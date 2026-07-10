import { useState, useEffect } from "react";
import type { EventData } from "../types/event";
import { eventService } from "../services/api";
import GuestApi from "../services/guestApi";

// Backend type definitions (not exported from EventDetail)
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
  id?: string;
  user: BackendUser;
  status?: EventData["roles"][0]["currentSignups"][0]["registrationStatus"];
  attendanceConfirmed?: boolean;
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

type BackendEventLike = {
  id?: string;
  _id?: string;
  title: string;
  type: string;
  date: string;
  endDate?: string;
  time: string;
  endTime?: string;
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
  youtubeUrl?: string;
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

type GuestApiGuest = {
  id?: string;
  _id?: string;
  roleId: string;
  fullName: string;
  email?: string;
  phone?: string;
  notes?: string;
};

type GuestDisplay = {
  id?: string;
  fullName: string;
  email?: string;
  phone?: string;
  notes?: string;
};

export interface EventDataResult {
  event: EventData | null;
  setEvent: React.Dispatch<React.SetStateAction<EventData | null>>;
  loading: boolean;
  guestsByRole: Record<string, GuestDisplay[]>;
  setGuestsByRole: React.Dispatch<
    React.SetStateAction<Record<string, GuestDisplay[]>>
  >;
}

export interface UseEventDataParams {
  id: string | undefined;
  navigate: (path: string) => void;
  notificationRef: React.MutableRefObject<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error: (message: string, options?: any) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    success: (message: string, options?: any) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    warning: (message: string, options?: any) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    info: (message: string, options?: any) => void;
  }>;
}

export function useEventData({
  id,
  navigate,
  notificationRef,
}: UseEventDataParams): EventDataResult {
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestsByRole, setGuestsByRole] = useState<
    Record<string, GuestDisplay[]>
  >({});

  // Fetch event data
  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) {
        navigate("/dashboard");
        return;
      }

      try {
        setLoading(true);

        // Fetch event from backend API
        const eventData = (await eventService.getEvent(id)) as unknown as
          | BackendEventLike
          | undefined;

        // In certain test/dev environments (e.g., StrictMode double-invocation),
        // a mocked getEvent may resolve only once and return undefined on the second call.
        // Guard against undefined to avoid crashing and let the first successful
        // render stand.
        if (!eventData) {
          setLoading(false);
          return;
        }

        // Convert backend event data to frontend EventData format
        const convertedEvent: EventData = {
          id: eventData.id || eventData._id!,
          title: eventData.title,
          type: eventData.type,
          date: eventData.date,
          endDate: eventData.endDate,
          time: eventData.time,
          endTime: eventData.endTime || "",
          timeZone: eventData.timeZone,
          location: eventData.location,
          organizer: eventData.organizer,
          hostedBy: eventData.hostedBy,
          organizerDetails: eventData.organizerDetails || [],
          purpose: eventData.purpose,
          agenda: eventData.agenda,
          format: eventData.format,
          disclaimer: eventData.disclaimer,
          flyerUrl: eventData.flyerUrl,
          secondaryFlyerUrl: eventData.secondaryFlyerUrl,
          // Programs integration - many-to-many relationship
          programLabels:
            (eventData as unknown as { programLabels?: string[] })
              .programLabels || [],
          roles: (eventData.roles || []).map((role: BackendRole) => {
            interface RoleWithPublicFields extends BackendRole {
              openToPublic?: boolean;
              capacityRemaining?: number;
            }
            const r = role as RoleWithPublicFields;
            return {
              id: role.id,
              name: role.name,
              description: role.description,
              agenda: (role as { agenda?: string }).agenda,
              maxParticipants: role.maxParticipants,
              openToPublic: r.openToPublic,
              capacityRemaining: r.capacityRemaining,
              // Convert new backend format (registrations) to frontend format (currentSignups)
              currentSignups: role.registrations
                ? role.registrations.map((reg: BackendRegistration) => ({
                    registrationId: reg.id,
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
                    registrationStatus: reg.status,
                    attendanceConfirmed: reg.attendanceConfirmed,
                  }))
                : role.currentSignups || [],
            };
          }),
          signedUp:
            eventData.signedUp ||
            (eventData.roles || []).reduce(
              (sum: number, role: BackendRole) =>
                sum +
                (role.registrations?.length ||
                  role.currentSignups?.length ||
                  0),
              0,
            ) ||
            0,
          totalSlots:
            eventData.totalSlots ||
            (eventData.roles || []).reduce(
              (sum: number, role: BackendRole) =>
                sum + (role.maxParticipants || 0),
              0,
            ) ||
            0,
          createdBy: eventData.createdBy,
          createdAt: eventData.createdAt,
          isHybrid: eventData.isHybrid,
          zoomLink: eventData.zoomLink,
          meetingId: eventData.meetingId,
          passcode: eventData.passcode,
          requirements: eventData.requirements,
          materials: eventData.materials,
          status:
            eventData.status === "completed" || eventData.status === "cancelled"
              ? eventData.status
              : undefined,
          attendees: eventData.attendees,
          workshopGroupTopics: eventData.workshopGroupTopics || undefined,
          publish: (eventData as { publish?: boolean }).publish,
          publishedAt: (eventData as { publishedAt?: string }).publishedAt,
          publicSlug: (eventData as { publicSlug?: string }).publicSlug,
          // Phase 6: Paid Events - Include pricing information
          pricing: (
            eventData as { pricing?: { isFree: boolean; price?: number } }
          ).pricing,
          // YouTube video URL for completed events with recordings
          youtubeUrl: eventData.youtubeUrl,
        };

        setEvent(convertedEvent);
        // After event is loaded, fetch guests for this event
        try {
          const data = await GuestApi.getEventGuests(convertedEvent.id);
          const grouped: Record<string, GuestDisplay[]> = {};
          const guests = (data?.guests || []) as GuestApiGuest[];
          guests.forEach((g) => {
            const r = g.roleId;
            if (!grouped[r]) grouped[r] = [];
            grouped[r].push({
              id: g.id || g._id,
              fullName: g.fullName,
              email: g.email,
              phone: g.phone,
              notes: g.notes,
            });
          });
          setGuestsByRole(grouped);
        } catch {
          // Silently ignore if unauthorized or failed
          setGuestsByRole({});
        }
      } catch (error: unknown) {
        console.error("Error fetching event:", error);

        const message =
          error instanceof Error ? error.message : String(error ?? "");

        if (message.includes("not found") || message.includes("404")) {
          notificationRef.current.error(
            "The requested event could not be found. It may have been deleted or moved.",
            {
              title: "Event Not Found",
              actionButton: {
                text: "Browse Events",
                onClick: () => navigate("/dashboard"),
                variant: "primary",
              },
            },
          );
          setEvent(null);
        } else {
          notificationRef.current.error(
            "Unable to load event details. Please check your connection and try again.",
            {
              title: "Loading Failed",
              actionButton: {
                text: "Retry",
                onClick: () => window.location.reload(),
                variant: "primary",
              },
            },
          );
          navigate("/dashboard");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id, navigate, notificationRef]);

  return {
    event,
    setEvent,
    loading,
    guestsByRole,
    setGuestsByRole,
  };
}
