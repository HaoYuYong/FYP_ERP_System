import { pool } from '../config/database';
import { createLog, getTableId } from '../utils/logger';

/**
 * Create classification with logging to audit trail.
 */
export const createClassification = async (
  data: {
    classification_code: string;
    classification_title: string;
    classification_description?: string;
  },
  userId: string
) => {
  try {
    // Insert into classification table
    const query = `
      INSERT INTO classification (classification_code, classification_title, classification_description)
      VALUES ($1, $2, $3)
      RETURNING classification_id, classification_code, classification_title, classification_description
    `;

    const result = await pool.query(query, [
      data.classification_code,
      data.classification_title,
      data.classification_description || null,
    ]);

    const classification = result.rows[0];

    // Create log entry for audit trail
    const tableId = await getTableId('classification');
    const logId = await createLog({
      tableId,
      recordId: String(classification.classification_id),
      actionType: 'INSERT',
      actionBy: userId,
      changedData: {
        classification_code: data.classification_code,
        classification_title: data.classification_title,
        classification_description: data.classification_description,
      },
    });

    // Update classification with log_id reference
    await pool.query(
      'UPDATE classification SET log_id = $1 WHERE classification_id = $2',
      [logId, classification.classification_id]
    );

    return {
      ...classification,
      log_id: logId,
    };
  } catch (error) {
    console.error('Error creating classification:', error);
    throw error;
  }
};

/**
 * Get all classifications (read-only, no logging needed).
 */
export const getClassifications = async () => {
  try {
    const result = await pool.query(
      'SELECT classification_id, classification_code, classification_title, classification_description FROM classification ORDER BY classification_code ASC'
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching classifications:', error);
    throw error;
  }
};
