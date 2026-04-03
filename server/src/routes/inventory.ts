import express, { Request, Response } from 'express';
import {
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getInventoryItems,
} from '../services/inventory.service';
import { createClassification, getClassifications } from '../services/classification.service';

const router = express.Router();

// ============================================
// INVENTORY ROUTES
// ============================================

/**
 * GET /api/inventory
 * Fetch all inventory items (read-only).
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const items = await getInventoryItems();
    return res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error: any) {
    console.error('Error fetching inventory:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory: ' + error.message,
    });
  }
});

/**
 * POST /api/inventory/create
 * Create new inventory item with logging.
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { item_name, serial_number, balance_qty, uom, description, classification_id } = req.body;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    // Validate required field
    if (!item_name || !item_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Item name is required',
      });
    }

    const newItem = await createInventoryItem(
      {
        item_name,
        ...(serial_number ? { serial_number } : {}),
        ...(balance_qty ? { balance_qty: parseFloat(balance_qty) } : {}),
        ...(uom ? { uom } : {}),
        ...(description ? { description } : {}),
        ...(classification_id ? { classification_id } : {}),
      },
      userId
    );

    return res.status(201).json({
      success: true,
      message: 'Inventory item created successfully',
      data: newItem,
    });
  } catch (error: any) {
    console.error('Error creating inventory item:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create inventory item: ' + error.message,
    });
  }
});

/**
 * POST /api/inventory/update
 * Update inventory item with logging.
 */
router.post('/update', async (req: Request, res: Response) => {
  try {
    const { item_id, item_name, serial_number, balance_qty, uom, description, classification_id } = req.body;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    // Validate item_id
    if (!item_id) {
      return res.status(400).json({
        success: false,
        message: 'Item ID is required',
      });
    }

    const updatedItem = await updateInventoryItem(
      item_id,
      {
        item_name,
        ...(serial_number ? { serial_number } : {}),
        ...(balance_qty !== undefined ? { balance_qty: parseFloat(balance_qty) } : {}),
        ...(uom ? { uom } : {}),
        ...(description ? { description } : {}),
        ...(classification_id ? { classification_id } : {}),
      },
      userId
    );

    return res.status(200).json({
      success: true,
      message: 'Inventory item updated successfully',
      data: updatedItem,
    });
  } catch (error: any) {
    console.error('Error updating inventory item:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update inventory item: ' + error.message,
    });
  }
});

/**
 * POST /api/inventory/delete
 * Delete inventory item with logging.
 */
router.post('/delete', async (req: Request, res: Response) => {
  try {
    const { item_id } = req.body;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    // Validate item_id
    if (!item_id) {
      return res.status(400).json({
        success: false,
        message: 'Item ID is required',
      });
    }

    await deleteInventoryItem(item_id, userId);

    return res.status(200).json({
      success: true,
      message: 'Inventory item deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting inventory item:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete inventory item: ' + error.message,
    });
  }
});

// ============================================
// CLASSIFICATION ROUTES
// ============================================

/**
 * GET /api/inventory/classifications
 * Fetch all classifications (read-only).
 */
router.get('/classifications', async (req: Request, res: Response) => {
  try {
    const classifications = await getClassifications();
    return res.status(200).json({
      success: true,
      data: classifications,
    });
  } catch (error: any) {
    console.error('Error fetching classifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch classifications: ' + error.message,
    });
  }
});

/**
 * POST /api/inventory/classification/create
 * Create new classification with logging.
 */
router.post('/classification/create', async (req: Request, res: Response) => {
  try {
    const { classification_code, classification_title, classification_description } = req.body;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    // Validate required fields
    if (!classification_code || !classification_code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Classification code is required',
      });
    }

    if (!classification_title || !classification_title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Classification title is required',
      });
    }

    const newClass = await createClassification(
      {
        classification_code,
        classification_title,
        classification_description,
      },
      userId
    );

    return res.status(201).json({
      success: true,
      message: 'Classification created successfully',
      data: newClass,
    });
  } catch (error: any) {
    console.error('Error creating classification:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create classification: ' + error.message,
    });
  }
});

export default router;
