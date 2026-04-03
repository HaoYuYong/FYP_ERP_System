/**
 * API client for backend authentication endpoints.
 * All auth operations (register, login) go through the backend to ensure logging.
 */

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'staff';
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    displayId: string;
    role: string;
  };
  token?: string;
}

/**
 * Register new user via backend.
 * Backend handles: auth.signUp + user record creation + logging.
 */
export const apiRegisterUser = async (payload: RegisterPayload): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Registration failed',
      };
    }

    return data;
  } catch (error: any) {
    console.error('Registration error:', error);
    return {
      success: false,
      message: error.message || 'Registration failed',
    };
  }
};

/**
 * Login user via backend.
 * Backend handles: Supabase auth + fetch user profile + return user data.
 */
export const apiLoginUser = async (payload: LoginPayload): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Login failed',
      };
    }

    // Store token for future API requests if needed
    if (data.token) {
      localStorage.setItem('authToken', data.token);
    }

    return data;
  } catch (error: any) {
    console.error('Login error:', error);
    return {
      success: false,
      message: error.message || 'Login failed',
    };
  }
};
