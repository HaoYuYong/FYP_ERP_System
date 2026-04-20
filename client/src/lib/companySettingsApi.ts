import { supabase } from './supabase';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getUserId = async (): Promise<string> => {
  const stored = localStorage.getItem('userId');
  if (stored) return stored;
  const { data } = await supabase.auth.getUser();
  return data.user?.id || 'anonymous';
};

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface CompanySettings {
  settings_id: number;
  company_name: string;
  register_no: string;
  address: string;
  city: string;
  state: string;
  country: string;
  post_code: string;
  phone: string;
  email: string;
  website: string;
}

/**
 * Fetch the singleton company settings row (settings_id = 1).
 */
export const apiGetCompanySettings = async (): Promise<ApiResponse<CompanySettings>> => {
  try {
    const response = await fetch(`${API_URL}/company-settings`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) return { success: false, message: data.message || 'Failed to fetch company settings' };
    return { success: true, data: data.data };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to fetch company settings' };
  }
};

/**
 * Update the singleton company settings row.
 */
export const apiUpdateCompanySettings = async (
  payload: Partial<CompanySettings>
): Promise<ApiResponse<CompanySettings>> => {
  try {
    const userId = await getUserId();
    const response = await fetch(`${API_URL}/company-settings/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, message: data.message || 'Failed to update company settings' };
    return { success: true, message: data.message, data: data.data };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to update company settings' };
  }
};
