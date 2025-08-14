import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import type { EventData, EventRole } from "../types/event";
import EventRoleSignup from "../components/events/EventRoleSignup";
import { Icon, EventDeletionModal } from "../components/common";
import NameCardActionModal from "../components/common/NameCardActionModal";
import { getAvatarUrl, getAvatarAlt } from "../utils/avatarUtils";
import { eventService } from "../services/api";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { useAuth } from "../hooks/useAuth";
import { formatDateToAmerican } from "../utils/eventStatsUtils";
import { socketService, type EventUpdate } from "../services/socketService";
import * as XLSX from "xlsx";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const notification = useToastReplacement();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [managementMode, setManagementMode] = useState(false);
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  // Workshop group topic editing state
  const [editingGroup, setEditingGroup] = useState<
    "A" | "B" | "C" | "D" | "E" | "F" | null
  >(null);
  const [topicDraft, setTopicDraft] = useState<string>("");

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

  // Use current user from auth context
  const currentUserId =
    currentUser?.id || "550e8400-e29b-41d4-a716-446655440000";
  const currentUserRole = currentUser?.role || "Super Admin";

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

  // Check if current user can delete this event (Super Admin or Organizer)
  const canDeleteEvent =
    event && (currentUserRole === "Super Admin" || isCurrentUserOrganizer);

  // Check if this is a passed event
  const isPassedEvent = event?.status === "completed";

  // Check if current user can manage signups (Super Admin or Organizer) - but not for passed events
  const canManageSignups =
    event &&
    !isPassedEvent &&
    (currentUserRole === "Super Admin" || isCurrentUserOrganizer);

  // Get maximum roles based on user authorization level
  const getMaxRolesForUser = (): number => {
    switch (currentUserRole) {
      case "Super Admin":
      case "Administrator":
        return 3;
      case "Leader":
        return 2;
      case "Participant":
      default:
        return 1;
    }
  };

  // Get participant-only roles that Participants can sign up for
  const getParticipantAllowedRoles = (): string[] => {
    // For Effective Communication Workshop type, Participants can only register Group Leaders and Group Participants
    if (event?.type === "Effective Communication Workshop") {
      const groups = ["A", "B", "C", "D", "E", "F"] as const;
      const allowed: string[] = [];
      groups.forEach((g) => {
        allowed.push(`Group ${g} Leader`);
        allowed.push(`Group ${g} Participants`);
      });
      return allowed;
    }
    // Default allowed roles for Participant in non-Workshop events
    return [
      "Prepared Speaker (on-site)",
      "Prepared Speaker (Zoom)",
      "Common Participant (on-site)",
      "Common Participant (Zoom)",
    ];
  };

  // Check if a role is allowed for the current user
  const isRoleAllowedForUser = (roleName: string): boolean => {
    if (currentUserRole === "Participant") {
      return getParticipantAllowedRoles().includes(roleName);
    }
    // Leaders, Administrators, and Super Admins can sign up for any role
    return true;
  };

  // Get all roles the user is signed up for
  const getUserSignupRoles = (): EventRole[] => {
    if (!event) return [];

    return event.roles.filter(
      (role) =>
        role.currentSignups?.some(
          (signup) => signup.userId === currentUserId
        ) ?? false
    );
  };

  // Check if user has reached the maximum number of roles based on their authorization level
  const userSignedUpRoles = getUserSignupRoles();
  const maxRolesForUser = getMaxRolesForUser();
  const hasReachedMaxRoles = userSignedUpRoles.length >= maxRolesForUser;
  const isUserSignedUp = userSignedUpRoles.length > 0;

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) {
        navigate("/dashboard");
        return;
      }

      try {
        setLoading(true);

        // Fetch event from backend API
        const eventData = await eventService.getEvent(id);

        // Convert backend event data to frontend EventData format
        const convertedEvent: EventData = {
          id: eventData.id || eventData._id,
          title: eventData.title,
          type: eventData.type,
          date: eventData.date,
          time: eventData.time,
          endTime: eventData.endTime,
          location: eventData.location,
          organizer: eventData.organizer,
          hostedBy: eventData.hostedBy,
          organizerDetails: eventData.organizerDetails || [],
          purpose: eventData.purpose,
          agenda: eventData.agenda,
          format: eventData.format,
          disclaimer: eventData.disclaimer,
          roles: eventData.roles.map((role: any) => ({
            id: role.id,
            name: role.name,
            description: role.description,
            maxParticipants: role.maxParticipants,
            // Convert new backend format (registrations) to frontend format (currentSignups)
            currentSignups: role.registrations
              ? role.registrations.map((reg: any) => ({
                  userId: reg.user.id,
                  username: reg.user.username,
                  firstName: reg.user.firstName,
                  lastName: reg.user.lastName,
                  email: reg.user.email,
                  phone: reg.user.phone,
                  avatar: reg.user.avatar,
                  gender: reg.user.gender,
                  systemAuthorizationLevel: reg.user.systemAuthorizationLevel,
                  roleInAtCloud: reg.user.roleInAtCloud,
                  notes: reg.notes,
                  registeredAt: reg.registeredAt,
                }))
              : role.currentSignups || [],
          })),
          signedUp:
            eventData.signedUp ||
            eventData.roles?.reduce(
              (sum: number, role: any) =>
                sum +
                (role.registrations?.length ||
                  role.currentSignups?.length ||
                  0),
              0
            ) ||
            0,
          totalSlots:
            eventData.totalSlots ||
            eventData.roles?.reduce(
              (sum: number, role: any) => sum + (role.maxParticipants || 0),
              0
            ) ||
            0,
          createdBy: eventData.createdBy,
          createdAt: eventData.createdAt,
          description: eventData.description,
          isHybrid: eventData.isHybrid,
          zoomLink: eventData.zoomLink,
          meetingId: eventData.meetingId,
          passcode: eventData.passcode,
          requirements: eventData.requirements,
          materials: eventData.materials,
          status: eventData.status || "upcoming",
          attendees: eventData.attendees,
          workshopGroupTopics: eventData.workshopGroupTopics || undefined,
        };

        setEvent(convertedEvent);
      } catch (error: any) {
        console.error("Error fetching event:", error);

        if (
          error.message.includes("not found") ||
          error.message.includes("404")
        ) {
          notification.error(
            "The requested event could not be found. It may have been deleted or moved.",
            {
              title: "Event Not Found",
              actionButton: {
                text: "Browse Events",
                onClick: () => navigate("/dashboard"),
                variant: "primary",
              },
            }
          );
          setEvent(null);
        } else {
          notification.error(
            "Unable to load event details. Please check your connection and try again.",
            {
              title: "Loading Failed",
              actionButton: {
                text: "Retry",
                onClick: () => window.location.reload(),
                variant: "primary",
              },
            }
          );
          navigate("/dashboard");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id, navigate]);

  // Set up real-time socket connection and event listeners
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token || !id) return;

    let isComponentMounted = true; // Track component mount state

    const initializeSocket = async () => {
      // Only proceed if component is still mounted
      if (!isComponentMounted) return;

      // Connect to socket service (only if not already connected)
      socketService.connect(token);

      // Join event room for real-time updates (now async)
      await socketService.joinEventRoom(id);
    };

    initializeSocket();

    // Handle event updates with current values
    const handleEventUpdate = async (updateData: EventUpdate) => {
      // Early return if component unmounted or wrong event
      if (!isComponentMounted || updateData.eventId !== id) return;

      console.log("📡 Real-time event update received:", updateData);

      // Update quickly with payload for instant UI feedback
      if (updateData.data.event) {
        const convertedEvent: EventData = {
          id: updateData.data.event.id || updateData.data.event._id,
          title: updateData.data.event.title,
          type: updateData.data.event.type,
          date: updateData.data.event.date,
          time: updateData.data.event.time,
          endTime: updateData.data.event.endTime,
          location: updateData.data.event.location,
          organizer: updateData.data.event.organizer,
          hostedBy: updateData.data.event.hostedBy,
          organizerDetails: updateData.data.event.organizerDetails || [],
          purpose: updateData.data.event.purpose,
          agenda: updateData.data.event.agenda,
          format: updateData.data.event.format,
          disclaimer: updateData.data.event.disclaimer,
          roles: updateData.data.event.roles.map((role: any) => ({
            id: role.id,
            name: role.name,
            description: role.description,
            maxParticipants: role.maxParticipants,
            // Convert new backend format (registrations) to frontend format (currentSignups)
            currentSignups: role.registrations
              ? role.registrations.map((reg: any) => ({
                  userId: reg.user.id,
                  username: reg.user.username,
                  firstName: reg.user.firstName,
                  lastName: reg.user.lastName,
                  email: reg.user.email,
                  phone: reg.user.phone,
                  avatar: reg.user.avatar,
                  gender: reg.user.gender,
                  systemAuthorizationLevel: reg.user.systemAuthorizationLevel,
                  roleInAtCloud: reg.user.roleInAtCloud,
                  notes: reg.notes,
                  registeredAt: reg.registeredAt,
                }))
              : role.currentSignups || [],
          })),
          signedUp:
            updateData.data.event.roles?.reduce(
              (sum: number, role: any) =>
                sum +
                (role.registrations?.length ||
                  role.currentSignups?.length ||
                  0),
              0
            ) || 0,
          totalSlots:
            updateData.data.event.roles?.reduce(
              (sum: number, role: any) => sum + (role.maxParticipants || 0),
              0
            ) || 0,
          createdBy: updateData.data.event.createdBy,
          createdAt: updateData.data.event.createdAt,
          description: updateData.data.event.description,
          isHybrid: updateData.data.event.isHybrid,
          zoomLink: updateData.data.event.zoomLink,
          meetingId: updateData.data.event.meetingId,
          passcode: updateData.data.event.passcode,
          requirements: updateData.data.event.requirements,
          materials: updateData.data.event.materials,
          status: updateData.data.event.status || "upcoming",
          attendees: updateData.data.event.attendees,
          workshopGroupTopics:
            updateData.data.event.workshopGroupTopics || undefined,
        };

        setEvent(convertedEvent);

        // Show notification based on update type - use currentUserId from component scope
        switch (updateData.updateType) {
          case "workshop_topic_updated": {
            const grp = updateData.data.group as
              | "A"
              | "B"
              | "C"
              | "D"
              | "E"
              | "F";
            const newTopic = updateData.data.topic as string;
            setEvent((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                workshopGroupTopics: {
                  ...(prev.workshopGroupTopics || {}),
                  [grp]: newTopic,
                },
              };
            });
            if (updateData.data.userId !== currentUserId) {
              notification.info(`Group ${grp} topic updated`, {
                title: "Workshop Topic",
              });
            }
            break;
          }
          case "user_signed_up":
            if (updateData.data.userId !== currentUserId) {
              notification.info(`Someone joined ${updateData.data.roleName}`, {
                title: "Event Updated",
              });
            }
            break;
          case "user_cancelled":
            if (updateData.data.userId !== currentUserId) {
              notification.info(`Someone left ${updateData.data.roleName}`, {
                title: "Event Updated",
              });
            }
            break;
          case "user_removed":
            // Only show prompt window if:
            // 1. Current user is the one removed
            // 2. User is actually on this event's detail page (not just in the room)
            if (
              updateData.data.userId === currentUserId &&
              location.pathname === `/dashboard/event/${id}`
            ) {
              notification.warning(
                `You were removed from ${updateData.data.roleName}`,
                { title: "Event Update" }
              );
            } else if (updateData.data.userId !== currentUserId) {
              notification.info(
                `Someone was removed from ${updateData.data.roleName}`,
                { title: "Event Updated" }
              );
            }
            break;
          case "user_moved":
            // Only show prompt window if:
            // 1. Current user is the one moved
            // 2. User is actually on this event's detail page (not just in the room)
            if (
              updateData.data.userId === currentUserId &&
              location.pathname === `/dashboard/event/${id}`
            ) {
              notification.info(
                `You were moved from ${updateData.data.fromRoleName} to ${updateData.data.toRoleName}`,
                { title: "Event Update" }
              );
            } else if (updateData.data.userId !== currentUserId) {
              notification.info(`Someone was moved between roles`, {
                title: "Event Updated",
              });
            }
            break;
          case "user_assigned":
            // Only show prompt window if:
            // 1. Current user is the one assigned
            // 2. User is actually on this event's detail page (not just in the room)
            if (
              updateData.data.userId === currentUserId &&
              location.pathname === `/dashboard/event/${id}`
            ) {
              notification.info(
                `You were assigned to ${updateData.data.roleName}`,
                { title: "Event Update" }
              );
            }
            // Do not show notification to others (mirrors removal/move pattern requirement)
            break;
        }
      }

      // Always refetch fresh event for viewer-specific privacy (ensures email/phone visibility is correct without page refresh)
      try {
        const fresh = await eventService.getEvent(id);
        const viewerScopedEvent: EventData = {
          id: fresh.id || fresh._id,
          title: fresh.title,
          type: fresh.type,
          date: fresh.date,
          time: fresh.time,
          endTime: fresh.endTime,
          location: fresh.location,
          organizer: fresh.organizer,
          hostedBy: fresh.hostedBy,
          organizerDetails: fresh.organizerDetails || [],
          purpose: fresh.purpose,
          agenda: fresh.agenda,
          format: fresh.format,
          disclaimer: fresh.disclaimer,
          roles: fresh.roles.map((role: any) => ({
            id: role.id,
            name: role.name,
            description: role.description,
            maxParticipants: role.maxParticipants,
            currentSignups: role.registrations
              ? role.registrations.map((reg: any) => ({
                  userId: reg.user.id,
                  username: reg.user.username,
                  firstName: reg.user.firstName,
                  lastName: reg.user.lastName,
                  email: reg.user.email,
                  phone: reg.user.phone,
                  avatar: reg.user.avatar,
                  gender: reg.user.gender,
                  systemAuthorizationLevel: reg.user.systemAuthorizationLevel,
                  roleInAtCloud: reg.user.roleInAtCloud,
                  notes: reg.notes,
                  registeredAt: reg.registeredAt,
                }))
              : role.currentSignups || [],
          })),
          signedUp:
            fresh.roles?.reduce(
              (sum: number, role: any) =>
                sum +
                (role.registrations?.length ||
                  role.currentSignups?.length ||
                  0),
              0
            ) || 0,
          totalSlots:
            fresh.roles?.reduce(
              (sum: number, role: any) => sum + (role.maxParticipants || 0),
              0
            ) || 0,
          createdBy: fresh.createdBy,
          createdAt: fresh.createdAt,
          description: fresh.description,
          isHybrid: fresh.isHybrid,
          zoomLink: fresh.zoomLink,
          meetingId: fresh.meetingId,
          passcode: fresh.passcode,
          requirements: fresh.requirements,
          materials: fresh.materials,
          status: fresh.status || "upcoming",
          attendees: fresh.attendees,
          workshopGroupTopics: fresh.workshopGroupTopics || undefined,
        };
        if (isComponentMounted) setEvent(viewerScopedEvent);
      } catch (e) {
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
        socketService.leaveEventRoom(id);
      }, 0);
    };
  }, [id, notification, currentUserId]); // Include currentUserId in dependencies

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
        roles: updatedEvent.roles.map((role: any) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          maxParticipants: role.maxParticipants,
          // Convert new backend format (registrations) to frontend format (currentSignups)
          currentSignups: role.registrations
            ? role.registrations.map((reg: any) => ({
                userId: reg.user.id,
                username: reg.user.username,
                firstName: reg.user.firstName,
                lastName: reg.user.lastName,
                email: reg.user.email,
                phone: reg.user.phone,
                avatar: reg.user.avatar,
                gender: reg.user.gender,
                systemAuthorizationLevel: reg.user.systemAuthorizationLevel,
                roleInAtCloud: reg.user.roleInAtCloud,
                notes: reg.notes,
                registeredAt: reg.registeredAt,
              }))
            : role.currentSignups || [],
        })),
        signedUp:
          updatedEvent.signedUp ||
          updatedEvent.roles?.reduce(
            (sum: number, role: any) =>
              sum +
              (role.registrations?.length || role.currentSignups?.length || 0),
            0
          ) ||
          0,
      };

      setEvent(convertedEvent);

      const roleName =
        event.roles.find((role) => role.id === roleId)?.name || "role";
      notification.success(`You have successfully signed up for ${roleName}!`, {
        title: "Signup Confirmed",
        autoCloseDelay: 4000,
        actionButton: {
          text: "View My Signups",
          onClick: () => navigate("/dashboard/my-events"),
          variant: "secondary",
        },
      });
    } catch (error: any) {
      console.error("Error signing up for role:", error);
      const roleName =
        event.roles.find((role) => role.id === roleId)?.name || "role";
      notification.error(
        error.message || `Unable to sign up for ${roleName}. Please try again.`,
        {
          title: "Signup Failed",
          actionButton: {
            text: "Retry Signup",
            onClick: () => handleRoleSignup(roleId),
            variant: "primary",
          },
        }
      );
    }
  };

  // Permission checks for editing workshop topics
  const canEditWorkshopGroup = (
    group: "A" | "B" | "C" | "D" | "E" | "F"
  ): boolean => {
    if (!event || !currentUser) return false;
    const userRole = currentUser.role;
    if (userRole === "Super Admin" || userRole === "Administrator") return true;
    // Event initiator (createdBy matches currentUser.id)
    if (event.createdBy === currentUser.id) return true;
    // Listed co-organizers in organizerDetails
    if (event.organizerDetails?.some((o) => o.userId === currentUser.id))
      return true;
    // Registered Group {X} Leader
    const leaderRoleName = `Group ${group} Leader`;
    return event.roles.some(
      (role) =>
        role.name === leaderRoleName &&
        role.currentSignups.some((s) => s.userId === currentUser.id)
    );
  };

  const startEditTopic = (group: "A" | "B" | "C" | "D" | "E" | "F") => {
    if (!event) return;
    setEditingGroup(group);
    const current = event.workshopGroupTopics?.[group] || "";
    setTopicDraft(current);
  };

  const cancelEditTopic = () => {
    setEditingGroup(null);
    setTopicDraft("");
  };

  const saveTopic = async () => {
    if (!event || !editingGroup) return;
    try {
      const updated = await eventService.updateWorkshopGroupTopic(
        event.id,
        editingGroup,
        topicDraft.trim()
      );
      // Merge back minimal parts we need
      setEvent((prev) => {
        if (!prev) return prev;
        const converted: EventData = {
          ...prev,
          // keep previous roles mapping; backend returns full event, but we only need topics here
          workshopGroupTopics: updated.workshopGroupTopics || {
            ...(prev.workshopGroupTopics || {}),
            [editingGroup]: topicDraft.trim(),
          },
        };
        return converted;
      });
      notification.success(`Saved topic for Group ${editingGroup}.`, {
        title: "Workshop Topic",
      });
      setEditingGroup(null);
      setTopicDraft("");
    } catch (error: any) {
      notification.error(error.message || "Failed to save topic.", {
        title: "Workshop Topic",
      });
    }
  };

  const handleRoleCancel = async (roleId: string) => {
    if (!event || !currentUser) return;

    try {
      // Call backend API to cancel event signup
      const updatedEvent = await eventService.cancelSignup(event.id, roleId);

      // Convert backend response to frontend format and update state
      const convertedEvent: EventData = {
        ...event,
        roles: updatedEvent.roles.map((role: any) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          maxParticipants: role.maxParticipants,
          // Convert new backend format (registrations) to frontend format (currentSignups)
          currentSignups: role.registrations
            ? role.registrations.map((reg: any) => ({
                userId: reg.user.id,
                username: reg.user.username,
                firstName: reg.user.firstName,
                lastName: reg.user.lastName,
                email: reg.user.email,
                phone: reg.user.phone,
                avatar: reg.user.avatar,
                gender: reg.user.gender,
                systemAuthorizationLevel: reg.user.systemAuthorizationLevel,
                roleInAtCloud: reg.user.roleInAtCloud,
                notes: reg.notes,
                registeredAt: reg.registeredAt,
              }))
            : role.currentSignups || [],
        })),
        signedUp:
          updatedEvent.signedUp ||
          updatedEvent.roles?.reduce(
            (sum: number, role: any) =>
              sum +
              (role.registrations?.length || role.currentSignups?.length || 0),
            0
          ) ||
          0,
      };

      setEvent(convertedEvent);

      const roleName =
        event.roles.find((role) => role.id === roleId)?.name || "role";
      notification.success(`Your signup for ${roleName} has been canceled.`, {
        title: "Signup Canceled",
        autoCloseDelay: 4000,
        actionButton: {
          text: "Undo Cancel",
          onClick: () => handleRoleSignup(roleId),
          variant: "secondary",
        },
      });
    } catch (error: any) {
      console.error("Error canceling role signup:", error);
      const roleName =
        event.roles.find((role) => role.id === roleId)?.name || "role";
      notification.error(
        error.message ||
          `Unable to cancel signup for ${roleName}. Please try again.`,
        {
          title: "Cancel Failed",
          actionButton: {
            text: "Retry Cancel",
            onClick: () => handleRoleCancel(roleId),
            variant: "primary",
          },
        }
      );
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
        roles: updatedEvent.roles.map((role: any) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          maxParticipants: role.maxParticipants,
          // Convert new backend format (registrations) to frontend format (currentSignups)
          currentSignups: role.registrations
            ? role.registrations.map((reg: any) => ({
                userId: reg.user.id,
                username: reg.user.username,
                firstName: reg.user.firstName,
                lastName: reg.user.lastName,
                email: reg.user.email,
                phone: reg.user.phone,
                avatar: reg.user.avatar,
                gender: reg.user.gender,
                systemAuthorizationLevel: reg.user.systemAuthorizationLevel,
                roleInAtCloud: reg.user.roleInAtCloud,
                notes: reg.notes,
                registeredAt: reg.registeredAt,
              }))
            : role.currentSignups || [],
        })),
        signedUp:
          updatedEvent.signedUp ||
          updatedEvent.roles?.reduce(
            (sum: number, role: any) =>
              sum +
              (role.registrations?.length || role.currentSignups?.length || 0),
            0
          ) ||
          0,
      };

      // Update local state with converted data
      setEvent(convertedEvent);

      notification.success(
        `${user?.firstName} ${user?.lastName} has been removed from ${roleName}.`,
        {
          title: "User Removed",
          autoCloseDelay: 4000,
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
      notification.error("Unable to remove user from role. Please try again.", {
        title: "Removal Failed",
        actionButton: {
          text: "Retry",
          onClick: () => handleManagementCancel(roleId, userId),
          variant: "primary",
        },
      });
    }
  };

  // Drag and drop functionality
  const handleDragStart = (
    e: React.DragEvent,
    userId: string,
    fromRoleId: string
  ) => {
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ userId, fromRoleId })
    );
    e.dataTransfer.effectAllowed = "move";
    setDraggedUserId(userId);
  };

  const handleDragEnd = () => {
    setDraggedUserId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, toRoleId: string) => {
    e.preventDefault();
    setDraggedUserId(null);

    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      const { userId, fromRoleId } = data;

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

      // Find the user to move
      const fromRole = event.roles.find((role) => role.id === fromRoleId);
      if (!fromRole) return;

      const userToMove = fromRole.currentSignups?.find(
        (signup) => signup.userId === userId
      );
      if (!userToMove) return;

      // Call real API endpoint
      const updatedEvent = await eventService.moveUserBetweenRoles(
        event.id,
        userId,
        fromRoleId,
        toRoleId
      );

      // Convert backend response to frontend format and update state
      const convertedEvent: EventData = {
        ...event,
        roles: updatedEvent.roles.map((role: any) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          maxParticipants: role.maxParticipants,
          // Convert new backend format (registrations) to frontend format (currentSignups)
          currentSignups: role.registrations
            ? role.registrations.map((reg: any) => ({
                userId: reg.user.id,
                username: reg.user.username,
                firstName: reg.user.firstName,
                lastName: reg.user.lastName,
                email: reg.user.email,
                phone: reg.user.phone,
                avatar: reg.user.avatar,
                gender: reg.user.gender,
                systemAuthorizationLevel: reg.user.systemAuthorizationLevel,
                roleInAtCloud: reg.user.roleInAtCloud,
                notes: reg.notes,
                registeredAt: reg.registeredAt,
              }))
            : role.currentSignups || [],
        })),
        signedUp:
          updatedEvent.signedUp ||
          updatedEvent.roles?.reduce(
            (sum: number, role: any) =>
              sum +
              (role.registrations?.length || role.currentSignups?.length || 0),
            0
          ) ||
          0,
      };

      // Update local state with converted data
      setEvent(convertedEvent);

      notification.success(
        `${userToMove.firstName} ${userToMove.lastName} has been moved from ${fromRole.name} to ${toRole.name}.`,
        {
          title: "User Moved",
          autoCloseDelay: 4000,
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
        "Unable to move user between roles. Please try again.",
        {
          title: "Move Failed",
          actionButton: {
            text: "Refresh",
            onClick: () => window.location.reload(),
            variant: "primary",
          },
        }
      );
    }
  };

  // Export signups to Excel
  const handleExportSignups = () => {
    if (!event) return;

    // Prepare data for export
    const exportData: any[] = [];

    event.roles.forEach((role) => {
      role.currentSignups?.forEach((signup) => {
        exportData.push({
          "First Name": signup.firstName || "",
          "Last Name": signup.lastName || "",
          Username: signup.username,
          "System Authorization Level": signup.systemAuthorizationLevel || "",
          "Role in @Cloud": signup.roleInAtCloud || "",
          Gender: signup.gender || "",
          "Event Role": role.name,
          "Role Description": role.description,
          "Signup Notes": signup.notes || "",
          "User ID": signup.userId,
        });
      });
    });

    if (exportData.length === 0) {
      notification.warning(
        "There are currently no signups to export for this event.",
        {
          title: "No Data to Export",
          autoCloseDelay: 4000,
        }
      );
      return;
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();

    // Convert data to worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Event Signups");

    // Generate filename with current date
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
    const filename = `${event.title.replace(
      /\s+/g,
      "_"
    )}_signups_${today}.xlsx`;

    // Write and download the file
    XLSX.writeFile(wb, filename);

    notification.success(
      `Successfully exported signup data for ${exportData.length} participants.`,
      {
        title: "Export Complete",
        autoCloseDelay: 4000,
        actionButton: {
          text: "Export Again",
          onClick: () => handleExportSignups(),
          variant: "secondary",
        },
      }
    );
  };

  // Handle event deletion
  const handleDeleteEvent = async () => {
    if (!event) return;

    try {
      // Call the actual backend API to delete the event
      await eventService.deleteEvent(event.id);

      notification.success(
        `"${event.title}" has been permanently deleted from the system.`,
        {
          title: "Event Deleted",
          autoCloseDelay: 3000,
          actionButton: {
            text: "Browse Events",
            onClick: () => navigate("/dashboard"),
            variant: "primary",
          },
        }
      );

      // Navigate back to dashboard
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error deleting event:", error);

      // Handle specific error cases
      let errorMessage =
        "Unable to delete the event. Please try again or contact support.";
      let errorTitle = "Deletion Failed";

      if (error.message?.includes("participants")) {
        errorMessage =
          "Cannot delete event with registered participants. Please remove all participants first.";
        errorTitle = "Event Has Participants";
      } else if (error.message?.includes("permissions")) {
        errorMessage =
          "You don't have permission to delete this event. Only event organizers or administrators can delete events.";
        errorTitle = "Permission Denied";
      } else if (error.message?.includes("not found")) {
        errorMessage =
          "This event has already been deleted or no longer exists.";
        errorTitle = "Event Not Found";
      }

      notification.error(errorMessage, {
        title: errorTitle,
        actionButton: {
          text:
            errorTitle === "Event Not Found" ? "Browse Events" : "Retry Delete",
          onClick: () => {
            if (errorTitle === "Event Not Found") {
              navigate("/dashboard");
            } else {
              handleDeleteEvent();
            }
          },
          variant: "primary",
        },
      });
    }
  };

  // Handle event cancellation
  const handleCancelEvent = async () => {
    if (!event) return;

    try {
      // Call the backend API to update event status to cancelled
      await eventService.updateEvent(event.id, { status: "cancelled" });

      // Update local state to mark as cancelled
      const updatedEvent = { ...event, status: "cancelled" as const };
      setEvent(updatedEvent);

      notification.success(
        `"${event.title}" has been cancelled. All participants will be notified automatically.`,
        {
          title: "Event Cancelled",
          autoCloseDelay: 5000,
          actionButton: {
            text: "Undo Cancel",
            onClick: async () => {
              try {
                // Call API to revert cancellation
                await eventService.updateEvent(event.id, {
                  status: "upcoming",
                });
                const revertedEvent = { ...event };
                delete (revertedEvent as any).status; // Remove cancelled status to revert to normal
                setEvent(revertedEvent);
                notification.success("Event cancellation has been reverted.", {
                  title: "Cancellation Reverted",
                  autoCloseDelay: 3000,
                });
              } catch (error) {
                console.error("Error reverting cancellation:", error);
                notification.error("Failed to revert event cancellation.", {
                  title: "Revert Failed",
                });
              }
            },
            variant: "secondary",
          },
        }
      );

      // Close management mode if open
      setManagementMode(false);
    } catch (error: any) {
      console.error("Error cancelling event:", error);

      // Handle specific error cases
      let errorMessage =
        "Unable to cancel the event. Please try again or contact support.";
      let errorTitle = "Cancellation Failed";

      if (error.message?.includes("permissions")) {
        errorMessage =
          "You don't have permission to cancel this event. Only event organizers or administrators can cancel events.";
        errorTitle = "Permission Denied";
      } else if (error.message?.includes("not found")) {
        errorMessage = "This event no longer exists.";
        errorTitle = "Event Not Found";
      }

      notification.error(errorMessage, {
        title: errorTitle,
        actionButton: {
          text:
            errorTitle === "Event Not Found" ? "Browse Events" : "Retry Cancel",
          onClick: () => {
            if (errorTitle === "Event Not Found") {
              navigate("/dashboard");
            } else {
              handleCancelEvent();
            }
          },
          variant: "primary",
        },
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Event Not Found
        </h2>
        <p className="text-gray-600 mb-6">
          The event you're looking for doesn't exist.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Event Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-600 hover:text-gray-900"
            >
              <Icon name="arrow-left" className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              {event.title}
              {isPassedEvent && (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  Completed
                </span>
              )}
            </h1>
          </div>

          {/* Action Buttons - Different for passed vs upcoming events */}
          <div className="flex items-center space-x-3">
            {isPassedEvent ? (
              /* For passed events, only show Export button for Super Admin and Organizers */
              currentUserRole === "Super Admin" || isCurrentUserOrganizer ? (
                <button
                  onClick={handleExportSignups}
                  className="inline-flex items-center bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Export Data
                </button>
              ) : null
            ) : (
              /* For upcoming events, show management and delete buttons for authorized users */
              <>
                {canManageSignups && (
                  <>
                    <button
                      onClick={() => setManagementMode(!managementMode)}
                      className={`px-4 py-2 rounded-md transition-colors ${
                        managementMode
                          ? "bg-gray-600 text-white hover:bg-gray-700"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {managementMode ? "Exit Management" : "Manage Sign-ups"}
                    </button>
                    {managementMode && (
                      <button
                        onClick={handleExportSignups}
                        className="inline-flex items-center bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                      >
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        Export Data
                      </button>
                    )}
                  </>
                )}
                {canDeleteEvent && (
                  <button
                    onClick={() => setShowDeletionModal(true)}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                  >
                    Delete Event
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Event Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="flex items-center text-gray-600">
            <Icon name="calendar" className="w-5 h-5 mr-3" />
            {formatDateToAmerican(event.date)} from {event.time} -{" "}
            {event.endTime}
          </div>
          <div className="flex items-center text-gray-600">
            <Icon name="map-pin" className="w-5 h-5 mr-3" />
            {event.location}
          </div>
          <div className="flex items-center text-gray-600">
            <Icon name="tag" className="w-5 h-5 mr-3" />
            Format: {event.format}
          </div>
          {/* Event Type */}
          <div className="flex items-center text-gray-600">
            <Icon name="check-circle" className="w-5 h-5 mr-3" />
            Type: {event.type || "No Type"}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Hosted by
            </h3>
            <div className="flex items-center text-gray-700">
              <img
                src="/Cloud-removebg.png"
                alt="@Cloud Logo"
                className="h-6 w-auto mr-2 object-contain"
              />
              {event.hostedBy || "@Cloud Marketplace Ministry"}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Purpose
            </h3>
            <p className="text-gray-700">{event.purpose}</p>
          </div>

          {/* Description */}
          {event.description && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Description
              </h3>
              <p className="text-gray-700">{event.description}</p>
            </div>
          )}

          {/* Event Capacity */}
          {event.totalSlots && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Event Capacity
              </h3>
              <div className="flex items-center text-gray-700">
                <Icon name="user" className="w-5 h-5 mr-2" />
                <span>
                  {event.totalSlots} total slots available
                  {event.signedUp !== undefined && (
                    <span className="text-gray-500 ml-2">
                      ({event.signedUp} currently signed up)
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Event Agenda and Schedule */}
          {event.agenda && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Event Agenda and Schedule
              </h3>
              <div className="text-gray-700 whitespace-pre-line">
                {event.agenda}
              </div>
            </div>
          )}

          {/* Organizer Contact Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Organizer Contact Information
            </h3>
            {event.organizerDetails && event.organizerDetails.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {event.organizerDetails.map((organizer, index) => {
                  // Check if organizer card should be clickable
                  const isClickable =
                    organizer.userId &&
                    (canNavigateToProfiles ||
                      organizer.userId === currentUserId);

                  return (
                    <div
                      key={index}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div
                        className={`flex items-start space-x-3 mb-3 ${
                          isClickable
                            ? "cursor-pointer hover:bg-gray-100 -mx-2 -my-1 px-2 py-1 rounded-md transition-colors"
                            : ""
                        }`}
                        onClick={() => {
                          if (isClickable && organizer.userId) {
                            handleNameCardClick(
                              organizer.userId,
                              organizer.name,
                              organizer.role
                            );
                          }
                        }}
                        title={
                          isClickable
                            ? `Click to interact with ${organizer.name}`
                            : undefined
                        }
                      >
                        {/* Avatar */}
                        <img
                          src={getAvatarUrl(
                            organizer.avatar || null,
                            organizer.gender || "male"
                          )}
                          alt={getAvatarAlt(
                            organizer.name.split(" ")[0] || "",
                            organizer.name.split(" ")[1] || "",
                            !!organizer.avatar
                          )}
                          className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                        />

                        {/* Organizer Info */}
                        <div className="flex-1">
                          <div
                            className={`font-medium text-gray-900 mb-1 ${
                              isClickable
                                ? "hover:text-blue-600 transition-colors"
                                : ""
                            }`}
                          >
                            {organizer.name}
                            {organizer.userId === currentUserId && (
                              <span className="ml-2 text-xs text-blue-600 font-normal">
                                (You)
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            {organizer.role}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-600">
                          <Icon name="envelope" className="w-3.5 h-3.5 mr-3" />
                          <a
                            href={`mailto:${organizer.email}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {organizer.email}
                          </a>
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Icon name="phone" className="w-3.5 h-3.5 mr-3" />
                          <a
                            href={`tel:${organizer.phone}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {organizer.phone}
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-700">
                {event.organizer || "No organizer specified."}
              </p>
            )}
          </div>

          {/* Online Meeting Link */}
          {(event.format === "Online" ||
            event.format === "Hybrid Participation") &&
            event.zoomLink && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Online Meeting Link
                </h3>
                <a
                  href={event.zoomLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline break-all"
                >
                  {event.zoomLink}
                </a>
              </div>
            )}

          {/* Meeting Details */}
          {(event.format === "Online" ||
            event.format === "Hybrid Participation") &&
            (event.meetingId || event.passcode) && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Meeting Details
                </h3>
                <div className="space-y-1 text-gray-700">
                  {event.meetingId && (
                    <div className="flex items-center">
                      <span className="font-medium w-24">Meeting ID:</span>
                      <span className="font-mono">{event.meetingId}</span>
                    </div>
                  )}
                  {event.passcode && (
                    <div className="flex items-center">
                      <span className="font-medium w-24">Passcode:</span>
                      <span className="font-mono">{event.passcode}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Requirements */}
          {event.requirements && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Requirements
              </h3>
              <p className="text-gray-700">{event.requirements}</p>
            </div>
          )}

          {/* Materials Needed */}
          {event.materials && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Materials Needed
              </h3>
              <p className="text-gray-700">{event.materials}</p>
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Disclaimer
            </h3>
            <p className="text-gray-700">{event.disclaimer}</p>
          </div>
        </div>
      </div>

      {/* User's Current Signup Status - Only show for upcoming events in normal mode */}
      {isUserSignedUp && !managementMode && !isPassedEvent && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Icon name="check-circle" className="w-5 h-5 text-green-600 mr-3" />
            <h3 className="text-sm font-medium text-green-800">
              You're signed up for {userSignedUpRoles.length} role
              {userSignedUpRoles.length !== 1 ? "s" : ""}:
            </h3>
          </div>
          <div className="ml-8 space-y-1">
            {userSignedUpRoles.map((role) => (
              <div key={role.id} className="text-sm text-green-700">
                <span className="font-medium">{role.name}</span> -{" "}
                {role.description}
              </div>
            ))}
          </div>
          {userSignedUpRoles.length < maxRolesForUser && (
            <p className="text-xs text-green-600 mt-2 ml-8">
              You can sign up for {maxRolesForUser - userSignedUpRoles.length}{" "}
              more role
              {maxRolesForUser - userSignedUpRoles.length !== 1 ? "s" : ""}.
              {currentUserRole === "Participant" && (
                <span className="block mt-1 text-gray-600">
                  As a Participant, you can only sign up for: Prepared Speaker
                  or Common Participant roles.
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Maximum roles reached warning - Only show for upcoming events in normal mode */}
      {hasReachedMaxRoles && !managementMode && !isPassedEvent && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center">
            <Icon name="tag" className="w-5 h-5 text-amber-600 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-amber-800">
                Maximum Roles Reached
              </h3>
              <p className="text-xs text-amber-600 mt-1">
                You have reached the maximum of {maxRolesForUser} role
                {maxRolesForUser !== 1 ? "s" : ""} allowed for your
                authorization level ({currentUserRole}).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Completed Event Notice - Only show for passed events */}
      {isPassedEvent && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <Icon name="check-circle" className="w-5 h-5 text-blue-600 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">
                This event has been completed.
              </h3>
              <p className="text-sm text-blue-600">
                This event took place on {formatDateToAmerican(event.date)} and
                had {event.attendees || event.signedUp} attendees. You can view
                the participant list below, but no changes can be made.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cancelled Event Notice */}
      {event.status === "cancelled" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <Icon name="tag" className="w-5 h-5 text-red-600 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-red-800">
                This event has been cancelled by the organizers.
              </h3>
              <p className="text-sm text-red-600">
                All participants have been notified of the cancellation. The
                event will be moved to past events after its scheduled time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Roles Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          {isPassedEvent
            ? "Event Participants"
            : managementMode
            ? "Manage Event Sign-ups"
            : "Event Roles & Sign-up"}
        </h2>

        {/* Workshop Group Topics Section */}
        {event.type === "Effective Communication Workshop" && (
          <div className="mb-8 border rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Group Practice Topics
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Each group can have a topic. Editable by Super Admin,
              Administrator, event initiator, co-organizers, and the registered
              Group Leader for that group.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(["A", "B", "C", "D", "E", "F"] as const).map((g) => {
                const topic = event.workshopGroupTopics?.[g] || "";
                const canEdit = canEditWorkshopGroup(g);
                const isEditing = editingGroup === g;
                return (
                  <div
                    key={g}
                    className="bg-white border border-gray-200 rounded-md p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-gray-900">Group {g}</div>
                      {canEdit &&
                        !isPassedEvent &&
                        (isEditing ? (
                          <div className="space-x-2">
                            <button
                              onClick={saveTopic}
                              className="px-2 py-1 text-sm bg-blue-600 text-white rounded"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditTopic}
                              className="px-2 py-1 text-sm bg-gray-200 text-gray-800 rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditTopic(g)}
                            className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                          >
                            Edit
                          </button>
                        ))}
                    </div>
                    {isEditing ? (
                      <textarea
                        value={topicDraft}
                        onChange={(e) => setTopicDraft(e.target.value)}
                        className="w-full border border-gray-300 rounded p-2 text-sm"
                        rows={3}
                        maxLength={200}
                        placeholder={`Enter topic for Group ${g} (max 200 chars)`}
                      />
                    ) : (
                      <div className="text-sm text-gray-700 min-h-[3rem] whitespace-pre-wrap">
                        {topic ? (
                          topic
                        ) : (
                          <span className="text-gray-400">No topic set</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
                    <p className="text-sm text-gray-600">{role.description}</p>
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
                        canNavigateToProfiles ||
                        signup.userId === currentUserId;
                      const roleGroupMatch = role.name.match(
                        /^Group ([A-F]) (Leader|Participants)$/
                      );
                      const roleGroupLetter =
                        (roleGroupMatch?.[1] as any) || null;
                      const myRole = getUserSignupRoles().find((r) =>
                        /^Group [A-F] (Leader|Participants)$/.test(r.name)
                      );
                      const m = myRole?.name.match(
                        /^Group ([A-F]) (Leader|Participants)$/
                      );
                      const viewerGroupLetter = (m?.[1] as any) || null;
                      const showContact =
                        event.type === "Effective Communication Workshop" &&
                        roleGroupLetter &&
                        viewerGroupLetter &&
                        roleGroupLetter === viewerGroupLetter;

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
                              src={getAvatarUrl(
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
                                {signup.systemAuthorizationLevel && (
                                  <div>
                                    System Authorization Level:{" "}
                                    {signup.systemAuthorizationLevel}
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
                  draggedUserId &&
                  role.currentSignups.length < role.maxParticipants
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, role.id)}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {role.name}
                    </h3>
                    <p className="text-sm text-gray-600">{role.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {role.currentSignups.length} / {role.maxParticipants}{" "}
                      participants
                      {role.currentSignups.length >= role.maxParticipants && (
                        <span className="text-red-500 ml-1">(Full)</span>
                      )}
                    </p>
                  </div>
                </div>

                {role.currentSignups.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-700 mb-2">
                      Current Sign-ups:
                    </h4>
                    {role.currentSignups.map((signup) => (
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
                            src={getAvatarUrl(
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
                              {signup.systemAuthorizationLevel && (
                                <div>
                                  System Authorization Level:{" "}
                                  {signup.systemAuthorizationLevel}
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
                    ))}
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
              const myRole = getUserSignupRoles().find((r) =>
                /^Group [A-F] (Leader|Participants)$/.test(r.name)
              );
              const m = myRole?.name.match(
                /^Group ([A-F]) (Leader|Participants)$/
              );
              const viewerGroupLetter = (m?.[1] as any) || null;

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
                  eventType={event.type}
                  viewerGroupLetter={viewerGroupLetter}
                  isOrganizer={!!canManageSignups}
                  onAssignUser={async (roleId, userId) => {
                    try {
                      const updatedEvent = await eventService.assignUserToRole(
                        event.id,
                        userId,
                        roleId
                      );
                      const convertedEvent: EventData = {
                        ...event,
                        roles: updatedEvent.roles.map((role: any) => ({
                          id: role.id,
                          name: role.name,
                          description: role.description,
                          maxParticipants: role.maxParticipants,
                          currentSignups: role.registrations
                            ? role.registrations.map((reg: any) => ({
                                userId: reg.user.id,
                                username: reg.user.username,
                                firstName: reg.user.firstName,
                                lastName: reg.user.lastName,
                                email: reg.user.email,
                                phone: reg.user.phone,
                                avatar: reg.user.avatar,
                                gender: reg.user.gender,
                                systemAuthorizationLevel:
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
                            (sum: number, role: any) =>
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
                        event.roles.find((r) => r.id === roleId)?.name ||
                        "role";
                      notification.success(
                        `User has been assigned to ${roleName}.`,
                        {
                          title: "Assignment Complete",
                        }
                      );
                    } catch (error: any) {
                      notification.error(
                        error.message || "Failed to assign user.",
                        {
                          title: "Assignment Failed",
                        }
                      );
                    }
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Event Deletion Modal */}
      {event && (
        <EventDeletionModal
          isOpen={showDeletionModal}
          onClose={() => setShowDeletionModal(false)}
          onDelete={handleDeleteEvent}
          onCancel={handleCancelEvent}
          eventTitle={event.title}
        />
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
