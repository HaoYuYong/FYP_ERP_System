import express, { Request, Response } from 'express';
import {
  createPurchaseRequest,
  getPurchaseRequests,
  getSuppliers,
  getInventoryItems,
} from '../services/purchase-request.service';

const router = express.Router();

/**
 * GET /api/purchase-request
 * Fetch all purchase requests with their line items (read-only).
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const purchaseRequests = await getPurchaseRequests();
    return res.status(200).json({
      success: true,
      data: purchaseRequests,
    });
  } catch (error: any) {
    console.error('Error fetching purchase requests:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase requests: ' + error.message,
    });
  }
});

/**
 * GET /api/purchase-request/suppliers
 * Fetch all suppliers for dropdown selection (read-only).
 */
router.get('/suppliers', async (req: Request, res: Response) => {
  try {
    const suppliers = await getSuppliers();
    return res.status(200).json({
      success: true,
      data: suppliers,
    });
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch suppliers: ' + error.message,
    });
  }
});

/**
 * GET /api/purchase-request/items
 * Fetch all inventory items for dropdown selection (read-only).
 */
router.get('/items', async (req: Request, res: Response) => {
  try {
    const items = await getInventoryItems();
    return res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error: any) {
    console.error('Error fetching inventory items:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory items: ' + error.message,
    });
  }
});

/**
 * POST /api/purchase-request/create
 * Create a new purchase request with line items and logging.
 * Body:
 * {
 *   reference_no?: string,
 *   supplier_id?: number,
 *   remarks?: string,
 *   items: [
 *     {
 *       item_id?: number,
 *       item_name: string (required),
 *       item_description: string (required),
 *       uom?: string,
 *       pri_quantity: number (required, > 0)
 *     }
 *   ]
 * }
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { reference_no, supplier_id, remarks, items } = req.body;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    // Validate required fields.
    if (!reference_no || !reference_no.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reference number is required',
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required',
      });
    }

    // Validate each item.
    for (const item of items) {
      if (!item.item_name || !item.item_name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Item name is required for all items',
        });
      }

      if (item.pri_quantity === undefined || item.pri_quantity === null) {
        return res.status(400).json({
          success: false,
          message: 'Quantity is required for all items',
        });
      }

      const qty = parseFloat(item.pri_quantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be a positive number',
        });
      }
    }

    // Create the purchase request with automatic logging.
    const newPR = await createPurchaseRequest(
      {
        // Only include optional top-level properties if they have actual values.
        ...(reference_no ? { reference_no } : {}),
        ...(supplier_id ? { supplier_id: parseInt(supplier_id) } : {}),
        ...(remarks ? { remarks } : {}),
        // Map items and only include optional properties if they have values (not undefined).
        items: items.map((item: any) => ({
          ...(item.item_id ? { item_id: parseInt(item.item_id) } : {}),
          item_name: item.item_name,
          item_description: item.item_description || item.item_name,
          ...(item.uom ? { uom: item.uom } : {}),
          pri_quantity: parseFloat(item.pri_quantity),
        })),
      },
      userId
    );

    return res.status(201).json({
      success: true,
      message: 'Purchase request created successfully',
      data: newPR,
    });
  } catch (error: any) {
    console.error('Error creating purchase request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create purchase request: ' + error.message,
    });
  }
});

export default router;
