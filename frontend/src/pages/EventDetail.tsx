import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { EventData, EventRole } from "../types/event";
import EventRoleSignup from "../components/events/EventRoleSignup";
import { COMMUNICATION_WORKSHOP_ROLES } from "../config/eventRoles";
import { Icon } from "../components/common";
import { getAvatarUrl, getAvatarAlt } from "../utils/avatarUtils";
import toast from "react-hot-toast";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId] = useState<number>(1); // Replace with auth context later
  const [currentUserRole] = useState<
    "Super Admin" | "Administrator" | "Leader" | "Participant"
  >("Participant"); // Replace with auth context later

  // Check if current user created this event or has permission to delete
  const canDeleteEvent =
    event &&
    (currentUserRole === "Super Admin" ||
      currentUserRole === "Administrator" ||
      (currentUserRole === "Leader" && event.createdBy === currentUserId));

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

          {/* Delete Button - Only show for authorized users */}
          {canDeleteEvent && (
            <button
              onClick={() => {
                /* We'll implement delete functionality in Step 7 */
              }}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Delete Event
            </button>
          )}
        </div>

        {/* Event Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="flex items-center text-gray-600">
            <Icon name="calendar" className="w-5 h-5 mr-3" />
            {event.date} at {event.time}
          </div>
          <div className="flex items-center text-gray-600">
            <Icon name="map-pin" className="w-5 h-5 mr-3" />
            {event.location}
          </div>
          <div className="flex items-center text-gray-600">
            <Icon name="user" className="w-5 h-5 mr-3" />
            {event.organizer}
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
                        <Icon name="mail" className="w-3.5 h-3.5 mr-2" />
                        <a
                          href={`mailto:${organizer.email}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {organizer.email}
                        </a>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Icon name="phone" className="w-3.5 h-3.5 mr-2" />
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

      {/* User's Current Signup Status */}
      {isUserSignedUp && (
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

      {/* Maximum roles reached warning */}
      {hasReachedMaxRoles && (
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

      {/* Roles Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          Event Roles & Sign-up
        </h2>
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
      </div>
    </div>
  );
}
