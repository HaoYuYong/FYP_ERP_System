import express, { Request, Response } from 'express';
import {
  createProformaInvoice,
  getProformaInvoices,
  getCustomersWithDetails,
  getInventoryItems,
  updateProformaInvoice,
} from '../services/proforma-invoice.service';

const router = express.Router();

/**
 * GET /api/proforma-invoice
 * Fetch all proforma invoices with their line items.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const invoices = await getProformaInvoices();
    return res.status(200).json({ success: true, data: invoices });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch proforma invoices: ' + error.message });
  }
});

/**
 * GET /api/proforma-invoice/customers-details
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
 * GET /api/proforma-invoice/items
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
 * POST /api/proforma-invoice/create
 * Create a new proforma invoice with line items and logging.
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { reference_no, terms, customer_id, remarks, items, quot_id } = req.body;
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
      const qty = parseFloat(item.pi_quantity);
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

    const newInvoice = await createProformaInvoice(
      {
        ...(reference_no ? { reference_no } : {}),
        ...(terms ? { terms } : {}),
        ...(customer_id ? { customer_id: parseInt(customer_id) } : {}),
        ...(remarks ? { remarks } : {}),
        ...(quot_id ? { quot_id: String(quot_id) } : {}),
        items: items.map((item: any) => ({
          ...(item.item_id ? { item_id: parseInt(item.item_id) } : {}),
          item_name: item.item_name,
          item_description: item.item_description || item.item_name,
          ...(item.uom ? { uom: item.uom } : {}),
          pi_quantity: parseFloat(item.pi_quantity),
          unit_price: parseFloat(item.unit_price),
          discount: parseFloat(item.discount ?? 0),
          line_total: parseFloat(item.line_total ?? 0),
        })),
      },
      userId
    );

    return res.status(201).json({ success: true, message: 'Proforma invoice created successfully', data: newInvoice });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to create proforma invoice: ' + error.message });
  }
});

/**
 * PUT /api/proforma-invoice/update
 * Update an existing proforma invoice header and its line items.
 */
router.put('/update', async (req: Request, res: Response) => {
  try {
    const { pi_id, reference_no, terms, remarks, status, customer_id, total_amount, items } = req.body;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    if (!pi_id) {
      return res.status(400).json({ success: false, message: 'Proforma invoice ID is required' });
    }

    const validStatuses = ['draft', 'confirmed', 'paid', 'closed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (!item.item_name || !item.item_name.trim()) {
          return res.status(400).json({ success: false, message: 'Item name is required for all items' });
        }
        const qty = parseFloat(item.pi_quantity);
        if (isNaN(qty) || qty <= 0) {
          return res.status(400).json({ success: false, message: 'All item quantities must be positive numbers' });
        }
      }
    }

    await updateProformaInvoice(
      {
        pi_id,
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

    return res.status(200).json({ success: true, message: 'Proforma invoice updated successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to update proforma invoice: ' + error.message });
  }
});

export default router;
