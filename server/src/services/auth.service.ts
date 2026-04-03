import { supabase, pool } from '../config/database';
import { createLog, getTableId } from '../utils/logger';

/**
 * Register a new user with logging.
 * Creates auth user and user record, then logs the action.
 */
export const registerUser = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: 'admin' | 'manager' | 'staff',
  createdByUserId?: string // UUID of who created this user (for logging)
) => {
  try {
    // Create auth user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) {
      throw new Error('Failed to create authentication user');
    }

    const authId = authData.user.id;

    // Get role_id from role table
    const roleQuery = 'SELECT role_id FROM role WHERE role_code = $1';
    const roleResult = await pool.query(roleQuery, [getRoleCode(role)]);
    if (roleResult.rows.length === 0) {
      throw new Error('Invalid role');
    }
    const roleId = roleResult.rows[0].role_id;

    // Get next sequence value for display_id
    const roleCode = getRoleCode(role);
    const seqName = `seq_user_${roleCode.toLowerCase()}`;
    const seqQuery = `SELECT nextval('${seqName}') as next_val`;
    const seqResult = await pool.query(seqQuery);
    const seqNum = seqResult.rows[0].next_val;
    const displayId = `${roleCode}${String(seqNum).padStart(4, '0')}`;

    // Create log entry for user creation
    const tableId = await getTableId('users');
    const logId = await createLog({
      tableId,
      recordId: authId,
      actionType: 'INSERT',
      actionBy: createdByUserId || authId, // User creates their own account or admin creates it
      changedData: {
        email,
        first_name: firstName,
        last_name: lastName,
        display_id: displayId,
        role: role,
      },
    });

    // Insert user record with log_id reference
    const userQuery = `
      INSERT INTO users (auth_id, email, first_name, last_name, display_id, role_id, log_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING auth_id, email, first_name, last_name, display_id
    `;

    const userResult = await pool.query(userQuery, [
      authId,
      email,
      firstName,
      lastName,
      displayId,
      roleId,
      logId,
    ]);

    const newUser = userResult.rows[0];

    return {
      success: true,
      message: 'User registered successfully',
      user: newUser,
    };
  } catch (error: any) {
    console.error('Registration error:', error);
    return {
      success: false,
      message: error.message || 'Registration failed',
    };
  }
};

/**
 * Login user and return user data with role information.
 * Note: Actual password verification happens in Supabase Auth.
 * This endpoint verifies the user exists in the users table with their role.
 */
export const loginUser = async (email: string, authId: string) => {
  try {
    // Fetch user profile with role information
    const query = `
      SELECT 
        u.auth_id, 
        u.email, 
        u.first_name, 
        u.last_name, 
        u.display_id,
        r.role_type
      FROM users u
      JOIN role r ON u.role_id = r.role_id
      WHERE u.auth_id = $1 AND u.email = $2
    `;

    const result = await pool.query(query, [authId, email]);

    if (result.rows.length === 0) {
      throw new Error('User profile not found');
    }

    const user = result.rows[0];

    return {
      success: true,
      user: {
        id: user.auth_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        displayId: user.display_id,
        role: user.role_type,
      },
    };
  } catch (error: any) {
    console.error('Login error:', error);
    return {
      success: false,
      message: error.message || 'Login failed',
    };
  }
};

/**
 * Helper: Map role type to role code (A/M/S).
 */
const getRoleCode = (role: 'admin' | 'manager' | 'staff'): string => {
  const codeMap = {
    admin: 'A',
    manager: 'M',
    staff: 'S',
  };
  return codeMap[role] || 'S';
};
