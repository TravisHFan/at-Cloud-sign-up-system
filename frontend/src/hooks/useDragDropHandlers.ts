import { useState } from "react";
import type { EventData } from "../types/event";
import { eventService, guestService } from "../services/api";

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

export type BackendRole = {
  id: string;
  name: string;
  description: string;
  maxParticipants: number;
  registrations?: BackendRegistration[];
  currentSignups?: EventData["roles"][0]["currentSignups"];
};

export type GuestDisplay = {
  id?: string;
  fullName: string;
  email?: string;
  phone?: string;
  notes?: string;
};

export interface DragDropHandlersResult {
  draggedUserId: string | null;
  draggedGuestId: string | null;
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
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, toRoleId: string) => Promise<void>;
}

export interface UseDragDropHandlersParams {
  event: EventData | null;
  guestsByRole: Record<string, GuestDisplay[]>;
  setGuestsByRole: React.Dispatch<
    React.SetStateAction<Record<string, GuestDisplay[]>>
  >;
  setEvent: React.Dispatch<React.SetStateAction<EventData | null>>;
  notification: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error: (message: string, options?: any) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    success: (message: string, options?: any) => void;
  };
}

export function useDragDropHandlers({
  event,
  guestsByRole,
  setGuestsByRole,
  setEvent,
  notification,
}: UseDragDropHandlersParams): DragDropHandlersResult {
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);
  const [draggedGuestId, setDraggedGuestId] = useState<string | null>(null);

  // Drag and drop functionality
  const handleDragStart = (
    e: React.DragEvent,
    userId: string,
    fromRoleId: string
  ) => {
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ userId, fromRoleId, type: "user" })
    );
    e.dataTransfer.effectAllowed = "move";
    setDraggedUserId(userId);
    setDraggedGuestId(null);
  };

  const handleGuestDragStart = (
    e: React.DragEvent,
    guestId: string,
    fromRoleId: string
  ) => {
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ guestId, fromRoleId, type: "guest" })
    );
    e.dataTransfer.effectAllowed = "move";
    setDraggedGuestId(guestId);
    setDraggedUserId(null);
  };

  const handleDragEnd = () => {
    setDraggedUserId(null);
    setDraggedGuestId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, toRoleId: string) => {
    e.preventDefault();
    setDraggedUserId(null);
    setDraggedGuestId(null);

    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      const { userId, guestId, fromRoleId, type } = data;

      if (fromRoleId === toRoleId) {
        return; // Same role, no action needed
      }

      if (!event) return;

      // Check if target role has space
      const toRole = event.roles.find((role) => role.id === toRoleId);
      if (!toRole) return;

      if ((toRole.currentSignups?.length || 0) >= toRole.maxParticipants) {
        notification.error(
          `${toRole.name} is already full and cannot accept more participants.`,
          {
            title: "Role Full",
            autoCloseDelay: 4000,
          }
        );
        return;
      }

      // Find the user/guest to move
      const fromRole = event.roles.find((role) => role.id === fromRoleId);
      if (!fromRole) return;

      let updatedEvent: { roles: BackendRole[]; signedUp?: number } | undefined;
      if (type === "guest") {
        // Optimistic UI update for admin guest list map (guestsByRole)
        if (guestId) {
          const prevFrom = guestsByRole[fromRoleId] || [];
          const prevTo = guestsByRole[toRoleId] || [];
          const moving = prevFrom.find((g) => (g.id || "") === guestId);
          if (moving) {
            setGuestsByRole((prev) => {
              const copy = { ...prev };
              copy[fromRoleId] = prevFrom.filter(
                (g) => (g.id || "") !== guestId
              );
              copy[toRoleId] = [...prevTo, { ...moving }];
              return copy;
            });
          }
        }
        updatedEvent = (await guestService.moveGuestBetweenRoles(
          event.id,
          guestId,
          fromRoleId,
          toRoleId
        )) as unknown as { roles: BackendRole[]; signedUp?: number };
      } else {
        const userToMove = fromRole.currentSignups?.find(
          (signup) => signup.userId === userId
        );
        if (!userToMove) return;
        // Call real API endpoint
        updatedEvent = (await eventService.moveUserBetweenRoles(
          event.id,
          userId,
          fromRoleId,
          toRoleId
        )) as unknown as { roles: BackendRole[]; signedUp?: number };
      }

      // Convert backend response to frontend format and update state
      const convertedEvent: EventData = {
        ...event,
        roles: (updatedEvent?.roles || []).map((role: BackendRole) => ({
          id: role.id,
          name: role.name,
          description: role.description,
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
          updatedEvent?.signedUp ||
          updatedEvent?.roles?.reduce(
            (sum: number, role: BackendRole) =>
              sum +
              (role.registrations?.length || role.currentSignups?.length || 0),
            0
          ) ||
          0,
      };

      // Update local state with converted data
      setEvent(convertedEvent);

      notification.success(
        type === "guest"
          ? `Guest moved from ${fromRole.name} to ${toRole.name}.`
          : `${
              fromRole.currentSignups?.find((s) => s.userId === userId)
                ? `${
                    fromRole.currentSignups?.find((s) => s.userId === userId)
                      ?.firstName
                  } ${
                    fromRole.currentSignups?.find((s) => s.userId === userId)
                      ?.lastName
                  }`
                : "User"
            } has been moved from ${fromRole.name} to ${toRole.name}.`,
        {
          title: "User Moved",
          autoCloseDelay: 4000,
          closeButtonText: "OK",
          actionButton: {
            text: "Refresh Event",
            onClick: () => window.location.reload(),
            variant: "secondary",
          },
        }
      );
    } catch (error) {
      console.error("Error moving user:", error);
      notification.error(
        "Unable to move participant between roles. Please try again.",
        {
          title: "Move Failed",
        }
      );
    }
  };

  return {
    draggedUserId,
    draggedGuestId,
    handleDragStart,
    handleGuestDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
  };
}
