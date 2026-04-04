import express, { Request, Response } from 'express';
import { createSupplier, updateSupplier, deleteSupplier, getSuppliers } from '../services/supplier.service';

const router = express.Router();

/**
 * GET /api/supplier
 * Fetch all suppliers (read-only)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const suppliers = await getSuppliers();
    return res.status(200).json({ success: true, data: suppliers });
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch suppliers: ' + error.message });
  }
});

/**
 * POST /api/supplier/create
 * Create new supplier with logging
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { company_name, control_ac, branch_name, industry_name, industry_code, register_no_new, register_no_old, status } = req.body;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    // Validate required field
    if (!company_name || !company_name.trim()) {
      return res.status(400).json({ success: false, message: 'Company name is required' });
    }

    const newSupplier = await createSupplier(
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
      message: 'Supplier created successfully',
      data: newSupplier,
    });
  } catch (error: any) {
    console.error('Error creating supplier:', error);
    return res.status(500).json({ success: false, message: 'Failed to create supplier: ' + error.message });
  }
});

/**
 * POST /api/supplier/update
 * Update supplier with logging
 */
router.post('/update', async (req: Request, res: Response) => {
  try {
    const { supplier_id, company_name, control_ac, branch_name, industry_name, industry_code, register_no_new, register_no_old, status } = req.body;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    // Validate required field
    if (!supplier_id) {
      return res.status(400).json({ success: false, message: 'Supplier ID is required' });
    }

    const updatedSupplier = await updateSupplier(
      supplier_id,
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
      message: 'Supplier updated successfully',
      data: updatedSupplier,
    });
  } catch (error: any) {
    console.error('Error updating supplier:', error);
    return res.status(500).json({ success: false, message: 'Failed to update supplier: ' + error.message });
  }
});

/**
 * POST /api/supplier/delete
 * Delete supplier with logging
 */
router.post('/delete', async (req: Request, res: Response) => {
  try {
    const { supplier_id } = req.body;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    // Validate required field
    if (!supplier_id) {
      return res.status(400).json({ success: false, message: 'Supplier ID is required' });
    }

    await deleteSupplier(supplier_id, userId);

    return res.status(200).json({
      success: true,
      message: 'Supplier deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting supplier:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete supplier: ' + error.message });
  }
});

export default router;
