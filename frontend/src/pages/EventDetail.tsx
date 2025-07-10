import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { EventData, EventRole } from "../types/event";
import EventRoleSignup from "../components/events/EventRoleSignup";
import { COMMUNICATION_WORKSHOP_ROLES } from "../config/eventRoles";
import { Icon, EventDeletionModal } from "../components/common";
import { getAvatarUrl, getAvatarAlt } from "../utils/avatarUtils";
import toast from "react-hot-toast";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [managementMode, setManagementMode] = useState(false);
  const [draggedUserId, setDraggedUserId] = useState<number | null>(null);
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const [currentUserId] = useState<number>(1); // Replace with auth context later
  const [currentUserRole] = useState<
    "Super Admin" | "Administrator" | "Leader" | "Participant"
  >("Super Admin"); // Replace with auth context later

  // Check if current user created this event or has permission to delete
  const canDeleteEvent =
    event &&
    (currentUserRole === "Super Admin" ||
      currentUserRole === "Administrator" ||
      (currentUserRole === "Leader" && event.createdBy === currentUserId));

  // Check if current user can manage signups (Super Admin or Organizer)
  const canManageSignups =
    event &&
    (currentUserRole === "Super Admin" ||
      event.organizerDetails?.some(
        (organizer) => organizer.name.toLowerCase().includes("current user") // Replace with proper auth check
      ));

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

        const roles = COMMUNICATION_WORKSHOP_ROLES.map((role, index) => ({
          id: (index + 1).toString(),
          name: role.name,
          description: role.description,
          maxParticipants: role.maxParticipants,
          currentSignups:
            index === 0
              ? [
                  {
                    userId: 2,
                    username: "jane_smith",
                    firstName: "Jane",
                    lastName: "Smith",
                    roleInAtCloud: "Event Director",
                    gender: "female" as const,
                    notes: "Excited to lead the spiritual covering!",
                  },
                ]
              : index === 1
              ? [
                  {
                    userId: 5,
                    username: "mike_johnson",
                    firstName: "Mike",
                    lastName: "Johnson",
                    roleInAtCloud: "Participant",
                    gender: "male" as const,
                    notes: "Ready to handle all technical needs",
                  },
                ]
              : index === 2
              ? [
                  {
                    userId: 6,
                    username: "alex_tech",
                    firstName: "Alex",
                    lastName: "Martinez",
                    roleInAtCloud: "Participant",
                    gender: "male" as const,
                    notes: "Experienced with AV equipment and streaming",
                  },
                  {
                    userId: 7,
                    username: "sarah_tech",
                    firstName: "Sarah",
                    lastName: "Wilson",
                    roleInAtCloud: "Participant",
                    gender: "female" as const,
                    notes: "Specializing in sound engineering and recording",
                  },
                  // Add current user to this role (Tech Assistant has max 3, currently has 2)
                  {
                    userId: 1,
                    username: "current_user",
                    firstName: "Current",
                    lastName: "User",
                    roleInAtCloud: "Regular Participant",
                    gender: "male" as const,
                    notes: "Happy to assist with technical support",
                  },
                ]
              : index === 3 // Main Presenter role
              ? [
                  // Add current user to Main Presenter role (max 1, currently has 0)
                  {
                    userId: 1,
                    username: "current_user",
                    firstName: "Current",
                    lastName: "User",
                    roleInAtCloud: "Regular Participant",
                    gender: "male" as const,
                    notes: "Excited to present communication best practices",
                  },
                ]
              : index === 5 // Zoom Co-host role
              ? [
                  // Add current user to Zoom Co-host role (max 3, currently has 0) - this makes them have 3 roles total
                  {
                    userId: 1,
                    username: "current_user",
                    firstName: "Current",
                    lastName: "User",
                    roleInAtCloud: "Regular Participant",
                    gender: "male" as const,
                    notes: "Ready to assist with Zoom management",
                  },
                ]
              : [],
        }));

        // Mock event data - this should come from your API
        const mockEvent: EventData = {
          id: 1,
          title: "Effective Communication Workshop Series",
          type: "Effective Communication Workshop Series",
          date: "2025-07-19",
          time: "10:00 AM - 2:00 PM",
          location: "Main Conference Room",
          organizer: "John Doe (Administrator), Jane Smith (Event Director)",
          hostedBy: "@Cloud Marketplace Ministry",
          organizerDetails: [
            {
              name: "John Doe",
              role: "Administrator",
              email: "john.doe@atcloud.org",
              phone: "+1 (555) 123-4567",
              avatar: null,
              gender: "male" as const,
            },
            {
              name: "Jane Smith",
              role: "Event Director",
              email: "jane.smith@atcloud.org",
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
          createdBy: 1,
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
  const handleManagementCancel = async (roleId: string, userId: number) => {
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
    userId: number,
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
          "Role in @Cloud": signup.roleInAtCloud || "",
          Gender: signup.gender || "",
          "Event Role": role.name,
          "Role Description": role.description,
          Notes: signup.notes || "",
          "User ID": signup.userId,
        });
      });
    });

    // Convert to CSV format (simpler implementation)
    const headers = Object.keys(exportData[0] || {});
    const csvContent = [
      headers.join(","),
      ...exportData.map((row) =>
        headers.map((header) => `"${row[header]}"`).join(",")
      ),
    ].join("\n");

    // Download CSV file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${event.title.replace(/\s+/g, "_")}_signups.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Signup data exported successfully!");
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

      toast.success(`Event "${event.title}" has been cancelled. Participants will be notified.`);
      
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
            <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
          </div>

          {/* Management and Delete Buttons - Only show for authorized users */}
          <div className="flex items-center space-x-3">
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
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                  >
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
          </div>
        </div>

        {/* Event Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="flex items-center text-gray-600">
            <Icon name="calendar" className="w-5 h-5 mr-3" />
            {event.date} at {event.time}
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
                {event.organizerDetails.map((organizer, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="flex items-start space-x-3 mb-3">
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
                        <div className="font-medium text-gray-900 mb-1">
                          {organizer.name}
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {organizer.role}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center text-sm text-gray-600">
                        <Icon name="mail" className="w-3 h-3 mr-2" />
                        <a
                          href={`mailto:${organizer.email}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {organizer.email}
                        </a>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Icon name="phone" className="w-3 h-3 mr-2" />
                        <a
                          href={`tel:${organizer.phone}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {organizer.phone}
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
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

      {/* User's Current Signup Status - Only show in normal mode */}
      {isUserSignedUp && !managementMode && (
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

      {/* Maximum roles reached warning - Only show in normal mode */}
      {hasReachedMaxRoles && !managementMode && (
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
                All participants have been notified of the cancellation. The event will be moved to past events after its scheduled time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Roles Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          {managementMode ? "Manage Event Sign-ups" : "Event Roles & Sign-up"}
        </h2>

        {event.status === "cancelled" && !managementMode ? (
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
                            <div className="text-sm text-gray-600">
                              @{signup.username} • {signup.roleInAtCloud}
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
    </div>
  );
}
