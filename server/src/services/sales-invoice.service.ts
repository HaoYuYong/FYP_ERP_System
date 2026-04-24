import { pool } from '../config/database';
import { createLog, getTableId } from '../utils/logger';

/**
 * Create a sales invoice header with associated line items and logging.
 */
export const createSalesInvoice = async (
  data: {
    reference_no?: string;
    terms?: string;
    due_date?: string;
    customer_id?: number;
    remarks?: string;
    do_id?: string;
    items: Array<{
      item_id?: number;
      item_name: string;
      item_description: string;
      uom?: string;
      si_quantity: number;
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

    // Safety check: if do_id given, ensure DO has not already been used to generate an SI.
    if (data.do_id) {
      const doCheck = await client.query(
        'SELECT generated_si_id FROM delivery_order WHERE do_id = $1 FOR UPDATE',
        [data.do_id]
      );
      if (!doCheck.rows[0]) {
        throw new Error('Delivery order not found');
      }
      if (doCheck.rows[0].generated_si_id !== null) {
        throw new Error('This delivery order has already been used to generate a sales invoice');
      }
    }

    // Get next SI number from sequence.
    const siNoResult = await client.query(
      "SELECT 'SI-' || LPAD(nextval('seq_si_no')::text, 6, '0') AS si_no"
    );
    const siNo = siNoResult.rows[0].si_no;

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

    const siQuery = `
      INSERT INTO sales_invoice (
        si_no, reference_no, terms, due_date, customer_id, remarks, status, total_amount, created_by,
        customer_company_name, customer_register_no, customer_address, customer_phone, customer_email,
        do_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING si_id, si_no, reference_no, terms, due_date, customer_id, remarks, status, total_amount, created_by,
                customer_company_name, customer_register_no, customer_address, customer_phone, customer_email,
                do_id
    `;

    const siResult = await client.query(siQuery, [
      siNo,
      data.reference_no || null,
      data.terms || null,
      data.due_date || null,
      data.customer_id || null,
      data.remarks || null,
      totalAmount,
      userId || null,
      snapshotCompanyName,
      snapshotRegisterNo,
      snapshotAddress,
      snapshotPhone,
      snapshotEmail,
      data.do_id || null,
    ]);

    const salesInvoice = siResult.rows[0];

    // Log sales invoice header creation.
    const tableId = await getTableId('sales_invoice');
    const siLogId = await createLog({
      tableId,
      recordId: salesInvoice.si_id,
      actionType: 'INSERT',
      actionBy: userId,
      changedData: {
        si_no: salesInvoice.si_no,
        reference_no: data.reference_no,
        terms: data.terms,
        due_date: data.due_date,
        customer_id: data.customer_id,
        remarks: data.remarks,
        status: 'draft',
        total_amount: totalAmount,
        do_id: data.do_id || null,
      },
    });

    await client.query(
      'UPDATE sales_invoice SET log_id = $1 WHERE si_id = $2',
      [siLogId, salesInvoice.si_id]
    );

    // Create line items.
    const items = [];
    const itemTableId = await getTableId('sales_invoice_item');

    for (const item of data.items) {
      const siiQuery = `
        INSERT INTO sales_invoice_item (si_id, item_id, item_name, item_description, uom, si_quantity, unit_price, discount, line_total)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING sii_id, si_id, item_id, item_name, item_description, uom, si_quantity, unit_price, discount, line_total
      `;

      const siiResult = await client.query(siiQuery, [
        salesInvoice.si_id,
        item.item_id || null,
        item.item_name,
        item.item_description,
        item.uom || null,
        item.si_quantity,
        item.unit_price,
        item.discount,
        item.line_total,
      ]);

      const lineItem = siiResult.rows[0];
      items.push(lineItem);

      const siiLogId = await createLog({
        tableId: itemTableId,
        recordId: String(lineItem.sii_id),
        actionType: 'INSERT',
        actionBy: userId,
        changedData: {
          si_id: salesInvoice.si_id,
          item_id: item.item_id,
          item_name: item.item_name,
          item_description: item.item_description,
          uom: item.uom,
          si_quantity: item.si_quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          line_total: item.line_total,
        },
      });

      await client.query(
        'UPDATE sales_invoice_item SET log_id = $1 WHERE sii_id = $2',
        [siiLogId, lineItem.sii_id]
      );
    }

    // If generated from a DO, mark that DO as linked.
    if (data.do_id) {
      await client.query(
        'UPDATE delivery_order SET generated_si_id = $1 WHERE do_id = $2',
        [salesInvoice.si_id, data.do_id]
      );
    }

    await client.query('COMMIT');
    return { ...salesInvoice, log_id: siLogId, items };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Fetch all sales invoices with their associated line items.
 */
export const getSalesInvoices = async () => {
  try {
    const query = `
      SELECT
        s.si_id,
        s.si_no,
        s.reference_no,
        s.terms,
        s.due_date,
        s.customer_id,
        s.do_id,
        s.remarks,
        s.status,
        s.total_amount,
        s.created_by,
        CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
        l.action_at AS created_at,
        COALESCE(s.customer_company_name, c.company_name) AS customer_company_name,
        s.customer_register_no,
        s.customer_address,
        s.customer_phone,
        s.customer_email,
        json_agg(
          json_build_object(
            'sii_id',           sii.sii_id,
            'item_id',          sii.item_id,
            'item_name',        sii.item_name,
            'item_description', sii.item_description,
            'uom',              sii.uom,
            'si_quantity',      sii.si_quantity,
            'unit_price',       sii.unit_price,
            'discount',         sii.discount,
            'line_total',       sii.line_total
          ) ORDER BY sii.sii_id
        ) FILTER (WHERE sii.sii_id IS NOT NULL) AS items
      FROM sales_invoice s
      LEFT JOIN customer c ON s.customer_id = c.customer_id
      LEFT JOIN sales_invoice_item sii ON s.si_id = sii.si_id
      LEFT JOIN users u ON s.created_by = u.auth_id
      LEFT JOIN log l ON s.log_id = l.log_id
      GROUP BY s.si_id, s.si_no, s.reference_no, s.terms, s.due_date, s.customer_id, s.do_id,
               s.remarks, s.status, s.total_amount, s.created_by, u.first_name, u.last_name, l.action_at,
               s.customer_company_name, c.company_name, s.customer_register_no,
               s.customer_address, s.customer_phone, s.customer_email
      ORDER BY s.si_no DESC
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
 * Update a sales invoice header and its line items with audit logging.
 */
export const updateSalesInvoice = async (
  data: {
    si_id: string;
    reference_no?: string;
    terms?: string;
    due_date?: string | null;
    remarks?: string;
    status?: string;
    customer_id?: number | null;
    total_amount?: number;
    items?: Array<{
      sii_id?: number;
      item_id?: number | null;
      item_name: string;
      item_description: string;
      uom?: string;
      si_quantity: number;
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

    const oldSiResult = await client.query(
      'SELECT * FROM sales_invoice WHERE si_id = $1',
      [data.si_id]
    );
    if (oldSiResult.rows.length === 0) throw new Error('Sales invoice not found');
    const oldSi = oldSiResult.rows[0];

    const headerFields: Record<string, any> = {};
    if (data.reference_no !== undefined) headerFields.reference_no = data.reference_no;
    if (data.terms !== undefined) headerFields.terms = data.terms;
    if (data.due_date !== undefined) headerFields.due_date = data.due_date || null;
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

    let updatedSi = oldSi;
    if (Object.keys(headerFields).length > 0) {
      const keys = Object.keys(headerFields);
      const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const updateResult = await client.query(
        `UPDATE sales_invoice SET ${setClauses} WHERE si_id = $1 RETURNING *`,
        [data.si_id, ...Object.values(headerFields)]
      );
      updatedSi = updateResult.rows[0];
    }

    const siTableId = await getTableId('sales_invoice');
    await createLog({
      tableId: siTableId,
      recordId: data.si_id,
      actionType: 'UPDATE',
      actionBy: userId,
      changedData: { before: oldSi, after: updatedSi },
    });

    if (data.items !== undefined) {
      const itemTableId = await getTableId('sales_invoice_item');

      const existingResult = await client.query(
        'SELECT sii_id, item_id, item_name, item_description, uom, si_quantity, unit_price, discount, line_total FROM sales_invoice_item WHERE si_id = $1',
        [data.si_id]
      );
      const existingItems: any[] = existingResult.rows;

      const keptSiiIds = new Set(
        data.items.filter(i => i.sii_id).map(i => i.sii_id)
      );

      for (const existing of existingItems) {
        if (!keptSiiIds.has(existing.sii_id)) {
          await client.query('DELETE FROM sales_invoice_item WHERE sii_id = $1', [existing.sii_id]);
          await createLog({
            tableId: itemTableId,
            recordId: String(existing.sii_id),
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
        const newQty       = item.si_quantity;
        const newUnitPrice = item.unit_price;
        const newDiscount  = item.discount;
        const newLineTotal = item.line_total;

        if (item.sii_id) {
          const oldItem = existingItems.find(i => i.sii_id === item.sii_id);
          if (!oldItem) continue;

          const itemChanged =
            String(oldItem.item_id)            !== String(newItemId)   ||
            oldItem.item_name                  !== newItemName          ||
            oldItem.item_description           !== newItemDesc          ||
            oldItem.uom                        !== newUom               ||
            parseFloat(oldItem.si_quantity)   !== newQty               ||
            parseFloat(oldItem.unit_price)     !== newUnitPrice         ||
            parseFloat(oldItem.discount)       !== newDiscount          ||
            parseFloat(oldItem.line_total)     !== newLineTotal;

          const updatedItemResult = await client.query(`
            UPDATE sales_invoice_item
            SET item_id = $2, item_name = $3, item_description = $4, uom = $5,
                si_quantity = $6, unit_price = $7, discount = $8, line_total = $9
            WHERE sii_id = $1
            RETURNING sii_id, item_id, item_name, item_description, uom, si_quantity, unit_price, discount, line_total
          `, [item.sii_id, newItemId, newItemName, newItemDesc, newUom, newQty, newUnitPrice, newDiscount, newLineTotal]);

          if (itemChanged) {
            await createLog({
              tableId: itemTableId,
              recordId: String(item.sii_id),
              actionType: 'UPDATE',
              actionBy: userId,
              changedData: { before: oldItem, after: updatedItemResult.rows[0] },
            });
          }
        } else {
          const insertResult = await client.query(`
            INSERT INTO sales_invoice_item (si_id, item_id, item_name, item_description, uom, si_quantity, unit_price, discount, line_total)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING sii_id, item_id, item_name, item_description, uom, si_quantity, unit_price, discount, line_total
          `, [data.si_id, newItemId, newItemName, newItemDesc, newUom, newQty, newUnitPrice, newDiscount, newLineTotal]);

          const newItem = insertResult.rows[0];
          const siiLogId = await createLog({
            tableId: itemTableId,
            recordId: String(newItem.sii_id),
            actionType: 'INSERT',
            actionBy: userId,
            changedData: {
              si_id: data.si_id,
              item_id: newItemId,
              item_name: newItemName,
              item_description: newItemDesc,
              uom: newUom,
              si_quantity: newQty,
              unit_price: newUnitPrice,
              discount: newDiscount,
              line_total: newLineTotal,
            },
          });
          await client.query(
            'UPDATE sales_invoice_item SET log_id = $1 WHERE sii_id = $2',
            [siiLogId, newItem.sii_id]
          );
        }
      }
    }

    await client.query('COMMIT');
    return { si_id: data.si_id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
