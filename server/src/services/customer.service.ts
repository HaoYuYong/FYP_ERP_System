import { pool } from '../config/database';
import { createLog, getTableId } from '../utils/logger';

// Interface for customer data
interface CustomerData {
  company_name?: string;
  control_ac?: string;
  branch_name?: string;
  industry_name?: string;
  industry_code?: string;
  register_no_new?: string;
  register_no_old?: string;
  status?: string;
}

/**
 * Create new customer with automatic logging
 */
export const createCustomer = async (data: CustomerData, userId: string) => {
  // 1. INSERT into customer table
  const { rows: insertRows } = await pool.query(
    `INSERT INTO customer (company_name, control_ac, branch_name, industry_name, industry_code, register_no_new, register_no_old, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [data.company_name, data.control_ac || null, data.branch_name || null, data.industry_name || null, data.industry_code || null, data.register_no_new || null, data.register_no_old || null, data.status || null]
  );
  const customerId = insertRows[0].customer_id;

  // 2. LOG the creation
  const tableId = await getTableId('customer');
  const logId = await createLog({
    tableId: tableId,
    recordId: customerId.toString(),
    actionType: 'INSERT',
    actionBy: userId,
    changedData: data,
  });

  // 3. LINK log_id to customer record
  await pool.query(
    'UPDATE customer SET log_id = $1 WHERE customer_id = $2',
    [logId, customerId]
  );

  return insertRows[0];
};

/**
 * Update customer with automatic logging (tracks before/after values)
 */
export const updateCustomer = async (customerId: number, data: CustomerData, userId: string) => {
  // 1. GET current values (before state)
  const { rows: beforeRows } = await pool.query(
    'SELECT * FROM customer WHERE customer_id = $1',
    [customerId]
  );
  const beforeData = beforeRows[0];

  // 2. UPDATE with new values
  await pool.query(
    `UPDATE customer 
     SET company_name = COALESCE($1, company_name),
         control_ac = COALESCE($2, control_ac),
         branch_name = COALESCE($3, branch_name),
         industry_name = COALESCE($4, industry_name),
         industry_code = COALESCE($5, industry_code),
         register_no_new = COALESCE($6, register_no_new),
         register_no_old = COALESCE($7, register_no_old),
         status = COALESCE($8, status)
     WHERE customer_id = $9`,
    [data.company_name, data.control_ac, data.branch_name, data.industry_name, data.industry_code, data.register_no_new, data.register_no_old, data.status, customerId]
  );

  // 3. LOG with before/after comparison
  const tableId = await getTableId('customer');
  const logId = await createLog({
    tableId: tableId,
    recordId: customerId.toString(),
    actionType: 'UPDATE',
    actionBy: userId,
    changedData: { before: beforeData, after: data },
  });

  // 4. UPDATE log_id reference
  await pool.query(
    'UPDATE customer SET log_id = $1 WHERE customer_id = $2',
    [logId, customerId]
  );

  // 5. RETURN updated customer
  const { rows: updatedRows } = await pool.query(
    'SELECT * FROM customer WHERE customer_id = $1',
    [customerId]
  );
  return updatedRows[0];
};

/**
 * Delete customer with automatic logging (stores complete record for recovery)
 */
export const deleteCustomer = async (customerId: number, userId: string) => {
  // 1. GET complete record before deletion
  const { rows: recordRows } = await pool.query(
    'SELECT * FROM customer WHERE customer_id = $1',
    [customerId]
  );
  const deletedRecord = recordRows[0];

  // 2. LOG the deletion with complete record
  const tableId = await getTableId('customer');
  await createLog({
    tableId: tableId,
    recordId: customerId.toString(),
    actionType: 'DELETE',
    actionBy: userId,
    changedData: { deleted_record: deletedRecord },
  });

  // 3. DELETE from customer table
  await pool.query(
    'DELETE FROM customer WHERE customer_id = $1',
    [customerId]
  );
};

/**
 * Get all customers (read-only, no logging needed)
 */
export const getCustomers = async () => {
  const { rows } = await pool.query(
    'SELECT * FROM customer ORDER BY customer_id ASC'
  );
  return rows;
};
