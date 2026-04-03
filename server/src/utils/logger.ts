import { pool } from '../config/database';

// Log entry structure
export interface LogEntry {
  tableId: number;
  recordId: string;
  actionType: 'INSERT' | 'UPDATE' | 'DELETE';
  actionBy: string; // UUID of the user who performed the action
  changedData?: any; // Optional: store before/after values as JSON
}

/**
 * Creates a log entry in the database for audit trail.
 * Used to track all database operations (insert, update, delete).
 * Returns the log_id which can be used as reference in record tables.
 */
export const createLog = async (entry: LogEntry): Promise<number> => {
  const query = `
    INSERT INTO log (table_id, record_id, action_type, action_by, changed_data)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING log_id
  `;

  try {
    const result = await pool.query(query, [
      entry.tableId,
      entry.recordId,
      entry.actionType,
      entry.actionBy,
      entry.changedData ? JSON.stringify(entry.changedData) : null,
    ]);

    return result.rows[0].log_id;
  } catch (error) {
    console.error('Error creating log entry:', error);
    throw error;
  }
};

/**
 * Get the table_id from the tracked_tables lookup table.
 * Used when creating log entries.
 */
export const getTableId = async (tableName: string): Promise<number> => {
  const query = 'SELECT table_id FROM tracked_tables WHERE table_name = $1';

  try {
    const result = await pool.query(query, [tableName]);
    if (result.rows.length === 0) {
      throw new Error(`Table ${tableName} not found in tracked_tables`);
    }
    return result.rows[0].table_id;
  } catch (error) {
    console.error('Error getting table ID:', error);
    throw error;
  }
};
