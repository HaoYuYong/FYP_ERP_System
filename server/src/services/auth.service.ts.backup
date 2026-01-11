import { supabase } from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// JWT Configuration with type safety
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret_key'; // Secret key for signning JWT tokens
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // Token expiration time

// TypeScript interfaces for better type safety
export interface LoginCredentials {
  email: string; // User email for login
  password: string; // User password for login
}

// New user email, password, and profile data
export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'manager' | 'staff'; // New user role (only allowed values)
}

export interface AuthResponse {
  success: boolean; // Operation success status
  message: string; // Response message for client
  token?: string; // JWT token if login/register successful
  user?: { // User data without sensitive information
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  };
}

// JWT payload interface (data stored inside the token)
interface JWTPayload {
  id: number;
  email: string;
  role: string;
}

export class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Validate input: ensure email and password are provided
      if (!credentials.email || !credentials.password) {
        return {
          success: false,
          message: 'Email and password are required',
        };
      }

      // Query user from database: find user by email
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', credentials.email)
        .single();

      // User not found or database error
      if (error || !user) {
        // Generic error for security (don't reveal if user exists)
        return {
          success: false,
          message: 'Invalid email or password',
        };
      }

      // Verify password: compare input with stored hash
      const isPasswordValid = await comparePassword(
        credentials.password,
        user.password_hash
      );

      // Password doesn't match
      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Invalid email or password',
        };
      }

      // Create JWT payload: data to encode in token
      const payload: JWTPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      // Generate JWT token: create signed token with payload
      const token = jwt.sign(
        payload, // Data to store in token
        JWT_SECRET as jwt.Secret, // Secret key for signing
        {
          expiresIn: JWT_EXPIRES_IN, // Token expiry time
          algorithm: 'HS256', // Explicitly specify algorithm
        } as jwt.SignOptions
      );

      // Return success response
      return {
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'An error occurred during login',
      };
    }
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      // Validate all required fields are provided
      if (!data.email || !data.password || !data.first_name || !data.last_name || !data.role) {
        return {
          success: false,
          message: 'All fields are required',
        };
      }

      // Check if user already exists: prevent duplicate emails
      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', data.email)
        .single();
      // IF Email already registered
      if (existingUser) {
        return {
          success: false,
          message: 'Email already registered',
        };
      }

      // Hash password before storing in database
      const hashedPassword = await hashPassword(data.password);

      // Create new user in database
      const { data: newUser, error } = await supabase
        .from('users')
        .insert([ // Insert new user record
          {
            email: data.email,
            password_hash: hashedPassword,
            first_name: data.first_name,
            last_name: data.last_name,
            role: data.role,
          },
        ])
        .select()
        .single();

      // Database insertion error
      if (error) {
        console.error('Registration database error:', error);
        return {
          success: false,
          message: 'Failed to create user in database',
        };
      }

      // Create JWT payload for new user
      const payload: JWTPayload = {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      };

      // Generate JWT token for auto-login after registration
      const token = jwt.sign(
        payload,
        JWT_SECRET as jwt.Secret, // Type assertion
        {
          expiresIn: JWT_EXPIRES_IN,
          algorithm: 'HS256',
        } as jwt.SignOptions
      );

      // Return success with token and user data
      return {
        success: true,
        message: 'Registration successful',
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          role: newUser.role,
        },
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: 'An error occurred during registration',
      };
    }
  }

  // Optional: Token verification method
  async verifyToken(token: string): Promise<JWTPayload | null> {
    try {
      // Verify token signature and decode payload  
      const decoded = jwt.verify(token, JWT_SECRET as jwt.Secret) as JWTPayload;
      return decoded;
    } catch (error) {
      // Token is invalid or expired
      console.error('Token verification error:', error);
      return null;
    }
  }
}

// Export singleton instance for use throughout application
export const authService = new AuthService();