import express, { Request, Response } from 'express';
import {
  getCompanySettings,
  updateCompanySettings,
} from '../services/company-settings.service';

const router = express.Router();

/**
 * GET /api/company-settings
 * Fetch the singleton company settings row (settings_id = 1).
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const settings = await getCompanySettings();
    return res.status(200).json({ success: true, data: settings });
  } catch (error: any) {
    console.error('Error fetching company settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch company settings: ' + error.message,
    });
  }
});

/**
 * PUT /api/company-settings/update
 * Update the singleton company settings row (always settings_id = 1).
 * Requires x-user-id header for audit logging.
 */
router.put('/update', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'anonymous';
    const {
      company_name,
      register_no,
      address,
      city,
      state,
      country,
      post_code,
      phone,
      email,
      website,
    } = req.body;

    const updated = await updateCompanySettings(
      {
        company_name,
        register_no,
        address,
        city,
        state,
        country,
        post_code,
        phone,
        email,
        website,
      },
      userId
    );

    return res.status(200).json({
      success: true,
      message: 'Company settings updated successfully',
      data: updated,
    });
  } catch (error: any) {
    console.error('Error updating company settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update company settings: ' + error.message,
    });
  }
});

export default router;
