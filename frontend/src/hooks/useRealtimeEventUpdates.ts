/**
 * useRealtimeEventUpdates Hook
 *
 * Manages real-time WebSocket event updates for the EventDetail page.
 * Handles 15+ event update types, guest synchronization, notifications,
 * auto-unpublish detection, and backend-to-frontend data conversion.
 *
 * Extracted from EventDetail.tsx to improve modularity and testability.
 */

import { useEffect, useRef } from "react";
import type { EventData, EventRole } from "../types/event";
import { eventService } from "../services/api";
import GuestApi from "../services/guestApi";
import { socketService, type EventUpdate } from "../services/socketService";
import {
  getMissingNecessaryFieldsForPublishFrontend,
  PUBLISH_FIELD_LABELS,
} from "../types/event";

// Types for guest display
type GuestDisplay = {
  id?: string;
  fullName: string;
  email?: string;
  phone?: string;
  notes?: string;
};

type GuestApiGuest = {
  id?: string;
  _id?: string;
  fullName: string;
  email?: string;
  phone?: string;
  notes?: string;
  roleId: string;
};

// Backend event/role/user shapes for safe conversion
type BackendUser = {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  gender?: "male" | "female";
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
  currentSignups?: EventRole["currentSignups"];
};

type BackendEventLike = {
  id?: string;
  _id?: string;
  title: string;
  type: string;
  date: string;
  endDate?: string;
  time: string;
  endTime: string;
  timeZone?: string;
  location: string;
  organizer: string;
  hostedBy?: string;
  organizerDetails?: EventData["organizerDetails"];
  purpose?: string;
  agenda?: string;
  format: string;
  disclaimer?: string;
  roles: BackendRole[];
  signedUp?: number;
  totalSlots?: number;
  createdBy: EventData["createdBy"];
  createdAt: string;
  isHybrid?: boolean;
  zoomLink?: string;
  meetingId?: string;
  passcode?: string;
  requirements?: string;
  materials?: string;
  status?: "completed" | "cancelled" | "upcoming" | string;
  attendees?: number;
  workshopGroupTopics?: EventData["workshopGroupTopics"];
  flyerUrl?: string;
  secondaryFlyerUrl?: string;
  // Paid events
  pricing?: { isFree: boolean; price?: number };
  // Programs integration
  programLabels?: string[];
  // Publishing fields
  publish?: boolean;
  publicSlug?: string;
  publishedAt?: string;
  // Auto-unpublish tracking
  autoUnpublishedAt?: string | null;
  autoUnpublishedReason?: string | null;
  unpublishScheduledAt?: string | null;
  unpublishWarningFields?: string[];
};

// Hook parameters
export interface UseRealtimeEventUpdatesParams {
  eventId: string | undefined;
  currentUserId: string;
  setEvent: React.Dispatch<React.SetStateAction<EventData | null>>;
  setGuestsByRole: React.Dispatch<
    React.SetStateAction<Record<string, GuestDisplay[]>>
  >;
  notification: {
    info: (message: string, options?: { title?: string }) => void;
    warning: (message: string, options?: { title?: string }) => void;
  };
  locationPathname: string;
}

/**
 * Custom hook for managing real-time event updates via WebSocket
 */
export function useRealtimeEventUpdates({
  eventId,
  currentUserId,
  setEvent,
  setGuestsByRole,
  notification,
  locationPathname,
}: UseRealtimeEventUpdatesParams): void {
  // Keep a stable reference for notifications inside effects
  const notificationRef = useRef(notification);
  useEffect(() => {
    notificationRef.current = notification;
  }, [notification]);

  // Set up real-time socket connection and event listeners
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token || !eventId) return;

    let isComponentMounted = true; // Track component mount state

    const initializeSocket = async () => {
      // Only proceed if component is still mounted
      if (!isComponentMounted) return;

      // Connect to socket service (only if not already connected)
      socketService.connect(token);

      // Join event room for real-time updates (now async)
      await socketService.joinEventRoom(eventId);
    };

    initializeSocket();

    // Handle event updates with current values
    const handleEventUpdate = async (updateData: EventUpdate) => {
      // Early return if component unmounted or wrong event
      if (!isComponentMounted || updateData.eventId !== eventId) return;

      console.log("📡 Real-time event update received:", updateData);

      // Keep admin guest list in sync on guest events without full refetch
      if (
        updateData.updateType === "guest_cancellation" ||
        updateData.updateType === "guest_declined" ||
        updateData.updateType === "guest_updated" ||
        updateData.updateType === "guest_registration" ||
        updateData.updateType === "guest_moved"
      ) {
        // guest_moved doesn't carry roleId/guestName; other guest_* do
        if (updateData.updateType !== "guest_moved") {
          const payloadUnknown: unknown = updateData.data;
          const { roleId, guestName } =
            typeof payloadUnknown === "object" && payloadUnknown !== null
              ? (payloadUnknown as { roleId?: string; guestName?: string })
              : ({} as { roleId?: string; guestName?: string });
          if (roleId && guestName) {
            setGuestsByRole((prev) => {
              const copy: typeof prev = { ...prev };
              const list = copy[roleId] ? [...copy[roleId]] : [];
              if (
                updateData.updateType === "guest_cancellation" ||
                updateData.updateType === "guest_declined"
              ) {
                copy[roleId] = list.filter((g) => g.fullName !== guestName);
              } else if (updateData.updateType === "guest_registration") {
                // optimistically add entry if not present (admin view lists guests by role)
                if (!list.find((g) => g.fullName === guestName)) {
                  list.push({
                    id: `${guestName}-${Date.now()}`,
                    fullName: guestName,
                  });
                }
                copy[roleId] = list;
              } else {
                // guest_updated: name or phone may change; best-effort update by name
                const idx = list.findIndex((g) => g.fullName === guestName);
                if (idx !== -1) {
                  list[idx] = { ...list[idx] };
                  copy[roleId] = list;
                }
              }
              return copy;
            });
          }
        }

        // Immediately refresh guests list from API to include contact info (email/phone)
        // Only for guest_registration and guest_updated; for cancellations, keep optimistic removal stable
        if (
          updateData.updateType === "guest_registration" ||
          updateData.updateType === "guest_updated" ||
          updateData.updateType === "guest_moved"
        ) {
          try {
            const data = await GuestApi.getEventGuests(eventId);
            const grouped: Record<string, GuestDisplay[]> = {};
            const guests = (data?.guests || []) as GuestApiGuest[];
            guests.forEach((g) => {
              const r = g.roleId;
              if (!grouped[r]) grouped[r] = [];
              grouped[r].push({
                id: g.id || g._id!,
                fullName: g.fullName,
                email: g.email,
                phone: g.phone,
                notes: g.notes,
              });
            });
            setGuestsByRole(grouped);
          } catch {
            // Ignore if unauthorized or failed; optimistic update remains
          }
        }
      }

      // Update quickly with payload for instant UI feedback using typed unions
      const maybeEvent = (() => {
        switch (updateData.updateType) {
          case "user_signed_up":
          case "user_cancelled":
          case "user_removed":
          case "user_moved":
          case "user_assigned":
            return updateData.data.event;
          case "guest_moved":
            return updateData.data.event;
          default:
            return undefined;
        }
      })();

      if (maybeEvent) {
        const e = maybeEvent as BackendEventLike;
        setEvent((prev) => {
          const convertedEvent: EventData = {
            id: e.id || (e._id as string),
            title: e.title,
            type: e.type,
            date: e.date,
            endDate: e.endDate,
            time: e.time,
            endTime: e.endTime,
            timeZone: e.timeZone,
            location: e.location,
            organizer: e.organizer,
            hostedBy: e.hostedBy,
            organizerDetails: e.organizerDetails || [],
            purpose: e.purpose,
            agenda: e.agenda,
            format: e.format,
            disclaimer: e.disclaimer,
            flyerUrl: e.flyerUrl,
            secondaryFlyerUrl: e.secondaryFlyerUrl,
            roles: (e.roles || []).map((role: BackendRole) => {
              interface RoleWithPublic extends BackendRole {
                openToPublic?: boolean;
                capacityRemaining?: number;
              }
              const r = role as RoleWithPublic;
              return {
                id: role.id,
                name: role.name,
                description: role.description,
                maxParticipants: role.maxParticipants,
                openToPublic:
                  r.openToPublic ??
                  prev?.roles.find((pr) => pr.id === role.id)?.openToPublic,
                capacityRemaining: r.capacityRemaining,
                currentSignups: role.registrations
                  ? role.registrations.map((reg: BackendRegistration) => ({
                      userId: reg.user.id,
                      username: reg.user.username,
                      firstName: reg.user.firstName,
                      lastName: reg.user.lastName,
                      email: reg.user.email,
                      phone: reg.user.phone,
                      avatar: reg.user.avatar,
                      gender: reg.user.gender,
                      systemAuthorizationLevel:
                        (reg.user as { role?: string }).role ||
                        reg.user.systemAuthorizationLevel,
                      roleInAtCloud: reg.user.roleInAtCloud,
                      notes: reg.notes,
                      registeredAt: reg.registeredAt,
                    }))
                  : role.currentSignups || [],
              };
            }),
            signedUp:
              (e.roles || []).reduce(
                (sum: number, role: BackendRole) =>
                  sum +
                  (role.registrations?.length ||
                    role.currentSignups?.length ||
                    0),
                0
              ) || 0,
            totalSlots:
              (e.roles || []).reduce(
                (sum: number, role: BackendRole) =>
                  sum + (role.maxParticipants || 0),
                0
              ) || 0,
            createdBy: e.createdBy,
            createdAt: e.createdAt,
            isHybrid: e.isHybrid,
            zoomLink: e.zoomLink,
            meetingId: e.meetingId,
            passcode: e.passcode,
            requirements: e.requirements,
            materials: e.materials,
            status:
              e.status === "completed" || e.status === "cancelled"
                ? e.status
                : undefined,
            attendees: e.attendees,
            workshopGroupTopics: e.workshopGroupTopics || undefined,
            // Preserve publish metadata if omitted in the socket payload
            publish: e.publish ?? prev?.publish,
            publicSlug: e.publicSlug ?? prev?.publicSlug,
            publishedAt: e.publishedAt ?? prev?.publishedAt,
            // Preserve pricing and program data (critical for UI sections)
            pricing: e.pricing ?? prev?.pricing,
            programLabels: e.programLabels ?? prev?.programLabels,
            // Preserve auto-unpublish tracking
            autoUnpublishedAt: e.autoUnpublishedAt ?? prev?.autoUnpublishedAt,
            autoUnpublishedReason:
              e.autoUnpublishedReason ?? prev?.autoUnpublishedReason,
            unpublishScheduledAt:
              e.unpublishScheduledAt ?? prev?.unpublishScheduledAt,
            unpublishWarningFields:
              e.unpublishWarningFields ?? prev?.unpublishWarningFields,
          };
          return convertedEvent;
        });
      }

      // Show notification based on update type - use currentUserId from hook scope
      switch (updateData.updateType) {
        case "workshop_topic_updated": {
          const { group, topic, userId: actorId } = updateData.data;
          const grp = group as "A" | "B" | "C" | "D" | "E" | "F";
          setEvent((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              workshopGroupTopics: {
                ...(prev.workshopGroupTopics || {}),
                [grp]: topic,
              },
            };
          });
          if (actorId !== currentUserId) {
            notificationRef.current.info(`Group ${grp} topic updated`, {
              title: "Workshop Topic",
            });
          }
          break;
        }
        case "user_signed_up": {
          const { userId: uid, roleName } = updateData.data;
          if (uid !== currentUserId) {
            notificationRef.current.info(`Someone joined ${roleName}`, {
              title: "Event Updated",
            });
          }
          break;
        }
        case "user_cancelled": {
          const { userId: uid, roleName } = updateData.data;
          if (uid !== currentUserId) {
            notificationRef.current.info(`Someone left ${roleName}`, {
              title: "Event Updated",
            });
          }
          break;
        }
        case "role_rejected": {
          // Backend emits when a previously assigned user rejects the role via email token
          type RoleRejectedPayload = {
            userId?: string;
            roleName?: string;
            roleId?: string;
          };
          const dataUnknown: unknown = updateData.data;
          const payload: RoleRejectedPayload =
            typeof dataUnknown === "object" && dataUnknown !== null
              ? (dataUnknown as RoleRejectedPayload)
              : {};
          const roleName = payload.roleName || "a role";
          const uid = payload.userId;
          if (uid === currentUserId) {
            // This would only happen if user rejected from another tab; still give feedback
            notificationRef.current.info(`You rejected ${roleName}`, {
              title: "Role Rejected",
            });
          } else {
            notificationRef.current.info(`Someone rejected ${roleName}`, {
              title: "Event Updated",
            });
          }
          break;
        }
        case "user_removed": {
          const { userId: uid, roleName } = updateData.data;
          if (
            uid === currentUserId &&
            locationPathname === `/dashboard/event/${eventId}`
          ) {
            notificationRef.current.warning(
              `You were removed from ${roleName}`,
              {
                title: "Event Update",
              }
            );
          } else if (uid !== currentUserId) {
            notificationRef.current.info(
              `Someone was removed from ${roleName}`,
              {
                title: "Event Updated",
              }
            );
          }
          break;
        }
        case "user_moved": {
          const { userId: uid, fromRoleName, toRoleName } = updateData.data;
          if (
            uid === currentUserId &&
            locationPathname === `/dashboard/event/${eventId}`
          ) {
            notificationRef.current.info(
              `You were moved from ${fromRoleName} to ${toRoleName}`,
              { title: "Event Update" }
            );
          } else if (uid !== currentUserId) {
            notificationRef.current.info(`Someone was moved between roles`, {
              title: "Event Updated",
            });
          }
          break;
        }
        case "user_assigned": {
          const { userId: uid, roleName } = updateData.data;
          if (
            uid === currentUserId &&
            locationPathname === `/dashboard/event/${eventId}`
          ) {
            notificationRef.current.info(`You were assigned to ${roleName}`, {
              title: "Event Update",
            });
          }
          break;
        }
        case "guest_cancellation":
          notificationRef.current.info(`A guest cancelled their registration`, {
            title: "Event Updated",
          });
          break;
        case "guest_declined":
          notificationRef.current.info(`A guest declined an invitation`, {
            title: "Event Updated",
          });
          break;
        case "guest_registration":
          notificationRef.current.info(`A guest registered`, {
            title: "Event Updated",
          });
          break;
        case "guest_updated":
          notificationRef.current.info(`Guest details updated`, {
            title: "Event Updated",
          });
          break;
        case "guest_moved": {
          const { fromRoleName, toRoleName, fromRoleId, toRoleId } =
            updateData.data;
          notificationRef.current.info(
            `A guest was moved from ${fromRoleName || fromRoleId} to ${
              toRoleName || toRoleId
            }`,
            { title: "Event Updated" }
          );
          break;
        }
      }

      // Always refetch fresh event for viewer-specific privacy (ensures email/phone visibility is correct without page refresh)
      try {
        const fresh = (await eventService.getEvent(
          eventId
        )) as unknown as BackendEventLike;
        if (isComponentMounted) {
          setEvent((prev) => {
            const viewerScopedEvent: EventData = {
              id: fresh.id || fresh._id!,
              title: fresh.title,
              type: fresh.type,
              date: fresh.date,
              endDate: fresh.endDate,
              time: fresh.time,
              endTime: fresh.endTime,
              timeZone: fresh.timeZone,
              location: fresh.location,
              organizer: fresh.organizer,
              hostedBy: fresh.hostedBy,
              organizerDetails: fresh.organizerDetails || [],
              purpose: fresh.purpose,
              agenda: fresh.agenda,
              format: fresh.format,
              disclaimer: fresh.disclaimer,
              flyerUrl: fresh.flyerUrl,
              secondaryFlyerUrl: fresh.secondaryFlyerUrl,
              roles: fresh.roles.map((role: BackendRole) => {
                interface RoleWithPublic extends BackendRole {
                  openToPublic?: boolean;
                  capacityRemaining?: number;
                }
                const r = role as RoleWithPublic;
                return {
                  id: role.id,
                  name: role.name,
                  description: role.description,
                  maxParticipants: role.maxParticipants,
                  openToPublic:
                    r.openToPublic ??
                    prev?.roles.find((pr) => pr.id === role.id)?.openToPublic,
                  capacityRemaining: r.capacityRemaining,
                  currentSignups: role.registrations
                    ? role.registrations.map((reg: BackendRegistration) => ({
                        userId: reg.user.id,
                        username: reg.user.username,
                        firstName: reg.user.firstName,
                        lastName: reg.user.lastName,
                        email: reg.user.email,
                        phone: reg.user.phone,
                        avatar: reg.user.avatar,
                        gender: reg.user.gender,
                        systemAuthorizationLevel:
                          (reg.user as { role?: string }).role ||
                          reg.user.systemAuthorizationLevel,
                        roleInAtCloud: reg.user.roleInAtCloud,
                        notes: reg.notes,
                        registeredAt: reg.registeredAt,
                      }))
                    : role.currentSignups || [],
                };
              }),
              signedUp:
                fresh.roles?.reduce(
                  (sum: number, role: BackendRole) =>
                    sum +
                    (role.registrations?.length ||
                      role.currentSignups?.length ||
                      0),
                  0
                ) || 0,
              totalSlots:
                fresh.roles?.reduce(
                  (sum: number, role: BackendRole) =>
                    sum + (role.maxParticipants || 0),
                  0
                ) || 0,
              createdBy: fresh.createdBy,
              createdAt: fresh.createdAt,
              isHybrid: fresh.isHybrid,
              zoomLink: fresh.zoomLink,
              meetingId: fresh.meetingId,
              passcode: fresh.passcode,
              requirements: fresh.requirements,
              materials: fresh.materials,
              status:
                fresh.status === "completed" || fresh.status === "cancelled"
                  ? fresh.status
                  : undefined,
              attendees: fresh.attendees,
              workshopGroupTopics: fresh.workshopGroupTopics || undefined,
              publish: fresh.publish ?? prev?.publish,
              publicSlug: fresh.publicSlug ?? prev?.publicSlug,
              publishedAt: fresh.publishedAt ?? prev?.publishedAt,
              // Preserve pricing and program data (critical for UI sections)
              pricing: fresh.pricing ?? prev?.pricing,
              programLabels: fresh.programLabels ?? prev?.programLabels,
              // Auto-unpublish tracking
              autoUnpublishedAt:
                fresh.autoUnpublishedAt ?? prev?.autoUnpublishedAt,
              autoUnpublishedReason:
                fresh.autoUnpublishedReason ?? prev?.autoUnpublishedReason,
              unpublishScheduledAt:
                fresh.unpublishScheduledAt ?? prev?.unpublishScheduledAt,
              unpublishWarningFields:
                fresh.unpublishWarningFields ?? prev?.unpublishWarningFields,
            };
            // Detect auto-unpublish (published -> unpublished) with reason
            try {
              const wasPublished = prev?.publish;
              const nowPublished = viewerScopedEvent.publish;
              const reason = viewerScopedEvent.autoUnpublishedReason;
              if (
                wasPublished &&
                wasPublished === true &&
                nowPublished === false &&
                reason === "MISSING_REQUIRED_FIELDS"
              ) {
                // Build human readable missing fields using the helper (defensive: rely on current viewerScopedEvent values)
                const missing =
                  getMissingNecessaryFieldsForPublishFrontend(
                    viewerScopedEvent
                  );
                const readable = missing.map(
                  (m) => PUBLISH_FIELD_LABELS[m] || m
                );
                notificationRef.current.warning(
                  readable.length
                    ? `Event automatically unpublished: missing ${readable.join(
                        ", "
                      )}`
                    : "Event automatically unpublished due to missing required fields",
                  { title: "Auto-unpublished" }
                );
              }
            } catch {
              // Swallow detection errors silently (non-critical UX enhancement)
            }
            return viewerScopedEvent;
          });
        }
      } catch {
        // Ignore refetch failures for realtime; initial optimistic update already applied
      }
    };

    socketService.on("event_update", handleEventUpdate);

    // Cleanup on unmount
    return () => {
      isComponentMounted = false; // Mark component as unmounted
      socketService.off("event_update");
      // Use setTimeout to ensure cleanup happens after React StrictMode double cleanup
      setTimeout(() => {
        socketService.leaveEventRoom(eventId);
      }, 0);
    };
  }, [eventId, currentUserId, locationPathname, setEvent, setGuestsByRole]); // notification handled via ref to avoid unstable deps
}
