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

export const apiGetProformaInvoices = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/proforma-invoice`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) return { success: false, message: data.message || 'Failed to fetch proforma invoices' };
    return { success: true, data: data.data };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to fetch proforma invoices' };
  }
};

export const apiGetPICustomersWithDetails = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/proforma-invoice/customers-details`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) return { success: false, message: data.message || 'Failed to fetch customers' };
    return { success: true, data: data.data };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to fetch customers' };
  }
};

export const apiGetPIInventoryItems = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/proforma-invoice/items`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) return { success: false, message: data.message || 'Failed to fetch inventory items' };
    return { success: true, data: data.data };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to fetch inventory items' };
  }
};

export const apiCreateProformaInvoice = async (payload: any): Promise<ApiResponse<any>> => {
  try {
    const userId = await getUserId();
    const response = await fetch(`${API_URL}/proforma-invoice/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, message: data.message || 'Failed to create proforma invoice' };
    return { success: true, message: data.message, data: data.data };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to create proforma invoice' };
  }
};

export const apiUpdateProformaInvoice = async (payload: any): Promise<ApiResponse<any>> => {
  try {
    const userId = await getUserId();
    const response = await fetch(`${API_URL}/proforma-invoice/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, message: data.message || 'Failed to update proforma invoice' };
    return { success: true, message: data.message };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to update proforma invoice' };
  }
};
