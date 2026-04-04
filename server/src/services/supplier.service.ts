import { pool } from '../config/database';
import { createLog, getTableId } from '../utils/logger';

// Interface for supplier data
interface SupplierData {
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
 * Create new supplier with automatic logging
 */
export const createSupplier = async (data: SupplierData, userId: string) => {
  // 1. INSERT into supplier table
  const { rows: insertRows } = await pool.query(
    `INSERT INTO supplier (company_name, control_ac, branch_name, industry_name, industry_code, register_no_new, register_no_old, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [data.company_name, data.control_ac || null, data.branch_name || null, data.industry_name || null, data.industry_code || null, data.register_no_new || null, data.register_no_old || null, data.status || null]
  );
  const supplierId = insertRows[0].supplier_id;

  // 2. LOG the creation
  const tableId = await getTableId('supplier');
  const logId = await createLog({
    tableId: tableId,
    recordId: supplierId.toString(),
    actionType: 'INSERT',
    actionBy: userId,
    changedData: data,
  });

  // 3. LINK log_id to supplier record
  await pool.query(
    'UPDATE supplier SET log_id = $1 WHERE supplier_id = $2',
    [logId, supplierId]
  );

  return insertRows[0];
};

/**
 * Update supplier with automatic logging (tracks before/after values)
 */
export const updateSupplier = async (supplierId: number, data: SupplierData, userId: string) => {
  // 1. GET current values (before state)
  const { rows: beforeRows } = await pool.query(
    'SELECT * FROM supplier WHERE supplier_id = $1',
    [supplierId]
  );
  const beforeData = beforeRows[0];

  // 2. UPDATE with new values
  await pool.query(
    `UPDATE supplier 
     SET company_name = COALESCE($1, company_name),
         control_ac = COALESCE($2, control_ac),
         branch_name = COALESCE($3, branch_name),
         industry_name = COALESCE($4, industry_name),
         industry_code = COALESCE($5, industry_code),
         register_no_new = COALESCE($6, register_no_new),
         register_no_old = COALESCE($7, register_no_old),
         status = COALESCE($8, status)
     WHERE supplier_id = $9`,
    [data.company_name, data.control_ac, data.branch_name, data.industry_name, data.industry_code, data.register_no_new, data.register_no_old, data.status, supplierId]
  );

  // 3. LOG with before/after comparison
  const tableId = await getTableId('supplier');
  const logId = await createLog({
    tableId: tableId,
    recordId: supplierId.toString(),
    actionType: 'UPDATE',
    actionBy: userId,
    changedData: { before: beforeData, after: data },
  });

  // 4. UPDATE log_id reference
  await pool.query(
    'UPDATE supplier SET log_id = $1 WHERE supplier_id = $2',
    [logId, supplierId]
  );

  // 5. RETURN updated supplier
  const { rows: updatedRows } = await pool.query(
    'SELECT * FROM supplier WHERE supplier_id = $1',
    [supplierId]
  );
  return updatedRows[0];
};

/**
 * Delete supplier with automatic logging (stores complete record for recovery)
 */
export const deleteSupplier = async (supplierId: number, userId: string) => {
  // 1. GET complete record before deletion
  const { rows: recordRows } = await pool.query(
    'SELECT * FROM supplier WHERE supplier_id = $1',
    [supplierId]
  );
  const deletedRecord = recordRows[0];

  // 2. LOG the deletion with complete record
  const tableId = await getTableId('supplier');
  await createLog({
    tableId: tableId,
    recordId: supplierId.toString(),
    actionType: 'DELETE',
    actionBy: userId,
    changedData: { deleted_record: deletedRecord },
  });

  // 3. DELETE from supplier table
  await pool.query(
    'DELETE FROM supplier WHERE supplier_id = $1',
    [supplierId]
  );
};

/**
 * Get all suppliers (read-only, no logging needed)
 */
export const getSuppliers = async () => {
  const { rows } = await pool.query(
    'SELECT * FROM supplier ORDER BY supplier_id ASC'
  );
  return rows;
};
