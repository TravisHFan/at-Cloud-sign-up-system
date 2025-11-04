import { useNavigate } from "react-router-dom";

interface ProgramAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  programId: string;
  programName: string;
}

/**
 * ProgramAccessModal - Modal displayed when a user tries to access an event
 * that requires enrollment in a paid program.
 *
 * Features:
 * - Lock icon with purple theme
 * - Program name display
 * - Three action buttons: Enroll Now, View Program, Back to Programs
 * - Overlay click to close
 */
export default function ProgramAccessModal({
  isOpen,
  onClose,
  programId,
  programName,
}: ProgramAccessModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleEnroll = () => {
    onClose();
    navigate(`/dashboard/programs/${programId}/enroll`);
  };

  const handleViewProgram = () => {
    onClose();
    navigate(`/dashboard/programs/${programId}`);
  };

  const handleBackToPrograms = () => {
    onClose();
    navigate("/dashboard/programs");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="text-center">
          {/* Lock Icon */}
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-purple-100 mb-4">
            <svg
              className="h-6 w-6 text-purple-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Enrollment Required
          </h3>

          {/* Message */}
          <p className="text-gray-600 mb-6">
            This event is part of a paid program:{" "}
            <span className="font-semibold text-gray-900">{programName}</span>.
            Please enroll in the program to access this event.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleEnroll}
              className="flex-1 sm:flex-initial px-6 py-2.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              Enroll Now
            </button>
            <button
              onClick={handleViewProgram}
              className="flex-1 sm:flex-initial px-6 py-2.5 bg-white text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              View Program
            </button>
          </div>

          {/* Close button */}
          <button
            onClick={handleBackToPrograms}
            className="mt-4 text-sm text-gray-500 hover:text-gray-700"
          >
            Back to Programs
          </button>
        </div>
      </div>
    </div>
  );
}
