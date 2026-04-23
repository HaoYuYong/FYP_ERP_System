import express, { Request, Response } from 'express';
import {
  createQuotation,
  getQuotations,
  getCustomersWithDetails,
  getInventoryItems,
  updateQuotation,
} from '../services/quotation.service';

const router = express.Router();

/**
 * GET /api/quotation
 * Fetch all quotations with their line items.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const quotations = await getQuotations();
    return res.status(200).json({ success: true, data: quotations });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch quotations: ' + error.message });
  }
});

/**
 * GET /api/quotation/customers-details
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
 * GET /api/quotation/items
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
 * POST /api/quotation/create
 * Create a new quotation with line items and logging.
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { reference_no, terms, customer_id, remarks, items } = req.body;
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
      const qty = parseFloat(item.qi_quantity);
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

    const newQuotation = await createQuotation(
      {
        ...(reference_no ? { reference_no } : {}),
        ...(terms ? { terms } : {}),
        ...(customer_id ? { customer_id: parseInt(customer_id) } : {}),
        ...(remarks ? { remarks } : {}),
        items: items.map((item: any) => ({
          ...(item.item_id ? { item_id: parseInt(item.item_id) } : {}),
          item_name: item.item_name,
          item_description: item.item_description || item.item_name,
          ...(item.uom ? { uom: item.uom } : {}),
          qi_quantity: parseFloat(item.qi_quantity),
          unit_price: parseFloat(item.unit_price),
          discount: parseFloat(item.discount ?? 0),
          line_total: parseFloat(item.line_total ?? 0),
        })),
      },
      userId
    );

    return res.status(201).json({ success: true, message: 'Quotation created successfully', data: newQuotation });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to create quotation: ' + error.message });
  }
});

/**
 * PUT /api/quotation/update
 * Update an existing quotation header and its line items.
 */
router.put('/update', async (req: Request, res: Response) => {
  try {
    const { quot_id, reference_no, terms, remarks, status, customer_id, total_amount, items } = req.body;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    if (!quot_id) {
      return res.status(400).json({ success: false, message: 'Quotation ID is required' });
    }

    const validStatuses = ['draft', 'sent', 'accepted', 'rejected', 'closed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (!item.item_name || !item.item_name.trim()) {
          return res.status(400).json({ success: false, message: 'Item name is required for all items' });
        }
        const qty = parseFloat(item.qi_quantity);
        if (isNaN(qty) || qty <= 0) {
          return res.status(400).json({ success: false, message: 'All item quantities must be positive numbers' });
        }
      }
    }

    await updateQuotation(
      {
        quot_id,
        ...(reference_no !== undefined ? { reference_no } : {}),
        ...(terms !== undefined ? { terms } : {}),
        ...(remarks !== undefined ? { remarks } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(customer_id !== undefined ? { customer_id: customer_id ? parseInt(customer_id) : null } : {}),
        ...(total_amount !== undefined ? { total_amount: parseFloat(total_amount) } : {}),
        items: items || [],
      },
      userId
    );

    return res.status(200).json({ success: true, message: 'Quotation updated successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to update quotation: ' + error.message });
  }
});

export default router;
