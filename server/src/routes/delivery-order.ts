import express, { Request, Response } from 'express';
import {
  createDeliveryOrder,
  getDeliveryOrders,
  getCustomersWithDetails,
  getInventoryItems,
  updateDeliveryOrder,
} from '../services/delivery-order.service';

const router = express.Router();

/**
 * GET /api/delivery-order
 * Fetch all delivery orders with their line items.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const orders = await getDeliveryOrders();
    return res.status(200).json({ success: true, data: orders });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch delivery orders: ' + error.message });
  }
});

/**
 * GET /api/delivery-order/customers-details
 * Fetch all customers with contact info for dropdown and display.
 */
router.get('/customers-details', async (req: Request, res: Response) => {
  try {
    const customers = await getCustomersWithDetails();
    return res.status(200).json({ success: true, data: customers });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch customers: ' + error.message });
  }
});

/**
 * GET /api/delivery-order/items
 * Fetch all inventory items for dropdown selection.
 */
router.get('/items', async (req: Request, res: Response) => {
  try {
    const items = await getInventoryItems();
    return res.status(200).json({ success: true, data: items });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch inventory items: ' + error.message });
  }
});

/**
 * POST /api/delivery-order/create
 * Create a new delivery order with line items and logging.
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { reference_no, terms, delivery_date, customer_id, remarks, items, pi_id } = req.body;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    if (!reference_no || !reference_no.trim()) {
      return res.status(400).json({ success: false, message: 'Reference number is required' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }

    for (const item of items) {
      if (!item.item_name || !item.item_name.trim()) {
        return res.status(400).json({ success: false, message: 'Item name is required for all items' });
      }
      const qty = parseFloat(item.do_quantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: 'Quantity must be a positive number' });
      }
      const price = parseFloat(item.unit_price);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ success: false, message: 'Unit price must be a non-negative number' });
      }
      const discount = parseFloat(item.discount ?? 0);
      if (isNaN(discount) || discount < 0) {
        return res.status(400).json({ success: false, message: 'Discount must be a non-negative number' });
      }
    }

    const newOrder = await createDeliveryOrder(
      {
        ...(reference_no ? { reference_no } : {}),
        ...(terms ? { terms } : {}),
        ...(delivery_date ? { delivery_date } : {}),
        ...(customer_id ? { customer_id: parseInt(customer_id) } : {}),
        ...(remarks ? { remarks } : {}),
        ...(pi_id ? { pi_id: String(pi_id) } : {}),
        items: items.map((item: any) => ({
          ...(item.item_id ? { item_id: parseInt(item.item_id) } : {}),
          item_name: item.item_name,
          item_description: item.item_description || item.item_name,
          ...(item.uom ? { uom: item.uom } : {}),
          do_quantity: parseFloat(item.do_quantity),
          unit_price: parseFloat(item.unit_price),
          discount: parseFloat(item.discount ?? 0),
          line_total: parseFloat(item.line_total ?? 0),
        })),
      },
      userId
    );

    return res.status(201).json({ success: true, message: 'Delivery order created successfully', data: newOrder });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to create delivery order: ' + error.message });
  }
});

/**
 * PUT /api/delivery-order/update
 * Update an existing delivery order header and its line items.
 */
router.put('/update', async (req: Request, res: Response) => {
  try {
    const { do_id, reference_no, terms, delivery_date, remarks, status, customer_id, total_amount, items } = req.body;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    if (!do_id) {
      return res.status(400).json({ success: false, message: 'Delivery order ID is required' });
    }

    const validStatuses = ['draft', 'sent', 'delivered', 'closed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (!item.item_name || !item.item_name.trim()) {
          return res.status(400).json({ success: false, message: 'Item name is required for all items' });
        }
        const qty = parseFloat(item.do_quantity);
        if (isNaN(qty) || qty <= 0) {
          return res.status(400).json({ success: false, message: 'All item quantities must be positive numbers' });
        }
      }
    }

    await updateDeliveryOrder(
      {
        do_id,
        ...(reference_no !== undefined ? { reference_no } : {}),
        ...(terms !== undefined ? { terms } : {}),
        ...(delivery_date !== undefined ? { delivery_date: delivery_date || null } : {}),
        ...(remarks !== undefined ? { remarks } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(customer_id !== undefined ? { customer_id: customer_id ? parseInt(customer_id) : null } : {}),
        ...(total_amount !== undefined ? { total_amount: parseFloat(total_amount) } : {}),
        items: items || [],
      },
      userId
    );

    return res.status(200).json({ success: true, message: 'Delivery order updated successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to update delivery order: ' + error.message });
  }
});

export default router;
