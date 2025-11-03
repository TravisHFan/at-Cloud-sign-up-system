import { useEffect, useState } from "react";
import {
  eventService,
  programService,
  purchaseService,
  roleTemplateService,
} from "../services/api";
import { parseEventDateSafely } from "../utils/eventStatsUtils";
import type { EventData } from "../types/event";

interface BackendRole {
  id?: string;
  name: string;
  description: string;
  agenda?: string;
  maxParticipants: number;
  openToPublic?: boolean;
  currentSignups?: Array<{
    userId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    avatar?: string | null;
    gender?: string;
    systemAuthorizationLevel?: string;
    roleInAtCloud?: string;
    notes?: string;
  }>;
  registrations?: Array<{
    user?: {
      id: string;
      username?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      avatar?: string | null;
      gender?: string;
      systemAuthorizationLevel?: string;
      role?: string;
      roleInAtCloud?: string;
    };
    userId?: string;
    notes?: string;
  }>;
}

interface FormRole {
  id: string;
  name: string;
  description: string;
  agenda?: string;
  maxParticipants: number;
  openToPublic?: boolean;
  currentSignups: Array<{
    userId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    avatar?: string | null;
    gender?: string;
    systemAuthorizationLevel?: string;
    roleInAtCloud?: string;
    notes?: string;
  }>;
}

interface Organizer {
  id: string;
  firstName: string;
  lastName: string;
  systemAuthorizationLevel: string;
  roleInAtCloud?: string;
  gender: "male" | "female";
  avatar: string | null;
  email: string;
  phone?: string;
}

interface CurrentUser {
  id?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  roleInAtCloud?: string;
}

interface UseEventDataLoaderParams {
  eventId: string | undefined;
  currentUser: CurrentUser | null;
  onEventLoad: (data: {
    event: EventData;
    formData: {
      title: string;
      type: string;
      format: string;
      date: string;
      endDate: string;
      time: string;
      endTime: string;
      organizer: string;
      purpose: string;
      agenda: string;
      location: string;
      zoomLink: string;
      meetingId: string;
      passcode: string;
      disclaimer: string;
      hostedBy: string;
      timeZone: string;
      flyerUrl: string;
      secondaryFlyerUrl: string;
      programLabels: string[];
      roles: FormRole[];
    };
    selectedOrganizers: Organizer[];
    originalFlyerUrl: string | null;
    originalSecondaryFlyerUrl: string | null;
    mentorIds?: string[];
  }) => void;
  onError: (message: string) => void;
  onNavigate: (path: string) => void;
}

interface RoleTemplate {
  _id: string;
  name: string;
  roles: Array<{
    name: string;
    description: string;
    maxParticipants: number;
    openToPublic?: boolean;
    agenda?: string;
    startTime?: string;
    endTime?: string;
  }>;
}

export function useEventDataLoader({
  eventId,
  currentUser,
  onEventLoad,
  onError,
  onNavigate,
}: UseEventDataLoaderParams) {
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<
    Array<{ id: string; title: string; programType: string }>
  >([]);
  const [programLoading, setProgramLoading] = useState(false);
  const [templates, setTemplates] = useState<
    Record<
      string,
      Array<{
        name: string;
        description: string;
        maxParticipants: number;
      }>
    >
  >({});
  const [dbTemplates, setDbTemplates] = useState<
    Record<string, RoleTemplate[]>
  >({});

  // Load templates
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await roleTemplateService
          .getAllRolesTemplates()
          .catch(() => ({}));
        if (!cancelled) {
          setTemplates(
            (data as Record<
              string,
              Array<{
                name: string;
                description: string;
                maxParticipants: number;
              }>
            >) || {}
          );
          // Also set dbTemplates for "Use Template" functionality
          setDbTemplates((data as Record<string, RoleTemplate[]>) || {});
        }
      } catch {
        // On error, set empty templates
        if (!cancelled) {
          setTemplates({});
          setDbTemplates({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load event data
  useEffect(() => {
    if (!eventId) return;

    const fetchEvent = async () => {
      try {
        setLoading(true);
        const event = await eventService.getEvent(eventId);

        // Initialize form with event data
        const currentUserRole =
          currentUser?.roleInAtCloud || currentUser?.role || "";
        const mainOrganizer =
          event.organizer ||
          `${currentUser?.firstName || ""} ${
            currentUser?.lastName || ""
          } (${currentUserRole})`;

        // Map backend roles (which may include `registrations`) to form roles with `currentSignups`
        const rolesForForm: FormRole[] = (event.roles || []).map(
          (role: BackendRole, index: number) => ({
            id: role.id || `role-${index}`,
            name: role.name,
            description: role.description,
            agenda: role.agenda,
            maxParticipants: Number(role.maxParticipants || 0),
            openToPublic: role.openToPublic === true,
            currentSignups: Array.isArray(role.registrations)
              ? role.registrations.map((reg) => ({
                  userId: reg.user?.id || reg.userId || "",
                  username: reg.user?.username,
                  firstName: reg.user?.firstName,
                  lastName: reg.user?.lastName,
                  email: reg.user?.email,
                  phone: reg.user?.phone,
                  avatar: reg.user?.avatar,
                  gender: reg.user?.gender,
                  systemAuthorizationLevel:
                    reg.user?.role || reg.user?.systemAuthorizationLevel,
                  roleInAtCloud: reg.user?.roleInAtCloud,
                  notes: reg.notes,
                }))
              : role.currentSignups || [],
          })
        );

        const originalFlyerUrl = event.flyerUrl || null;
        const originalSecondaryFlyerUrl = event.secondaryFlyerUrl || null;

        const formData = {
          title: event.title || "",
          type: event.type || "",
          format: event.format || "",
          date: parseEventDateSafely(event.date),
          endDate: parseEventDateSafely(event.endDate || event.date),
          time: event.time || "",
          endTime: event.endTime || "",
          organizer: mainOrganizer,
          purpose: event.purpose || "",
          agenda: event.agenda || "",
          location: event.location || "",
          zoomLink: event.zoomLink || "",
          meetingId: event.meetingId || "",
          passcode: event.passcode || "",
          disclaimer: event.disclaimer || "",
          hostedBy: event.hostedBy || "",
          timeZone:
            event.timeZone ||
            (typeof Intl !== "undefined"
              ? Intl.DateTimeFormat().resolvedOptions().timeZone ||
                "America/Los_Angeles"
              : "America/Los_Angeles"),
          flyerUrl: (event as unknown as { flyerUrl?: string }).flyerUrl || "",
          secondaryFlyerUrl:
            (event as unknown as { secondaryFlyerUrl?: string })
              .secondaryFlyerUrl || "",
          programLabels:
            (event as unknown as { programLabels?: string[] }).programLabels ||
            [],
          roles: rolesForForm,
        };

        // Get mentor IDs if present
        const existingMentors = (
          event as unknown as {
            mentors?: Array<{
              userId: string;
              firstName?: string;
              lastName?: string;
              email?: string;
              gender?: "male" | "female";
              avatar?: string | null;
              roleInAtCloud?: string;
            }>;
          }
        ).mentors;

        const mentorIds = existingMentors?.map((m) => m.userId);

        // Parse organizers from event data if available
        let selectedOrganizers: Organizer[] = [];
        if (event.organizerDetails && Array.isArray(event.organizerDetails)) {
          const mainId =
            typeof event.createdBy === "string"
              ? event.createdBy
              : event.createdBy?.id;
          const coOrganizers = event.organizerDetails
            .filter((org) => !mainId || org.userId !== mainId)
            .map((org) => ({
              id: org.userId || "",
              firstName: org.name.split(" ")[0] || "",
              lastName: org.name.split(" ").slice(1).join(" ") || "",
              systemAuthorizationLevel: org.role,
              roleInAtCloud: org.role,
              gender: (org.gender as Organizer["gender"]) || "male",
              avatar: org.avatar ?? null,
              email: org.email || "Email not available",
              phone: org.phone,
            }));

          selectedOrganizers = coOrganizers;
        }

        onEventLoad({
          event,
          formData,
          selectedOrganizers,
          originalFlyerUrl,
          originalSecondaryFlyerUrl,
          mentorIds,
        });
      } catch (error) {
        console.error("Error fetching event:", error);
        onError("Failed to load event data");
        onNavigate("/dashboard/upcoming");
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]); // Only depend on eventId to prevent infinite loops

  // Load programs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setProgramLoading(true);
        const list = await programService.list();
        if (!cancelled) {
          type ProgramListItem = {
            id?: string;
            _id?: string;
            title: string;
            programType?: string;
            isFree?: boolean;
            mentors?: Array<{ userId: string }>;
          };

          let filteredList = (list as ProgramListItem[]).map((p) => ({
            id: p.id || p._id || "",
            title: p.title,
            programType: p.programType || "",
            isFree: p.isFree,
            mentors: p.mentors,
          }));

          // FOR LEADER USERS: Filter programs to only show accessible ones
          // (free programs, purchased programs, or programs where they are a mentor)
          if (currentUser?.role === "Leader") {
            const accessiblePrograms: typeof filteredList = [];

            for (const program of filteredList) {
              // Check 1: Is program free?
              if (program.isFree === true) {
                accessiblePrograms.push(program);
                continue;
              }

              // Check 2: Is user a mentor of this program?
              const isMentor = program.mentors?.some(
                (m) => m.userId === currentUser.id
              );
              if (isMentor) {
                accessiblePrograms.push(program);
                continue;
              }

              // Check 3: Has user purchased this program?
              try {
                const accessResult = await purchaseService.checkProgramAccess(
                  program.id
                );
                if (accessResult.hasAccess) {
                  accessiblePrograms.push(program);
                }
              } catch (error) {
                console.error(
                  `Error checking access for program ${program.id}:`,
                  error
                );
                // On error, exclude the program to be safe
              }
            }

            filteredList = accessiblePrograms;
          }

          setPrograms(
            filteredList.map((p) => ({
              id: p.id,
              title: p.title,
              programType: p.programType,
            }))
          );
        }
      } catch (e) {
        console.error("Failed to load programs", e);
      } finally {
        if (!cancelled) setProgramLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  return {
    loading,
    programs,
    programLoading,
    templates,
    dbTemplates,
  };
}
