import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { EventData, EventRole } from "../types/event";
import EventRoleSignup from "../components/events/EventRoleSignup";
import { Icon, EventDeletionModal } from "../components/common";
import NameCardActionModal from "../components/common/NameCardActionModal";
import { getAvatarUrl, getAvatarAlt } from "../utils/avatarUtils";
import { eventService } from "../services/api";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { useAuth } from "../hooks/useAuth";
import * as XLSX from "xlsx";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const notification = useToastReplacement();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [managementMode, setManagementMode] = useState(false);
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);
  const [showDeletionModal, setShowDeletionModal] = useState(false);

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

  // Get all roles the user is signed up for
  const getUserSignupRoles = (): EventRole[] => {
    if (!event) return [];

    return event.roles.filter((role) =>
      role.currentSignups.some((signup) => signup.userId === currentUserId)
    );
  };

  // Check if user has reached the maximum number of roles (3)
  const userSignedUpRoles = getUserSignupRoles();
  const hasReachedMaxRoles = userSignedUpRoles.length >= 3;
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
            currentSignups: role.currentSignups || [],
          })),
          signedUp:
            eventData.signedUp ||
            eventData.roles?.reduce(
              (sum: number, role: any) =>
                sum + (role.currentSignups?.length || 0),
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
          currentSignups: role.currentSignups || [],
        })),
        signedUp:
          updatedEvent.signedUp ||
          updatedEvent.roles?.reduce(
            (sum: number, role: any) =>
              sum + (role.currentSignups?.length || 0),
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
          onClick: () => navigate("/my-events"),
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
          currentSignups: role.currentSignups || [],
        })),
        signedUp:
          updatedEvent.signedUp ||
          updatedEvent.roles?.reduce(
            (sum: number, role: any) =>
              sum + (role.currentSignups?.length || 0),
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
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update local state
      const updatedEvent = { ...event };
      const roleIndex = updatedEvent.roles.findIndex(
        (role) => role.id === roleId
      );

      if (roleIndex !== -1) {
        const user = updatedEvent.roles[roleIndex].currentSignups.find(
          (signup) => signup.userId === userId
        );

        updatedEvent.roles[roleIndex].currentSignups = updatedEvent.roles[
          roleIndex
        ].currentSignups.filter((signup) => signup.userId !== userId);

        setEvent(updatedEvent);
        notification.success(
          `${user?.firstName} ${user?.lastName} has been removed from ${updatedEvent.roles[roleIndex].name}.`,
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
      }
    } catch (error) {
      console.error("Error canceling user signup:", error);
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

      if (toRole.currentSignups.length >= toRole.maxParticipants) {
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

      const userToMove = fromRole.currentSignups.find(
        (signup) => signup.userId === userId
      );
      if (!userToMove) return;

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Update local state
      const updatedEvent = { ...event };

      // Remove user from source role
      const fromRoleIndex = updatedEvent.roles.findIndex(
        (role) => role.id === fromRoleId
      );
      if (fromRoleIndex !== -1) {
        updatedEvent.roles[fromRoleIndex].currentSignups = updatedEvent.roles[
          fromRoleIndex
        ].currentSignups.filter((signup) => signup.userId !== userId);
      }

      // Add user to target role
      const toRoleIndex = updatedEvent.roles.findIndex(
        (role) => role.id === toRoleId
      );
      if (toRoleIndex !== -1) {
        updatedEvent.roles[toRoleIndex].currentSignups.push(userToMove);
      }

      setEvent(updatedEvent);
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
      role.currentSignups.forEach((signup) => {
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
            {event.date} from {event.time} - {event.endTime}
          </div>
          <div className="flex items-center text-gray-600">
            <Icon name="map-pin" className="w-5 h-5 mr-3" />
            {event.location}
          </div>
          <div className="flex items-center text-gray-600">
            <Icon name="tag" className="w-5 h-5 mr-3" />
            {event.format}
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
          {userSignedUpRoles.length < 3 && (
            <p className="text-xs text-green-600 mt-2 ml-8">
              You can sign up for {3 - userSignedUpRoles.length} more role
              {3 - userSignedUpRoles.length !== 1 ? "s" : ""}.
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
                You have reached the maximum number of roles permitted.
              </h3>
              <p className="text-sm text-amber-600">
                You cannot sign up for additional roles beyond the 3 you've
                already selected.
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
                This event took place on {event.date} and had{" "}
                {event.attendees || event.signedUp} attendees. You can view the
                participant list below, but no changes can be made.
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
                          {/* Removed "Attended" information */}
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
