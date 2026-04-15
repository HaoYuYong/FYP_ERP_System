import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import { PackageIcon } from '../components/ui/Icons';

/**
 * PURCHASE PAGE COMPONENT
 * Main Purchase Management page displaying two options:
 * 1. Purchase Request (PR) - to request items from suppliers
 * 2. Purchase Order (PO) - to confirm and place formal orders
 *
 * Layout: Teams-like card design with rounded corners and icons
 */
const PurchasePage: React.FC = () => {
  // Initialize navigation hook to handle page navigation
  const navigate = useNavigate();

  // Handle navigation when user clicks on Purchase Request card
  const handlePurchaseRequestClick = () => {
    navigate('/purchase/purchase_request');
  };

  // Handle navigation when user clicks on Purchase Order card
  const handlePurchaseOrderClick = () => {
    navigate('/purchase/purchase_order');
  };

  return (
    // Outer wrapper for full height layout with vertical flexbox
    <div className="flex flex-col h-full">

      {/* ============================================== */}
      {/* PAGE HEADER                                    */}
      {/* Displays the title "Purchase Management"      */}
      {/* ============================================== */}
      <PageHeader title="Purchase Management" />

      {/* ============================================== */}
      {/* MAIN CONTENT AREA                              */}
      {/* Scrollable container with padding              */}
      {/* ============================================== */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* Grid container for the two option cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ============================================== */}
          {/* PURCHASE REQUEST CARD                          */}
          {/* Left card: Navigate to purchase request page   */}
          {/* ============================================== */}
          <div
            onClick={handlePurchaseRequestClick}
            className="
              bg-white rounded-lg shadow-md hover:shadow-lg
              transition-all duration-300 cursor-pointer
              border border-gray-200 hover:border-primary-400
              p-6 flex items-center space-x-6
            "
          >
            {/* Icon circle containing PackageIcon */}
            <div className="
              flex-shrink-0 w-16 h-16
              bg-primary-100 rounded-full
              flex items-center justify-center
            ">
              <PackageIcon className="w-8 h-8 text-primary-600" />
            </div>

            {/* Text content: title and description */}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-semibold text-gray-900 truncate">
                Purchase Request
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Create and manage purchase requests to send to suppliers
              </p>
            </div>

            {/* Right arrow icon indicating navigation */}
            <div className="flex-shrink-0">
              <svg
                className="w-6 h-6 text-gray-400 group-hover:text-primary-600 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>

          {/* ============================================== */}
          {/* PURCHASE ORDER CARD                            */}
          {/* Right card: Navigate to purchase order page    */}
          {/* ============================================== */}
          <div
            onClick={handlePurchaseOrderClick}
            className="
              bg-white rounded-lg shadow-md hover:shadow-lg
              transition-all duration-300 cursor-pointer
              border border-gray-200 hover:border-primary-400
              p-6 flex items-center space-x-6
            "
          >
            {/* Icon circle containing PackageIcon */}
            <div className="
              flex-shrink-0 w-16 h-16
              bg-primary-100 rounded-full
              flex items-center justify-center
            ">
              <PackageIcon className="w-8 h-8 text-primary-600" />
            </div>

            {/* Text content: title and description */}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-semibold text-gray-900 truncate">
                Purchase Order
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Create and manage purchase orders after receiving supplier quotations
              </p>
            </div>

            {/* Right arrow icon indicating navigation */}
            <div className="flex-shrink-0">
              <svg
                className="w-6 h-6 text-gray-400 group-hover:text-primary-600 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>

        </div>

      </div> {/* end flex-1 overflow-y-auto content area */}
    </div>
  );
};

export default PurchasePage;
