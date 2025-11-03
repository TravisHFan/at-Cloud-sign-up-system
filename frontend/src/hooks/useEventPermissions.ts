import { useNavigate } from "react-router-dom";
import type { EventData } from "../types/event";

export interface EventPermissionsResult {
  canNavigateToProfiles: boolean;
  isCurrentUserRegistered: () => boolean;
  canViewZoomInfo: () => boolean;
  getProfileLink: (userId: string) => string;
  handleNameCardClick: (
    userId: string,
    userName?: string,
    userRole?: string
  ) => void;
  isCurrentUserOrganizer: boolean | null;
  canDeleteEvent: boolean | null;
  isPassedEvent: boolean;
  canManageSignups: boolean | null;
  isRoleAllowedForUser: (roleName: string) => boolean;
}

export interface UseEventPermissionsParams {
  event: EventData | null;
  currentUser: {
    id: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  } | null;
  currentUserId: string;
  currentUserRole: string;
  setNameCardModal: (modal: {
    isOpen: boolean;
    userId: string;
    userName: string;
    userRole?: string;
  }) => void;
}

export function useEventPermissions({
  event,
  currentUser,
  currentUserId,
  currentUserRole,
  setNameCardModal,
}: UseEventPermissionsParams): EventPermissionsResult {
  const navigate = useNavigate();

  // Check if current user can navigate to other user profiles
  const canNavigateToProfiles =
    currentUserRole === "Super Admin" ||
    currentUserRole === "Administrator" ||
    currentUserRole === "Leader";

  // Check if current user is registered for this event
  const isCurrentUserRegistered = (): boolean => {
    if (!event || !currentUser) return false;

    // Check if user is registered in any role of the event
    return event.roles.some((role) =>
      role.currentSignups.some((signup) => signup.userId === currentUser.id)
    );
  };

  // Check if current user is an organizer of this event
  const isCurrentUserOrganizer =
    event &&
    // Check if user is in organizerDetails array
    (event.organizerDetails?.some(
      (organizer) =>
        organizer.name
          .toLowerCase()
          .includes(currentUser?.firstName?.toLowerCase() || "") &&
        organizer.name
          .toLowerCase()
          .includes(currentUser?.lastName?.toLowerCase() || "")
    ) ||
      // Check if user is the event creator
      event.createdBy === currentUserId ||
      // Check if user is in the organizer string field
      event.organizer
        ?.toLowerCase()
        .includes(
          `${currentUser?.firstName} ${currentUser?.lastName}`.toLowerCase()
        ));

  // Check if current user can view Zoom information
  const canViewZoomInfo = (): boolean => {
    if (!currentUser) return false;

    // Super Admin and Administrator can always see Zoom info
    if (
      currentUserRole === "Super Admin" ||
      currentUserRole === "Administrator"
    ) {
      return true;
    }

    // Event organizers can always see Zoom info
    if (isCurrentUserOrganizer) {
      return true;
    }

    // Registered participants can see Zoom info
    return isCurrentUserRegistered();
  };

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

  // Check if current user can delete this event (Administrator/Super Admin or Organizer)
  const canDeleteEvent =
    event &&
    (currentUserRole === "Super Admin" ||
      currentUserRole === "Administrator" ||
      isCurrentUserOrganizer);

  // Check if this is a passed event
  const isPassedEvent = event?.status === "completed";

  // Check if current user can manage signups (Administrator/Super Admin or Organizer) - but not for passed events
  const canManageSignups =
    event &&
    !isPassedEvent &&
    (currentUserRole === "Super Admin" ||
      currentUserRole === "Administrator" ||
      isCurrentUserOrganizer);

  // Universal role visibility: all roles are allowed for every user.
  const isRoleAllowedForUser = (_roleName: string): boolean => true;

  return {
    canNavigateToProfiles,
    isCurrentUserRegistered,
    canViewZoomInfo,
    getProfileLink,
    handleNameCardClick,
    isCurrentUserOrganizer,
    canDeleteEvent,
    isPassedEvent,
    canManageSignups,
    isRoleAllowedForUser,
  };
}
