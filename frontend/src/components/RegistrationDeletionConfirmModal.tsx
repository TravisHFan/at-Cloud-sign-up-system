import React from "react";
import { createPortal } from "react-dom";

interface RegistrationDeletionConfirmModalProps {
  isOpen: boolean;
  registrationCount: number;
  userCount: number;
  guestCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation modal shown when applying a role template to an event with existing registrations
 * Warns user that all registrations (both user and guest) will be permanently deleted
 */
export const RegistrationDeletionConfirmModal: React.FC<
  RegistrationDeletionConfirmModalProps
> = ({
  isOpen,
  registrationCount,
  userCount,
  guestCount,
  onCancel,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
            Delete All Registrations?
          </h3>

          {/* Message */}
          <div className="mb-6">
            <p className="text-sm text-gray-600 text-center mb-4">
              This event has{" "}
              <span className="font-semibold text-gray-900">
                {registrationCount} existing registration
                {registrationCount === 1 ? "" : "s"}
              </span>
              :
            </p>
            <div className="bg-gray-50 rounded-md p-3 mb-4">
              <ul className="text-sm text-gray-700 space-y-1">
                <li>
                  • {userCount} user registration{userCount === 1 ? "" : "s"}
                </li>
                <li>
                  • {guestCount} guest registration{guestCount === 1 ? "" : "s"}
                </li>
              </ul>
            </div>
            <p className="text-sm text-gray-600 text-center">
              <span className="font-semibold text-red-600">
                All registrations will be permanently deleted
              </span>{" "}
              when you update this event with the selected template.
            </p>
            <p className="text-sm text-gray-600 text-center mt-2">
              Are you sure you want to continue?
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
            >
              Yes, remove all registrations and save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
