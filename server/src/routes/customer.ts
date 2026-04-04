import express, { Request, Response } from 'express';
import { createCustomer, updateCustomer, deleteCustomer, getCustomers } from '../services/customer.service';

const router = express.Router();

/**
 * GET /api/customer
 * Fetch all customers (read-only)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const customers = await getCustomers();
    return res.status(200).json({ success: true, data: customers });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch customers: ' + error.message });
  }
});

/**
 * POST /api/customer/create
 * Create new customer with logging
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { company_name, control_ac, branch_name, industry_name, industry_code, register_no_new, register_no_old, status } = req.body;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    // Validate required field
    if (!company_name || !company_name.trim()) {
      return res.status(400).json({ success: false, message: 'Company name is required' });
    }

    const newCustomer = await createCustomer(
      {
        company_name,
        ...(control_ac ? { control_ac } : {}),
        ...(branch_name ? { branch_name } : {}),
        ...(industry_name ? { industry_name } : {}),
        ...(industry_code ? { industry_code } : {}),
        ...(register_no_new ? { register_no_new } : {}),
        ...(register_no_old ? { register_no_old } : {}),
        ...(status ? { status } : {}),
      },
      userId
    );

    return res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: newCustomer,
    });
  } catch (error: any) {
    console.error('Error creating customer:', error);
    return res.status(500).json({ success: false, message: 'Failed to create customer: ' + error.message });
  }
});

/**
 * POST /api/customer/update
 * Update customer with logging
 */
router.post('/update', async (req: Request, res: Response) => {
  try {
    const { customer_id, company_name, control_ac, branch_name, industry_name, industry_code, register_no_new, register_no_old, status } = req.body;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    // Validate required field
    if (!customer_id) {
      return res.status(400).json({ success: false, message: 'Customer ID is required' });
    }

    const updatedCustomer = await updateCustomer(
      customer_id,
      {
        company_name,
        control_ac,
        branch_name,
        industry_name,
        industry_code,
        register_no_new,
        register_no_old,
        status,
      },
      userId
    );

    return res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: updatedCustomer,
    });
  } catch (error: any) {
    console.error('Error updating customer:', error);
    return res.status(500).json({ success: false, message: 'Failed to update customer: ' + error.message });
  }
});

/**
 * POST /api/customer/delete
 * Delete customer with logging
 */
router.post('/delete', async (req: Request, res: Response) => {
  try {
    const { customer_id } = req.body;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    // Validate required field
    if (!customer_id) {
      return res.status(400).json({ success: false, message: 'Customer ID is required' });
    }

    await deleteCustomer(customer_id, userId);

    return res.status(200).json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete customer: ' + error.message });
  }
});

export default router;
