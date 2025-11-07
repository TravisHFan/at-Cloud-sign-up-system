import type { EventData } from "../types/event";
import { eventService } from "../services/api";

// Types for backend API responses
type BackendUser = {
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

type BackendRegistration = {
  user: BackendUser;
  notes?: string;
  registeredAt?: string;
};

type BackendRole = {
  id: string;
  name: string;
  description: string;
  maxParticipants: number;
  registrations?: BackendRegistration[];
  currentSignups?: EventData["roles"][0]["currentSignups"];
};

export interface SignupHandlersResult {
  handleRoleSignup: (roleId: string, notes?: string) => Promise<void>;
  handleRoleCancel: (roleId: string) => Promise<void>;
  handleManagementCancel: (roleId: string, userId: string) => Promise<void>;
}

export interface UseSignupHandlersParams {
  event: EventData | null;
  currentUser: { id: string } | null;
  setEvent: React.Dispatch<React.SetStateAction<EventData | null>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  notification: any;
  navigate: (path: string) => void;
  handleDownloadCalendar: () => Promise<void>;
}

export function useSignupHandlers({
  event,
  currentUser,
  setEvent,
  notification,
  navigate,
  handleDownloadCalendar,
}: UseSignupHandlersParams): SignupHandlersResult {
  // Type assertion for notification methods
  const notify = notification as {
    error: (message: string, options?: unknown) => void;
    success: (message: string, options?: unknown) => void;
    warning: (message: string, options?: unknown) => void;
    info: (message: string, options?: unknown) => void;
  };

  const handleRoleSignup = async (roleId: string, notes?: string) => {
    if (!event || !currentUser) return;

    try {
      // Call backend API to sign up for event
      const updatedEvent = await eventService.signUpForEvent(
        event.id,
        roleId,
        notes
      );

      // Convert backend response to frontend format and update state
      const convertedEvent: EventData = {
        ...event,
        roles: updatedEvent.roles.map((role: BackendRole) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          agenda: (role as { agenda?: string }).agenda,
          maxParticipants: role.maxParticipants,
          // Convert new backend format (registrations) to frontend format (currentSignups)
          currentSignups: role.registrations
            ? role.registrations.map((reg: BackendRegistration) => ({
                userId: reg.user.id,
                username: reg.user.username,
                firstName: reg.user.firstName,
                lastName: reg.user.lastName,
                email: reg.user.email,
                phone: reg.user.phone,
                avatar: reg.user.avatar,
                gender: (reg.user.gender as "male" | "female") || undefined,
                systemAuthorizationLevel:
                  (reg.user as { role?: string }).role ||
                  reg.user.systemAuthorizationLevel,
                roleInAtCloud: reg.user.roleInAtCloud,
                notes: reg.notes,
                registeredAt: reg.registeredAt,
              }))
            : role.currentSignups || [],
        })),
        signedUp:
          updatedEvent.signedUp ||
          updatedEvent.roles?.reduce(
            (sum: number, role: BackendRole) =>
              sum +
              (role.registrations?.length || role.currentSignups?.length || 0),
            0
          ) ||
          0,
      };

      setEvent(convertedEvent);

      const roleName =
        event.roles.find((role) => role.id === roleId)?.name || "role";
      notify.success(`You have successfully signed up for ${roleName}!`, {
        title: "Signup Confirmed",
        autoCloseDelay: 4000,
        closeButtonText: "Close",
        actionButtons: [
          {
            text: "Add to Calendar",
            onClick: handleDownloadCalendar,
            variant: "primary",
          },
          {
            text: "View My Signups",
            onClick: () => navigate("/dashboard/my-events"),
            variant: "secondary",
          },
        ],
      });
    } catch (error: unknown) {
      console.error("Error signing up for role:", error);
      const roleName =
        event.roles.find((role) => role.id === roleId)?.name || "role";
      const message =
        error instanceof Error
          ? error.message
          : `Unable to sign up for ${roleName}. Please try again.`;
      notify.error(message, {
        title: "Signup Failed",
        actionButton: {
          text: "Retry Signup",
          onClick: () => handleRoleSignup(roleId),
          variant: "primary",
        },
      });
    }
  };

  const handleRoleCancel = async (roleId: string) => {
    if (!event || !currentUser) return;

    try {
      // Call backend API to cancel event signup (user self-cancellation)
      const updatedEvent = await eventService.cancelEventSignup(
        event.id,
        roleId
      );

      // Convert backend response to frontend format and update state
      const convertedEvent: EventData = {
        ...event,
        roles: updatedEvent.roles.map((role: BackendRole) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          agenda: (role as { agenda?: string }).agenda,
          maxParticipants: role.maxParticipants,
          // Convert new backend format (registrations) to frontend format (currentSignups)
          currentSignups: role.registrations
            ? role.registrations.map((reg: BackendRegistration) => ({
                userId: reg.user.id,
                username: reg.user.username,
                firstName: reg.user.firstName,
                lastName: reg.user.lastName,
                email: reg.user.email,
                phone: reg.user.phone,
                avatar: reg.user.avatar,
                gender: (reg.user.gender as "male" | "female") || undefined,
                systemAuthorizationLevel:
                  (reg.user as { role?: string }).role ||
                  reg.user.systemAuthorizationLevel,
                roleInAtCloud: reg.user.roleInAtCloud,
                notes: reg.notes,
                registeredAt: reg.registeredAt,
              }))
            : role.currentSignups || [],
        })),
        signedUp:
          updatedEvent.signedUp ||
          updatedEvent.roles?.reduce(
            (sum: number, role: BackendRole) =>
              sum +
              (role.registrations?.length || role.currentSignups?.length || 0),
            0
          ) ||
          0,
      };

      setEvent(convertedEvent);

      const roleName =
        event.roles.find((role) => role.id === roleId)?.name || "role";
      notify.success(`Your signup for ${roleName} has been canceled.`, {
        title: "Signup Canceled",
        autoCloseDelay: 4000,
        closeButtonText: "OK",
        actionButton: {
          text: "Undo Cancel",
          onClick: () => handleRoleSignup(roleId),
          variant: "secondary",
        },
      });
    } catch (error: unknown) {
      console.error("Error canceling role signup:", error);
      const roleName =
        event.roles.find((role) => role.id === roleId)?.name || "role";
      const message =
        error instanceof Error
          ? error.message
          : `Unable to cancel signup for ${roleName}. Please try again.`;
      notify.error(message, {
        title: "Cancel Failed",
        actionButton: {
          text: "Retry Cancel",
          onClick: () => handleRoleCancel(roleId),
          variant: "primary",
        },
      });
    }
  };

  // Management function to cancel any user's signup
  const handleManagementCancel = async (roleId: string, userId: string) => {
    if (!event) return;

    try {
      // Get user info for notification before removal
      const roleIndex = event.roles.findIndex((role) => role.id === roleId);
      const user = event.roles[roleIndex]?.currentSignups?.find(
        (signup) => signup.userId === userId
      );
      const roleName = event.roles[roleIndex]?.name;

      // Call real API endpoint
      const updatedEvent = await eventService.removeUserFromRole(
        event.id,
        userId,
        roleId
      );

      // Convert backend response to frontend format and update state
      const convertedEvent: EventData = {
        ...event,
        roles: updatedEvent.roles.map((role: BackendRole) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          agenda: (role as { agenda?: string }).agenda,
          maxParticipants: role.maxParticipants,
          // Convert new backend format (registrations) to frontend format (currentSignups)
          currentSignups: role.registrations
            ? role.registrations.map((reg: BackendRegistration) => ({
                userId: reg.user.id,
                username: reg.user.username,
                firstName: reg.user.firstName,
                lastName: reg.user.lastName,
                email: reg.user.email,
                phone: reg.user.phone,
                avatar: reg.user.avatar,
                gender: (reg.user.gender as "male" | "female") || undefined,
                systemAuthorizationLevel:
                  (reg.user as { role?: string }).role ||
                  reg.user.systemAuthorizationLevel,
                roleInAtCloud: reg.user.roleInAtCloud,
                notes: reg.notes,
                registeredAt: reg.registeredAt,
              }))
            : role.currentSignups || [],
        })),
        signedUp:
          updatedEvent.signedUp ||
          updatedEvent.roles?.reduce(
            (sum: number, role: BackendRole) =>
              sum +
              (role.registrations?.length || role.currentSignups?.length || 0),
            0
          ) ||
          0,
      };

      // Update local state with converted data
      setEvent(convertedEvent);

      notify.success(
        `${user?.firstName} ${user?.lastName} has been removed from ${roleName}.`,
        {
          title: "User Removed",
          autoCloseDelay: 4000,
          closeButtonText: "OK",
          actionButton: {
            text: "Undo Removal",
            onClick: () => {
              // Simple undo - just reload the event data
              window.location.reload();
            },
            variant: "secondary",
          },
        }
      );
    } catch (error) {
      console.error("Error removing user from role:", error);
      notify.error("Unable to remove user from role. Please try again.", {
        title: "Removal Failed",
        actionButton: {
          text: "Retry",
          onClick: () => handleManagementCancel(roleId, userId),
          variant: "primary",
        },
      });
    }
  };

  return {
    handleRoleSignup,
    handleRoleCancel,
    handleManagementCancel,
  };
}
