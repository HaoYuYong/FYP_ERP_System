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
        
        {/* Main Content – flex-col so each page can place its own header + scrollable content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;