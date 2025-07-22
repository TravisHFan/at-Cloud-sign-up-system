import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { EventRole } from "../../types/event";
import { getAvatarUrl, getAvatarAlt } from "../../utils/avatarUtils";
import NameCardActionModal from "../common/NameCardActionModal";

interface EventRoleSignupProps {
  role: EventRole;
  onSignup: (roleId: string, notes?: string) => void;
  onCancel: (roleId: string) => void;
  currentUserId: string;
  currentUserRole: "Super Admin" | "Administrator" | "Leader" | "Participant";
  isUserSignedUpForThisRole: boolean;
  hasReachedMaxRoles: boolean;
  maxRolesForUser: number;
  isRoleAllowedForUser: boolean;
}

export default function EventRoleSignup({
  role,
  onSignup,
  onCancel,
  currentUserId,
  currentUserRole,
  isUserSignedUpForThisRole,
  hasReachedMaxRoles,
  maxRolesForUser,
  isRoleAllowedForUser,
}: EventRoleSignupProps) {
  const navigate = useNavigate();
  const [showSignupForm, setShowSignupForm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [notes, setNotes] = useState("");

  // Name card action modal state
  const [nameCardModal, setNameCardModal] = useState<{
    isOpen: boolean;
    userId: string;
    userName: string;
    userRole?: string;
  }>({
    isOpen: false,
    userId: "",
    userName: "",
    userRole: "",
  });

  const availableSpots = role.maxParticipants - role.currentSignups.length;
  const isFull = availableSpots <= 0;

  // Check if current user can navigate to other user profiles
  const canNavigateToProfiles =
    currentUserRole === "Super Admin" ||
    currentUserRole === "Administrator" ||
    currentUserRole === "Leader";

  // Get the correct profile link (matching Management page logic)
  const getProfileLink = (userId: string) => {
    return userId === currentUserId
      ? "/dashboard/profile" // Own profile page (editable)
      : `/dashboard/profile/${userId}`; // View-only profile page
  };

  // Handle name card click for authorized users
  const handleNameCardClick = (
    userId: string,
    userName?: string,
    userRole?: string
  ) => {
    // If clicking on self, always allow navigation to own profile
    if (userId === currentUserId) {
      navigate(getProfileLink(userId));
      return;
    }

    // Open action modal for other users
    setNameCardModal({
      isOpen: true,
      userId,
      userName: userName || "Unknown User",
      userRole: userRole || "",
    });
  };

  const handleSignup = () => {
    onSignup(role.id, notes);
    setShowSignupForm(false);
    setNotes("");
  };

  const handleCancel = () => {
    onCancel(role.id);
    setShowCancelConfirm(false);
  };

  const handleCancelClick = () => {
    setShowCancelConfirm(true);
  };

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{role.name}</h3>
          <p className="text-sm text-gray-600">{role.description}</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-700">
            {role.currentSignups.length} / {role.maxParticipants}
          </div>
          {!isFull && (
            <div className="text-xs text-green-600">
              {availableSpots} spot{availableSpots !== 1 ? "s" : ""} available
            </div>
          )}
        </div>
      </div>

      {/* Current Signups */}
      {role.currentSignups.length > 0 && (
        <div className="mb-3">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Current Signups:
          </h4>
          <div className="space-y-2">
            {role.currentSignups.map((participant) => {
              const isClickable =
                canNavigateToProfiles && participant.userId !== currentUserId;

              return (
                <div
                  key={participant.userId}
                  className={`flex items-start space-x-3 ${
                    isClickable
                      ? "cursor-pointer hover:bg-gray-50 rounded-md p-2 -m-2 transition-colors"
                      : ""
                  }`}
                  onClick={() =>
                    handleNameCardClick(
                      participant.userId,
                      `${participant.firstName} ${participant.lastName}`,
                      participant.roleInAtCloud
                    )
                  }
                  title={
                    isClickable
                      ? `View ${participant.firstName} ${participant.lastName}'s profile`
                      : undefined
                  }
                >
                  <img
                    src={getAvatarUrl(
                      participant.avatar || null,
                      participant.gender || "male"
                    )}
                    alt={getAvatarAlt(
                      participant.firstName || "",
                      participant.lastName || "",
                      !!participant.avatar
                    )}
                    className="w-8 h-8 rounded-full flex-shrink-0 mt-1"
                  />
                  <div className="flex-grow">
                    <div className="text-sm font-medium text-gray-900">
                      {participant.firstName} {participant.lastName}
                      {participant.userId === currentUserId && (
                        <span className="ml-2 text-xs text-blue-600 font-normal">
                          (You)
                        </span>
                      )}
                    </div>
                    {/* Display both system authorization level and role in @Cloud */}
                    <div className="text-xs text-gray-500 space-y-0.5">
                      {participant.systemAuthorizationLevel && (
                        <div>
                          System Authorization Level:{" "}
                          {participant.systemAuthorizationLevel}
                        </div>
                      )}
                      {participant.roleInAtCloud && (
                        <div>Role in @Cloud: {participant.roleInAtCloud}</div>
                      )}
                    </div>
                    {participant.notes && (
                      <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded mt-1">
                        <span className="font-medium">Note:</span>{" "}
                        {participant.notes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* User Already Signed Up for This Role */}
      {isUserSignedUpForThisRole && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          {!showCancelConfirm ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-green-700">
                  ✓ You are already signed up for this role.
                </p>
                <button
                  onClick={handleCancelClick}
                  className="text-sm text-red-600 hover:text-red-800 hover:underline transition-colors"
                >
                  Cancel Signup
                </button>
              </div>
              {(() => {
                const currentUserSignup = role.currentSignups.find(
                  (signup) => signup.userId === currentUserId
                );
                return (
                  currentUserSignup?.notes && (
                    <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                      <span className="font-medium">Your note:</span>{" "}
                      {currentUserSignup.notes}
                    </div>
                  )
                );
              })()}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-amber-700">
                Are you sure you want to cancel your signup for this role?
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={handleCancel}
                  className="flex-1 bg-red-600 text-white py-2 px-3 rounded-md hover:bg-red-700 transition-colors text-sm"
                >
                  Yes, Cancel
                </button>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-3 rounded-md hover:bg-gray-400 transition-colors text-sm"
                >
                  Keep Signup
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Signup Button or Form */}
      {!isUserSignedUpForThisRole && (
        <div>
          {isFull ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-700">
                This role is full, please choose another one or contact the
                Organizers.
              </p>
            </div>
          ) : hasReachedMaxRoles ? (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <p className="text-sm text-amber-700">
                You have reached the maximum number of roles permitted (
                {maxRolesForUser}) for your authorization level (
                {currentUserRole}). You cannot sign up for additional roles.
              </p>
            </div>
          ) : !isRoleAllowedForUser ? (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
              <p className="text-sm text-gray-700">
                You need authorization to sign up for this role. As a{" "}
                {currentUserRole}, you can only sign up for: Prepared Speaker or
                Common Participant roles.
              </p>
            </div>
          ) : !showSignupForm ? (
            <button
              onClick={() => setShowSignupForm(true)}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Sign Up for This Role
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Any additional notes or comments..."
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleSignup}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
                >
                  Confirm Signup
                </button>
                <button
                  onClick={() => setShowSignupForm(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Name Card Action Modal */}
      <NameCardActionModal
        isOpen={nameCardModal.isOpen}
        onClose={() => setNameCardModal({ ...nameCardModal, isOpen: false })}
        userId={nameCardModal.userId}
        userName={nameCardModal.userName}
        userRole={nameCardModal.userRole}
      />
    </div>
  );
}
