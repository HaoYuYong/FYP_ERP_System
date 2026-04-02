import React from 'react';

// ==============================================
// TYPE DEFINITIONS
// ==============================================

interface ConfirmationDialogProps {
  isOpen: boolean;           // Whether the dialog is visible
  message: string;           // The text to display (use **OK** and **Cancel** to make them bold)
  onConfirm: () => void;     // Called when user clicks "OK"
  onCancel: () => void;      // Called when user clicks "Cancel"
}

// ==============================================
// COMPONENT
// ==============================================

/**
 * ConfirmationDialog – A custom modal dialog that replaces window.confirm.
 * Displays a message with bold keywords and two buttons.
 */
const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  message,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null; // Don't render when closed

  // Convert **OK** and **Cancel** in the message to bold spans
  const formatMessage = (text: string) => {
    const parts = text.split(/(\*\*OK\*\*|\*\*Cancel\*\*)/g);
    return parts.map((part, index) => {
      if (part === '**OK**') {
        return <strong key={index} className="font-bold">OK</strong>;
      }
      if (part === '**Cancel**') {
        return <strong key={index} className="font-bold">Cancel</strong>;
      }
      return part;
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="mb-6 text-gray-700">
          {formatMessage(message)}
        </div>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;