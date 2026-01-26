import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// ==============================================
// TYPE DEFINITIONS
// ==============================================

/**
 * User Interface
 * Represents a user from the public.users table
 */
interface User {
  // Database ID
  id: number;
  
  // Supabase Auth UUID
  auth_id: string;
  
  // User's email address
  email: string;
  
  // User's first name
  first_name: string;
  
  // User's last name
  last_name: string;
  
  // User's role in the system
  role: string;
  
  // Timestamp when user was created
  created_at: string;
}

/**
 * TestUsers Component
 * Displays all registered users for testing and verification
 */
const TestUsers: React.FC = () => {
  // ==============================================
  // STATE HOOKS
  // ==============================================
  
  // State for storing user list
  const [users, setUsers] = useState<User[]>([]);
  
  // State for loading indicator
  const [loading, setLoading] = useState(true);
  
  // State for error messages
  const [error, setError] = useState('');

  // ==============================================
  // EFFECT HOOK (RUNS ON COMPONENT MOUNT)
  // ==============================================
  
  useEffect(() => {
    // Fetch users when component mounts
    fetchUsers();
  }, []); // Empty dependency array = runs once on mount

  /**
   * FETCH USERS FUNCTION
   * Retrieves all users from the public.users table
   */
  const fetchUsers = async () => {
    try {
      // Set loading state to true
      setLoading(true);
      
      // Clear any previous errors
      setError('');
      
      // Query Supabase for all users
      const { data, error } = await supabase
        .from('users')                    // From users table
        .select('*')                      // Select all columns
        .order('created_at', { ascending: false }); // Newest first

      // Handle Supabase query error
      if (error) throw error;
      
      // Update users state with fetched data (or empty array if null)
      setUsers(data || []);
      
    } catch (err: any) {
      // Handle and display errors
      setError(err.message);
      console.error('Error fetching users:', err);
    } finally {
      // Always set loading to false when done
      setLoading(false);
    }
  };

  // ==============================================
  // RENDER FUNCTION
  // ==============================================
  
  return (
    <div className="p-6">
      {/* Page Title */}
      <h1 className="text-2xl font-bold mb-4">Registered Users</h1>
      
      {/* ============================================== */}
      {/* ERROR DISPLAY SECTION                         */}
      {/* ============================================== */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
          <div className="font-medium">Error Loading Users</div>
          <div className="text-sm mt-1">{error}</div>
        </div>
      )}

      {/* ============================================== */}
      {/* LOADING STATE                                 */}
      {/* ============================================== */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          {/* Loading spinner */}
          <svg className="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="ml-3 text-gray-600">Loading users...</span>
        </div>
      ) : (
        /* ============================================== */
        /* USERS TABLE SECTION                            */
        /* ============================================== */
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {/* Table container */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              {/* Table Header */}
              <thead className="bg-gray-50">
                <tr>
                  {/* Name Column Header */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  
                  {/* Email Column Header */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  
                  {/* Role Column Header */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  
                  {/* Auth ID Column Header */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Auth ID
                  </th>
                  
                  {/* Created Column Header */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              
              {/* Table Body */}
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Empty State - No Users Found */}
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5 0a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z" />
                        </svg>
                        <p className="mt-2">No users found</p>
                        <p className="text-sm mt-1">Register a user to see them here</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  /* ============================================== */
                  /* USER ROWS - MAP THROUGH USERS ARRAY           */
                  /* ============================================== */
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      {/* Name Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </div>
                      </td>
                      
                      {/* Email Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.email}</div>
                      </td>
                      
                      {/* Role Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {/* Role badge with conditional styling based on role */}
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800' 
                            : user.role === 'manager'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                      </td>
                      
                      {/* Auth ID Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {/* Fixed: Removed text-sm, kept text-xs for smaller UUID display */}
                        <div className="text-gray-500 font-mono text-xs truncate max-w-[120px]" title={user.auth_id}>
                          {user.auth_id ? `${user.auth_id.substring(0, 8)}...` : 'N/A'}
                        </div>
                      </td>
                      
                      {/* Created Date Column */}
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

      {/* ============================================== */}
      {/* ACTION BUTTONS SECTION                        */}
      {/* ============================================== */}
      <div className="mt-6 flex justify-between items-center">
        {/* User Count */}
        <div className="text-sm text-gray-600">
          {users.length} user{users.length !== 1 ? 's' : ''} found
        </div>
        
        {/* Refresh Button */}
        <button
          onClick={fetchUsers}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors flex items-center"
        >
          {/* Refresh icon */}
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh List
        </button>
      </div>

      {/* ============================================== */}
      {/* INFORMATION SECTION                           */}
      /* ============================================== */
      <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">How This Works</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>This page shows all users registered in the system. Users are:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Created in Supabase Authentication when registered</li>
                <li>Automatically added to the <code className="bg-blue-100 px-1 rounded">public.users</code> table via database trigger</li>
                <li>Linked by <code className="bg-blue-100 px-1 rounded">auth_id</code> (UUID from Supabase Auth)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestUsers;