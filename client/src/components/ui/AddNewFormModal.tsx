import React from 'react';

// ==============================================
// TYPE DEFINITIONS
// ==============================================

interface AddNewFormModalProps {
  isOpen: boolean; // Whether the modal is visible
  title: string; // Modal title shown in header
  onClose: () => void; // Called when user clicks close button or cancel
  children: React.ReactNode; // Form content (fields, sections, buttons)
  maxWidth?: string; // Max width of modal (default: max-w-2xl)
}

// ==============================================
// COMPONENT
// ==============================================

/**
 * AddNewFormModal – Reusable modal for all Add New forms across the application.
 * Features:
 * - Dark header that stays at the top while content scrolls below
 * - Consistent styling across all Add New forms
 * - Close button in header
 *
 * Usage:
 * <AddNewFormModal
 *   isOpen={showModal}
 *   title="Create New Item"
 *   onClose={handleClose}
 * >
 *   <form>...</form>
 * </AddNewFormModal>
 */
const AddNewFormModal: React.FC<AddNewFormModalProps> = ({
  isOpen,
  title,
  onClose,
  children,
  maxWidth = 'max-w-2xl',
}) => {
  if (!isOpen) return null; // Don't render when closed

  return (
    // Overlay backdrop with fixed positioning to cover entire screen
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      {/* Modal container – white box with max height and width constraints */}
      <div className={`bg-white rounded-lg shadow-xl w-full ${maxWidth} max-h-[90vh] flex flex-col`}>

        {/* ============================================== */}
        {/* MODAL HEADER – stays fixed at top while content scrolls */}
        {/* ============================================== */}
        <div className="bg-gray-900 px-6 py-4 flex items-center justify-between flex-shrink-0">
          {/* Modal title */}
          <h2 className="text-xl font-bold text-white">{title}</h2>

          {/* Close button – calls onClose when clicked */}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            title="Close"
          >
            {/* X icon */}
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* ============================================== */}
        {/* MODAL CONTENT – scrollable area below fixed header */}
        {/* ============================================== */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Children content (form, sections, etc.) */}
          {children}
        </div>
      </div>
    </div>
  );
};

export default AddNewFormModal;
