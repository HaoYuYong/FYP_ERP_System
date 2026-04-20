import { pool } from '../config/database';
import { createLog, getTableId } from '../utils/logger';

/**
 * Create a purchase order header with line items and audit logging.
 */
export const createPurchaseOrder = async (
  data: {
    reference_no?: string;
    terms?: string;
    delivery_date?: string;
    supplier_id?: number;
    pr_id?: string;
    remarks?: string;
    items: Array<{
      item_id?: number;
      item_name: string;
      item_description: string;
      uom?: string;
      poi_quantity: number;
      unit_price?: number;
      discount?: number;
    }>;
  },
  userId: string
) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Generate PO number from sequence
    const poNoResult = await client.query(
      "SELECT 'PO-' || LPAD(nextval('seq_po_no')::text, 6, '0') AS po_no"
    );
    const poNo = poNoResult.rows[0].po_no;

    // Snapshot supplier details at creation time
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

    // Calculate total_amount from line items
    const totalAmount = data.items.reduce((sum, item) => {
      const lineTotal = (item.poi_quantity * (item.unit_price || 0)) - (item.discount || 0);
      return sum + Math.max(0, lineTotal);
    }, 0);

    // Insert PO header
    const poQuery = `
      INSERT INTO purchase_order (
        po_no, reference_no, terms, delivery_date, supplier_id, pr_id, remarks, status,
        total_amount, created_by, supplier_company_name, supplier_register_no,
        supplier_address, supplier_phone, supplier_email
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    const poResult = await client.query(poQuery, [
      poNo,
      data.reference_no || null,
      data.terms || null,
      data.delivery_date || null,
      data.supplier_id || null,
      data.pr_id || null,
      data.remarks || null,
      totalAmount,
      userId || null,
      snapshotCompanyName,
      snapshotRegisterNo,
      snapshotAddress,
      snapshotPhone,
      snapshotEmail,
    ]);
    const po = poResult.rows[0];

    // Audit log for PO header
    const tableId = await getTableId('purchase_order');
    const poLogId = await createLog({
      tableId,
      recordId: po.po_id,
      actionType: 'INSERT',
      actionBy: userId,
      changedData: {
        po_no: po.po_no,
        reference_no: data.reference_no,
        supplier_id: data.supplier_id,
        status: 'draft',
      },
    });
    await client.query('UPDATE purchase_order SET log_id = $1 WHERE po_id = $2', [poLogId, po.po_id]);

    // Insert line items
    const items = [];
    const itemTableId = await getTableId('purchase_order_item');

    for (const item of data.items) {
      const unitPrice = item.unit_price || 0;
      const discount  = item.discount  || 0;
      const lineTotal = Math.max(0, item.poi_quantity * unitPrice - discount);

      const poiQuery = `
        INSERT INTO purchase_order_item
          (po_id, item_id, item_name, item_description, uom, poi_quantity,
           unit_price, discount, line_total)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const poiResult = await client.query(poiQuery, [
        po.po_id,
        item.item_id || null,
        item.item_name,
        item.item_description || item.item_name,
        item.uom || null,
        item.poi_quantity,
        unitPrice,
        discount,
        lineTotal,
      ]);
      const lineItem = poiResult.rows[0];
      items.push(lineItem);

      const poiLogId = await createLog({
        tableId: itemTableId,
        recordId: String(lineItem.poi_id),
        actionType: 'INSERT',
        actionBy: userId,
        changedData: {
          po_id: po.po_id,
          item_id: item.item_id,
          item_name: item.item_name,
          poi_quantity: item.poi_quantity,
          unit_price: unitPrice,
          discount,
          line_total: lineTotal,
        },
      });
      await client.query(
        'UPDATE purchase_order_item SET log_id = $1 WHERE poi_id = $2',
        [poiLogId, lineItem.poi_id]
      );
    }

    await client.query('COMMIT');
    return { ...po, log_id: poLogId, items };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Fetch all purchase orders with their line items, ordered newest first.
 */
export const getPurchaseOrders = async () => {
  try {
    const query = `
      SELECT
        po.po_id,
        po.po_no,
        po.reference_no,
        po.terms,
        po.delivery_date,
        po.supplier_id,
        po.pr_id,
        po.remarks,
        po.status,
        po.total_amount,
        po.created_by,
        CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
        l.action_at AS created_at,
        COALESCE(po.supplier_company_name, s.company_name) AS supplier_company_name,
        po.supplier_register_no,
        po.supplier_address,
        po.supplier_phone,
        po.supplier_email,
        json_agg(
          json_build_object(
            'poi_id',            poi.poi_id,
            'item_id',           poi.item_id,
            'item_name',         poi.item_name,
            'item_description',  poi.item_description,
            'uom',               poi.uom,
            'poi_quantity',      poi.poi_quantity,
            'unit_price',        poi.unit_price,
            'discount',          poi.discount,
            'line_total',        poi.line_total,
            'received_quantity', poi.received_quantity,
            'quantity_added',    poi.quantity_added
          ) ORDER BY poi.poi_id
        ) FILTER (WHERE poi.poi_id IS NOT NULL) AS items
      FROM purchase_order po
      LEFT JOIN supplier s ON po.supplier_id = s.supplier_id
      LEFT JOIN purchase_order_item poi ON po.po_id = poi.po_id
      LEFT JOIN users u ON po.created_by = u.auth_id
      LEFT JOIN log l ON po.log_id = l.log_id
      GROUP BY po.po_id, po.po_no, po.reference_no, po.terms, po.delivery_date,
               po.supplier_id, po.pr_id, po.remarks, po.status, po.total_amount,
               po.created_by, u.first_name, u.last_name, l.action_at,
               po.supplier_company_name, s.company_name, po.supplier_register_no,
               po.supplier_address, po.supplier_phone, po.supplier_email
      ORDER BY po.po_no DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    throw error;
  }
};

/**
 * Fetch suppliers with contact details for dropdown.
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
    throw error;
  }
};

/**
 * Fetch all inventory items for dropdown.
 */
export const getInventoryItems = async () => {
  try {
    const result = await pool.query(
      'SELECT item_id, item_name, description, uom FROM inventory ORDER BY item_name'
    );
    return result.rows;
  } catch (error) {
    throw error;
  }
};

/**
 * Update a purchase order header and line items with audit logging.
 * Always re-snapshots supplier when supplier_id is in the payload.
 * Full-syncs items: DELETE removed, UPDATE existing, INSERT new.
 */
export const updatePurchaseOrder = async (
  data: {
    po_id: string;
    reference_no?: string;
    terms?: string;
    delivery_date?: string;
    remarks?: string;
    status?: string;
    supplier_id?: number | null;
    items?: Array<{
      poi_id?: number;
      item_id?: number | null;
      item_name: string;
      item_description: string;
      uom?: string;
      poi_quantity: number;
      unit_price?: number;
      discount?: number;
      received_quantity?: number;
    }>;
  },
  userId: string
) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify PO exists
    const oldPOResult = await client.query(
      'SELECT * FROM purchase_order WHERE po_id = $1',
      [data.po_id]
    );
    if (oldPOResult.rows.length === 0) throw new Error('Purchase order not found');
    const oldPO = oldPOResult.rows[0];

    // Build header update fields
    const headerFields: Record<string, any> = {};
    if (data.reference_no !== undefined) headerFields.reference_no = data.reference_no;
    if (data.terms        !== undefined) headerFields.terms        = data.terms;
    if (data.delivery_date !== undefined) headerFields.delivery_date = data.delivery_date || null;
    if (data.remarks      !== undefined) headerFields.remarks      = data.remarks;
    if (data.status       !== undefined) headerFields.status       = data.status;

    // Always re-snapshot supplier when supplier_id is in payload
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
          headerFields.supplier_company_name = sup.company_name;
          headerFields.supplier_register_no  = sup.register_no_new;
          headerFields.supplier_address      = addressParts.join(', ') || null;
          headerFields.supplier_phone        = sup.phone;
          headerFields.supplier_email        = sup.email;
        }
      } else {
        headerFields.supplier_id             = null;
        headerFields.supplier_company_name   = null;
        headerFields.supplier_register_no    = null;
        headerFields.supplier_address        = null;
        headerFields.supplier_phone          = null;
        headerFields.supplier_email          = null;
      }
    }

    let updatedPO = oldPO;
    if (Object.keys(headerFields).length > 0) {
      const keys = Object.keys(headerFields);
      const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const updateResult = await client.query(
        `UPDATE purchase_order SET ${setClauses} WHERE po_id = $1 RETURNING *`,
        [data.po_id, ...Object.values(headerFields)]
      );
      updatedPO = updateResult.rows[0];
    }

    // Audit log for PO header
    const poTableId = await getTableId('purchase_order');
    await createLog({
      tableId: poTableId,
      recordId: data.po_id,
      actionType: 'UPDATE',
      actionBy: userId,
      changedData: { before: oldPO, after: updatedPO },
    });

    // Full-sync line items
    if (data.items !== undefined) {
      const itemTableId = await getTableId('purchase_order_item');

      const existingResult = await client.query(
        `SELECT poi_id, item_id, item_name, item_description, uom,
                poi_quantity, unit_price, discount, line_total, received_quantity
         FROM purchase_order_item WHERE po_id = $1`,
        [data.po_id]
      );
      const existingItems: any[] = existingResult.rows;

      const keptPoiIds = new Set(
        data.items.filter(i => i.poi_id).map(i => i.poi_id)
      );

      // DELETE items removed by the user
      for (const existing of existingItems) {
        if (!keptPoiIds.has(existing.poi_id)) {
          await client.query('DELETE FROM purchase_order_item WHERE poi_id = $1', [existing.poi_id]);
          await createLog({
            tableId: itemTableId,
            recordId: String(existing.poi_id),
            actionType: 'DELETE',
            actionBy: userId,
            changedData: { before: existing, after: null },
          });
        }
      }

      let newTotalAmount = 0;

      for (const item of data.items) {
        const newItemId   = item.item_id || null;
        const newItemName = item.item_name;
        const newItemDesc = item.item_description || item.item_name;
        const newUom      = item.uom || null;
        const newQty      = item.poi_quantity;
        const newPrice    = item.unit_price  ?? 0;
        const newDiscount = item.discount    ?? 0;
        const newLineTotal = Math.max(0, newQty * newPrice - newDiscount);

        newTotalAmount += newLineTotal;

        if (item.poi_id) {
          // UPDATE existing item
          const oldItem = existingItems.find(i => i.poi_id === item.poi_id);
          if (!oldItem) continue;

          const newReceivedQty = item.received_quantity !== undefined
            ? item.received_quantity
            : parseFloat(oldItem.received_quantity ?? 0);

          const itemChanged =
            String(oldItem.item_id)          !== String(newItemId)   ||
            oldItem.item_name                !== newItemName          ||
            oldItem.item_description         !== newItemDesc          ||
            oldItem.uom                      !== newUom               ||
            parseFloat(oldItem.poi_quantity) !== newQty               ||
            parseFloat(oldItem.unit_price)   !== newPrice             ||
            parseFloat(oldItem.discount)     !== newDiscount          ||
            parseFloat(oldItem.received_quantity ?? 0) !== newReceivedQty;

          const updatedItemResult = await client.query(`
            UPDATE purchase_order_item
            SET item_id = $2, item_name = $3, item_description = $4,
                uom = $5, poi_quantity = $6, unit_price = $7, discount = $8, line_total = $9,
                received_quantity = $10
            WHERE poi_id = $1
            RETURNING *
          `, [item.poi_id, newItemId, newItemName, newItemDesc, newUom, newQty, newPrice, newDiscount, newLineTotal, newReceivedQty]);

          if (itemChanged) {
            await createLog({
              tableId: itemTableId,
              recordId: String(item.poi_id),
              actionType: 'UPDATE',
              actionBy: userId,
              changedData: { before: oldItem, after: updatedItemResult.rows[0] },
            });
          }
        } else {
          // INSERT new item
          const insertResult = await client.query(`
            INSERT INTO purchase_order_item
              (po_id, item_id, item_name, item_description, uom,
               poi_quantity, unit_price, discount, line_total)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
          `, [data.po_id, newItemId, newItemName, newItemDesc, newUom, newQty, newPrice, newDiscount, newLineTotal]);

          const newItem = insertResult.rows[0];
          const poiLogId = await createLog({
            tableId: itemTableId,
            recordId: String(newItem.poi_id),
            actionType: 'INSERT',
            actionBy: userId,
            changedData: {
              po_id: data.po_id, item_id: newItemId, item_name: newItemName,
              poi_quantity: newQty, unit_price: newPrice, discount: newDiscount, line_total: newLineTotal,
            },
          });
          await client.query(
            'UPDATE purchase_order_item SET log_id = $1 WHERE poi_id = $2',
            [poiLogId, newItem.poi_id]
          );
        }
      }

      // Recalculate and update total_amount on header
      await client.query(
        'UPDATE purchase_order SET total_amount = $1 WHERE po_id = $2',
        [newTotalAmount, data.po_id]
      );

      // Push stock movements when PO status is 'received'
      const finalStatus = (headerFields.status as string | undefined) ?? oldPO.status;
      if (finalStatus === 'received') {
        const inventoryTableId = await getTableId('inventory');
        const smTableId = await getTableId('stock_movement');

        const updatedItems = await client.query(
          `SELECT poi_id, item_id, received_quantity, quantity_added
           FROM purchase_order_item WHERE po_id = $1`,
          [data.po_id]
        );

        for (const poi of updatedItems.rows) {
          if (!poi.item_id) continue;
          const delta = parseFloat(poi.received_quantity) - parseFloat(poi.quantity_added);
          if (delta <= 0) continue;

          const invResult = await client.query(
            `SELECT quantity FROM inventory WHERE item_id = $1 FOR UPDATE`,
            [poi.item_id]
          );
          if (!invResult.rows.length) continue;

          const qtyBefore = parseFloat(invResult.rows[0].quantity);
          const qtyAfter  = qtyBefore + delta;

          await client.query(
            `UPDATE inventory SET quantity = $1 WHERE item_id = $2`,
            [qtyAfter, poi.item_id]
          );

          const smResult = await client.query(`
            INSERT INTO stock_movement
              (item_id, movement_type, quantity_change, quantity_before, quantity_after, poi_id)
            VALUES ($1, 'po_receipt', $2, $3, $4, $5)
            RETURNING movement_id
          `, [poi.item_id, delta, qtyBefore, qtyAfter, poi.poi_id]);

          const smLogId = await createLog({
            tableId: smTableId,
            recordId: String(smResult.rows[0].movement_id),
            actionType: 'INSERT',
            actionBy: userId,
            changedData: {
              item_id: poi.item_id,
              movement_type: 'po_receipt',
              quantity_change: delta,
              quantity_before: qtyBefore,
              quantity_after: qtyAfter,
              poi_id: poi.poi_id,
            },
          });
          await client.query(
            `UPDATE stock_movement SET log_id = $1 WHERE movement_id = $2`,
            [smLogId, smResult.rows[0].movement_id]
          );

          await createLog({
            tableId: inventoryTableId,
            recordId: String(poi.item_id),
            actionType: 'UPDATE',
            actionBy: userId,
            changedData: {
              quantity_before: qtyBefore,
              quantity_after: qtyAfter,
              source: 'po_receipt',
              po_id: data.po_id,
              poi_id: poi.poi_id,
            },
          });

          await client.query(
            `UPDATE purchase_order_item SET quantity_added = $1 WHERE poi_id = $2`,
            [poi.received_quantity, poi.poi_id]
          );
        }
      }
    }

    await client.query('COMMIT');
    return { po_id: data.po_id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
