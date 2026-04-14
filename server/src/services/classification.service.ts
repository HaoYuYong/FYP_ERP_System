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
 * Update classification with logging to audit trail.
 */
export const updateClassification = async (
  classificationId: number,
  data: {
    classification_code?: string;
    classification_title?: string;
    classification_description?: string;
  },
  userId: string
) => {
  try {
    // Get old values before update for audit trail
    const oldResult = await pool.query('SELECT * FROM classification WHERE classification_id = $1', [classificationId]);
    const oldValues = oldResult.rows[0];

    // Build update query dynamically – only include provided fields
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 1;

    if (data.classification_code !== undefined) {
      updateFields.push(`classification_code = $${paramCount++}`);
      updateValues.push(data.classification_code);
    }
    if (data.classification_title !== undefined) {
      updateFields.push(`classification_title = $${paramCount++}`);
      updateValues.push(data.classification_title);
    }
    if (data.classification_description !== undefined) {
      updateFields.push(`classification_description = $${paramCount++}`);
      updateValues.push(data.classification_description);
    }

    // No fields provided – return unchanged record
    if (updateFields.length === 0) return oldValues;

    updateValues.push(classificationId);
    const updateQuery = `UPDATE classification SET ${updateFields.join(', ')} WHERE classification_id = $${paramCount} RETURNING *`;
    const result = await pool.query(updateQuery, updateValues);
    const updatedClass = result.rows[0];

    // Create log entry for audit trail
    const tableId = await getTableId('classification');
    const logId = await createLog({
      tableId,
      recordId: String(classificationId),
      actionType: 'UPDATE',
      actionBy: userId,
      changedData: {
        before: oldValues,
        after: updatedClass,
      },
    });

    // Update classification with new log_id reference
    await pool.query(
      'UPDATE classification SET log_id = $1 WHERE classification_id = $2',
      [logId, classificationId]
    );

    return { ...updatedClass, log_id: logId };
  } catch (error) {
    console.error('Error updating classification:', error);
    throw error;
  }
};

/**
 * Delete classification with logging to audit trail.
 */
export const deleteClassification = async (classificationId: number, userId: string) => {
  try {
    // Get full record before deletion for audit trail
    const getResult = await pool.query('SELECT * FROM classification WHERE classification_id = $1', [classificationId]);
    const classData = getResult.rows[0];

    if (!classData) throw new Error('Classification not found');

    // Create log entry BEFORE deleting (record will no longer exist after)
    const tableId = await getTableId('classification');
    await createLog({
      tableId,
      recordId: String(classificationId),
      actionType: 'DELETE',
      actionBy: userId,
      changedData: classData, // Full record stored for reference
    });

    // Delete the classification record
    const deleteResult = await pool.query(
      'DELETE FROM classification WHERE classification_id = $1 RETURNING *',
      [classificationId]
    );

    return deleteResult.rows[0];
  } catch (error) {
    console.error('Error deleting classification:', error);
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
