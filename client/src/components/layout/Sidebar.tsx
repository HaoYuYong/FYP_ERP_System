import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
// Import SVG icon components for navigation items
import { 
  HomeIcon, 
  UserAddIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  UsersIcon,
  PackageIcon,
  ChartBarIcon,
  CogIcon
} from '../ui/Icons';
import { NavigationItem } from '../../types';

interface SidebarProps {
  navigationItems: NavigationItem[];
}

/**
 * SIDEBAR COMPONENT
 * Collapsible navigation sidebar with:
 * 1. Company logo/title
 * 2. Navigation links with icons
 * 3. Collapse/expand functionality
 * 4. User profile section (placeholder)
 */
const Sidebar: React.FC<SidebarProps> = ({ navigationItems }) => {
  // ==============================================
  // STATE HOOKS
  // ==============================================
  
  // State to track if sidebar is collapsed or expanded
  // Default: Expanded (false = not collapsed)
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Get current URL path to highlight active navigation item
  const location = useLocation();

  // ==============================================
  // RENDER FUNCTION
  // ==============================================
  return (
    /**
     * SIDEBAR CONTAINER DIV
     * Main sidebar wrapper with conditional width
     * Classes:
     * - bg-gray-900: Dark background color
     * - text-white: White text color
     * - transition-all duration-300: Smooth animation for width changes
     * - Conditional: w-20 when collapsed, w-64 when expanded
     * - flex-shrink-0: Prevents sidebar from shrinking
     */
    <div className={`bg-gray-900 text-white transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'} flex-shrink-0`}>
      {/**
       * VERTICAL FLEX CONTAINER
       * Organizes sidebar content vertically
       * Classes:
       * - flex flex-col: Vertical flexbox layout
       * - h-full: Full height of parent container
       */}
      <div className="flex flex-col h-full">
        {/* ============================================== */}
        {/* COMPANY LOGO/TITLE SECTION                    */}
        {/* ============================================== */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            {/* Company Title - Only shows when sidebar is expanded */}
            {!isCollapsed && (
              <h1 className="text-xl font-bold truncate">NCM Group</h1>
            )}

            {/* Collapse/Expand Button */}
            <button
              // Toggle collapsed state when clicked
              onClick={() => setIsCollapsed(!isCollapsed)}

              // CSS classes for styling
              className="p-1 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-600"
              
              // Accessibility label for screen readers
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >

              {/* Show appropriate icon based on state */}  
              {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </button>
          </div>

          {/* Subtitle - Only shows when sidebar is expanded */}
          {!isCollapsed && (
            <p className="text-sm text-gray-400 mt-1 truncate">Admin Dashboard</p>
          )}
        </div>

        {/* ============================================== */}
        {/* NAVIGATION ITEMS SECTION                       */}
        {/* ============================================== */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {/**
           * MAP THROUGH NAVIGATION ITEMS
           * Creates a clickable link for each navigation item
           */}  
          {navigationItems.map((item) => {
            // Check if current route matches this item's href
            const isActive = location.pathname === item.href;
            
            return (
              /**
               * REACT ROUTER LINK COMPONENT
               * Client-side navigation without page reload
               * Key attributes:
               * - key: Unique identifier for React rendering
               * - to: URL path to navigate to
               * - className: Conditional styling based on active state
               * - title: Tooltip when sidebar is collapsed
               */  
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center p-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-700 text-white' // Active item styling
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white' // Inactive item styling
                }`}
                title={isCollapsed ? item.name : undefined} // Tooltip when collapsed
              >

                {/* Icon - centered when collapsed, left-aligned when expanded */}
                <item.icon className={`${isCollapsed ? 'mx-auto' : 'mr-3'} w-5 h-5`} />
                
                {/* Item name - only shows when sidebar is expanded */}
                {!isCollapsed && (
                  <span className="truncate">{item.name}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ============================================== */}
        {/* USER PROFILE SECTION (PLACEHOLDER)             */}
        {/* ============================================== */}
        {/* Only shows when sidebar is expanded */}
        {!isCollapsed && (
          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                <span className="text-sm font-medium">A</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium truncate">Admin User</p>
                <p className="text-xs text-gray-400 truncate">admin@example.com</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;