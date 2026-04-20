import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import AdminHome from './pages/AdminHome';
import ManagerHome from './pages/ManagerHome';
import StaffHome from './pages/StaffHome';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import UserManaging from './pages/UserManaging';
import InventoryPage from './pages/InventoryPage';
import SupplierPage from './pages/SupplierPage';
import CustomerPage from './pages/CustomerPage';
import PurchasePage from './pages/PurchasePage';
import PurchaseRequestPage from './pages/PurchaseRequestPage';
import PurchaseOrderPage from './pages/PurchaseOrderPage';
import SalesPage from './pages/SalesPage';
import QuotationPage from './pages/QuotationPage';
import ProformaInvoicePage from './pages/ProformaInvoicePage';
import DeliveryOrderPage from './pages/DeliveryOrderPage';
import SalesInvoicePage from './pages/SalesInvoicePage';

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
 * Reusable placeholder component for pages under development
 */
const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="p-6">
    <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
    <p className="text-gray-600 mt-2">This page is under development.</p>
  </div>
);

/**
 * MAIN APP COMPONENT
 * This is the root component that renders everything
 */
function App() {
  // ==============================================
  // NAVIGATION ITEMS CONFIGURATION
  // ==============================================
  // Array defining all items in the sidebar navigation
  // Each item has: name, URL path, and icon component
  const navigationItems: NavigationItem[] = [
    // Dashboard - Will redirect based on role (handled by protected routes)
    {
      name: 'Dashboard',
      href: '/dashboard',    // Updated from '/adminhome' to generic dashboard
      icon: HomeIcon
    },

    // User Management - View all registered users
    {
      name: 'User Management',
      href: '/users',
      icon: UsersIcon
    },

    // Inventory - Product and stock management
    {
      name: 'Inventory',
      href: '/inventory',
      icon: PackageIcon
    },

    // Suppliers - Manage supplier information
    {
      name: 'Suppliers',
      href: '/suppliers',
      icon: PackageIcon
    },

    // Customers - Manage customer information
    {
      name: 'Customers',
      href: '/customers',
      icon: UsersIcon
    },

    // Purchase - Manage purchase requests and orders
    {
      name: 'Purchase',
      href: '/purchase',
      icon: PackageIcon
    },

    // Sales - Manage quotations, proforma invoices, delivery orders, and invoices
    {
      name: 'Sales',
      href: '/sales',
      icon: ChartBarIcon
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
     */
    <Router>
      {/**
       * ROUTES CONFIGURATION
       * Public routes (no layout) are defined first,
       * then protected routes (with Layout) are grouped under '/*'
       */}
      <Routes>
        {/* PUBLIC ROUTE: LOGIN PAGE (NO SIDEBAR) */}
        <Route path="/" element={<LoginPage />} />

        {/* PROTECTED ROUTES: ALL PAGES THAT REQUIRE AUTHENTICATION AND SIDEBAR */}
        <Route
          path="/*"
          element={
            /**
             * LAYOUT COMPONENT
             * Provides consistent page structure (sidebar + main content)
             * Only rendered for routes under this wildcard
             */
            <Layout navigationItems={navigationItems}>
              {/**
               * NESTED ROUTES
               * These are rendered inside the Layout's main content area
               */}
              <Routes>
                {/* Role-specific home pages */}
                <Route path="/admin" element={<AdminHome />} />
                <Route path="/manager" element={<ManagerHome />} />
                <Route path="/staff" element={<StaffHome />} />

                {/* Other protected pages */}
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/users" element={<UserManaging />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/suppliers" element={<SupplierPage />} />
                <Route path="/customers" element={<CustomerPage />} />

                {/* Purchase Management Pages */}
                <Route path="/purchase" element={<PurchasePage />} />
                <Route path="/purchase/purchase_request" element={<PurchaseRequestPage />} />
                <Route path="/purchase/purchase_order" element={<PurchaseOrderPage />} />

                {/* Sales Management Pages */}
                <Route path="/sales" element={<SalesPage />} />
                <Route path="/sales/quotation" element={<QuotationPage />} />
                <Route path="/sales/proforma_invoice" element={<ProformaInvoicePage />} />
                <Route path="/sales/delivery_order" element={<DeliveryOrderPage />} />
                <Route path="/sales/invoice" element={<SalesInvoicePage />} />

                {/* Placeholder pages for future features */}
                <Route path="/analytics" element={<Placeholder title="Analytics & Reports" />} />
                <Route path="/settings" element={<Placeholder title="System Settings" />} />

                {/* Dashboard redirect - temporary: sends to admin page (will be replaced by role-based redirect later) */}
                <Route path="/dashboard" element={<AdminHome />} />

                {/* CATCH-ALL ROUTE for any undefined paths under protected section */}
                <Route path="*" element={<Placeholder title="Page Coming Soon" />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </Router>
  );
}

// Export the App component as default
export default App;