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

export const apiGetSalesInvoices = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/sales-invoice`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) return { success: false, message: data.message || 'Failed to fetch sales invoices' };
    return { success: true, data: data.data };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to fetch sales invoices' };
  }
};

export const apiGetSICustomersWithDetails = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/sales-invoice/customers-details`, {
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

export const apiGetSIInventoryItems = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/sales-invoice/items`, {
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

export const apiCreateSalesInvoice = async (payload: any): Promise<ApiResponse<any>> => {
  try {
    const userId = await getUserId();
    const response = await fetch(`${API_URL}/sales-invoice/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, message: data.message || 'Failed to create sales invoice' };
    return { success: true, message: data.message, data: data.data };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to create sales invoice' };
  }
};

export const apiUpdateSalesInvoice = async (payload: any): Promise<ApiResponse<any>> => {
  try {
    const userId = await getUserId();
    const response = await fetch(`${API_URL}/sales-invoice/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, message: data.message || 'Failed to update sales invoice' };
    return { success: true, message: data.message };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to update sales invoice' };
  }
};
