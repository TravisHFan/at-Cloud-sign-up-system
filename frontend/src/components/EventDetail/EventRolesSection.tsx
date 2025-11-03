import Icon from "../common/Icon";
import GuestList from "./GuestList";
import EventRoleSignup from "../events/EventRoleSignup";
import {
  getAvatarUrlWithCacheBust,
  getAvatarAlt,
} from "../../utils/avatarUtils";
import { eventService } from "../../services/api";
import type { EventData } from "../../types/event";

interface BackendRole {
  id: string;
  name: string;
  description: string;
  maxParticipants: number;
  registrations?: BackendRegistration[];
  currentSignups?: any[];
}

interface BackendRegistration {
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    avatar?: string;
    gender?: string;
    systemAuthorizationLevel?: string;
    roleInAtCloud?: string;
  };
  notes?: string;
  registeredAt: string;
}

interface Guest {
  id?: string;
  fullName: string;
  email?: string;
  phone?: string;
  notes?: string;
}

type UserRole =
  | "Super Admin"
  | "Administrator"
  | "Leader"
  | "Guest Expert"
  | "Participant";

interface EventRolesSectionProps {
  event: EventData;
  isPassedEvent: boolean;
  managementMode: boolean;
  currentUserId: string;
  currentUserRole: UserRole;
  canNavigateToProfiles: boolean;
  isCurrentUserOrganizer: boolean | null;
  guestsByRole: Record<string, Guest[]>;
  notification: {
    success: (message: string, options?: { title?: string }) => void;
    error: (message: string, options?: { title?: string }) => void;
  };
  setCancelConfirm: (value: {
    open: boolean;
    roleId?: string;
    guest?: Guest;
  }) => void;
  setEditGuest: (value: {
    open: boolean;
    roleId?: string;
    guest?: Guest;
  }) => void;
  handleNameCardClick: (
    userId: string,
    userName: string,
    userRole?: string
  ) => void;
  draggedUserId: string | null;
  draggedGuestId: string | null;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, targetRoleId: string) => void;
  handleDragStart: (
    e: React.DragEvent,
    userId: string,
    fromRoleId: string
  ) => void;
  handleGuestDragStart: (
    e: React.DragEvent,
    guestId: string,
    fromRoleId: string
  ) => void;
  handleDragEnd: () => void;
  setEvent: React.Dispatch<React.SetStateAction<EventData | null>>;
  handleManagementCancel: (roleId: string, userId: string) => void;
  setResendLinkConfirm: (value: {
    open: boolean;
    guestId?: string;
    guestName?: string;
  }) => void;
  handleRoleSignup: (roleId: string, notes?: string) => void;
  handleRoleCancel: (roleId: string) => void;
  hasReachedMaxRoles: boolean;
  maxRolesForUser: number;
  isRoleAllowedForUser: (roleName: string) => boolean;
  canManageSignups: boolean | null;
}

function EventRolesSection({
  event,
  isPassedEvent,
  managementMode,
  currentUserId,
  currentUserRole,
  canNavigateToProfiles,
  isCurrentUserOrganizer,
  guestsByRole,
  notification,
  setCancelConfirm,
  setEditGuest,
  handleNameCardClick,
  draggedUserId,
  draggedGuestId,
  handleDragOver,
  handleDrop,
  handleDragStart,
  handleGuestDragStart,
  handleDragEnd,
  setEvent,
  handleManagementCancel,
  setResendLinkConfirm,
  handleRoleSignup,
  handleRoleCancel,
  hasReachedMaxRoles,
  maxRolesForUser,
  isRoleAllowedForUser,
  canManageSignups,
}: EventRolesSectionProps) {
  return (
    <>
      {isPassedEvent ? (
        /* Completed Event - Read-only participant view */
        <div className="space-y-6">
          {event.roles.map((role) => (
            <div key={role.id} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {role.name}
                  </h3>
                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {role.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {role.currentSignups.length} / {role.maxParticipants}{" "}
                    participants
                    {role.currentSignups.length >= role.maxParticipants && (
                      <span className="text-green-600 ml-1">(Full)</span>
                    )}
                  </p>
                </div>
              </div>

              {role.currentSignups.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700 mb-2">
                    Participants:
                  </h4>
                  {role.currentSignups.map((signup) => {
                    const isClickable =
                      canNavigateToProfiles || signup.userId === currentUserId;

                    // Show contact information to all logged-in users
                    // (simplified from old group-based Workshop logic)
                    const showContact = true;

                    // Ensure the current viewer sees their correct System Authorization Level
                    const displaySystemLevel =
                      signup.userId === currentUserId &&
                      currentUserRole !== "Participant" &&
                      (!signup.systemAuthorizationLevel ||
                        signup.systemAuthorizationLevel === "Participant")
                        ? currentUserRole
                        : signup.systemAuthorizationLevel;

                    return (
                      <div
                        key={signup.userId}
                        className={`flex items-center justify-between p-3 rounded-md bg-white border border-gray-200 ${
                          isClickable
                            ? "cursor-pointer hover:bg-gray-50 transition-colors"
                            : ""
                        }`}
                        onClick={() => {
                          if (isClickable) {
                            handleNameCardClick(
                              signup.userId,
                              `${signup.firstName} ${signup.lastName}`,
                              signup.roleInAtCloud
                            );
                          }
                        }}
                        title={
                          isClickable
                            ? `View ${signup.firstName} ${signup.lastName}'s profile`
                            : undefined
                        }
                      >
                        <div className="flex items-center space-x-3">
                          <img
                            src={getAvatarUrlWithCacheBust(
                              signup.avatar || null,
                              signup.gender || "male"
                            )}
                            alt={getAvatarAlt(
                              signup.firstName || "",
                              signup.lastName || "",
                              !!signup.avatar
                            )}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                          <div>
                            <div className="font-medium text-gray-900">
                              {signup.firstName} {signup.lastName}
                              {signup.userId === currentUserId && (
                                <span className="ml-2 text-xs text-blue-600 font-normal">
                                  (You)
                                </span>
                              )}
                            </div>
                            {/* Display both system authorization level and role in @Cloud */}
                            <div className="text-sm text-gray-600 space-y-0.5">
                              {displaySystemLevel && (
                                <div>
                                  System Authorization Level:{" "}
                                  {displaySystemLevel}
                                </div>
                              )}
                              {signup.roleInAtCloud && (
                                <div>
                                  Role in @Cloud: {signup.roleInAtCloud}
                                </div>
                              )}
                            </div>
                            {signup.notes && (
                              <div className="text-xs text-gray-500 mt-1">
                                "{signup.notes}"
                              </div>
                            )}
                          </div>
                        </div>
                        {showContact && (
                          <div className="mt-2 text-xs text-gray-600 space-y-1">
                            {signup.email && (
                              <div className="flex items-center gap-2">
                                <Icon
                                  name="envelope"
                                  className="w-3 h-3 text-gray-500"
                                />
                                <a
                                  className="text-blue-600 hover:underline"
                                  href={`mailto:${signup.email}`}
                                >
                                  {signup.email}
                                </a>
                              </div>
                            )}
                            {signup.phone && signup.phone.trim() !== "" && (
                              <div className="flex items-center gap-2">
                                <Icon
                                  name="phone"
                                  className="w-3 h-3 text-gray-500"
                                />
                                <a
                                  className="text-blue-600 hover:underline"
                                  href={`tel:${signup.phone}`}
                                >
                                  {signup.phone}
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-gray-500 text-sm p-4 border-2 border-dashed border-gray-300 rounded-md text-center">
                  No participants for this role
                </div>
              )}
              {/* Admin-only guest list */}
              <GuestList
                roleId={role.id}
                guestsByRole={guestsByRole}
                currentUserRole={currentUserRole}
                isCurrentUserOrganizer={isCurrentUserOrganizer}
                event={event}
                notification={notification}
                setCancelConfirm={setCancelConfirm}
                setEditGuest={setEditGuest}
              />
            </div>
          ))}
        </div>
      ) : event.status === "cancelled" && !managementMode ? (
        /* Cancelled Event Message */
        <div className="text-center py-8">
          <Icon name="tag" className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Sign-ups are closed
          </h3>
          <p className="text-gray-600">
            This event has been cancelled and no longer accepts sign-ups.
          </p>
        </div>
      ) : managementMode ? (
        /* Management View */
        <div className="space-y-6">
          {event.roles.map((role) => (
            <div
              key={role.id}
              className={`border rounded-lg p-4 transition-all duration-200 ${
                (draggedUserId || draggedGuestId) &&
                role.currentSignups.length < role.maxParticipants
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, role.id)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {role.name}
                    </h3>
                    {/* Open to Public Toggle */}
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={role.openToPublic || false}
                          onChange={async (e) => {
                            const newValue = e.target.checked;
                            try {
                              // Optimistic update
                              setEvent((prev) => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  roles: prev.roles.map((r) =>
                                    r.id === role.id
                                      ? { ...r, openToPublic: newValue }
                                      : r
                                  ),
                                };
                              });

                              // Update the backend (suppressNotifications so users are not spammed for visibility toggle)
                              await eventService.updateEvent(event.id, {
                                roles: event.roles.map((r) =>
                                  r.id === role.id
                                    ? { ...r, openToPublic: newValue }
                                    : r
                                ),
                                // Include organizerDetails to satisfy UpdateEventPayload contract
                                organizerDetails: Array.isArray(
                                  event.organizerDetails
                                )
                                  ? [...event.organizerDetails]
                                  : [],
                                suppressNotifications: true,
                              });

                              notification.success(
                                `Role "${role.name}" ${
                                  newValue ? "opened" : "closed"
                                } to public registration`,
                                { title: "Role Updated" }
                              );
                            } catch {
                              // Rollback on error
                              setEvent((prev) => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  roles: prev.roles.map((r) =>
                                    r.id === role.id
                                      ? { ...r, openToPublic: !newValue }
                                      : r
                                  ),
                                };
                              });
                              notification.error(
                                "Failed to update role public access",
                                { title: "Update Failed" }
                              );
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-700">Open to Public</span>
                        {role.openToPublic && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Public
                          </span>
                        )}
                      </label>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {role.description}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-500">
                      {role.currentSignups.length} / {role.maxParticipants}{" "}
                      participants
                      {role.currentSignups.length >= role.maxParticipants && (
                        <span className="text-red-500 ml-1">(Full)</span>
                      )}
                      {role.capacityRemaining !== undefined && (
                        <span className="text-blue-600 ml-2">
                          ({role.capacityRemaining} spots available)
                        </span>
                      )}
                    </p>
                    {role.openToPublic && (
                      <span className="text-xs text-green-600 font-medium">
                        ✓ Accepting public registrations
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {role.currentSignups.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700 mb-2">
                    Current Sign-ups:
                  </h4>
                  {role.currentSignups.map((signup) => {
                    // Ensure the current viewer sees their correct System Authorization Level
                    const displaySystemLevel =
                      signup.userId === currentUserId &&
                      currentUserRole !== "Participant" &&
                      (!signup.systemAuthorizationLevel ||
                        signup.systemAuthorizationLevel === "Participant")
                        ? currentUserRole
                        : signup.systemAuthorizationLevel;
                    return (
                      <div
                        key={signup.userId}
                        className={`flex items-center justify-between p-3 rounded-md cursor-move transition-all duration-200 ${
                          draggedUserId === signup.userId
                            ? "bg-blue-100 shadow-lg scale-105"
                            : "bg-gray-50 hover:bg-gray-100"
                        }`}
                        draggable
                        onDragStart={(e) =>
                          handleDragStart(e, signup.userId, role.id)
                        }
                        onDragEnd={handleDragEnd}
                        title="Drag to move to another role"
                        onClick={(e) => {
                          // Check if click is not on drag area or remove button
                          const target = e.target as HTMLElement;
                          const isButton =
                            target.tagName === "BUTTON" ||
                            target.closest("button");
                          const isDragIndicator =
                            target.textContent?.includes("Drag to move");

                          if (
                            !isButton &&
                            !isDragIndicator &&
                            (canNavigateToProfiles ||
                              signup.userId === currentUserId)
                          ) {
                            handleNameCardClick(
                              signup.userId,
                              `${signup.firstName} ${signup.lastName}`,
                              signup.roleInAtCloud
                            );
                          }
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          <img
                            src={getAvatarUrlWithCacheBust(
                              signup.avatar || null,
                              signup.gender || "male"
                            )}
                            alt={getAvatarAlt(
                              signup.firstName || "",
                              signup.lastName || "",
                              !!signup.avatar
                            )}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                          <div>
                            <div className="font-medium text-gray-900">
                              {signup.firstName} {signup.lastName}
                            </div>
                            {/* Display both system authorization level and role in @Cloud */}
                            <div className="text-sm text-gray-600 space-y-0.5">
                              {displaySystemLevel && (
                                <div>
                                  System Authorization Level:{" "}
                                  {displaySystemLevel}
                                </div>
                              )}
                              {signup.roleInAtCloud && (
                                <div>
                                  Role in @Cloud: {signup.roleInAtCloud}
                                </div>
                              )}
                            </div>
                            {signup.notes && (
                              <div className="text-xs text-gray-500 mt-1">
                                "{signup.notes}"
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-400">
                            Drag to move
                          </span>
                          <button
                            onClick={() =>
                              handleManagementCancel(role.id, signup.userId)
                            }
                            className="bg-red-100 text-red-700 px-3 py-1 rounded-md text-sm hover:bg-red-200 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  className={`text-gray-500 text-sm p-4 border-2 border-dashed rounded-md text-center transition-all duration-200 ${
                    draggedUserId
                      ? "border-blue-400 bg-blue-50 text-blue-600"
                      : "border-gray-200"
                  }`}
                >
                  {draggedUserId
                    ? "Drop user here to assign to this role"
                    : "No sign-ups yet. Drop users here to assign them to this role."}
                </div>
              )}
              {/* Admin-only guest list (now draggable) */}
              {(() => {
                const list = guestsByRole[role.id] || [];
                const isAdminViewer =
                  currentUserRole === "Super Admin" ||
                  currentUserRole === "Administrator" ||
                  isCurrentUserOrganizer;
                if (!isAdminViewer || list.length === 0) return null;
                return (
                  <div
                    className="mt-3 space-y-1"
                    data-testid={`admin-guests-${role.id}`}
                  >
                    <h4 className="font-medium text-gray-700">Guests:</h4>
                    <div className="space-y-2">
                      {list.map((g, idx) => (
                        <div
                          key={g.id || idx}
                          className={`flex items-center justify-between p-3 rounded-md border ${
                            draggedGuestId === (g.id || "")
                              ? "bg-blue-100 border-blue-300 shadow"
                              : "bg-white border-gray-200 hover:bg-gray-50"
                          } cursor-move transition-colors`}
                          data-testid={`admin-guest-${g.id || idx}`}
                          draggable
                          onDragStart={(e) =>
                            g.id && handleGuestDragStart(e, g.id, role.id)
                          }
                          onDragEnd={handleDragEnd}
                          title="Drag to move to another role"
                        >
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium">
                              Guest
                            </span>
                            <span className="text-gray-900 font-medium">
                              {g.fullName}
                            </span>
                            {g.notes && (
                              <span className="ml-2 text-xs text-gray-500">
                                "{g.notes}"
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-xs text-gray-500">
                              {g.email && (
                                <span className="mr-3">{g.email}</span>
                              )}
                              {g.phone && <span>{g.phone}</span>}
                            </div>
                            {g.id && (
                              <div className="flex items-center gap-2">
                                <button
                                  className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                                  onClick={() => {
                                    setResendLinkConfirm({
                                      open: true,
                                      guestId: g.id!,
                                      guestName: g.fullName,
                                    });
                                  }}
                                >
                                  Re-send manage link
                                </button>
                                <button
                                  className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600"
                                  onClick={() => {
                                    setCancelConfirm({
                                      open: true,
                                      roleId: role.id,
                                      guest: g,
                                    });
                                  }}
                                >
                                  Cancel Guest
                                </button>
                                <button
                                  className="text-xs px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700"
                                  onClick={() => {
                                    setEditGuest({
                                      open: true,
                                      roleId: role.id,
                                      guest: g,
                                    });
                                  }}
                                >
                                  Edit Guest
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      ) : (
        /* Normal Sign-up View */
        <div className="space-y-4">
          {event.roles.map((role) => {
            // Check if user is already signed up for this specific role
            const isSignedUpForThisRole = role.currentSignups.some(
              (signup) => signup.userId === currentUserId
            );

            // Get ALL viewer's workshop group letters (fix for multi-group bug)
            // Determine guest count for this role (includes guests for capacity display and full-state)
            const guestCountForRole = guestsByRole[role.id]?.length || 0;

            return (
              <EventRoleSignup
                key={role.id}
                role={role}
                onSignup={handleRoleSignup}
                onCancel={handleRoleCancel}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                isUserSignedUpForThisRole={isSignedUpForThisRole}
                hasReachedMaxRoles={hasReachedMaxRoles}
                maxRolesForUser={maxRolesForUser}
                isRoleAllowedForUser={isRoleAllowedForUser(role.name)}
                eventId={event.id}
                organizerDetails={event.organizerDetails}
                guestCount={guestCountForRole}
                guestList={guestsByRole[role.id]}
                isOrganizer={!!canManageSignups}
                onAssignUser={async (
                  roleId,
                  userId,
                  sendNotifications = true
                ) => {
                  try {
                    const updatedEvent = await eventService.assignUserToRole(
                      event.id,
                      userId,
                      roleId,
                      undefined, // notes
                      sendNotifications
                    );
                    const convertedEvent: EventData = {
                      ...event,
                      roles: updatedEvent.roles.map((role: BackendRole) => ({
                        id: role.id,
                        name: role.name,
                        description: role.description,
                        agenda: (role as { agenda?: string }).agenda,
                        maxParticipants: role.maxParticipants,
                        currentSignups: role.registrations
                          ? role.registrations.map(
                              (reg: BackendRegistration) => ({
                                userId: reg.user.id,
                                username: reg.user.username,
                                firstName: reg.user.firstName,
                                lastName: reg.user.lastName,
                                email: reg.user.email,
                                phone: reg.user.phone,
                                avatar: reg.user.avatar,
                                gender: reg.user.gender,
                                systemAuthorizationLevel: ((
                                  reg.user as { role?: string }
                                ).role ||
                                  reg.user.systemAuthorizationLevel) as string,
                                roleInAtCloud: reg.user.roleInAtCloud,
                                notes: reg.notes,
                                registeredAt: reg.registeredAt,
                              })
                            )
                          : role.currentSignups || [],
                      })),
                      signedUp:
                        updatedEvent.signedUp ||
                        updatedEvent.roles?.reduce(
                          (sum: number, role: BackendRole) =>
                            sum +
                            (role.registrations?.length ||
                              role.currentSignups?.length ||
                              0),
                          0
                        ) ||
                        0,
                    };
                    setEvent(convertedEvent);
                    const roleName =
                      event.roles.find((r) => r.id === roleId)?.name || "role";
                    notification.success(
                      `User has been assigned to ${roleName}.`,
                      {
                        title: "Assignment Complete",
                      }
                    );
                  } catch (error: unknown) {
                    const message =
                      error instanceof Error
                        ? error.message
                        : "Failed to assign user.";
                    notification.error(message, {
                      title: "Assignment Failed",
                    });
                  }
                }}
              />
            );
          })}
          {/* Admin-only guest lists below roles (retain for full contact controls) */}
          <div className="space-y-6">
            {event.roles.map((role) => (
              <div key={`guests-${role.id}`}>
                <GuestList
                  roleId={role.id}
                  guestsByRole={guestsByRole}
                  currentUserRole={currentUserRole}
                  isCurrentUserOrganizer={isCurrentUserOrganizer}
                  event={event}
                  notification={notification}
                  setCancelConfirm={setCancelConfirm}
                  setEditGuest={setEditGuest}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default EventRolesSection;
