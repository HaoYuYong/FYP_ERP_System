import React from 'react';

// ==============================================
// TYPE DEFINITIONS
// ==============================================

interface PageHeaderProps {
  title: string;                    // Page title shown on the left side of the header
  onRefresh?: () => void;           // If provided, a Refresh List button is rendered at the far right
  children?: React.ReactNode;       // Slot for additional action buttons placed to the left of Refresh
}

// ==============================================
// COMPONENT
// ==============================================

/**
 * PageHeader – Reusable dark header bar used across all main pages.
 *
 * Layout: title on the left, action buttons on the right.
 * Usage:
 *   <PageHeader title="Inventory Management" onRefresh={fetchItems}>
 *     <SomeExtraButton />   ← passed as children, appears before Refresh List
 *   </PageHeader>
 *
 * flex-shrink-0 prevents the header from shrinking inside a flex-column parent,
 * so the content area below can take the remaining height and own its scroll.
 */
const PageHeader: React.FC<PageHeaderProps> = ({ title, onRefresh, children }) => {
  return (
    // Dark grey header bar – flex-shrink-0 keeps it fixed height in a flex-column layout
    <div className="flex-shrink-0 bg-gray-800 px-6 py-4 flex items-center justify-between">

      {/* Page title on the left, white text for contrast on dark background */}
      <h1 className="text-2xl font-bold text-white">{title}</h1>

      {/* Right-side action buttons container */}
      <div className="flex items-center space-x-3">

        {/* Additional action buttons (e.g., Change View, Add New dropdowns) passed in from the page */}
        {children}

        {/* Refresh List button – only rendered when onRefresh prop is supplied; always at the far right */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors flex items-center"
          >
            {/* Circular-arrow refresh icon */}
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh List
          </button>
        )}

      </div>
    </div>
  );
};

export default PageHeader;
