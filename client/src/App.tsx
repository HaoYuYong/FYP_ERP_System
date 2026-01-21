import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import AdminHome from './pages/AdminHome';
import RegisterPage from './pages/RegisterPage';
import { HomeIcon, UserAddIcon, UsersIcon, PackageIcon, ChartBarIcon, CogIcon } from './components/ui/Icons';
import { NavigationItem } from './types';

function App() {
  const navigationItems: NavigationItem[] = [
    { name: 'Dashboard', href: '/', icon: HomeIcon, current: true },
    { name: 'Register User', href: '/register', icon: UserAddIcon },
    { name: 'User Management', href: '/users', icon: UsersIcon },
    { name: 'Inventory', href: '/inventory', icon: PackageIcon },
    { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
    { name: 'Settings', href: '/settings', icon: CogIcon },
  ];

  return (
    <Router>
      <Layout navigationItems={navigationItems}>
        <Routes>
          <Route path="/" element={<AdminHome />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900">Page Coming Soon</h1>
              <p className="text-gray-600 mt-2">This page is under development.</p>
            </div>
          } />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;