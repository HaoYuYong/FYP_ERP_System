/**
 * Customer API client - all customer operations go through backend API with automatic logging
 */

import { supabase } from './supabase';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Get current user ID from Supabase Auth
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
 * Fetch all customers (read-only, no logging needed)
 */
export const apiGetCustomers = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${API_URL}/customer`, { method: 'GET' });
    const data = await response.json();
    return { success: data.success, data: data.data };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

/**
 * Create new customer via backend API (automatically logged)
 */
export const apiCreateCustomer = async (payload: any): Promise<ApiResponse<any>> => {
  try {
    const userId = await getUserId();
    const response = await fetch(`${API_URL}/customer/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return { success: data.success, message: data.message, data: data.data };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

/**
 * Update customer via backend API (automatically logged with before/after)
 */
export const apiUpdateCustomer = async (payload: any): Promise<ApiResponse<any>> => {
  try {
    const userId = await getUserId();
    const response = await fetch(`${API_URL}/customer/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return { success: data.success, message: data.message, data: data.data };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

/**
 * Delete customer via backend API (automatically logged with complete record)
 */
export const apiDeleteCustomer = async (customerId: number): Promise<ApiResponse<void>> => {
  try {
    const userId = await getUserId();
    const response = await fetch(`${API_URL}/customer/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({ customer_id: customerId }),
    });
    const data = await response.json();
    return { success: data.success, message: data.message };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};
