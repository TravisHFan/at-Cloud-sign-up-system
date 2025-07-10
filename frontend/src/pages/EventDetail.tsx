import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { EventData, EventRole } from "../types/event";
import EventRoleSignup from "../components/events/EventRoleSignup";
import { COMMUNICATION_WORKSHOP_ROLES } from "../config/eventRoles";
import Icon from "../components/Icon";
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

  // Check if user is already signed up for any role
  const getUserSignupRole = (): EventRole | null => {
    if (!event) return null;

    return (
      event.roles.find((role) =>
        role.currentSignups.some((signup) => signup.userId === currentUserId)
      ) || null
    );
  };

  const userSignedUpRole = getUserSignupRole();
  const isUserSignedUp = !!userSignedUpRole;

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

        // Mock event data - this should come from your API
        const mockEvent: EventData = {
          id: 1,
          title: "Effective Communication Workshop Series",
          type: "Effective Communication Workshop Series",
          date: "2025-07-19",
          time: "10:00 AM - 2:00 PM",
          location: "Main Conference Room",
          organizer: "Dr. Sarah Johnson",
          purpose: "To enhance communication skills within ministry teams",
          format: "Hybrid Participation",
          disclaimer:
            "Please bring your own materials and arrive 15 minutes early",
          createdBy: 1,
          createdAt: "2025-07-01T10:00:00Z",
          zoomLink: "https://zoom.us/j/123456789",
          meetingId: "123 456 789",
          passcode: "workshop123",
          roles: COMMUNICATION_WORKSHOP_ROLES.map((role, index) => ({
            id: (index + 1).toString(),
            name: role.name,
            description: role.description,
            maxParticipants: role.maxParticipants,
            currentSignups:
              index === 0
                ? [
                    {
                      userId: 2,
                      username: "jane_doe",
                      firstName: "Jane",
                      lastName: "Doe",
                      roleInAtCloud: "Leader",
                      gender: "female" as const,
                      notes: "Excited to lead the spiritual covering!",
                    },
                  ]
                : index === 1
                ? [
                    {
                      userId: 3,
                      username: "john_tech",
                      firstName: "John",
                      lastName: "Tech",
                      roleInAtCloud: "Technical Support",
                      gender: "male" as const,
                      notes: "Ready to handle all technical needs",
                    },
                  ]
                : [],
          })),
          signedUp: 2,
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
    <div className="space-y-6">
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
              Purpose
            </h3>
            <p className="text-gray-700">{event.purpose}</p>
          </div>

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
          <div className="flex items-center">
            <Icon name="check-circle" className="w-5 h-5 text-green-600 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-green-800">
                You're signed up for: {userSignedUpRole?.name}
              </h3>
              <p className="text-sm text-green-600">
                {userSignedUpRole?.description}
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
          {event.roles.map((role) => (
            <EventRoleSignup
              key={role.id}
              role={role}
              onSignup={handleRoleSignup}
              currentUserId={currentUserId}
              isUserSignedUp={isUserSignedUp}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
