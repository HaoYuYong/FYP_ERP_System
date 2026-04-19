/**
 * Purchase Request API client - all purchase request operations go through backend API with automatic logging
 */

import { supabase } from './supabase';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Get current user ID from Supabase Auth.
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
 * Fetch all purchase requests (read-only, no logging needed).
 */
export const apiGetPurchaseRequests = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/purchase-request`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Failed to fetch purchase requests',
      };
    }

    return {
      success: true,
      data: data.data,
    };
  } catch (error: any) {
    console.error('Error fetching purchase requests:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch purchase requests',
    };
  }
};

/**
 * Fetch all suppliers for dropdown selection (read-only, no logging needed).
 */
export const apiGetSuppliers = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/purchase-request/suppliers`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Failed to fetch suppliers',
      };
    }

    return {
      success: true,
      data: data.data,
    };
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch suppliers',
    };
  }
};

/**
 * Fetch all inventory items for dropdown selection (read-only, no logging needed).
 */
export const apiGetInventoryItems = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/purchase-request/items`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Failed to fetch inventory items',
      };
    }

    return {
      success: true,
      data: data.data,
    };
  } catch (error: any) {
    console.error('Error fetching inventory items:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch inventory items',
    };
  }
};

/**
 * Fetch all suppliers with contact details for EditPanel Supplier tab dropdown.
 */
export const apiGetSuppliersWithDetails = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/purchase-request/suppliers-details`, {
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
 * Update an existing purchase request header and its line items (automatically logged).
 */
export const apiUpdatePurchaseRequest = async (payload: any): Promise<ApiResponse<any>> => {
  try {
    const userId = await getUserId();
    const response = await fetch(`${API_URL}/purchase-request/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, message: data.message || 'Failed to update purchase request' };
    }
    return { success: true, message: data.message };
  } catch (error: any) {
    console.error('Error updating purchase request:', error);
    return { success: false, message: error.message || 'Failed to update purchase request' };
  }
};

/**
 * Create new purchase request and its line items via backend (automatically logged).
 */
export const apiCreatePurchaseRequest = async (payload: any): Promise<ApiResponse<any>> => {
  try {
    const userId = await getUserId();
    const response = await fetch(`${API_URL}/purchase-request/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Failed to create purchase request',
      };
    }

    return {
      success: true,
      message: data.message,
      data: data.data,
    };
  } catch (error: any) {
    console.error('Error creating purchase request:', error);
    return {
      success: false,
      message: error.message || 'Failed to create purchase request',
    };
  }
};
