import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useAuth } from "../../contexts/AuthContext";
import Icon from "./Icon";

interface NameCardActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userRole?: string;
}

export default function NameCardActionModal({
  isOpen,
  onClose,
  userId,
  userName,
  userRole,
}: NameCardActionModalProps) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  if (!isOpen) return null;

  const currentUserId =
    currentUser?.id || "550e8400-e29b-41d4-a716-446655440000";

  // If clicking on self, navigate to own profile
  if (userId === currentUserId) {
    navigate("/dashboard/profile");
    onClose();
    return null;
  }

  // Check if current user is Participant level
  const isParticipantLevel = currentUser?.role === "Participant";

  const handleViewProfile = () => {
    navigate(`/dashboard/profile/${userId}`);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 min-w-80 max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Actions for {userName}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Icon name="x-mark" className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        <div className="mb-6 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            What would you like to do with{" "}
            <span className="font-medium text-gray-900">{userName}</span>?
          </p>
          {userRole && (
            <p className="text-xs text-gray-500 mt-1">Role: {userRole}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          {/* See Profile button - only for non-Participant users */}
          {!isParticipantLevel && (
            <button
              onClick={handleViewProfile}
              className="w-full flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-green-50 hover:border-green-300 transition-colors group"
            >
              <div className="p-2 bg-green-100 group-hover:bg-green-200 rounded-lg transition-colors">
                <Icon name="user" className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">See Profile</p>
                <p className="text-sm text-gray-500">
                  View {userName}'s profile details
                </p>
              </div>
            </button>
          )}
        </div>

        {/* Cancel button */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
