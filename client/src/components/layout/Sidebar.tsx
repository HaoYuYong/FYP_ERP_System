import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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

const Sidebar: React.FC<SidebarProps> = ({ navigationItems }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className={`bg-gray-900 text-white transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'} flex-shrink-0`}>
      <div className="flex flex-col h-full">
        {/* Company Logo/Title */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <h1 className="text-xl font-bold truncate">ERP Inventory System</h1>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-600"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </button>
          </div>
          {!isCollapsed && (
            <p className="text-sm text-gray-400 mt-1 truncate">Admin Dashboard</p>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.href;
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center p-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-700 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon className={`${isCollapsed ? 'mx-auto' : 'mr-3'} w-5 h-5`} />
                {!isCollapsed && (
                  <span className="truncate">{item.name}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile (Placeholder for now) */}
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