import { Icon } from "../common";
import { LoadingSpinner } from "../ui/LoadingStates";

interface DeleteProgramModalProps {
  isOpen: boolean;
  showFinalConfirm: boolean;
  isDeleting: boolean;
  linkedEventsCount: number;
  deleteCascade: boolean;
  onCascadeChange: (cascade: boolean) => void;
  onProceedToFinalConfirm: () => void;
  onConfirmDelete: () => void;
  onCancel: () => void;
}

/**
 * DeleteProgramModal Component
 *
 * Two-step confirmation modal for deleting programs:
 * 1. First step: Choose between deleting program only or cascade delete
 * 2. Final confirmation: Confirm the deletion action
 *
 * Features:
 * - Radio button selection for delete mode
 * - Clear warnings about linked events
 * - Loading state during deletion
 * - Accessibility support (ARIA labels, roles)
 *
 * Extracted from ProgramDetail.tsx (Phase 6.5.2)
 */
export default function DeleteProgramModal({
  isOpen,
  showFinalConfirm,
  isDeleting,
  linkedEventsCount,
  deleteCascade,
  onCascadeChange,
  onProceedToFinalConfirm,
  onConfirmDelete,
  onCancel,
}: DeleteProgramModalProps) {
  if (!isOpen && !showFinalConfirm) return null;

  return (
    <>
      {/* First Step: Choose Delete Mode */}
      {isOpen && !showFinalConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="program-delete-title"
            className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4"
          >
            <div className="p-6">
              <h2
                id="program-delete-title"
                className="text-xl font-semibold text-gray-900"
              >
                Delete Program
              </h2>
              <p className="mt-2 text-sm text-gray-700">
                This action cannot be undone. Choose how to handle the program's
                linked events.
              </p>
              <div className="mt-4 space-y-3">
                <label className="flex items-start gap-3 p-3 border rounded-md hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="delete-mode"
                    checked={!deleteCascade}
                    onChange={() => onCascadeChange(false)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">
                      Delete program only
                    </div>
                    <div className="text-sm text-gray-600">
                      Keep its {linkedEventsCount} linked{" "}
                      {linkedEventsCount === 1 ? "event" : "events"}, and remove
                      their program association so these events become
                      independent (not part of any program).
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border rounded-md hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="delete-mode"
                    checked={deleteCascade}
                    onChange={() => onCascadeChange(true)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">
                      Delete program and all linked events
                    </div>
                    <div className="text-sm text-gray-600">
                      Permanently remove this program and its{" "}
                      {linkedEventsCount} linked{" "}
                      {linkedEventsCount === 1 ? "event" : "events"}. This
                      action will delete everything under the events, including
                      registrations and guest registrations.
                    </div>
                  </div>
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 rounded-md border text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={onProceedToFinalConfirm}
                  className="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Final Confirmation Step */}
      {showFinalConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="final-confirm-title"
            className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
          >
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                <Icon name="x-circle" className="w-6 h-6 text-red-600" />
              </div>
              <h2
                id="final-confirm-title"
                className="text-xl font-semibold text-gray-900 text-center mb-2"
              >
                Final Confirmation
              </h2>
              <p className="text-sm text-gray-700 text-center mb-6">
                Are you absolutely sure you want to{" "}
                {deleteCascade
                  ? `delete this program and all ${linkedEventsCount} linked ${
                      linkedEventsCount === 1 ? "event" : "events"
                    }?`
                  : "delete this program and unlink its events?"}
                <br />
                <strong className="text-red-600 mt-2 block">
                  This action cannot be undone.
                </strong>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 px-4 py-2 rounded-md border text-gray-700 hover:bg-gray-50"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirmDelete}
                  className="flex-1 px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2"
                  disabled={isDeleting}
                >
                  {isDeleting && (
                    <LoadingSpinner size="sm" className="text-white" />
                  )}
                  {isDeleting ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
