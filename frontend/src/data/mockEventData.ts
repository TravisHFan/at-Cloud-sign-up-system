import type { EventData } from "../types/event";
import { COMMUNICATION_WORKSHOP_ROLES } from "../config/eventRoles";
import { categorizeEvents } from "../utils/eventFilters";

const mockUpcomingEvents: EventData[] = [
  {
    id: 1,
    title: "Effective Communication Workshop Series",
    type: "Effective Communication Workshop Series",
    date: "2025-07-19",
    time: "14:00",
    endTime: "17:30",
    location: "Main Sanctuary",
    organizer: "Pastor John",
    hostedBy: "@Cloud Marketplace Ministry",
    organizerDetails: [
      {
        name: "Pastor John",
        role: "Lead Pastor",
        email: "pastor.john@atcloud.org",
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
                userId: 2,
                username: "spiritual_leader",
                firstName: "Mary",
                lastName: "Johnson",
                roleInAtCloud: "Leader",
                gender: "female" as const,
                notes: "Looking forward to providing spiritual guidance",
              },
            ]
          : index === 1
          ? [
              {
                userId: 3,
                username: "tech_expert",
                firstName: "David",
                lastName: "Wilson",
                roleInAtCloud: "Technical Support",
                gender: "male" as const,
                notes: "Ready to handle all technical aspects",
              },
            ]
          : [],
    })),
    signedUp: 2,
    totalSlots: COMMUNICATION_WORKSHOP_ROLES.reduce(
      (sum, role) => sum + role.maxParticipants,
      0
    ),
    createdBy: 1,
    createdAt: "2025-07-01T10:00:00Z",
    zoomLink: "https://zoom.us/j/123456789",
    meetingId: "123 456 789",
    passcode: "workshop123",
  },
  {
    id: 2,
    title: "Bible Study Series: Romans",
    type: "Bible Study",
    date: "2025-07-20",
    time: "19:00",
    endTime: "21:00",
    location: "Conference Room A",
    organizer: "Elder Sarah",
    purpose: "Deep dive into the book of Romans.",
    format: "In-person",
    disclaimer: "Bring your Bible.",
    roles: [],
    signedUp: 28,
    totalSlots: 30,
    createdBy: 2,
    createdAt: "2025-07-05T10:00:00Z",
  },
  {
    id: 3,
    title: "Youth Outreach Event (Cancelled)",
    type: "Outreach",
    date: "2025-08-15",
    time: "09:00",
    endTime: "15:00",
    location: "Community Center",
    organizer: "Youth Ministry Team",
    purpose:
      "Community outreach to local youth - cancelled due to venue issues.",
    format: "In-person",
    disclaimer: "Event has been cancelled. Refunds will be processed.",
    roles: [],
    signedUp: 15,
    totalSlots: 50,
    status: "cancelled",
    createdBy: 3,
    createdAt: "2025-07-01T10:00:00Z",
  },
];

const mockPassedEvents: EventData[] = [
  {
    id: 101,
    title: "Easter Celebration Service",
    type: "Service",
    date: "2025-03-31",
    time: "10:00",
    endTime: "12:00",
    location: "Main Sanctuary",
    organizer: "Pastor John",
    purpose: "Celebrate Easter with worship and fellowship.",
    format: "In-person",
    disclaimer: "Arrive early for seating.",
    roles: [],
    signedUp: 180,
    totalSlots: 200,
    attendees: 175,
    status: "completed",
    createdBy: 1,
    createdAt: "2025-03-01T10:00:00Z",
  },
  {
    id: 102,
    title: "Men's Breakfast Fellowship",
    type: "Fellowship",
    date: "2025-04-15",
    time: "08:00",
    endTime: "10:00",
    location: "Fellowship Hall",
    organizer: "Men's Ministry",
    purpose: "Build connections among men in the church.",
    format: "In-person",
    disclaimer: "Breakfast provided.",
    roles: [],
    signedUp: 45,
    totalSlots: 50,
    attendees: 42,
    status: "completed",
    createdBy: 2,
    createdAt: "2025-04-01T10:00:00Z",
  },
  {
    id: 103,
    title: "Children's Sunday School Training",
    type: "Training",
    date: "2025-05-20",
    time: "13:00",
    endTime: "16:00",
    location: "Children's Wing",
    organizer: "Sister Mary",
    purpose: "Equip teachers for Sunday school.",
    format: "In-person",
    disclaimer: "Materials provided.",
    roles: [],
    signedUp: 25,
    totalSlots: 30,
    attendees: 0,
    status: "cancelled",
    createdBy: 3,
    createdAt: "2025-05-01T10:00:00Z",
  },
  {
    id: 104,
    title: "Marriage Enrichment Seminar",
    type: "Seminar",
    date: "2025-06-10",
    time: "15:00",
    endTime: "17:30",
    location: "Conference Room B",
    organizer: "Counseling Team",
    purpose: "Strengthen marriages through biblical principles.",
    format: "In-person",
    disclaimer: "Couples only.",
    roles: [],
    signedUp: 20,
    totalSlots: 25,
    attendees: 18,
    status: "completed",
    createdBy: 4,
    createdAt: "2025-06-01T10:00:00Z",
  },
  {
    id: 105,
    title: "Summer Bible Camp (Cancelled)",
    type: "Camp",
    date: "2025-06-15",
    time: "08:00",
    endTime: "17:00",
    location: "Camp Grounds",
    organizer: "Children's Ministry",
    purpose: "Summer camp for children - cancelled due to safety concerns.",
    format: "In-person",
    disclaimer: "Event cancelled - full refunds issued.",
    roles: [],
    signedUp: 40,
    totalSlots: 60,
    attendees: 0,
    status: "cancelled",
    createdBy: 5,
    createdAt: "2025-05-01T10:00:00Z",
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
