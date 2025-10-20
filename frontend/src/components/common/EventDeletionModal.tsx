import { useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import ConfirmationModal from "./ConfirmationModal";

interface EventDeletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onCancel: () => Promise<void>;
  eventTitle: string;
}

export default function EventDeletionModal({
  isOpen,
  onClose,
  onDelete,
  onCancel,
  eventTitle,
}: EventDeletionModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen && !showDeleteConfirm && !showCancelConfirm) return null;

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleCancelClick = () => {
    setShowCancelConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    setIsLoading(true);
    try {
      await onDelete();
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      console.error("Error deleting event:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelConfirm = async () => {
    setIsLoading(true);
    try {
      await onCancel();
      setShowCancelConfirm(false);
      onClose();
    } catch (error) {
      console.error("Error cancelling event:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseAll = () => {
    setShowDeleteConfirm(false);
    setShowCancelConfirm(false);
    onClose();
  };

  // Show delete confirmation modal
  if (showDeleteConfirm) {
    return (
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Event"
        message={`Are you sure you want to permanently delete "${eventTitle}"?\n\nThis action cannot be undone. All signup data and event information will be lost forever.`}
        confirmText="Delete Forever"
        type="danger"
        isLoading={isLoading}
      />
    );
  }

  // Show cancel confirmation modal
  if (showCancelConfirm) {
    return (
      <ConfirmationModal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleCancelConfirm}
        title="Cancel Event"
        message={`Are you sure you want to cancel "${eventTitle}"?\n\nThe event will be marked as cancelled and moved to past events after its scheduled time. Participants will be notified that the event has been cancelled.`}
        confirmText="Cancel Event"
        type="warning"
        isLoading={isLoading}
      />
    );
  }

  // Show main options modal
  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <Icon name="trash" className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">
                Event Management
              </h3>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-4">
              What would you like to do with "{eventTitle}"?
            </p>

            <div className="space-y-3">
              <button
                onClick={handleDeleteClick}
                className="w-full flex items-center p-3 text-left border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Icon name="trash" className="w-5 h-5 text-red-600 mr-3" />
                <div>
                  <div className="font-medium text-red-900">
                    Delete this event
                  </div>
                  <div className="text-sm text-red-600">
                    Permanently remove the event and all data
                  </div>
                </div>
              </button>

              <button
                onClick={handleCancelClick}
                className="w-full flex items-center p-3 text-left border border-yellow-200 rounded-lg hover:bg-yellow-50 transition-colors"
              >
                <Icon name="tag" className="w-5 h-5 text-yellow-600 mr-3" />
                <div>
                  <div className="font-medium text-yellow-900">
                    Cancel this event
                  </div>
                  <div className="text-sm text-yellow-600">
                    Mark as cancelled, keep in history
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              onClick={handleCloseAll}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
