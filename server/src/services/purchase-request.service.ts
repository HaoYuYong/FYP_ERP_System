import { pool } from '../config/database';
import { createLog, getTableId } from '../utils/logger';

/**
 * Create a purchase request header with associated line items and logging.
 * Handles the entire PR creation process: header + items + audit trail.
 */
export const createPurchaseRequest = async (
  data: {
    reference_no?: string;
    supplier_id?: number;
    remarks?: string;
    items: Array<{
      item_id?: number;
      item_name: string;
      item_description: string;
      uom?: string;
      pri_quantity: number;
    }>;
  },
  userId: string
) => {
  const client = await pool.connect();

  try {
    // Start transaction for atomicity - ensures all changes succeed or all fail.
    await client.query('BEGIN');

    // Get next PR number from sequence.
    const prNoResult = await client.query("SELECT 'PR-' || LPAD(nextval('seq_pr_no')::text, 6, '0') AS pr_no");
    const prNo = prNoResult.rows[0].pr_no;

    // Snapshot supplier details at creation time if supplier_id provided.
    let snapshotCompanyName = null;
    let snapshotRegisterNo  = null;
    let snapshotAddress     = null;
    let snapshotPhone       = null;
    let snapshotEmail       = null;

    if (data.supplier_id) {
      const supResult = await client.query(`
        SELECT s.company_name, s.register_no_new,
               ci.address, ci.city, ci.state, ci.country, ci.post_code,
               ci.phone, ci.email
        FROM supplier s
        LEFT JOIN contact_info ci ON s.contact_id = ci.contact_id
        WHERE s.supplier_id = $1
      `, [data.supplier_id]);
      const sup = supResult.rows[0];
      if (sup) {
        const addressParts = [sup.address, sup.city, sup.state, sup.country, sup.post_code].filter(Boolean);
        snapshotCompanyName = sup.company_name || null;
        snapshotRegisterNo  = sup.register_no_new || null;
        snapshotAddress     = addressParts.join(', ') || null;
        snapshotPhone       = sup.phone || null;
        snapshotEmail       = sup.email || null;
      }
    }

    // Insert purchase_request header record with supplier snapshot columns.
    const prQuery = `
      INSERT INTO purchase_request (
        pr_no, reference_no, supplier_id, remarks, status,
        supplier_company_name, supplier_register_no, supplier_address, supplier_phone, supplier_email
      )
      VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9)
      RETURNING pr_id, pr_no, reference_no, supplier_id, remarks, status,
                supplier_company_name, supplier_register_no, supplier_address, supplier_phone, supplier_email
    `;

    const prResult = await client.query(prQuery, [
      prNo,
      data.reference_no || null,
      data.supplier_id || null,
      data.remarks || null,
      snapshotCompanyName,
      snapshotRegisterNo,
      snapshotAddress,
      snapshotPhone,
      snapshotEmail,
    ]);

    const pr = prResult.rows[0];

    // Create log entry for the PR header.
    const tableId = await getTableId('purchase_request');
    const prLogId = await createLog({
      tableId,
      recordId: pr.pr_id,
      actionType: 'INSERT',
      actionBy: userId,
      changedData: {
        pr_no: pr.pr_no,
        reference_no: data.reference_no,
        supplier_id: data.supplier_id,
        remarks: data.remarks,
        status: 'draft',
      },
    });

    // Update PR with log_id reference.
    await client.query(
      'UPDATE purchase_request SET log_id = $1 WHERE pr_id = $2',
      [prLogId, pr.pr_id]
    );

    // Create line items for the PR.
    const items = [];
    const itemTableId = await getTableId('purchase_request_item');

    for (const item of data.items) {
      // Insert purchase_request_item line.
      const priQuery = `
        INSERT INTO purchase_request_item (pr_id, item_id, item_name, item_description, uom, pri_quantity)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING pri_id, pr_id, item_id, item_name, item_description, uom, pri_quantity
      `;

      const priResult = await client.query(priQuery, [
        pr.pr_id,
        item.item_id || null,
        item.item_name,
        item.item_description,
        item.uom || null,
        item.pri_quantity,
      ]);

      const lineItem = priResult.rows[0];
      items.push(lineItem);

      // Create log entry for the line item.
      const priLogId = await createLog({
        tableId: itemTableId,
        recordId: String(lineItem.pri_id),
        actionType: 'INSERT',
        actionBy: userId,
        changedData: {
          pr_id: pr.pr_id,
          item_id: item.item_id,
          item_name: item.item_name,
          item_description: item.item_description,
          uom: item.uom,
          pri_quantity: item.pri_quantity,
        },
      });

      // Update line item with log_id reference.
      await client.query(
        'UPDATE purchase_request_item SET log_id = $1 WHERE pri_id = $2',
        [priLogId, lineItem.pri_id]
      );
    }

    // Commit transaction - all changes are saved.
    await client.query('COMMIT');

    return {
      ...pr,
      log_id: prLogId,
      items,
    };
  } catch (error) {
    // Rollback transaction on error - nothing is saved.
    await client.query('ROLLBACK');
    console.error('Error creating purchase request:', error);
    throw error;
  } finally {
    // Always release the connection back to the pool.
    client.release();
  }
};

/**
 * Fetch all purchase requests with their associated line items and supplier snapshot columns.
 */
export const getPurchaseRequests = async () => {
  try {
    // Join PR header with line items; use COALESCE to prefer snapshot over live supplier name
    const query = `
      SELECT
        pr.pr_id,
        pr.pr_no,
        pr.reference_no,
        pr.terms,
        pr.supplier_id,
        pr.remarks,
        pr.status,
        COALESCE(pr.supplier_company_name, s.company_name) AS supplier_company_name,
        pr.supplier_register_no,
        pr.supplier_address,
        pr.supplier_phone,
        pr.supplier_email,
        json_agg(
          json_build_object(
            'pri_id', pri.pri_id,
            'item_id', pri.item_id,
            'item_name', pri.item_name,
            'item_description', pri.item_description,
            'uom', pri.uom,
            'pri_quantity', pri.pri_quantity
          ) ORDER BY pri.pri_id
        ) FILTER (WHERE pri.pri_id IS NOT NULL) AS items
      FROM purchase_request pr
      LEFT JOIN supplier s ON pr.supplier_id = s.supplier_id
      LEFT JOIN purchase_request_item pri ON pr.pr_id = pri.pr_id
      GROUP BY pr.pr_id, pr.pr_no, pr.reference_no, pr.terms, pr.supplier_id, pr.remarks, pr.status,
               pr.supplier_company_name, s.company_name, pr.supplier_register_no,
               pr.supplier_address, pr.supplier_phone, pr.supplier_email
      ORDER BY pr.pr_no DESC
    `;

    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('Error fetching purchase requests:', error);
    throw error;
  }
};

/**
 * Fetch all suppliers for dropdown selection (lightweight, create form use).
 */
export const getSuppliers = async () => {
  try {
    const query = 'SELECT supplier_id, company_name FROM supplier ORDER BY company_name';
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    throw error;
  }
};

/**
 * Fetch all suppliers with contact details for EditPanel Supplier tab.
 * Joins supplier with contact_info to get email, phone, address.
 */
export const getSuppliersWithDetails = async () => {
  try {
    const query = `
      SELECT s.supplier_id, s.company_name, s.register_no_new,
             ci.email, ci.phone, ci.address, ci.city, ci.state, ci.country, ci.post_code
      FROM supplier s
      LEFT JOIN contact_info ci ON s.contact_id = ci.contact_id
      ORDER BY s.company_name
    `;
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('Error fetching suppliers with details:', error);
    throw error;
  }
};

/**
 * Fetch all inventory items for dropdown selection.
 */
export const getInventoryItems = async () => {
  try {
    const query = 'SELECT item_id, item_name, description, uom FROM inventory ORDER BY item_name';
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    throw error;
  }
};

/**
 * Update a purchase request header and its line items with audit logging.
 * Updates supplier snapshot columns when supplier_id changes.
 */
export const updatePurchaseRequest = async (
  data: {
    pr_id: string;
    reference_no?: string;
    terms?: string;
    remarks?: string;
    status?: string;
    supplier_id?: number | null;
    items?: Array<{
      pri_id?: number;        // omitted for new items; present for existing items
      item_id?: number | null;
      item_name: string;
      item_description: string;
      uom?: string;
      pri_quantity: number;
    }>;
  },
  userId: string
) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify PR exists before updating
    const oldPRResult = await client.query(
      'SELECT * FROM purchase_request WHERE pr_id = $1',
      [data.pr_id]
    );
    if (oldPRResult.rows.length === 0) throw new Error('Purchase request not found');
    const oldPR = oldPRResult.rows[0];

    // Build dynamic SET clauses for header fields
    const headerFields: Record<string, any> = {};
    if (data.reference_no !== undefined) headerFields.reference_no = data.reference_no;
    if (data.terms !== undefined) headerFields.terms = data.terms;
    if (data.remarks !== undefined) headerFields.remarks = data.remarks;
    if (data.status !== undefined) headerFields.status = data.status;

    // Always re-snapshot supplier details when supplier_id is provided.
    // This ensures Refresh + Update writes the latest contact info even when the same supplier is kept.
    if (data.supplier_id !== undefined) {
      headerFields.supplier_id = data.supplier_id;
      if (data.supplier_id) {
        const supResult = await client.query(`
          SELECT s.company_name, s.register_no_new,
                 ci.address, ci.city, ci.state, ci.country, ci.post_code,
                 ci.phone, ci.email
          FROM supplier s
          LEFT JOIN contact_info ci ON s.contact_id = ci.contact_id
          WHERE s.supplier_id = $1
        `, [data.supplier_id]);
        const sup = supResult.rows[0];
        if (sup) {
          const addressParts = [sup.address, sup.city, sup.state, sup.country, sup.post_code].filter(Boolean);
          // Update snapshot columns to reflect new supplier
          headerFields.supplier_company_name = sup.company_name;
          headerFields.supplier_register_no   = sup.register_no_new;
          headerFields.supplier_address       = addressParts.join(', ') || null;
          headerFields.supplier_phone         = sup.phone;
          headerFields.supplier_email         = sup.email;
        }
      } else {
        // Clear all supplier fields when supplier is deselected
        headerFields.supplier_id             = null;
        headerFields.supplier_company_name   = null;
        headerFields.supplier_register_no    = null;
        headerFields.supplier_address        = null;
        headerFields.supplier_phone          = null;
        headerFields.supplier_email          = null;
      }
    }

    // Execute header update; use RETURNING * so we can store the real updated record in the log
    let updatedPR = oldPR; // Fallback to old record if nothing changed
    if (Object.keys(headerFields).length > 0) {
      const keys = Object.keys(headerFields);
      const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const updateResult = await client.query(
        `UPDATE purchase_request SET ${setClauses} WHERE pr_id = $1 RETURNING *`,
        [data.pr_id, ...Object.values(headerFields)]
      );
      updatedPR = updateResult.rows[0];
    }

    // Log PR header update — stores full record before and after (consistent with inventory logs)
    const prTableId = await getTableId('purchase_request');
    await createLog({
      tableId: prTableId,
      recordId: data.pr_id,
      actionType: 'UPDATE',
      actionBy: userId,
      changedData: { before: oldPR, after: updatedPR },
    });

    // Full-sync line items: INSERT new, UPDATE existing, DELETE removed
    if (data.items !== undefined) {
      const itemTableId = await getTableId('purchase_request_item');

      // Fetch all current items for this PR
      const existingResult = await client.query(
        'SELECT pri_id, item_id, item_name, item_description, uom, pri_quantity FROM purchase_request_item WHERE pr_id = $1',
        [data.pr_id]
      );
      const existingItems: any[] = existingResult.rows;

      // Build set of pri_ids that are still in the payload
      const keptPriIds = new Set(
        data.items.filter(i => i.pri_id).map(i => i.pri_id)
      );

      // DELETE items removed by the user (in DB but not in payload)
      for (const existing of existingItems) {
        if (!keptPriIds.has(existing.pri_id)) {
          await client.query('DELETE FROM purchase_request_item WHERE pri_id = $1', [existing.pri_id]);
          await createLog({
            tableId: itemTableId,
            recordId: String(existing.pri_id),
            actionType: 'DELETE',
            actionBy: userId,
            changedData: { before: existing, after: null },
          });
        }
      }

      for (const item of data.items) {
        const newItemId   = item.item_id || null;
        const newItemName = item.item_name;
        const newItemDesc = item.item_description || item.item_name;
        const newUom      = item.uom || null;
        const newQty      = item.pri_quantity;

        if (item.pri_id) {
          // UPDATE existing item
          const oldItem = existingItems.find(i => i.pri_id === item.pri_id);
          if (!oldItem) continue; // safety guard

          const itemChanged =
            String(oldItem.item_id)          !== String(newItemId)   ||
            oldItem.item_name                !== newItemName          ||
            oldItem.item_description         !== newItemDesc          ||
            oldItem.uom                      !== newUom               ||
            parseFloat(oldItem.pri_quantity) !== newQty;

          const updatedItemResult = await client.query(`
            UPDATE purchase_request_item
            SET item_id = $2, item_name = $3, item_description = $4, uom = $5, pri_quantity = $6
            WHERE pri_id = $1
            RETURNING pri_id, item_id, item_name, item_description, uom, pri_quantity
          `, [item.pri_id, newItemId, newItemName, newItemDesc, newUom, newQty]);

          if (itemChanged) {
            await createLog({
              tableId: itemTableId,
              recordId: String(item.pri_id),
              actionType: 'UPDATE',
              actionBy: userId,
              changedData: { before: oldItem, after: updatedItemResult.rows[0] },
            });
          }
        } else {
          // INSERT new item added via "Add Item"
          const insertResult = await client.query(`
            INSERT INTO purchase_request_item (pr_id, item_id, item_name, item_description, uom, pri_quantity)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING pri_id, item_id, item_name, item_description, uom, pri_quantity
          `, [data.pr_id, newItemId, newItemName, newItemDesc, newUom, newQty]);

          const newItem = insertResult.rows[0];
          const priLogId = await createLog({
            tableId: itemTableId,
            recordId: String(newItem.pri_id),
            actionType: 'INSERT',
            actionBy: userId,
            changedData: {
              pr_id: data.pr_id,
              item_id: newItemId,
              item_name: newItemName,
              item_description: newItemDesc,
              uom: newUom,
              pri_quantity: newQty,
            },
          });
          await client.query(
            'UPDATE purchase_request_item SET log_id = $1 WHERE pri_id = $2',
            [priLogId, newItem.pri_id]
          );
        }
      }
    }

    await client.query('COMMIT');
    return { pr_id: data.pr_id };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating purchase request:', error);
    throw error;
  } finally {
    client.release();
  }
};
