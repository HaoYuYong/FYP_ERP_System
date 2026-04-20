import { pool } from '../config/database';
import { createLog, getTableId } from '../utils/logger';

/**
 * Fetch the singleton company settings row (settings_id = 1).
 */
export const getCompanySettings = async () => {
  try {
    const result = await pool.query(
      'SELECT * FROM company_settings WHERE settings_id = 1'
    );
    return result.rows[0] || null;
  } catch (error) {
    throw error;
  }
};

/**
 * Update the singleton company settings row (settings_id = 1) with audit logging.
 */
export const updateCompanySettings = async (
  data: {
    company_name?: string;
    register_no?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    post_code?: string;
    phone?: string;
    email?: string;
    website?: string;
  },
  userId: string
) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tableId = await getTableId('company_settings');

    const result = await client.query(
      `UPDATE company_settings
       SET company_name = $1,
           register_no  = $2,
           address      = $3,
           city         = $4,
           state        = $5,
           country      = $6,
           post_code    = $7,
           phone        = $8,
           email        = $9,
           website      = $10
       WHERE settings_id = 1
       RETURNING *`,
      [
        data.company_name  ?? '',
        data.register_no   ?? '',
        data.address       ?? '',
        data.city          ?? '',
        data.state         ?? '',
        data.country       ?? '',
        data.post_code     ?? '',
        data.phone         ?? '',
        data.email         ?? '',
        data.website       ?? '',
      ]
    );

    const updated = result.rows[0];

    const logId = await createLog({
      tableId,
      recordId: '1',
      actionType: 'UPDATE',
      actionBy: userId,
      changedData: { ...data },
    });

    await client.query(
      'UPDATE company_settings SET log_id = $1 WHERE settings_id = 1',
      [logId]
    );

    await client.query('COMMIT');
    return updated;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
