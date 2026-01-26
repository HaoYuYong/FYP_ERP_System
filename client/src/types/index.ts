export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'manager' | 'staff';
  created_at: string;
  updated_at?: string;
  auth_id?: string;
}

export interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  current?: boolean;
}

export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'staff';
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: any;
}