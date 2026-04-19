/**
 * Purchase Order API client - all purchase order operations go through backend API with automatic logging
 */

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

/**
 * Fetch all purchase orders with their line items (read-only).
 */
export const apiGetPurchaseOrders = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/purchase-order`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, message: data.message || 'Failed to fetch purchase orders' };
    }
    return { success: true, data: data.data };
  } catch (error: any) {
    console.error('Error fetching purchase orders:', error);
    return { success: false, message: error.message || 'Failed to fetch purchase orders' };
  }
};

/**
 * Fetch all suppliers with contact details for dropdown and detail display.
 */
export const apiGetSuppliersWithDetails = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/purchase-order/suppliers-details`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, message: data.message || 'Failed to fetch supplier details' };
    }
    return { success: true, data: data.data };
  } catch (error: any) {
    console.error('Error fetching supplier details:', error);
    return { success: false, message: error.message || 'Failed to fetch supplier details' };
  }
};

/**
 * Fetch all inventory items for dropdown selection (read-only).
 */
export const apiGetInventoryItems = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/purchase-order/items`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, message: data.message || 'Failed to fetch inventory items' };
    }
    return { success: true, data: data.data };
  } catch (error: any) {
    console.error('Error fetching inventory items:', error);
    return { success: false, message: error.message || 'Failed to fetch inventory items' };
  }
};

/**
 * Create a new purchase order with line items (automatically logged).
 */
export const apiCreatePurchaseOrder = async (payload: any): Promise<ApiResponse<any>> => {
  try {
    const userId = await getUserId();
    const response = await fetch(`${API_URL}/purchase-order/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, message: data.message || 'Failed to create purchase order' };
    }
    return { success: true, message: data.message, data: data.data };
  } catch (error: any) {
    console.error('Error creating purchase order:', error);
    return { success: false, message: error.message || 'Failed to create purchase order' };
  }
};

/**
 * Update an existing purchase order header and its line items (automatically logged).
 */
export const apiUpdatePurchaseOrder = async (payload: any): Promise<ApiResponse<any>> => {
  try {
    const userId = await getUserId();
    const response = await fetch(`${API_URL}/purchase-order/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, message: data.message || 'Failed to update purchase order' };
    }
    return { success: true, message: data.message };
  } catch (error: any) {
    console.error('Error updating purchase order:', error);
    return { success: false, message: error.message || 'Failed to update purchase order' };
  }
};
