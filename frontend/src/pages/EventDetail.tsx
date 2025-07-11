import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { EventData, EventRole } from "../types/event";
import EventRoleSignup from "../components/events/EventRoleSignup";
import { COMMUNICATION_WORKSHOP_ROLES } from "../config/eventRoles";
import { Icon, EventDeletionModal } from "../components/common";
import NameCardActionModal from "../components/common/NameCardActionModal";
import { getAvatarUrl, getAvatarAlt } from "../utils/avatarUtils";
import {
  mockUpcomingEventsDynamic,
  mockPassedEventsDynamic,
} from "../data/mockEventData";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth";
import * as XLSX from "xlsx";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
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

        // Simulate API call - replace with actual API call later
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check if event exists in upcoming events first
        let foundEvent = mockUpcomingEventsDynamic.find(
          (event) => event.id === id
        );

        // If not found in upcoming, check passed events
        if (!foundEvent) {
          foundEvent = mockPassedEventsDynamic.find((event) => event.id === id);
        }

        if (foundEvent) {
          // Use the actual event data from mock data
          setEvent(foundEvent);
        } else {
          // Fallback to original mock logic for event ID 1 (for backwards compatibility)
          if (id === "1") {
            const roles = COMMUNICATION_WORKSHOP_ROLES.map((role, index) => ({
              id: (index + 1).toString(),
              name: role.name,
              description: role.description,
              maxParticipants: role.maxParticipants,
              currentSignups:
                index === 0
                  ? [
                      {
                        userId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
                        username: "jane_smith",
                        firstName: "Jane",
                        lastName: "Smith",
                        systemAuthorizationLevel: "Leader",
                        roleInAtCloud: "Event Director",
                        gender: "female" as const,
                        notes: "Excited to lead the spiritual covering!",
                      },
                    ]
                  : index === 1
                  ? [
                      {
                        userId: "6ba7b814-9dad-11d1-80b4-00c04fd430c8",
                        username: "mike_johnson",
                        firstName: "Mike",
                        lastName: "Johnson",
                        systemAuthorizationLevel: "Participant",
                        roleInAtCloud: "Multimedia Technician",
                        gender: "male" as const,
                        notes: "Ready to handle all technical needs",
                      },
                    ]
                  : index === 2
                  ? [
                      {
                        userId: "6ba7b815-9dad-11d1-80b4-00c04fd430c8",
                        username: "alex_tech",
                        firstName: "Alex",
                        lastName: "Martinez",
                        systemAuthorizationLevel: "Participant",
                        roleInAtCloud: "AV Equipment Specialist",
                        gender: "male" as const,
                        notes: "Experienced with AV equipment and streaming",
                      },
                      {
                        userId: "6ba7b817-9dad-11d1-80b4-00c04fd430c8",
                        username: "sarah_tech",
                        firstName: "Sarah",
                        lastName: "Wilson",
                        systemAuthorizationLevel: "Participant",
                        roleInAtCloud: "Sound Engineer",
                        gender: "female" as const,
                        notes:
                          "Specializing in sound engineering and recording",
                      },
                      // Add current user to this role (Tech Assistant has max 3, currently has 2)
                      {
                        userId: "550e8400-e29b-41d4-a716-446655440000",
                        username: "current_user",
                        firstName: "Current",
                        lastName: "User",
                        systemAuthorizationLevel: "Super Admin",
                        roleInAtCloud: "Regular Participant",
                        gender: "male" as const,
                        notes: "Happy to assist with technical support",
                      },
                    ]
                  : index === 3 // Main Presenter role
                  ? [
                      // Add current user to Main Presenter role (max 1, currently has 0)
                      {
                        userId: "550e8400-e29b-41d4-a716-446655440000",
                        username: "current_user",
                        firstName: "Current",
                        lastName: "User",
                        systemAuthorizationLevel: "Super Admin",
                        roleInAtCloud: "Regular Participant",
                        gender: "male" as const,
                        notes:
                          "Excited to present communication best practices",
                      },
                    ]
                  : index === 5 // Zoom Co-host role
                  ? [
                      // Add current user to Zoom Co-host role (max 3, currently has 0) - this makes them have 3 roles total
                      {
                        userId: "550e8400-e29b-41d4-a716-446655440000",
                        username: "current_user",
                        firstName: "Current",
                        lastName: "User",
                        systemAuthorizationLevel: "Super Admin",
                        roleInAtCloud: "Regular Participant",
                        gender: "male" as const,
                        notes: "Ready to assist with Zoom management",
                      },
                    ]
                  : [],
            }));

            // Mock event data - this should come from your API
            const mockEvent: EventData = {
              id: "1",
              title: "Effective Communication Workshop Series",
              type: "Effective Communication Workshop Series",
              date: "2025-07-19",
              time: "10:00",
              endTime: "14:00",
              location: "Main Conference Room",
              organizer: "John Doe (Super Admin), Jane Smith (Leader)",
              hostedBy: "@Cloud Marketplace Ministry",
              organizerDetails: [
                {
                  userId: "550e8400-e29b-41d4-a716-446655440000", // John Doe's ID (matches current user)
                  name: "John Doe",
                  role: "Super Admin",
                  email: "john@example.com",
                  phone: "+1 (555) 123-4567",
                  avatar: null,
                  gender: "male" as const,
                },
                {
                  userId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8", // Jane Smith's ID
                  name: "Jane Smith",
                  role: "Leader - Event Director",
                  email: "jane@example.com",
                  phone: "+1 (555) 234-5678",
                  avatar: null,
                  gender: "female" as const,
                },
              ],
              purpose: "To enhance communication skills within ministry teams",
              agenda:
                "10:00 AM - Registration and Welcome\n10:30 AM - Opening Session: Communication Fundamentals\n11:30 AM - Break\n12:00 PM - Workshop: Active Listening Techniques\n1:00 PM - Lunch Break\n2:00 PM - Closing Session and Q&A",
              format: "Hybrid Participation",
              disclaimer:
                "Please bring your own materials and arrive 15 minutes early",
              createdBy: "550e8400-e29b-41d4-a716-446655440000",
              createdAt: "2025-07-01T10:00:00Z",
              zoomLink: "https://zoom.us/j/123456789",
              meetingId: "123 456 789",
              passcode: "workshop123",
              roles,
              signedUp: roles.reduce(
                (sum, role) => sum + role.currentSignups.length,
                0
              ), // Dynamic count based on actual signups
              totalSlots: COMMUNICATION_WORKSHOP_ROLES.reduce(
                (sum, role) => sum + role.maxParticipants,
                0
              ),
            };

            setEvent(mockEvent);
          } else {
            // Event not found
            setEvent(null);
          }
        }
      } catch (error) {
        console.error("Error fetching event:", error);
        toast.error("Failed to load event details");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id, navigate]);

  const handleRoleSignup = async (roleId: string, notes?: string) => {
    if (!event) return;

    try {
      console.log(`Signing up for role ${roleId} with notes:`, notes);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update local state - in real app, refetch from server
      const updatedEvent = { ...event };
      const roleIndex = updatedEvent.roles.findIndex(
        (role) => role.id === roleId
      );

      if (roleIndex !== -1) {
        updatedEvent.roles[roleIndex].currentSignups.push({
          userId: currentUserId,
          username: "current_user", // Replace with auth context
          firstName: "Current",
          lastName: "User",
          systemAuthorizationLevel: "Super Admin", // Replace with auth context
          roleInAtCloud: "Regular Participant",
          gender: "male" as const, // Replace with auth context
          notes: notes,
        });

        setEvent(updatedEvent);
        toast.success(
          `Successfully signed up for ${updatedEvent.roles[roleIndex].name}!`
        );
      }
    } catch (error) {
      console.error("Error signing up for role:", error);
      toast.error("Failed to sign up. Please try again.");
    }
  };

  const handleRoleCancel = async (roleId: string) => {
    if (!event) return;

    try {
      console.log(`Canceling signup for role ${roleId}`);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update local state - in real app, refetch from server
      const updatedEvent = { ...event };
      const roleIndex = updatedEvent.roles.findIndex(
        (role) => role.id === roleId
      );

      if (roleIndex !== -1) {
        // Remove the current user from the role's signups
        updatedEvent.roles[roleIndex].currentSignups = updatedEvent.roles[
          roleIndex
        ].currentSignups.filter((signup) => signup.userId !== currentUserId);

        setEvent(updatedEvent);
        toast.success(
          `Successfully canceled signup for ${updatedEvent.roles[roleIndex].name}!`
        );
      }
    } catch (error) {
      console.error("Error canceling role signup:", error);
      toast.error("Failed to cancel signup. Please try again.");
    }
  };

  // Management function to cancel any user's signup
  const handleManagementCancel = async (roleId: string, userId: string) => {
    if (!event) return;

    try {
      console.log(`Admin canceling user ${userId} from role ${roleId}`);

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
        toast.success(
          `Successfully removed ${user?.firstName} ${user?.lastName} from ${updatedEvent.roles[roleIndex].name}!`
        );
      }
    } catch (error) {
      console.error("Error canceling user signup:", error);
      toast.error("Failed to cancel signup. Please try again.");
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
        toast.error(
          `${toRole.name} is already full (${toRole.maxParticipants}/${toRole.maxParticipants})`
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

      console.log(
        `Moving user ${userId} from role ${fromRoleId} to role ${toRoleId}`
      );

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
      toast.success(
        `Successfully moved ${userToMove.firstName} ${userToMove.lastName} from ${fromRole.name} to ${toRole.name}!`
      );
    } catch (error) {
      console.error("Error moving user:", error);
      toast.error("Failed to move user. Please try again.");
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
      toast.error("No signup data to export.");
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

    toast.success(
      `Signup data exported successfully! (${exportData.length} participants)`
    );
  };

  // Handle event deletion
  const handleDeleteEvent = async () => {
    if (!event) return;

    try {
      console.log(`Permanently deleting event ${event.id}`);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success(`Event "${event.title}" has been permanently deleted.`);

      // Navigate back to dashboard
      navigate("/dashboard");
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("Failed to delete event. Please try again.");
    }
  };

  // Handle event cancellation
  const handleCancelEvent = async () => {
    if (!event) return;

    try {
      console.log(`Cancelling event ${event.id}`);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Update local state to mark as cancelled
      const updatedEvent = { ...event, status: "cancelled" as const };
      setEvent(updatedEvent);

      toast.success(
        `Event "${event.title}" has been cancelled. Participants will be notified.`
      );

      // Close management mode if open
      setManagementMode(false);
    } catch (error) {
      console.error("Error cancelling event:", error);
      toast.error("Failed to cancel event. Please try again.");
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
          {event.organizerDetails && event.organizerDetails.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Organizer Contact Information
              </h3>
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
