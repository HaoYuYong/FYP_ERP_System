import express, { Request, Response } from 'express';
import { supabase } from '../config/database';
import { registerUser, loginUser } from '../services/auth.service';

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user: Create Supabase auth + create user record with logging
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    // Validate input
    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: email, password, firstName, lastName, role',
      });
    }

    // Call service to register user (creates auth + user record + logging)
    const result = await registerUser(email, password, firstName, lastName, role);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  } catch (error: any) {
    console.error('Register error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration failed: ' + error.message,
    });
  }
});

/**
 * POST /api/auth/login
 * Login: Verify credentials via Supabase Auth, fetch user profile
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (!authData.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed',
      });
    }

    // Fetch user profile from database (with role info)
    const userResult = await loginUser(email, authData.user.id);

    if (!userResult.success) {
      return res.status(401).json(userResult);
    }

    // Return user data + session token
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: userResult.user,
      token: authData.session?.access_token, // Frontend can use this for subsequent requests
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed: ' + error.message,
    });
  }
});

export default router;