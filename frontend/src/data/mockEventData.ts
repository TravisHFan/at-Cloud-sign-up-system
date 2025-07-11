import type { EventData } from "../types/event";
import { COMMUNICATION_WORKSHOP_ROLES } from "../config/eventRoles";
import { categorizeEvents } from "../utils/eventFilters";

const mockUpcomingEvents: EventData[] = [
  {
    id: "1",
    title: "Effective Communication Workshop Series",
    type: "Effective Communication Workshop Series",
    date: "2025-07-19",
    time: "14:00",
    endTime: "17:30",
    location: "Main Sanctuary",
    organizer: "John Doe",
    hostedBy: "@Cloud Marketplace Ministry",
    organizerDetails: [
      {
        userId: "550e8400-e29b-41d4-a716-446655440000", // John Doe's ID (matches current user)
        name: "John Doe",
        role: "Super Admin",
        email: "john@example.com",
        phone: "(555) 123-4567",
        avatar: null,
        gender: "male" as const,
      },
    ],
    purpose:
      "Develop communication skills and enhance ministry effectiveness through interactive workshops and practical exercises.",
    agenda:
      "2:00 PM - Welcome and Registration\n2:30 PM - Opening Session: Introduction to Effective Communication\n3:30 PM - Workshop Break\n4:00 PM - Interactive Exercise: Active Listening\n5:00 PM - Group Discussion and Q&A\n5:30 PM - Closing Remarks",
    format: "Hybrid Participation",
    disclaimer:
      "Bring your own materials. Please arrive 15 minutes early for setup.",
    roles: COMMUNICATION_WORKSHOP_ROLES.map((role, index) => ({
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
                userId: "6ba7b813-9dad-11d1-80b4-00c04fd430c8",
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
                userId: "6ba7b814-9dad-11d1-80b4-00c04fd430c8",
                username: "alex_tech",
                firstName: "Alex",
                lastName: "Martinez",
                systemAuthorizationLevel: "Participant",
                roleInAtCloud: "AV Equipment Specialist",
                gender: "male" as const,
                notes: "Experienced with AV equipment and streaming",
              },
              {
                userId: "6ba7b815-9dad-11d1-80b4-00c04fd430c8",
                username: "sarah_tech",
                firstName: "Sarah",
                lastName: "Wilson",
                systemAuthorizationLevel: "Participant",
                roleInAtCloud: "Sound Engineer",
                gender: "female" as const,
                notes: "Specializing in sound engineering and recording",
              },
              {
                userId: "550e8400-e29b-41d4-a716-446655440000",
                username: "current_user",
                firstName: "Current",
                lastName: "User",
                systemAuthorizationLevel: "Super Admin",
                roleInAtCloud: "System Administrator",
                gender: "male" as const,
                notes: "Happy to assist with technical support",
              },
            ]
          : index === 3
          ? [
              {
                userId: "550e8400-e29b-41d4-a716-446655440000",
                username: "current_user",
                firstName: "Current",
                lastName: "User",
                systemAuthorizationLevel: "Super Admin",
                roleInAtCloud: "System Administrator",
                gender: "male" as const,
                notes: "Excited to present communication best practices",
              },
            ]
          : index === 5
          ? [
              {
                userId: "550e8400-e29b-41d4-a716-446655440000",
                username: "current_user",
                firstName: "Current",
                lastName: "User",
                systemAuthorizationLevel: "Super Admin",
                roleInAtCloud: "System Administrator",
                gender: "male" as const,
                notes: "Ready to assist with Zoom management",
              },
            ]
          : [],
    })),
    signedUp: 7,
    totalSlots: COMMUNICATION_WORKSHOP_ROLES.reduce(
      (sum, role) => sum + role.maxParticipants,
      0
    ),
    createdBy: "550e8400-e29b-41d4-a716-446655440000", // John Doe
    createdAt: "2025-07-01T10:00:00Z",
    zoomLink: "https://zoom.us/j/123456789",
    meetingId: "123 456 789",
    passcode: "workshop123",
  },
];

const mockPassedEvents: EventData[] = [
  {
    id: "101",
    title: "Effective Communication Workshop Series",
    type: "Effective Communication Workshop Series",
    date: "2025-06-15",
    time: "14:00",
    endTime: "17:30",
    location: "Main Sanctuary",
    organizer: "Sarah Davis, Robert Thompson",
    hostedBy: "@Cloud Marketplace Ministry",
    organizerDetails: [
      {
        userId: "6ba7b812-9dad-11d1-80b4-00c04fd430c8", // Sarah Davis's ID
        name: "Sarah Davis",
        role: "Leader - IT Director",
        email: "sarah@example.com",
        phone: "(555) 234-5678",
        avatar: null,
        gender: "female" as const,
      },
      {
        userId: "6ba7b816-9dad-11d1-80b4-00c04fd430c8", // Robert Thompson's ID
        name: "Robert Thompson",
        role: "Administrator - Operations Manager",
        email: "robert.thompson@example.com",
        phone: "(555) 345-6789",
        avatar: null,
        gender: "male" as const,
      },
    ],
    purpose:
      "Develop communication skills and enhance ministry effectiveness through interactive workshops and practical exercises.",
    agenda:
      "2:00 PM - Welcome and Registration\n2:30 PM - Opening Session: Introduction to Effective Communication\n3:30 PM - Workshop Break\n4:00 PM - Interactive Exercise: Active Listening\n5:00 PM - Group Discussion and Q&A\n5:30 PM - Closing Remarks",
    format: "Hybrid Participation",
    disclaimer:
      "Bring your own materials. Please arrive 15 minutes early for setup.",
    roles: COMMUNICATION_WORKSHOP_ROLES.map((role, index) => ({
      id: (index + 1).toString(),
      name: role.name,
      description: role.description,
      maxParticipants: role.maxParticipants,
      currentSignups:
        index === 0 // Spiritual Covering - 1 person signed up
          ? [
              {
                userId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
                username: "jane_smith",
                firstName: "Jane",
                lastName: "Smith",
                systemAuthorizationLevel: "Leader",
                roleInAtCloud: "Event Director",
                gender: "female" as const,
                notes:
                  "Provided excellent spiritual guidance throughout the event",
              },
            ]
          : index === 1 // Event Coordinator - 2 people signed up
          ? [
              {
                userId: "6ba7b816-9dad-11d1-80b4-00c04fd430c8",
                username: "robert_admin",
                firstName: "Robert",
                lastName: "Thompson",
                systemAuthorizationLevel: "Administrator",
                roleInAtCloud: "Operations Manager",
                gender: "male" as const,
                notes: "Coordinated all logistics seamlessly",
              },
              {
                userId: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
                username: "sarah_davis",
                firstName: "Sarah",
                lastName: "Davis",
                systemAuthorizationLevel: "Leader",
                roleInAtCloud: "IT Director",
                gender: "female" as const,
                notes: "Managed technical coordination perfectly",
              },
            ]
          : index === 2 // Tech Assistant - 3 people signed up (max capacity)
          ? [
              {
                userId: "6ba7b814-9dad-11d1-80b4-00c04fd430c8",
                username: "alex_tech",
                firstName: "Alex",
                lastName: "Martinez",
                systemAuthorizationLevel: "Participant",
                roleInAtCloud: "AV Equipment Specialist",
                gender: "male" as const,
                notes: "Handled AV equipment and streaming expertly",
              },
              {
                userId: "6ba7b815-9dad-11d1-80b4-00c04fd430c8",
                username: "sarah_tech",
                firstName: "Sarah",
                lastName: "Wilson",
                systemAuthorizationLevel: "Participant",
                roleInAtCloud: "Sound Engineer",
                gender: "female" as const,
                notes: "Managed sound engineering and recording",
              },
              {
                userId: "6ba7b813-9dad-11d1-80b4-00c04fd430c8",
                username: "mike_johnson",
                firstName: "Mike",
                lastName: "Johnson",
                systemAuthorizationLevel: "Participant",
                roleInAtCloud: "Multimedia Technician",
                gender: "male" as const,
                notes: "Provided excellent technical support",
              },
            ]
          : index === 3 // Main Presenter - 1 person signed up
          ? [
              {
                userId: "550e8400-e29b-41d4-a716-446655440000",
                username: "john_doe",
                firstName: "John",
                lastName: "Doe",
                systemAuthorizationLevel: "Super Admin",
                roleInAtCloud: "System Administrator",
                gender: "male" as const,
                notes:
                  "Delivered outstanding presentation on communication best practices",
              },
            ]
          : index === 4 // Workshop Facilitator - 2 people signed up
          ? [
              {
                userId: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
                username: "alice_brown",
                firstName: "Alice",
                lastName: "Brown",
                systemAuthorizationLevel: "Participant",
                roleInAtCloud: "Workshop Coordinator",
                gender: "female" as const,
                notes: "Facilitated interactive workshops effectively",
              },
              {
                userId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
                username: "jane_smith",
                firstName: "Jane",
                lastName: "Smith",
                systemAuthorizationLevel: "Leader",
                roleInAtCloud: "Event Director",
                gender: "female" as const,
                notes: "Co-facilitated with great enthusiasm",
              },
            ]
          : index === 5 // Zoom Co-host - 2 people signed up
          ? [
              {
                userId: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
                username: "sarah_davis",
                firstName: "Sarah",
                lastName: "Davis",
                systemAuthorizationLevel: "Leader",
                roleInAtCloud: "IT Director",
                gender: "female" as const,
                notes: "Managed online participants smoothly",
              },
              {
                userId: "6ba7b816-9dad-11d1-80b4-00c04fd430c8",
                username: "robert_admin",
                firstName: "Robert",
                lastName: "Thompson",
                systemAuthorizationLevel: "Administrator",
                roleInAtCloud: "Operations Manager",
                gender: "male" as const,
                notes: "Assisted with Zoom management and breakout rooms",
              },
            ]
          : [], // Other roles remain empty
    })),
    signedUp: 8, // Unique users: Jane Smith, Robert Thompson, Sarah Davis, Alex Martinez, Sarah Wilson, Mike Johnson, John Doe, Alice Brown
    totalSlots: COMMUNICATION_WORKSHOP_ROLES.reduce(
      (sum, role) => sum + role.maxParticipants,
      0
    ),
    attendees: 10, // 10 out of 12 actually attended
    status: "completed",
    createdBy: "6ba7b812-9dad-11d1-80b4-00c04fd430c8", // Created by Sarah Davis
    createdAt: "2025-05-15T10:00:00Z",
    zoomLink: "https://zoom.us/j/123456789",
    meetingId: "123 456 789",
    passcode: "workshop123",
  },
];

// Combined all events data
const allMockEvents: EventData[] = [
  // Currently upcoming events (based on manual categorization)
  ...mockUpcomingEvents,
  // Currently passed events (based on manual categorization)
  ...mockPassedEvents,
];

// Dynamic categorization based on actual end times
const { upcomingEvents, passedEvents } = categorizeEvents(allMockEvents);

// Export dynamically categorized events for use throughout the app
export { upcomingEvents as mockUpcomingEventsDynamic };
export { passedEvents as mockPassedEventsDynamic };

// Keep original exports for backward compatibility
export { mockUpcomingEvents, mockPassedEvents };
