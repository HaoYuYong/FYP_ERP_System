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

export const apiGetDeliveryOrders = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/delivery-order`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) return { success: false, message: data.message || 'Failed to fetch delivery orders' };
    return { success: true, data: data.data };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to fetch delivery orders' };
  }
};

export const apiGetDOCustomersWithDetails = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/delivery-order/customers-details`, {
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

export const apiGetDOInventoryItems = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/delivery-order/items`, {
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

export const apiCreateDeliveryOrder = async (payload: any): Promise<ApiResponse<any>> => {
  try {
    const userId = await getUserId();
    const response = await fetch(`${API_URL}/delivery-order/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, message: data.message || 'Failed to create delivery order' };
    return { success: true, message: data.message, data: data.data };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to create delivery order' };
  }
};

export const apiUpdateDeliveryOrder = async (payload: any): Promise<ApiResponse<any>> => {
  try {
    const userId = await getUserId();
    const response = await fetch(`${API_URL}/delivery-order/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, message: data.message || 'Failed to update delivery order' };
    return { success: true, message: data.message };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to update delivery order' };
  }
};
