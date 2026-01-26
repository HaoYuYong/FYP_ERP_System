import { createClient } from '@supabase/supabase-js'

// Get environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || ''
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || ''

// Create and export Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  }
})

// Helper function to get user role from metadata
export interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'manager' | 'staff'
  created_at: string
}

// Auth error types
export type AuthError = {
  message: string
  status?: number
}

// Register user function
export const registerUser = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: 'admin' | 'manager' | 'staff'
) => {
  try {
    // 1. Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          role: role,
        }
      }
    })

    if (authError) throw authError

    if (authData.user) {
      console.log('User registered in Auth:', authData.user.id)
      
      // Note: The database trigger (handle_new_user) will automatically create 
      // the user record in the public.users table
      // We just need to wait a moment and verify
      
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

// Get current user profile
export const getCurrentUserProfile = async () => {
  try {
    // Get current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) throw sessionError
    if (!sessionData.session) return null

    // Get user from public.users table using auth_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', sessionData.session.user.id)
      .single()

    if (userError) {
      console.error('Error fetching user profile:', userError)
      return null
    }

    return userData as UserProfile
  } catch (error) {
    console.error('Error getting user profile:', error)
    return null
  }
}