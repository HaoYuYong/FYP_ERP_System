import { pool } from '../config/database';
import { createLog, getTableId } from '../utils/logger';

/**
 * Create a quotation header with associated line items and logging.
 */
export const createQuotation = async (
  data: {
    reference_no?: string;
    terms?: string;
    customer_id?: number;
    remarks?: string;
    items: Array<{
      item_id?: number;
      item_name: string;
      item_description: string;
      uom?: string;
      qi_quantity: number;
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

    // Get next QUOT number from sequence.
    const quotNoResult = await client.query(
      "SELECT 'QUOT-' || LPAD(nextval('seq_quot_no')::text, 6, '0') AS quot_no"
    );
    const quotNo = quotNoResult.rows[0].quot_no;

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

    // Compute total_amount from items.
    const totalAmount = data.items.reduce((sum, item) => sum + (item.line_total || 0), 0);

    // Insert quotation header.
    const quotQuery = `
      INSERT INTO quotation (
        quot_no, reference_no, terms, customer_id, remarks, status, total_amount, created_by,
        customer_company_name, customer_register_no, customer_address, customer_phone, customer_email
      )
      VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, $10, $11, $12)
      RETURNING quot_id, quot_no, reference_no, terms, customer_id, remarks, status, total_amount, created_by,
                customer_company_name, customer_register_no, customer_address, customer_phone, customer_email
    `;

    const quotResult = await client.query(quotQuery, [
      quotNo,
      data.reference_no || null,
      data.terms || null,
      data.customer_id || null,
      data.remarks || null,
      totalAmount,
      userId || null,
      snapshotCompanyName,
      snapshotRegisterNo,
      snapshotAddress,
      snapshotPhone,
      snapshotEmail,
    ]);

    const quot = quotResult.rows[0];

    // Log quotation header creation.
    const tableId = await getTableId('quotation');
    const quotLogId = await createLog({
      tableId,
      recordId: quot.quot_id,
      actionType: 'INSERT',
      actionBy: userId,
      changedData: {
        quot_no: quot.quot_no,
        reference_no: data.reference_no,
        terms: data.terms,
        customer_id: data.customer_id,
        remarks: data.remarks,
        status: 'draft',
        total_amount: totalAmount,
      },
    });

    await client.query(
      'UPDATE quotation SET log_id = $1 WHERE quot_id = $2',
      [quotLogId, quot.quot_id]
    );

    // Create line items.
    const items = [];
    const itemTableId = await getTableId('quotation_item');

    for (const item of data.items) {
      const qiQuery = `
        INSERT INTO quotation_item (quot_id, item_id, item_name, item_description, uom, qi_quantity, unit_price, discount, line_total)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING qi_id, quot_id, item_id, item_name, item_description, uom, qi_quantity, unit_price, discount, line_total
      `;

      const qiResult = await client.query(qiQuery, [
        quot.quot_id,
        item.item_id || null,
        item.item_name,
        item.item_description,
        item.uom || null,
        item.qi_quantity,
        item.unit_price,
        item.discount,
        item.line_total,
      ]);

      const lineItem = qiResult.rows[0];
      items.push(lineItem);

      const qiLogId = await createLog({
        tableId: itemTableId,
        recordId: String(lineItem.qi_id),
        actionType: 'INSERT',
        actionBy: userId,
        changedData: {
          quot_id: quot.quot_id,
          item_id: item.item_id,
          item_name: item.item_name,
          item_description: item.item_description,
          uom: item.uom,
          qi_quantity: item.qi_quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          line_total: item.line_total,
        },
      });

      await client.query(
        'UPDATE quotation_item SET log_id = $1 WHERE qi_id = $2',
        [qiLogId, lineItem.qi_id]
      );
    }

    await client.query('COMMIT');
    return { ...quot, log_id: quotLogId, items };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Fetch all quotations with their associated line items.
 */
export const getQuotations = async () => {
  try {
    const query = `
      SELECT
        q.quot_id,
        q.quot_no,
        q.reference_no,
        q.terms,
        q.customer_id,
        q.remarks,
        q.status,
        q.total_amount,
        q.generated_so_id,
        q.created_by,
        CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
        l.action_at AS created_at,
        COALESCE(q.customer_company_name, c.company_name) AS customer_company_name,
        q.customer_register_no,
        q.customer_address,
        q.customer_phone,
        q.customer_email,
        json_agg(
          json_build_object(
            'qi_id',            qi.qi_id,
            'item_id',          qi.item_id,
            'item_name',        qi.item_name,
            'item_description', qi.item_description,
            'uom',              qi.uom,
            'qi_quantity',      qi.qi_quantity,
            'unit_price',       qi.unit_price,
            'discount',         qi.discount,
            'line_total',       qi.line_total
          ) ORDER BY qi.qi_id
        ) FILTER (WHERE qi.qi_id IS NOT NULL) AS items
      FROM quotation q
      LEFT JOIN customer c ON q.customer_id = c.customer_id
      LEFT JOIN quotation_item qi ON q.quot_id = qi.quot_id
      LEFT JOIN users u ON q.created_by = u.auth_id
      LEFT JOIN log l ON q.log_id = l.log_id
      GROUP BY q.quot_id, q.quot_no, q.reference_no, q.terms, q.customer_id, q.remarks, q.status,
               q.total_amount, q.generated_so_id, q.created_by, u.first_name, u.last_name, l.action_at,
               q.customer_company_name, c.company_name, q.customer_register_no,
               q.customer_address, q.customer_phone, q.customer_email
      ORDER BY q.quot_no DESC
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
 * Update a quotation header and its line items with audit logging.
 */
export const updateQuotation = async (
  data: {
    quot_id: string;
    reference_no?: string;
    terms?: string;
    remarks?: string;
    status?: string;
    customer_id?: number | null;
    total_amount?: number;
    items?: Array<{
      qi_id?: number;
      item_id?: number | null;
      item_name: string;
      item_description: string;
      uom?: string;
      qi_quantity: number;
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

    const oldQuotResult = await client.query(
      'SELECT * FROM quotation WHERE quot_id = $1',
      [data.quot_id]
    );
    if (oldQuotResult.rows.length === 0) throw new Error('Quotation not found');
    const oldQuot = oldQuotResult.rows[0];

    const headerFields: Record<string, any> = {};
    if (data.reference_no !== undefined) headerFields.reference_no = data.reference_no;
    if (data.terms !== undefined) headerFields.terms = data.terms;
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

    let updatedQuot = oldQuot;
    if (Object.keys(headerFields).length > 0) {
      const keys = Object.keys(headerFields);
      const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const updateResult = await client.query(
        `UPDATE quotation SET ${setClauses} WHERE quot_id = $1 RETURNING *`,
        [data.quot_id, ...Object.values(headerFields)]
      );
      updatedQuot = updateResult.rows[0];
    }

    const quotTableId = await getTableId('quotation');
    await createLog({
      tableId: quotTableId,
      recordId: data.quot_id,
      actionType: 'UPDATE',
      actionBy: userId,
      changedData: { before: oldQuot, after: updatedQuot },
    });

    if (data.items !== undefined) {
      const itemTableId = await getTableId('quotation_item');

      const existingResult = await client.query(
        'SELECT qi_id, item_id, item_name, item_description, uom, qi_quantity, unit_price, discount, line_total FROM quotation_item WHERE quot_id = $1',
        [data.quot_id]
      );
      const existingItems: any[] = existingResult.rows;

      const keptQiIds = new Set(
        data.items.filter(i => i.qi_id).map(i => i.qi_id)
      );

      for (const existing of existingItems) {
        if (!keptQiIds.has(existing.qi_id)) {
          await client.query('DELETE FROM quotation_item WHERE qi_id = $1', [existing.qi_id]);
          await createLog({
            tableId: itemTableId,
            recordId: String(existing.qi_id),
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
        const newQty      = item.qi_quantity;
        const newUnitPrice = item.unit_price;
        const newDiscount  = item.discount;
        const newLineTotal = item.line_total;

        if (item.qi_id) {
          const oldItem = existingItems.find(i => i.qi_id === item.qi_id);
          if (!oldItem) continue;

          const itemChanged =
            String(oldItem.item_id)          !== String(newItemId)   ||
            oldItem.item_name                !== newItemName          ||
            oldItem.item_description         !== newItemDesc          ||
            oldItem.uom                      !== newUom               ||
            parseFloat(oldItem.qi_quantity)  !== newQty               ||
            parseFloat(oldItem.unit_price)   !== newUnitPrice         ||
            parseFloat(oldItem.discount)     !== newDiscount          ||
            parseFloat(oldItem.line_total)   !== newLineTotal;

          const updatedItemResult = await client.query(`
            UPDATE quotation_item
            SET item_id = $2, item_name = $3, item_description = $4, uom = $5,
                qi_quantity = $6, unit_price = $7, discount = $8, line_total = $9
            WHERE qi_id = $1
            RETURNING qi_id, item_id, item_name, item_description, uom, qi_quantity, unit_price, discount, line_total
          `, [item.qi_id, newItemId, newItemName, newItemDesc, newUom, newQty, newUnitPrice, newDiscount, newLineTotal]);

          if (itemChanged) {
            await createLog({
              tableId: itemTableId,
              recordId: String(item.qi_id),
              actionType: 'UPDATE',
              actionBy: userId,
              changedData: { before: oldItem, after: updatedItemResult.rows[0] },
            });
          }
        } else {
          const insertResult = await client.query(`
            INSERT INTO quotation_item (quot_id, item_id, item_name, item_description, uom, qi_quantity, unit_price, discount, line_total)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING qi_id, item_id, item_name, item_description, uom, qi_quantity, unit_price, discount, line_total
          `, [data.quot_id, newItemId, newItemName, newItemDesc, newUom, newQty, newUnitPrice, newDiscount, newLineTotal]);

          const newItem = insertResult.rows[0];
          const qiLogId = await createLog({
            tableId: itemTableId,
            recordId: String(newItem.qi_id),
            actionType: 'INSERT',
            actionBy: userId,
            changedData: {
              quot_id: data.quot_id,
              item_id: newItemId,
              item_name: newItemName,
              item_description: newItemDesc,
              uom: newUom,
              qi_quantity: newQty,
              unit_price: newUnitPrice,
              discount: newDiscount,
              line_total: newLineTotal,
            },
          });
          await client.query(
            'UPDATE quotation_item SET log_id = $1 WHERE qi_id = $2',
            [qiLogId, newItem.qi_id]
          );
        }
      }
    }

    await client.query('COMMIT');
    return { quot_id: data.quot_id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
