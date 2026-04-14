import { pool } from '../config/database';
import { createLog, getTableId } from '../utils/logger';

/**
 * Create inventory item with logging to audit trail.
 */
export const createInventoryItem = async (
  data: {
    item_name: string;
    serial_number?: string;
    balance_qty?: number;
    uom?: string;
    description?: string;
    classification_id?: number;
  },
  userId: string
) => {
  try {
    // Insert into inventory table
    const query = `
      INSERT INTO inventory (item_name, serial_number, balance_qty, uom, description, classification_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING item_id, item_name, serial_number, balance_qty, uom, description, classification_id
    `;

    const result = await pool.query(query, [
      data.item_name,
      data.serial_number || null,
      data.balance_qty || null,
      data.uom || null,
      data.description || null,
      data.classification_id || null,
    ]);

    const item = result.rows[0];

    // Create log entry for audit trail
    const tableId = await getTableId('inventory');
    const logId = await createLog({
      tableId,
      recordId: String(item.item_id),
      actionType: 'INSERT',
      actionBy: userId,
      changedData: {
        item_name: data.item_name,
        serial_number: data.serial_number,
        balance_qty: data.balance_qty,
        uom: data.uom,
        description: data.description,
        classification_id: data.classification_id,
      },
    });

    // Update inventory with log_id reference
    await pool.query(
      'UPDATE inventory SET log_id = $1 WHERE item_id = $2',
      [logId, item.item_id]
    );

    return {
      ...item,
      log_id: logId,
    };
  } catch (error) {
    console.error('Error creating inventory item:', error);
    throw error;
  }
};

/**
 * Update inventory item with logging to audit trail.
 */
export const updateInventoryItem = async (
  itemId: number,
  data: {
    item_name?: string;
    serial_number?: string;
    balance_qty?: number;
    uom?: string;
    description?: string;
    classification_id?: number;
  },
  userId: string
) => {
  try {
    // Get old values for audit trail
    const oldResult = await pool.query('SELECT * FROM inventory WHERE item_id = $1', [itemId]);
    const oldValues = oldResult.rows[0];

    // Prepare update query dynamically (only include provided fields)
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 1;

    if (data.item_name !== undefined) {
      updateFields.push(`item_name = $${paramCount++}`);
      updateValues.push(data.item_name);
    }
    if (data.serial_number !== undefined) {
      updateFields.push(`serial_number = $${paramCount++}`);
      updateValues.push(data.serial_number);
    }
    if (data.balance_qty !== undefined) {
      updateFields.push(`balance_qty = $${paramCount++}`);
      updateValues.push(data.balance_qty);
    }
    if (data.uom !== undefined) {
      updateFields.push(`uom = $${paramCount++}`);
      updateValues.push(data.uom);
    }
    if (data.description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      updateValues.push(data.description);
    }
    if (data.classification_id !== undefined) {
      updateFields.push(`classification_id = $${paramCount++}`);
      updateValues.push(data.classification_id);
    }

    // If no fields to update, return unchanged item
    if (updateFields.length === 0) {
      return oldValues;
    }

    updateValues.push(itemId);
    const updateQuery = `UPDATE inventory SET ${updateFields.join(', ')} WHERE item_id = $${paramCount} RETURNING *`;

    const result = await pool.query(updateQuery, updateValues);
    const updatedItem = result.rows[0];

    // Create log entry for audit trail
    const tableId = await getTableId('inventory');
    const logId = await createLog({
      tableId,
      recordId: String(itemId),
      actionType: 'UPDATE',
      actionBy: userId,
      changedData: {
        before: oldValues,
        after: updatedItem,
      },
    });

    // Update inventory with new log_id
    await pool.query(
      'UPDATE inventory SET log_id = $1 WHERE item_id = $2',
      [logId, itemId]
    );

    return { ...updatedItem, log_id: logId };
  } catch (error) {
    console.error('Error updating inventory item:', error);
    throw error;
  }
};

/**
 * Delete inventory item with logging to audit trail.
 */
export const deleteInventoryItem = async (itemId: number, userId: string) => {
  try {
    // Get item details before deletion for audit trail
    const getResult = await pool.query('SELECT * FROM inventory WHERE item_id = $1', [itemId]);
    const itemData = getResult.rows[0];

    if (!itemData) {
      throw new Error('Inventory item not found');
    }

    // Create log entry BEFORE deleting
    const tableId = await getTableId('inventory');
    await createLog({
      tableId,
      recordId: String(itemId),
      actionType: 'DELETE',
      actionBy: userId,
      changedData: itemData, // Store complete item data before deletion
    });

    // Delete from inventory table
    const deleteResult = await pool.query(
      'DELETE FROM inventory WHERE item_id = $1 RETURNING *',
      [itemId]
    );

    return deleteResult.rows[0];
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    throw error;
  }
};

/**
 * Get all inventory items (read-only, no logging needed).
 */
export const getInventoryItems = async () => {
  try {
    // LEFT JOIN classification to get classification_code for display
    // LEFT JOIN quantity to get current quantity for display
    const result = await pool.query(`
      SELECT
        i.item_id,
        i.item_name,
        c.classification_code,
        c.classification_title,
        i.uom,
        q.quantity,
        i.serial_number,
        i.balance_qty,
        i.description,
        i.classification_id,
        i.log_id
      FROM inventory i
      LEFT JOIN classification c ON i.classification_id = c.classification_id
      LEFT JOIN quantity q ON i.item_id = q.item_id
      ORDER BY i.item_id ASC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    throw error;
  }
};
