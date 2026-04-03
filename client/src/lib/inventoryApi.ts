/**
 * Inventory API client - all inventory operations go through backend API.
 * Each operation is automatically logged in the database audit trail.
 */

import { supabase } from './supabase';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Helper to get current user ID from Supabase Auth.
 */
const getUserId = async (): Promise<string> => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || 'anonymous';
};

export interface CreateInventoryPayload {
  item_name: string;
  serial_number?: string;
  balance_qty?: number;
  uom?: string;
  description?: string;
  classification_id?: number;
}

export interface UpdateInventoryPayload {
  item_id: number;
  item_name?: string;
  serial_number?: string;
  balance_qty?: number;
  uom?: string;
  description?: string;
  classification_id?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

/**
 * Get all inventory items (read-only, no logging needed).
 */
export const apiGetInventoryItems = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/inventory`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Failed to fetch inventory',
      };
    }

    return {
      success: true,
      data: data.data,
    };
  } catch (error: any) {
    console.error('Error fetching inventory:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch inventory',
    };
  }
};

/**
 * Create new inventory item via backend (automatically logged).
 */
export const apiCreateInventoryItem = async (
  payload: CreateInventoryPayload
): Promise<ApiResponse<any>> => {
  try {
    const userId = await getUserId();
    const response = await fetch(`${API_URL}/inventory/create`, {
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
        message: data.message || 'Failed to create inventory item',
      };
    }

    return {
      success: true,
      message: data.message,
      data: data.data,
    };
  } catch (error: any) {
    console.error('Error creating inventory item:', error);
    return {
      success: false,
      message: error.message || 'Failed to create inventory item',
    };
  }
};

/**
 * Update inventory item via backend (automatically logged).
 */
export const apiUpdateInventoryItem = async (
  payload: UpdateInventoryPayload
): Promise<ApiResponse<any>> => {
  try {
    const userId = await getUserId();
    const response = await fetch(`${API_URL}/inventory/update`, {
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
        message: data.message || 'Failed to update inventory item',
      };
    }

    return {
      success: true,
      message: data.message,
      data: data.data,
    };
  } catch (error: any) {
    console.error('Error updating inventory item:', error);
    return {
      success: false,
      message: error.message || 'Failed to update inventory item',
    };
  }
};

/**
 * Delete inventory item via backend (automatically logged).
 */
export const apiDeleteInventoryItem = async (itemId: number): Promise<ApiResponse<void>> => {
  try {
    const userId = await getUserId();
    const response = await fetch(`${API_URL}/inventory/delete`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({ item_id: itemId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Failed to delete inventory item',
      };
    }

    return {
      success: true,
      message: data.message,
    };
  } catch (error: any) {
    console.error('Error deleting inventory item:', error);
    return {
      success: false,
      message: error.message || 'Failed to delete inventory item',
    };
  }
};

/**
 * Get all classifications (read-only, no logging needed).
 */
export const apiGetClassifications = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/inventory/classifications`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Failed to fetch classifications',
      };
    }

    return {
      success: true,
      data: data.data,
    };
  } catch (error: any) {
    console.error('Error fetching classifications:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch classifications',
    };
  }
};

/**
 * Create new classification via backend (automatically logged).
 */
export const apiCreateClassification = async (payload: {
  classification_code: string;
  classification_title: string;
  classification_description?: string;
}): Promise<ApiResponse<any>> => {
  try {
    const userId = await getUserId();
    const response = await fetch(`${API_URL}/inventory/classification/create`, {
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
        message: data.message || 'Failed to create classification',
      };
    }

    return {
      success: true,
      message: data.message,
      data: data.data,
    };
  } catch (error: any) {
    console.error('Error creating classification:', error);
    return {
      success: false,
      message: error.message || 'Failed to create classification',
    };
  }
};
