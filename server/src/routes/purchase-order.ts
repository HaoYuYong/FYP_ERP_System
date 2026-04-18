import express, { Request, Response } from 'express';
import {
  createPurchaseOrder,
  getPurchaseOrders,
  getSuppliersWithDetails,
  getInventoryItems,
  updatePurchaseOrder,
} from '../services/purchase-order.service';

const router = express.Router();

/**
 * GET /api/purchase-order
 * Fetch all purchase orders with their line items (read-only).
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const purchaseOrders = await getPurchaseOrders();
    return res.status(200).json({ success: true, data: purchaseOrders });
  } catch (error: any) {
    console.error('Error fetching purchase orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase orders: ' + error.message,
    });
  }
});

/**
 * GET /api/purchase-order/suppliers-details
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
 * GET /api/purchase-order/items
 * Fetch all inventory items for dropdown selection (read-only).
 */
router.get('/items', async (req: Request, res: Response) => {
  try {
    const items = await getInventoryItems();
    return res.status(200).json({ success: true, data: items });
  } catch (error: any) {
    console.error('Error fetching inventory items:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory items: ' + error.message,
    });
  }
});

/**
 * POST /api/purchase-order/create
 * Create a new purchase order with line items and audit logging.
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { reference_no, terms, delivery_date, supplier_id, pr_id, remarks, items } = req.body;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }

    for (const item of items) {
      if (!item.item_name || !item.item_name.trim()) {
        return res.status(400).json({ success: false, message: 'Item name is required for all items' });
      }
      const qty = parseFloat(item.poi_quantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: 'Quantity must be a positive number' });
      }
    }

    const newPO = await createPurchaseOrder(
      {
        ...(reference_no ? { reference_no } : {}),
        ...(terms ? { terms } : {}),
        ...(delivery_date ? { delivery_date } : {}),
        ...(supplier_id ? { supplier_id: parseInt(supplier_id) } : {}),
        ...(pr_id ? { pr_id } : {}),
        ...(remarks ? { remarks } : {}),
        items: items.map((item: any) => ({
          ...(item.item_id ? { item_id: parseInt(item.item_id) } : {}),
          item_name: item.item_name,
          item_description: item.item_description || item.item_name,
          ...(item.uom ? { uom: item.uom } : {}),
          poi_quantity: parseFloat(item.poi_quantity),
          unit_price: item.unit_price ? parseFloat(item.unit_price) : 0,
          discount: item.discount ? parseFloat(item.discount) : 0,
        })),
      },
      userId
    );

    return res.status(201).json({
      success: true,
      message: 'Purchase order created successfully',
      data: newPO,
    });
  } catch (error: any) {
    console.error('Error creating purchase order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create purchase order: ' + error.message,
    });
  }
});

/**
 * PUT /api/purchase-order/update
 * Update an existing purchase order header and its line items.
 */
router.put('/update', async (req: Request, res: Response) => {
  try {
    const { po_id, reference_no, terms, delivery_date, remarks, status, supplier_id, items } = req.body;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    if (!po_id) {
      return res.status(400).json({ success: false, message: 'PO ID is required' });
    }

    const validStatuses = ['draft', 'sent', 'confirmed', 'received', 'closed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (!item.item_name || !item.item_name.trim()) {
          return res.status(400).json({ success: false, message: 'Item name is required for all items' });
        }
        const qty = parseFloat(item.poi_quantity);
        if (isNaN(qty) || qty <= 0) {
          return res.status(400).json({ success: false, message: 'All item quantities must be positive numbers' });
        }
      }
    }

    await updatePurchaseOrder(
      {
        po_id,
        ...(reference_no !== undefined ? { reference_no } : {}),
        ...(terms !== undefined ? { terms } : {}),
        ...(delivery_date !== undefined ? { delivery_date } : {}),
        ...(remarks !== undefined ? { remarks } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(supplier_id !== undefined ? { supplier_id: supplier_id ? parseInt(supplier_id) : null } : {}),
        items: items || [],
      },
      userId
    );

    return res.status(200).json({ success: true, message: 'Purchase order updated successfully' });
  } catch (error: any) {
    console.error('Error updating purchase order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update purchase order: ' + error.message,
    });
  }
});

export default router;
