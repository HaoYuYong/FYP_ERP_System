import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import AdminHome from './pages/AdminHome';
import RegisterPage from './pages/RegisterPage';
import TestUsers from './pages/TestUsers';

// ==============================================
// ICON COMPONENT IMPORTS
// ==============================================
// SVG icons for the navigation sidebar
import { 
  HomeIcon, 
  UserAddIcon, 
  UsersIcon, 
  PackageIcon, 
  ChartBarIcon, 
  CogIcon 
} from './components/ui/Icons';

// ==============================================
// TYPE IMPORTS
// ==============================================
import { NavigationItem } from './types';

/**
 * MAIN APP COMPONENT
 * This is the root component that renders everything
 */
function App() {
  // ==============================================
  // NAVIGATION ITEMS CONFIGURATION (FIXED - NO DUPLICATES)
  // ==============================================
  // Array defining all items in the sidebar navigation
  // Each item has: name, URL path, and icon component
  const navigationItems: NavigationItem[] = [
    // Dashboard - Main admin page
    { 
      name: 'Dashboard', 
      href: '/', 
      icon: HomeIcon
    },
    
    // Register User - Admin function to create new accounts
    { 
      name: 'Register User', 
      href: '/register', 
      icon: UserAddIcon 
    },
    
    // User Management - View all registered users
    // Note: We're using "User Management" instead of "View Users" for consistency
    { 
      name: 'User Management', 
      href: '/users', 
      icon: UsersIcon 
    },
    
    // Inventory - Product and stock management (placeholder - not yet implemented)
    { 
      name: 'Inventory', 
      href: '/inventory', 
      icon: PackageIcon 
    },
    
    // Analytics - Reports and charts (placeholder - not yet implemented)
    { 
      name: 'Analytics', 
      href: '/analytics', 
      icon: ChartBarIcon 
    },
    
    // Settings - System configuration (placeholder - not yet implemented)
    { 
      name: 'Settings', 
      href: '/settings', 
      icon: CogIcon 
    },
  ];

  // ==============================================
  // RENDER FUNCTION
  // ==============================================
  return (
    /**
     * ROUTER COMPONENT
     * Wraps the entire app to enable client-side routing
     * - Manages browser history
     * - Handles URL changes without page reloads
     */
    <Router>
      {/**
       * LAYOUT COMPONENT
       * Provides consistent page structure (sidebar + main content)
       * Passes navigationItems to Sidebar component
       */}
      <Layout navigationItems={navigationItems}>
        {/**
         * ROUTES COMPONENT
         * Container for all route definitions
         * Matches URL path to specific components
         */}
        <Routes>
          {/**
           * ROUTE: DASHBOARD (/)
           * Main admin dashboard - shown when user visits root URL
           */}
          <Route path="/" element={<AdminHome />} />
          
          {/**
           * ROUTE: REGISTER PAGE (/register)
           * Form for admins to register new users
           */}
          <Route path="/register" element={<RegisterPage />} />
          
          {/**
           * ROUTE: USER MANAGEMENT (/users)
           * Page to view all registered users (for testing/verification)
           */}
          <Route path="/users" element={<TestUsers />} />
          
          {/**
           * ROUTE: INVENTORY (/inventory)
           * Placeholder page for inventory management (coming soon)
           */}
          <Route path="/inventory" element={
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
              <p className="text-gray-600 mt-2">This page is under development.</p>
            </div>
          } />
          
          {/**
           * ROUTE: ANALYTICS (/analytics)
           * Placeholder page for analytics and reports (coming soon)
           */}
          <Route path="/analytics" element={
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
              <p className="text-gray-600 mt-2">This page is under development.</p>
            </div>
          } />
          
          {/**
           * ROUTE: SETTINGS (/settings)
           * Placeholder page for system settings (coming soon)
           */}
          <Route path="/settings" element={
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
              <p className="text-gray-600 mt-2">This page is under development.</p>
            </div>
          } />
          
          {/**
           * CATCH-ALL ROUTE (*)
           * Shows a "Coming Soon" message for any other URLs
           * This prevents 404 errors during development
           */}
          <Route path="*" element={
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900">Page Coming Soon</h1>
              <p className="text-gray-600 mt-2">
                This page is under development. Check back later!
              </p>
            </div>
          } />
        </Routes>
      </Layout>
    </Router>
  );
}

// Export the App component as default
export default App;