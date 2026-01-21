import React from 'react';
import Sidebar from './Sidebar';
import { NavigationItem } from '../../types';

interface LayoutProps {
  children: React.ReactNode;
  navigationItems: NavigationItem[];
}

const Layout: React.FC<LayoutProps> = ({ children, navigationItems }) => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex h-screen">
        {/* Sidebar */}
        <Sidebar navigationItems={navigationItems} />
        
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="min-h-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;