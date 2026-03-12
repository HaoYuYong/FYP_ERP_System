import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom'; // <-- Added import for navigation
import { supabase } from '../lib/supabase';

// ==============================================
// TYPE DEFINITIONS
// ==============================================

/**
 * Role Interface – matches the structure of the role table.
 */
interface Role {
  role_id: number;
  role_type: 'admin' | 'manager' | 'staff';
  role_code: 'A' | 'M' | 'S';
}

/**
 * User Interface – matches the structure of the users table,
 * including an optional `role` object for joined data.
 */
interface User {
  auth_id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_id: string;
  role_id: number;
  created_at: string;
  updated_at: string;
  role?: Role;              // Joined role info (present after the query)
}

/**
 * TestUsers Component
 *
 * Purpose:
 * - Fetches and displays a list of all registered users.
 * - Shows each user's display_id, name, email, role, auth_id (truncated), and creation date.
 * - Includes a loading spinner and error handling.
 * - Demonstrates how to query the users table with a join to the role table.
 */
const TestUsers: React.FC = () => {
  // State variables
  const [users, setUsers] = useState<User[]>([]);     // List of users
  const [loading, setLoading] = useState(true);       // Loading indicator
  const [error, setError] = useState('');             // Error message

  // ==============================================
  // FETCH USERS
  // ==============================================
  /**
   * fetchUsers – retrieves all users from the database.
   * Uses a Supabase query with a join to the role table.
   * Also transforms the result to ensure `role` is a single object (not an array).
   */
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');

      // Query the 'users' table, including the joined role data
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
        .order('created_at', { ascending: false });   // Newest first

      if (error) throw error;

      // Supabase's TypeScript types sometimes represent the joined `role` as an array,
      // but it's actually a single object. We transform it here.
      const transformedData: User[] = (data || []).map((item: any) => ({
        ...item,
        role: Array.isArray(item.role) ? item.role[0] : item.role
      }));

      setUsers(transformedData);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  // Run fetchUsers once when the component mounts
  useEffect(() => {
    fetchUsers();
  }, []);

  // ==============================================
  // RENDER
  // ==============================================
  return (
    <div className="p-6">
      {/* Header with title and Register button */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Registered Users</h1>
        <Link
          to="/register"
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Register New User
        </Link>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
          <div className="font-medium">Error Loading Users</div>
          <div className="text-sm mt-1">{error}</div>
        </div>
      )}

      {/* Loading spinner */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <svg className="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="ml-3 text-gray-600">Loading users...</span>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Display ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Auth ID
                  </th> */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>

              {/* Table body */}
              <tbody className="bg-white divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5 0a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z" />
                      </svg>
                      <p className="mt-2">No users found</p>
                      <p className="text-sm mt-1">Register a user to see them here</p>
                    </td>
                  </tr>
                ) : (
                  // Map over users array to create table rows
                  users.map((user) => (
                    <tr key={user.auth_id} className="hover:bg-gray-50 transition-colors">
                      {/* Display ID – prominently shown in primary color */}
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-sm font-medium text-primary-600">
                        {user.display_id}
                      </td>
                      
                      {/* Full name */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </div>
                      </td>
                      
                      {/* Email */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.email}</div>
                      </td>

                      {/* Role – displayed as a badge with color coding */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role?.role_code === 'A' ? 'bg-purple-100 text-purple-800' :
                          user.role?.role_code === 'M' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role?.role_type} ({user.role?.role_code})
                        </span>
                      </td>

                      {/* Auth ID (UUID) – truncated for readability, full UUID on hover */}
                      {/* <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-500 font-mono text-xs truncate max-w-[120px]" title={user.auth_id}>
                          {user.auth_id ? `${user.auth_id.substring(0, 8)}...` : 'N/A'}
                        </div>
                      </td> */}

                      {/* Creation date – formatted nicely */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action buttons and summary */}
      <div className="mt-6 flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {users.length} user{users.length !== 1 ? 's' : ''} found
        </div>
        <button
          onClick={fetchUsers}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh List
        </button>
      </div>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">How This Works (Updated Schema)</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>This page shows all users registered in the system. Users are:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Created in Supabase Authentication when registered</li>
                <li>Automatically added to the <code className="bg-blue-100 px-1 rounded">public.users</code> table via database trigger</li>
                <li>Each user gets a <code className="bg-blue-100 px-1 rounded">display_id</code> (e.g., <strong>A0012</strong>) generated from a role‑based sequence</li>
                <li>Roles are stored in a separate <code className="bg-blue-100 px-1 rounded">role</code> table and linked via <code className="bg-blue-100 px-1 rounded">role_id</code></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestUsers;