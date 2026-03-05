// ==============================================
// GLOBAL TYPE DEFINITIONS
// ==============================================
// This file contains TypeScript interfaces used across the application.
// They ensure type safety and help with code completion.

// ==============================================
// USER INTERFACE (NEW SCHEMA)
// ==============================================
/**
 * Represents a user record from the 'users' table.
 * This interface matches the database schema after our redesign.
 * - auth_id: UUID from Supabase Auth (primary key)
 * - email: user's email address
 * - first_name / last_name: user's name
 * - display_id: auto‑generated identifier like "A0012"
 * - role_id: foreign key to the role table
 * - role?: optional joined role object (used when we query with a join)
 * - created_at / updated_at: timestamps
 */
export interface User {
  auth_id: string;               // UUID from Supabase Auth (primary key)
  email: string;
  first_name: string;
  last_name: string;
  display_id: string;             // e.g., "A0012", "M0045"
  role_id: number;
  role?: Role;                    // Joined role info (optional)
  created_at: string;
  updated_at: string;
}

// ==============================================
// NAVIGATION ITEM INTERFACE
// ==============================================
/**
 * Describes an item in the sidebar navigation.
 * - name: display text
 * - href: URL path
 * - icon: React component for the icon
 * - current: whether this item is currently active (used for highlighting)
 */
export interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  current?: boolean;
}

// ==============================================
// REGISTRATION FORM DATA
// ==============================================
/**
 * Shape of the registration form data.
 * Used in RegisterPage for type‑safe form handling.
 */
export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'staff';
}

// ==============================================
// AUTHENTICATION RESPONSE
// ==============================================
/**
 * Standard response format for authentication operations.
 * Used by registerUser and similar functions.
 */
export interface AuthResponse {
  success: boolean;     // Whether the operation succeeded
  message: string;      // User‑friendly message
  user?: any;           // Optional user data (from Supabase)
}

// ==============================================
// ROLE INTERFACE
// ==============================================
/**
 * Represents a role from the 'role' table.
 * - role_id: numeric ID
 * - role_type: human‑readable name
 * - role_code: single‑letter code used in display_id
 */
export interface Role {
  role_id: number;
  role_type: 'admin' | 'manager' | 'staff';   // matches the allowed values
  role_code: 'A' | 'M' | 'S';
}