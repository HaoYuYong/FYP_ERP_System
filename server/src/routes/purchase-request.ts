import express, { Request, Response } from 'express';
import {
  createPurchaseRequest,
  getPurchaseRequests,
  getSuppliers,
  getSuppliersWithDetails,
  getInventoryItems,
  updatePurchaseRequest,
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

/**
 * GET /api/purchase-request/suppliers-details
 * Fetch all suppliers with contact info for EditPanel Supplier tab dropdown.
 */
router.get('/suppliers-details', async (req: Request, res: Response) => {
  try {
    const suppliers = await getSuppliersWithDetails();
    return res.status(200).json({ success: true, data: suppliers });
  } catch (error: any) {
    console.error('Error fetching supplier details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch supplier details: ' + error.message,
    });
  }
});

/**
 * PUT /api/purchase-request/update
 * Update an existing purchase request header and its line items.
 * Body: { pr_id, reference_no?, terms?, remarks?, status?, supplier_id?, items? }
 */
router.put('/update', async (req: Request, res: Response) => {
  try {
    const { pr_id, reference_no, terms, remarks, status, supplier_id, items } = req.body;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    if (!pr_id) {
      return res.status(400).json({ success: false, message: 'PR ID is required' });
    }

    // Validate status if provided
    const validStatuses = ['draft', 'sent', 'received', 'closed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    // Validate each item — item_name required, quantity must be positive
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (!item.item_name || !item.item_name.trim()) {
          return res.status(400).json({ success: false, message: 'Item name is required for all items' });
        }
        const qty = parseFloat(item.pri_quantity);
        if (isNaN(qty) || qty <= 0) {
          return res.status(400).json({ success: false, message: 'All item quantities must be positive numbers' });
        }
      }
    }

    await updatePurchaseRequest(
      {
        pr_id,
        ...(reference_no !== undefined ? { reference_no } : {}),
        ...(terms !== undefined ? { terms } : {}),
        ...(remarks !== undefined ? { remarks } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(supplier_id !== undefined ? { supplier_id: supplier_id ? parseInt(supplier_id) : null } : {}),
        items: items || [],
      },
      userId
    );

    return res.status(200).json({
      success: true,
      message: 'Purchase request updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating purchase request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update purchase request: ' + error.message,
    });
  }
});

export default router;
