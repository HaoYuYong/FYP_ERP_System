import { createClient } from '@supabase/supabase-js'

// ==============================================
// SUPABASE CLIENT CONFIGURATION
// ==============================================
// Read the Supabase URL and anonymous key from environment variables.
// These are set in .env file and should never be hard-coded.
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || ''
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || ''

// Create and export a single Supabase client instance.
// This client will be used for all database and auth operations.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,     // Automatically refresh the JWT token when it expires
    persistSession: true,       // Keep the user logged in across page reloads (using localStorage)
    detectSessionInUrl: true    // Detect OAuth redirects in the URL
  },
  db: {
    schema: 'public'            // Use the 'public' schema (default)
  }
})

// ==============================================
// TYPE DEFINITIONS
// ==============================================

/**
 * Role Interface
 * Describes the structure of a role as stored in the 'role' table.
 * - role_id: numeric ID used as foreign key.
 * - role_type: human-readable name ('admin', 'manager', 'staff').
 * - role_code: single-letter code ('A', 'M', 'S') used to build display_id.
 */
export interface Role {
  role_id: number;
  role_type: 'admin' | 'manager' | 'staff';
  role_code: 'A' | 'M' | 'S';
}

/**
 * UserProfile Interface
 * Describes the structure of a user record in the 'users' table.
 * This matches the new database schema with display_id and role_id.
 * The optional 'role' field is used when we join the role table.
 */
export interface UserProfile {
  auth_id: string;              // UUID from Supabase Auth (primary key, links to auth.users)
  email: string;                
  first_name: string;
  last_name: string;
  display_id: string;           // Auto‑generated identifier, e.g., "A0012"
  role_id: number;              // Foreign key to the role table
  created_at: string;
  updated_at: string;
  role?: Role;                  // Joined role data (optional, only present when we ask for it)
}

export type AuthError = {
  message: string;
  status?: number;
}

// ==============================================
// REGISTER USER
// ==============================================
/**
 * Registers a new user using Supabase Auth.
 * The user's metadata (first_name, last_name, role) is stored in auth.users.
 * A database trigger will later copy the data into the public.users table
 * and generate a display_id.
 */
export const registerUser = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: 'admin' | 'manager' | 'staff'
) => {
  try {
    // Call Supabase Auth signUp method
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {    // Custom metadata stored in auth.users.raw_user_meta_data
          first_name: firstName,
          last_name: lastName,
          role: role,
        }
      }
    })

    if (authError) throw authError

    if (authData.user) {
      console.log('User registered in Auth:', authData.user.id)
      return {
        success: true,
        message: 'User registered successfully! Please check your email to verify your account.',
        user: authData.user
      }
    }

    return {
      success: false,
      message: 'Registration failed'
    }
  } catch (error: any) {
    console.error('Registration error:', error)
    return {
      success: false,
      message: error.message || 'Registration failed'
    }
  }
}

// ==============================================
// GET CURRENT USER PROFILE
// ==============================================
/**
 * Fetches the profile of the currently logged-in user from the 'users' table,
 * including the joined role data.
 *
 * Steps:
 * 1. Get the current session from Supabase Auth.
 * 2. If a session exists, query the 'users' table for the record with matching auth_id.
 * 3. Use a nested select to also fetch the role details (role_type, role_code).
 *
 * @returns The user profile object (with role) or null if not logged in / error.
 */
export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  try {
    // 1. Get current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    if (!sessionData.session) return null // No active session → not logged in

    // 2. Query the users table, joining the role table via role_id
    // 'role:role_id' - This tells Supabase to join the role table using role_id
    const { data, error } = await supabase
      .from('users')
      .select(`
        auth_id,
        email,
        first_name,
        last_name,
        display_id,
        role_id,
        created_at,
        updated_at,
        role:role_id (
          role_id,
          role_type,
          role_code
        )
      `)
      .eq('auth_id', sessionData.session.user.id)
      .single()

    if (error) {
      console.error('Error fetching user profile:', error)
      return null
    }

    // TypeScript sometimes thinks `role` could be an array because of how Supabase types work.
    // In reality, it's a single object. We cast through `unknown` to satisfy the compiler.
    return data as unknown as UserProfile
  } catch (error) {
    console.error('Error getting user profile:', error)
    return null
  }
}