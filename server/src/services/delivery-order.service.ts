import { pool } from '../config/database';
import { createLog, getTableId } from '../utils/logger';

/**
 * Create a delivery order header with associated line items and logging.
 */
export const createDeliveryOrder = async (
  data: {
    reference_no?: string;
    terms?: string;
    delivery_date?: string;
    customer_id?: number;
    remarks?: string;
    pi_id?: string;
    items: Array<{
      item_id?: number;
      item_name: string;
      item_description: string;
      uom?: string;
      do_quantity: number;
      unit_price: number;
      discount: number;
      line_total: number;
    }>;
  },
  userId: string
) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Safety check: if pi_id given, ensure PI is paid and not already linked.
    if (data.pi_id) {
      const piCheck = await client.query(
        'SELECT status, generated_do_id FROM proforma_invoice WHERE pi_id = $1 FOR UPDATE',
        [data.pi_id]
      );
      if (!piCheck.rows[0]) {
        throw new Error('Proforma invoice not found');
      }
      if (piCheck.rows[0].status !== 'paid') {
        throw new Error('Proforma invoice must be in Paid status to generate a delivery order');
      }
      if (piCheck.rows[0].generated_do_id !== null) {
        throw new Error('This proforma invoice has already been used to generate a delivery order');
      }
    }

    // Get next DO number from sequence.
    const doNoResult = await client.query(
      "SELECT 'DO-' || LPAD(nextval('seq_do_no')::text, 6, '0') AS do_no"
    );
    const doNo = doNoResult.rows[0].do_no;

    // Snapshot customer details at creation time.
    let snapshotCompanyName = null;
    let snapshotRegisterNo  = null;
    let snapshotAddress     = null;
    let snapshotPhone       = null;
    let snapshotEmail       = null;

    if (data.customer_id) {
      const custResult = await client.query(`
        SELECT c.company_name, c.register_no_new,
               ci.address, ci.city, ci.state, ci.country, ci.post_code,
               ci.phone, ci.email
        FROM customer c
        LEFT JOIN contact_info ci ON c.contact_id = ci.contact_id
        WHERE c.customer_id = $1
      `, [data.customer_id]);
      const cust = custResult.rows[0];
      if (cust) {
        const addressParts = [cust.address, cust.city, cust.state, cust.country, cust.post_code].filter(Boolean);
        snapshotCompanyName = cust.company_name || null;
        snapshotRegisterNo  = cust.register_no_new || null;
        snapshotAddress     = addressParts.join(', ') || null;
        snapshotPhone       = cust.phone || null;
        snapshotEmail       = cust.email || null;
      }
    }

    const totalAmount = data.items.reduce((sum, item) => sum + (item.line_total || 0), 0);

    const doQuery = `
      INSERT INTO delivery_order (
        do_no, reference_no, terms, delivery_date, customer_id, remarks, status, total_amount, created_by,
        customer_company_name, customer_register_no, customer_address, customer_phone, customer_email,
        pi_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING do_id, do_no, reference_no, terms, delivery_date, customer_id, remarks, status, total_amount, created_by,
                customer_company_name, customer_register_no, customer_address, customer_phone, customer_email,
                pi_id
    `;

    const doResult = await client.query(doQuery, [
      doNo,
      data.reference_no || null,
      data.terms || null,
      data.delivery_date || null,
      data.customer_id || null,
      data.remarks || null,
      totalAmount,
      userId || null,
      snapshotCompanyName,
      snapshotRegisterNo,
      snapshotAddress,
      snapshotPhone,
      snapshotEmail,
      data.pi_id || null,
    ]);

    const deliveryOrder = doResult.rows[0];

    // Log delivery order header creation.
    const tableId = await getTableId('delivery_order');
    const doLogId = await createLog({
      tableId,
      recordId: deliveryOrder.do_id,
      actionType: 'INSERT',
      actionBy: userId,
      changedData: {
        do_no: deliveryOrder.do_no,
        reference_no: data.reference_no,
        terms: data.terms,
        delivery_date: data.delivery_date,
        customer_id: data.customer_id,
        remarks: data.remarks,
        status: 'draft',
        total_amount: totalAmount,
        pi_id: data.pi_id || null,
      },
    });

    await client.query(
      'UPDATE delivery_order SET log_id = $1 WHERE do_id = $2',
      [doLogId, deliveryOrder.do_id]
    );

    // Create line items.
    const items = [];
    const itemTableId = await getTableId('delivery_order_item');

    for (const item of data.items) {
      const doiQuery = `
        INSERT INTO delivery_order_item (do_id, item_id, item_name, item_description, uom, do_quantity, unit_price, discount, line_total)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING doi_id, do_id, item_id, item_name, item_description, uom, do_quantity, unit_price, discount, line_total
      `;

      const doiResult = await client.query(doiQuery, [
        deliveryOrder.do_id,
        item.item_id || null,
        item.item_name,
        item.item_description,
        item.uom || null,
        item.do_quantity,
        item.unit_price,
        item.discount,
        item.line_total,
      ]);

      const lineItem = doiResult.rows[0];
      items.push(lineItem);

      const doiLogId = await createLog({
        tableId: itemTableId,
        recordId: String(lineItem.doi_id),
        actionType: 'INSERT',
        actionBy: userId,
        changedData: {
          do_id: deliveryOrder.do_id,
          item_id: item.item_id,
          item_name: item.item_name,
          item_description: item.item_description,
          uom: item.uom,
          do_quantity: item.do_quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          line_total: item.line_total,
        },
      });

      await client.query(
        'UPDATE delivery_order_item SET log_id = $1 WHERE doi_id = $2',
        [doiLogId, lineItem.doi_id]
      );
    }

    // If generated from a PI, mark that PI as linked.
    if (data.pi_id) {
      await client.query(
        'UPDATE proforma_invoice SET generated_do_id = $1 WHERE pi_id = $2',
        [deliveryOrder.do_id, data.pi_id]
      );
    }

    await client.query('COMMIT');
    return { ...deliveryOrder, log_id: doLogId, items };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Fetch all delivery orders with their associated line items.
 */
export const getDeliveryOrders = async () => {
  try {
    const query = `
      SELECT
        d.do_id,
        d.do_no,
        d.reference_no,
        d.terms,
        d.delivery_date,
        d.customer_id,
        d.pi_id,
        d.remarks,
        d.status,
        d.total_amount,
        d.created_by,
        CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
        l.action_at AS created_at,
        COALESCE(d.customer_company_name, c.company_name) AS customer_company_name,
        d.customer_register_no,
        d.customer_address,
        d.customer_phone,
        d.customer_email,
        json_agg(
          json_build_object(
            'doi_id',           doi.doi_id,
            'item_id',          doi.item_id,
            'item_name',        doi.item_name,
            'item_description', doi.item_description,
            'uom',              doi.uom,
            'do_quantity',      doi.do_quantity,
            'unit_price',       doi.unit_price,
            'discount',         doi.discount,
            'line_total',       doi.line_total
          ) ORDER BY doi.doi_id
        ) FILTER (WHERE doi.doi_id IS NOT NULL) AS items
      FROM delivery_order d
      LEFT JOIN customer c ON d.customer_id = c.customer_id
      LEFT JOIN delivery_order_item doi ON d.do_id = doi.do_id
      LEFT JOIN users u ON d.created_by = u.auth_id
      LEFT JOIN log l ON d.log_id = l.log_id
      GROUP BY d.do_id, d.do_no, d.reference_no, d.terms, d.delivery_date, d.customer_id, d.pi_id,
               d.remarks, d.status, d.total_amount, d.created_by, u.first_name, u.last_name, l.action_at,
               d.customer_company_name, c.company_name, d.customer_register_no,
               d.customer_address, d.customer_phone, d.customer_email
      ORDER BY d.do_no DESC
    `;

    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    throw error;
  }
};

/**
 * Fetch all customers with contact details for dropdown and display.
 */
export const getCustomersWithDetails = async () => {
  try {
    const query = `
      SELECT c.customer_id, c.company_name, c.register_no_new,
             ci.email, ci.phone, ci.address, ci.city, ci.state, ci.country, ci.post_code
      FROM customer c
      LEFT JOIN contact_info ci ON c.contact_id = ci.contact_id
      ORDER BY c.company_name
    `;
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
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
    throw error;
  }
};

/**
 * Update a delivery order header and its line items with audit logging.
 */
export const updateDeliveryOrder = async (
  data: {
    do_id: string;
    reference_no?: string;
    terms?: string;
    delivery_date?: string | null;
    remarks?: string;
    status?: string;
    customer_id?: number | null;
    total_amount?: number;
    items?: Array<{
      doi_id?: number;
      item_id?: number | null;
      item_name: string;
      item_description: string;
      uom?: string;
      do_quantity: number;
      unit_price: number;
      discount: number;
      line_total: number;
    }>;
  },
  userId: string
) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const oldDoResult = await client.query(
      'SELECT * FROM delivery_order WHERE do_id = $1',
      [data.do_id]
    );
    if (oldDoResult.rows.length === 0) throw new Error('Delivery order not found');
    const oldDo = oldDoResult.rows[0];

    const headerFields: Record<string, any> = {};
    if (data.reference_no !== undefined) headerFields.reference_no = data.reference_no;
    if (data.terms !== undefined) headerFields.terms = data.terms;
    if (data.delivery_date !== undefined) headerFields.delivery_date = data.delivery_date || null;
    if (data.remarks !== undefined) headerFields.remarks = data.remarks;
    if (data.status !== undefined) headerFields.status = data.status;
    if (data.total_amount !== undefined) headerFields.total_amount = data.total_amount;

    if (data.customer_id !== undefined) {
      headerFields.customer_id = data.customer_id;
      if (data.customer_id) {
        const custResult = await client.query(`
          SELECT c.company_name, c.register_no_new,
                 ci.address, ci.city, ci.state, ci.country, ci.post_code,
                 ci.phone, ci.email
          FROM customer c
          LEFT JOIN contact_info ci ON c.contact_id = ci.contact_id
          WHERE c.customer_id = $1
        `, [data.customer_id]);
        const cust = custResult.rows[0];
        if (cust) {
          const addressParts = [cust.address, cust.city, cust.state, cust.country, cust.post_code].filter(Boolean);
          headerFields.customer_company_name = cust.company_name;
          headerFields.customer_register_no  = cust.register_no_new;
          headerFields.customer_address      = addressParts.join(', ') || null;
          headerFields.customer_phone        = cust.phone;
          headerFields.customer_email        = cust.email;
        }
      } else {
        headerFields.customer_id             = null;
        headerFields.customer_company_name   = null;
        headerFields.customer_register_no    = null;
        headerFields.customer_address        = null;
        headerFields.customer_phone          = null;
        headerFields.customer_email          = null;
      }
    }

    let updatedDo = oldDo;
    if (Object.keys(headerFields).length > 0) {
      const keys = Object.keys(headerFields);
      const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const updateResult = await client.query(
        `UPDATE delivery_order SET ${setClauses} WHERE do_id = $1 RETURNING *`,
        [data.do_id, ...Object.values(headerFields)]
      );
      updatedDo = updateResult.rows[0];
    }

    const doTableId = await getTableId('delivery_order');
    await createLog({
      tableId: doTableId,
      recordId: data.do_id,
      actionType: 'UPDATE',
      actionBy: userId,
      changedData: { before: oldDo, after: updatedDo },
    });

    if (data.items !== undefined) {
      const itemTableId = await getTableId('delivery_order_item');

      const existingResult = await client.query(
        'SELECT doi_id, item_id, item_name, item_description, uom, do_quantity, unit_price, discount, line_total FROM delivery_order_item WHERE do_id = $1',
        [data.do_id]
      );
      const existingItems: any[] = existingResult.rows;

      const keptDoiIds = new Set(
        data.items.filter(i => i.doi_id).map(i => i.doi_id)
      );

      for (const existing of existingItems) {
        if (!keptDoiIds.has(existing.doi_id)) {
          await client.query('DELETE FROM delivery_order_item WHERE doi_id = $1', [existing.doi_id]);
          await createLog({
            tableId: itemTableId,
            recordId: String(existing.doi_id),
            actionType: 'DELETE',
            actionBy: userId,
            changedData: { before: existing, after: null },
          });
        }
      }

      for (const item of data.items) {
        const newItemId    = item.item_id || null;
        const newItemName  = item.item_name;
        const newItemDesc  = item.item_description || item.item_name;
        const newUom       = item.uom || null;
        const newQty       = item.do_quantity;
        const newUnitPrice = item.unit_price;
        const newDiscount  = item.discount;
        const newLineTotal = item.line_total;

        if (item.doi_id) {
          const oldItem = existingItems.find(i => i.doi_id === item.doi_id);
          if (!oldItem) continue;

          const itemChanged =
            String(oldItem.item_id)           !== String(newItemId)   ||
            oldItem.item_name                 !== newItemName          ||
            oldItem.item_description          !== newItemDesc          ||
            oldItem.uom                       !== newUom               ||
            parseFloat(oldItem.do_quantity)  !== newQty               ||
            parseFloat(oldItem.unit_price)    !== newUnitPrice         ||
            parseFloat(oldItem.discount)      !== newDiscount          ||
            parseFloat(oldItem.line_total)    !== newLineTotal;

          const updatedItemResult = await client.query(`
            UPDATE delivery_order_item
            SET item_id = $2, item_name = $3, item_description = $4, uom = $5,
                do_quantity = $6, unit_price = $7, discount = $8, line_total = $9
            WHERE doi_id = $1
            RETURNING doi_id, item_id, item_name, item_description, uom, do_quantity, unit_price, discount, line_total
          `, [item.doi_id, newItemId, newItemName, newItemDesc, newUom, newQty, newUnitPrice, newDiscount, newLineTotal]);

          if (itemChanged) {
            await createLog({
              tableId: itemTableId,
              recordId: String(item.doi_id),
              actionType: 'UPDATE',
              actionBy: userId,
              changedData: { before: oldItem, after: updatedItemResult.rows[0] },
            });
          }
        } else {
          const insertResult = await client.query(`
            INSERT INTO delivery_order_item (do_id, item_id, item_name, item_description, uom, do_quantity, unit_price, discount, line_total)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING doi_id, item_id, item_name, item_description, uom, do_quantity, unit_price, discount, line_total
          `, [data.do_id, newItemId, newItemName, newItemDesc, newUom, newQty, newUnitPrice, newDiscount, newLineTotal]);

          const newItem = insertResult.rows[0];
          const doiLogId = await createLog({
            tableId: itemTableId,
            recordId: String(newItem.doi_id),
            actionType: 'INSERT',
            actionBy: userId,
            changedData: {
              do_id: data.do_id,
              item_id: newItemId,
              item_name: newItemName,
              item_description: newItemDesc,
              uom: newUom,
              do_quantity: newQty,
              unit_price: newUnitPrice,
              discount: newDiscount,
              line_total: newLineTotal,
            },
          });
          await client.query(
            'UPDATE delivery_order_item SET log_id = $1 WHERE doi_id = $2',
            [doiLogId, newItem.doi_id]
          );
        }
      }
    }

    await client.query('COMMIT');
    return { do_id: data.do_id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
