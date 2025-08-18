import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { EventRole } from "../../types/event";
import { getAvatarUrl, getAvatarAlt } from "../../utils/avatarUtils";
import { Icon } from "../common";
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
  eventType?: string;
  eventId?: string;
  viewerGroupLetters?: ("A" | "B" | "C" | "D" | "E" | "F")[];
  // Deprecated: keeping for backward compatibility
  viewerGroupLetter?: "A" | "B" | "C" | "D" | "E" | "F" | null;
  // New props for organizer assignment
  isOrganizer?: boolean;
  onAssignUser?: (roleId: string, userId: string) => void;
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
  eventType,
  eventId,
  viewerGroupLetters,
  viewerGroupLetter, // kept for backward compatibility
  isOrganizer = false,
  onAssignUser,
}: EventRoleSignupProps) {
  const navigate = useNavigate();
  const [showSignupForm, setShowSignupForm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [notes, setNotes] = useState("");
  // Assign modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<
    Array<{
      id: string;
      username: string;
      firstName?: string;
      lastName?: string;
    }>
  >([]);
  const [assignError, setAssignError] = useState<string | null>(null);

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

  // lightweight debounced search using users endpoint
  useEffect(() => {
    let active = true;
    const handler = setTimeout(async () => {
      try {
        setAssignError(null);
        setIsSearching(true);
        const params = new URLSearchParams();
        if (userQuery.trim()) params.set("search", userQuery.trim());
        params.set("limit", "10");
        const token = localStorage.getItem("authToken");
        const base =
          import.meta.env.VITE_API_URL || "http://localhost:5001/api";
        const resp = await fetch(
          `${base.replace(/\/$/, "")}/users?${params.toString()}`,
          {
            headers: {
              Authorization: token ? `Bearer ${token}` : "",
              "Content-Type": "application/json",
            },
          }
        );
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.message || "Search failed");
        if (active) {
          const users = json.data?.users || [];
          setSearchResults(
            users.map((u: any) => ({
              id: u.id || u._id,
              username: u.username,
              firstName: u.firstName,
              lastName: u.lastName,
            }))
          );
        }
      } catch (e: any) {
        if (active) setAssignError(e.message);
      } finally {
        if (active) setIsSearching(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(handler);
    };
  }, [userQuery]);

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{role.name}</h3>
          <p className="text-sm text-gray-600">{role.description}</p>
        </div>
        <div className="text-right space-y-1">
          <div className="text-sm font-medium text-gray-700">
            {role.currentSignups.length} / {role.maxParticipants}
          </div>
          {!isFull && (
            <div className="text-xs text-green-600">
              {availableSpots} spot{availableSpots !== 1 ? "s" : ""} available
            </div>
          )}
          <div>
            <button
              type="button"
              className="text-xs text-purple-600 hover:underline"
              onClick={() => {
                if (eventId) {
                  navigate(`/guest/register/${eventId}?roleId=${role.id}`);
                } else {
                  navigate(`/guest`);
                }
              }}
            >
              Invite a guest to this role
            </button>
          </div>
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
              const roleGroupMatch = role.name.match(
                /^Group ([A-F]) (Leader|Participants)$/
              );
              const roleGroupLetter = (roleGroupMatch?.[1] as any) || null;

              // Use new viewerGroupLetters array or fall back to single viewerGroupLetter
              const viewerGroups =
                viewerGroupLetters ||
                (viewerGroupLetter ? [viewerGroupLetter] : []);

              const showContact =
                eventType === "Effective Communication Workshop" &&
                roleGroupLetter &&
                viewerGroups.length > 0 &&
                viewerGroups.includes(roleGroupLetter);

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
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1"
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
                    {showContact && (
                      <div className="mt-2 text-xs text-gray-600 space-y-1">
                        {participant.email && (
                          <div className="flex items-center gap-2">
                            <Icon
                              name="envelope"
                              className="w-3 h-3 text-gray-500"
                            />
                            <a
                              className="text-blue-600 hover:underline"
                              href={`mailto:${participant.email}`}
                            >
                              {participant.email}
                            </a>
                          </div>
                        )}
                        {participant.phone &&
                          participant.phone.trim() !== "" && (
                            <div className="flex items-center gap-2">
                              <Icon
                                name="phone"
                                className="w-3 h-3 text-gray-500"
                              />
                              <a
                                className="text-blue-600 hover:underline"
                                href={`tel:${participant.phone}`}
                              >
                                {participant.phone}
                              </a>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                  {/* Contact info moved under avatar/info block above */}
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
            <div className="flex gap-2">
              <button
                onClick={() => setShowSignupForm(true)}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                Sign Up for This Role
              </button>
              {isOrganizer && onAssignUser && (
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="flex-1 bg-gray-100 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Assign User
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="signup-notes"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Notes (optional)
                </label>
                <textarea
                  id="signup-notes"
                  name="notes"
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

      {/* Assign User Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-md shadow-lg w-[90vw] max-w-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">
                Assign User to {role.name}
              </h4>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowAssignModal(false)}
              >
                ✕
              </button>
            </div>
            <input
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Search by first name, last name, or username"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              autoFocus
            />
            <div className="mt-3 max-h-64 overflow-auto border border-gray-200 rounded">
              {assignError && (
                <div className="p-3 text-sm text-red-700 bg-red-50 border-b border-red-200">
                  {assignError}
                </div>
              )}
              {isSearching ? (
                <div className="p-3 text-sm text-gray-500">Searching…</div>
              ) : searchResults.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">No results</div>
              ) : (
                <ul>
                  {searchResults.map((u) => (
                    <li key={u.id}>
                      <button
                        className="w-full text-left px-3 py-2 hover:bg-gray-50"
                        onClick={() => {
                          onAssignUser?.(role.id, u.id);
                          setShowAssignModal(false);
                          setUserQuery("");
                        }}
                      >
                        {(u.firstName || "") +
                          (u.lastName ? ` ${u.lastName}` : "")}{" "}
                        <span className="text-gray-500">(@{u.username})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-3 text-right">
              <button
                className="px-3 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200"
                onClick={() => setShowAssignModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
