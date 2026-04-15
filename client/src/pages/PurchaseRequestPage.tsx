import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';

/**
 * PURCHASE REQUEST PAGE COMPONENT
 * Page for managing Purchase Requests (PR)
 * Currently displays placeholder content "This page is under development"
 *
 * URL: /purchase/purchase_request
 */
const PurchaseRequestPage: React.FC = () => {
  // Initialize navigation hook to navigate back to purchase page
  const navigate = useNavigate();

  // Handle back button click to navigate to /purchase page
  const handleBack = () => {
    navigate('/purchase');
  };

  return (
    // Outer wrapper for full height layout with vertical flexbox
    <div className="flex flex-col h-full">

      {/* ============================================== */}
      {/* PAGE HEADER                                    */}
      {/* Displays the title "Purchase Request" with    */}
      {/* a back arrow button on the left                */}
      {/* ============================================== */}
      <PageHeader title="Purchase Request" onBack={handleBack} />

      {/* ============================================== */}
      {/* MAIN CONTENT AREA                              */}
      {/* Scrollable container with centered message     */}
      {/* ============================================== */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Centered container for development message */}
        <div className="flex flex-col items-center justify-center h-full">
          {/* Placeholder icon */}
          <svg
            className="w-16 h-16 text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>

          {/* Page title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Purchase Request
          </h1>

          {/* Under development message */}
          <p className="text-gray-600 text-lg">
            This page is under development.
          </p>
        </div>
      </div> {/* end flex-1 overflow-y-auto content area */}
    </div>
  );
};

export default PurchaseRequestPage;
