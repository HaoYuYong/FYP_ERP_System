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

    // Insert purchase_request header record.
    const prQuery = `
      INSERT INTO purchase_request (pr_no, reference_no, supplier_id, remarks, status)
      VALUES ($1, $2, $3, $4, 'draft')
      RETURNING pr_id, pr_no, reference_no, supplier_id, remarks, status
    `;

    const prResult = await client.query(prQuery, [
      prNo,
      data.reference_no || null,
      data.supplier_id || null,
      data.remarks || null,
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
 * Fetch all purchase requests with their associated line items.
 */
export const getPurchaseRequests = async () => {
  try {
    // Join PR header with its line items and supplier info, group by PR
    const query = `
      SELECT 
        pr.pr_id,
        pr.pr_no,
        pr.reference_no,
        pr.supplier_id,
        pr.remarks,
        pr.status,
        s.company_name AS supplier_company_name,
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
      GROUP BY pr.pr_id, pr.pr_no, pr.reference_no, pr.supplier_id, pr.remarks, pr.status, s.company_name
      ORDER BY pr.pr_id DESC
    `;

    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('Error fetching purchase requests:', error);
    throw error;
  }
};

/**
 * Fetch all suppliers for dropdown selection.
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
