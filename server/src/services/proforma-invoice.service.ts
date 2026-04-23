import { pool } from '../config/database';
import { createLog, getTableId } from '../utils/logger';

/**
 * Create a proforma invoice header with associated line items and logging.
 */
export const createProformaInvoice = async (
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
      pi_quantity: number;
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

    // Get next PI number from sequence.
    const piNoResult = await client.query(
      "SELECT 'PI-' || LPAD(nextval('seq_pi_no')::text, 6, '0') AS pi_no"
    );
    const piNo = piNoResult.rows[0].pi_no;

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

    // Insert proforma invoice header.
    const piQuery = `
      INSERT INTO proforma_invoice (
        pi_no, reference_no, terms, customer_id, remarks, status, total_amount, created_by,
        customer_company_name, customer_register_no, customer_address, customer_phone, customer_email
      )
      VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, $10, $11, $12)
      RETURNING pi_id, pi_no, reference_no, terms, customer_id, remarks, status, total_amount, created_by,
                customer_company_name, customer_register_no, customer_address, customer_phone, customer_email
    `;

    const piResult = await client.query(piQuery, [
      piNo,
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

    const pi = piResult.rows[0];

    // Log proforma invoice header creation.
    const tableId = await getTableId('proforma_invoice');
    const piLogId = await createLog({
      tableId,
      recordId: pi.pi_id,
      actionType: 'INSERT',
      actionBy: userId,
      changedData: {
        pi_no: pi.pi_no,
        reference_no: data.reference_no,
        terms: data.terms,
        customer_id: data.customer_id,
        remarks: data.remarks,
        status: 'draft',
        total_amount: totalAmount,
      },
    });

    await client.query(
      'UPDATE proforma_invoice SET log_id = $1 WHERE pi_id = $2',
      [piLogId, pi.pi_id]
    );

    // Create line items.
    const items = [];
    const itemTableId = await getTableId('proforma_invoice_item');

    for (const item of data.items) {
      const piiQuery = `
        INSERT INTO proforma_invoice_item (pi_id, item_id, item_name, item_description, uom, pi_quantity, unit_price, discount, line_total)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING pii_id, pi_id, item_id, item_name, item_description, uom, pi_quantity, unit_price, discount, line_total
      `;

      const piiResult = await client.query(piiQuery, [
        pi.pi_id,
        item.item_id || null,
        item.item_name,
        item.item_description,
        item.uom || null,
        item.pi_quantity,
        item.unit_price,
        item.discount,
        item.line_total,
      ]);

      const lineItem = piiResult.rows[0];
      items.push(lineItem);

      const piiLogId = await createLog({
        tableId: itemTableId,
        recordId: String(lineItem.pii_id),
        actionType: 'INSERT',
        actionBy: userId,
        changedData: {
          pi_id: pi.pi_id,
          item_id: item.item_id,
          item_name: item.item_name,
          item_description: item.item_description,
          uom: item.uom,
          pi_quantity: item.pi_quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          line_total: item.line_total,
        },
      });

      await client.query(
        'UPDATE proforma_invoice_item SET log_id = $1 WHERE pii_id = $2',
        [piiLogId, lineItem.pii_id]
      );
    }

    await client.query('COMMIT');
    return { ...pi, log_id: piLogId, items };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Fetch all proforma invoices with their associated line items.
 */
export const getProformaInvoices = async () => {
  try {
    const query = `
      SELECT
        p.pi_id,
        p.pi_no,
        p.reference_no,
        p.terms,
        p.customer_id,
        p.remarks,
        p.status,
        p.total_amount,
        p.created_by,
        CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
        l.action_at AS created_at,
        COALESCE(p.customer_company_name, c.company_name) AS customer_company_name,
        p.customer_register_no,
        p.customer_address,
        p.customer_phone,
        p.customer_email,
        json_agg(
          json_build_object(
            'pii_id',           pii.pii_id,
            'item_id',          pii.item_id,
            'item_name',        pii.item_name,
            'item_description', pii.item_description,
            'uom',              pii.uom,
            'pi_quantity',     pii.pi_quantity,
            'unit_price',       pii.unit_price,
            'discount',         pii.discount,
            'line_total',       pii.line_total
          ) ORDER BY pii.pii_id
        ) FILTER (WHERE pii.pii_id IS NOT NULL) AS items
      FROM proforma_invoice p
      LEFT JOIN customer c ON p.customer_id = c.customer_id
      LEFT JOIN proforma_invoice_item pii ON p.pi_id = pii.pi_id
      LEFT JOIN users u ON p.created_by = u.auth_id
      LEFT JOIN log l ON p.log_id = l.log_id
      GROUP BY p.pi_id, p.pi_no, p.reference_no, p.terms, p.customer_id, p.remarks, p.status,
               p.total_amount, p.created_by, u.first_name, u.last_name, l.action_at,
               p.customer_company_name, c.company_name, p.customer_register_no,
               p.customer_address, p.customer_phone, p.customer_email
      ORDER BY p.pi_no DESC
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
 * Update a proforma invoice header and its line items with audit logging.
 */
export const updateProformaInvoice = async (
  data: {
    pi_id: string;
    reference_no?: string;
    terms?: string;
    remarks?: string;
    status?: string;
    customer_id?: number | null;
    total_amount?: number;
    items?: Array<{
      pii_id?: number;
      item_id?: number | null;
      item_name: string;
      item_description: string;
      uom?: string;
      pi_quantity: number;
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

    const oldPiResult = await client.query(
      'SELECT * FROM proforma_invoice WHERE pi_id = $1',
      [data.pi_id]
    );
    if (oldPiResult.rows.length === 0) throw new Error('Proforma invoice not found');
    const oldPi = oldPiResult.rows[0];

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

    let updatedPi = oldPi;
    if (Object.keys(headerFields).length > 0) {
      const keys = Object.keys(headerFields);
      const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const updateResult = await client.query(
        `UPDATE proforma_invoice SET ${setClauses} WHERE pi_id = $1 RETURNING *`,
        [data.pi_id, ...Object.values(headerFields)]
      );
      updatedPi = updateResult.rows[0];
    }

    const piTableId = await getTableId('proforma_invoice');
    await createLog({
      tableId: piTableId,
      recordId: data.pi_id,
      actionType: 'UPDATE',
      actionBy: userId,
      changedData: { before: oldPi, after: updatedPi },
    });

    if (data.items !== undefined) {
      const itemTableId = await getTableId('proforma_invoice_item');

      const existingResult = await client.query(
        'SELECT pii_id, item_id, item_name, item_description, uom, pi_quantity, unit_price, discount, line_total FROM proforma_invoice_item WHERE pi_id = $1',
        [data.pi_id]
      );
      const existingItems: any[] = existingResult.rows;

      const keptPiiIds = new Set(
        data.items.filter(i => i.pii_id).map(i => i.pii_id)
      );

      for (const existing of existingItems) {
        if (!keptPiiIds.has(existing.pii_id)) {
          await client.query('DELETE FROM proforma_invoice_item WHERE pii_id = $1', [existing.pii_id]);
          await createLog({
            tableId: itemTableId,
            recordId: String(existing.pii_id),
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
        const newQty       = item.pi_quantity;
        const newUnitPrice = item.unit_price;
        const newDiscount  = item.discount;
        const newLineTotal = item.line_total;

        if (item.pii_id) {
          const oldItem = existingItems.find(i => i.pii_id === item.pii_id);
          if (!oldItem) continue;

          const itemChanged =
            String(oldItem.item_id)           !== String(newItemId)   ||
            oldItem.item_name                 !== newItemName          ||
            oldItem.item_description          !== newItemDesc          ||
            oldItem.uom                       !== newUom               ||
            parseFloat(oldItem.pi_quantity)  !== newQty               ||
            parseFloat(oldItem.unit_price)    !== newUnitPrice         ||
            parseFloat(oldItem.discount)      !== newDiscount          ||
            parseFloat(oldItem.line_total)    !== newLineTotal;

          const updatedItemResult = await client.query(`
            UPDATE proforma_invoice_item
            SET item_id = $2, item_name = $3, item_description = $4, uom = $5,
                pi_quantity = $6, unit_price = $7, discount = $8, line_total = $9
            WHERE pii_id = $1
            RETURNING pii_id, item_id, item_name, item_description, uom, pi_quantity, unit_price, discount, line_total
          `, [item.pii_id, newItemId, newItemName, newItemDesc, newUom, newQty, newUnitPrice, newDiscount, newLineTotal]);

          if (itemChanged) {
            await createLog({
              tableId: itemTableId,
              recordId: String(item.pii_id),
              actionType: 'UPDATE',
              actionBy: userId,
              changedData: { before: oldItem, after: updatedItemResult.rows[0] },
            });
          }
        } else {
          const insertResult = await client.query(`
            INSERT INTO proforma_invoice_item (pi_id, item_id, item_name, item_description, uom, pi_quantity, unit_price, discount, line_total)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING pii_id, item_id, item_name, item_description, uom, pi_quantity, unit_price, discount, line_total
          `, [data.pi_id, newItemId, newItemName, newItemDesc, newUom, newQty, newUnitPrice, newDiscount, newLineTotal]);

          const newItem = insertResult.rows[0];
          const piiLogId = await createLog({
            tableId: itemTableId,
            recordId: String(newItem.pii_id),
            actionType: 'INSERT',
            actionBy: userId,
            changedData: {
              pi_id: data.pi_id,
              item_id: newItemId,
              item_name: newItemName,
              item_description: newItemDesc,
              uom: newUom,
              pi_quantity: newQty,
              unit_price: newUnitPrice,
              discount: newDiscount,
              line_total: newLineTotal,
            },
          });
          await client.query(
            'UPDATE proforma_invoice_item SET log_id = $1 WHERE pii_id = $2',
            [piiLogId, newItem.pii_id]
          );
        }
      }
    }

    await client.query('COMMIT');
    return { pi_id: data.pi_id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
