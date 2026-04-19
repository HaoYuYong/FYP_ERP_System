import React from 'react';

// ==============================================
// TYPE DEFINITIONS
// ==============================================

interface ConfirmationDialogProps {
  isOpen: boolean;                  // Whether the dialog is visible
  message: string;                  // The text to display (use **word** to make it bold)
  onConfirm: () => void;            // Called when user clicks confirm button
  onCancel: () => void;             // Called when user clicks cancel button
  confirmLabel?: string;            // Label for the confirm button (default: "OK")
  cancelLabel?: string;             // Label for the cancel button (default: "Cancel")
  content?: React.ReactNode;        // Optional rich content rendered below the message
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
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  content,
}) => {
  if (!isOpen) return null;

  // Convert **word** patterns in the message to bold spans
  const formatMessage = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      const match = part.match(/^\*\*([^*]+)\*\*$/);
      if (match) {
        return <strong key={index} className="font-bold">{match[1]}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="mb-4 text-gray-700">
          {formatMessage(message)}
        </div>
        {content && (
          <div className="mb-6">
            {content}
          </div>
        )}
        {!content && <div className="mb-2" />}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;