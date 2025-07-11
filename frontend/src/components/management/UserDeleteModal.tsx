import { useState } from "react";
import Icon from "../common/Icon";

interface UserDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName: string;
  title: string;
  message: string;
  isLoading?: boolean;
}

export default function UserDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  userName,
  title,
  message,
  isLoading = false,
}: UserDeleteModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [showWarning, setShowWarning] = useState(false);

  if (!isOpen) return null;

  const isConfirmationValid =
    confirmText.trim().toLowerCase() === userName.toLowerCase();

  const handleConfirm = () => {
    if (isConfirmationValid) {
      onConfirm();
    } else {
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 3000);
    }
  };

  const handleClose = () => {
    setConfirmText("");
    setShowWarning(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <Icon name="trash" className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-500 whitespace-pre-line mb-4">
              {message}
            </p>

            <div className="space-y-2">
              <label
                htmlFor="confirm-name"
                className="block text-sm font-medium text-gray-700"
              >
                Type the user's full name to confirm:
              </label>
              <input
                id="confirm-name"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={userName}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50"
              />
              {showWarning && (
                <p className="text-sm text-red-600 flex items-center">
                  <Icon name="x-circle" className="w-4 h-4 mr-1" />
                  Please type the exact name: "{userName}"
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end space-x-4">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading || !isConfirmationValid}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50 ${
                isConfirmationValid
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              {isLoading ? "Deleting..." : "Delete User"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
