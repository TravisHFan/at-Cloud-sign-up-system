import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UpcomingEvents from "../../pages/UpcomingEvents";
import PassedEvents from "../../pages/PassedEvents";
import MyEvents from "../../pages/MyEvents";
import { NotificationProvider } from "../../contexts/NotificationModalContext";

// Common auth mock
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: { id: "u1", role: "Participant" },
    isAuthenticated: true,
    isLoading: false,
    canCreateEvents: false,
    canManageUsers: false,
    hasRole: () => false,
  }),
}));

vi.mock("../../services/socketService", () => ({
  socketService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    joinEventRoom: vi.fn(),
    leaveEventRoom: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// Dynamic mocks we can tweak per test scenario
const upcomingEvents = [
  {
    id: "evt-1",
    title: "Zeta Gathering",
    date: "2025-09-20",
    time: "10:00",
    endTime: "11:00",
    location: "Room A",
    organizer: "Org A",
    roles: [],
    signedUp: 0,
    totalSlots: 10,
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    format: "In-person",
    status: "active",
  },
  {
    id: "evt-2",
    title: "Alpha Workshop",
    date: "2025-09-10",
    time: "09:00",
    endTime: "10:00",
    location: "Room B",
    organizer: "Org B",
    roles: [],
    signedUp: 0,
    totalSlots: 10,
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    format: "In-person",
    status: "active",
  },
  {
    id: "evt-3",
    title: "Beta Meetup",
    date: "2025-09-15",
    time: "13:00",
    endTime: "14:00",
    location: "Room C",
    organizer: "Org C",
    roles: [],
    signedUp: 0,
    totalSlots: 10,
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    format: "In-person",
    status: "active",
  },
];

const passedEvents = [
  {
    id: "evt-p1",
    title: "Older Completed",
    date: "2025-08-01",
    time: "08:00",
    endTime: "09:00",
    location: "Hall 1",
    organizer: "Org P1",
    roles: [],
    signedUp: 2,
    totalSlots: 10,
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    format: "In-person",
    status: "completed",
  },
  {
    id: "evt-p2",
    title: "Newer Completed",
    date: "2025-08-10",
    time: "08:00",
    endTime: "09:00",
    location: "Hall 2",
    organizer: "Org P2",
    roles: [],
    signedUp: 2,
    totalSlots: 10,
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    format: "In-person",
    status: "completed",
  },
];

// My Events registrations fixture
const myEventsRegistrations = [
  // Underlying registration objects just need minimal shape
  {
    event: upcomingEvents[0],
    registration: {
      id: "r1",
      status: "active",
      registrationDate: "2025-08-01T10:00:00Z",
      roleName: "Role A",
    },
    isPassedEvent: false,
    eventStatus: "active",
  },
  {
    event: upcomingEvents[1],
    registration: {
      id: "r2",
      status: "active",
      registrationDate: "2025-08-02T10:00:00Z",
      roleName: "Role A",
    },
    isPassedEvent: false,
    eventStatus: "active",
  },
  {
    event: upcomingEvents[2],
    registration: {
      id: "r3",
      status: "active",
      registrationDate: "2025-08-03T10:00:00Z",
      roleName: "Role A",
    },
    isPassedEvent: false,
    eventStatus: "active",
  },
];

vi.mock("../../hooks/useEventsApi", () => ({
  useUserEvents: () => ({
    events: myEventsRegistrations,
    stats: { totalEvents: 3, upcomingEvents: 3, passedEvents: 0 },
    loading: false,
    error: null,
    refreshEvents: vi.fn(),
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalEvents: 3,
      hasNext: false,
      hasPrev: false,
    },
  }),
}));

vi.mock("../../services/api", () => {
  return {
    eventService: {
      getEvents: vi.fn(async (params: any) => {
        const statuses = (params.statuses || params.status || "")
          .split(",")
          .map((s: string) => s.trim());
        if (statuses.includes("upcoming") || statuses.includes("ongoing")) {
          // Return unsorted array to ensure client sorts ascending
          return {
            events: upcomingEvents,
            pagination: {
              currentPage: 1,
              totalPages: 1,
              totalEvents: upcomingEvents.length,
              hasNext: false,
              hasPrev: false,
            },
          };
        }
        if (statuses.includes("completed") || statuses.includes("cancelled")) {
          // Sort by date based on sortOrder parameter
          const sortOrder = params.sortOrder || "desc";
          const sortedEvents = [...passedEvents].sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
          });
          return {
            events: sortedEvents,
            pagination: {
              currentPage: 1,
              totalPages: 1,
              totalEvents: passedEvents.length,
              hasNext: false,
              hasPrev: false,
            },
          };
        }
        return {
          events: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalEvents: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }),
    },
  };
});

function extractCardTitles(expected: string[]) {
  // Collect only headings whose text matches one of the expected event titles
  const set = new Set(expected.map((t) => t.toLowerCase()));
  const headings = screen.queryAllByRole("heading");
  return headings
    .map((h) => h.textContent || "")
    .filter((txt) => set.has((txt || "").toLowerCase()));
}

describe("Default event sorting (chronological asc)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Upcoming Events page sorts by earliest date first", async () => {
    render(
      <MemoryRouter initialEntries={["/upcoming"]}>
        <NotificationProvider>
          <UpcomingEvents />
        </NotificationProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Upcoming Events/i }),
      ).toBeInTheDocument();
    });

    const titles = extractCardTitles([
      "Alpha Workshop",
      "Beta Meetup",
      "Zeta Gathering",
    ]);
    // Expected order by date asc: Alpha (10th), Beta (15th), Zeta (20th)
    expect(titles).toEqual([
      expect.stringMatching(/Alpha Workshop/),
      expect.stringMatching(/Beta Meetup/),
      expect.stringMatching(/Zeta Gathering/),
    ]);
  });

  it("Past Events page sorts by newest date first (reverse chronological)", async () => {
    render(
      <MemoryRouter initialEntries={["/passed"]}>
        <NotificationProvider>
          <PassedEvents />
        </NotificationProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Past Events/i }),
      ).toBeInTheDocument();
    });

    const titles = extractCardTitles(["Older Completed", "Newer Completed"]);
    // Desc: Newer Completed (10th) first, Older Completed (1st) second
    expect(titles[0]).toMatch(/Newer Completed/);
    expect(titles[1]).toMatch(/Older Completed/);
  });

  it("My Events page sorts by earliest date first", async () => {
    render(
      <MemoryRouter initialEntries={["/my-events"]}>
        <NotificationProvider>
          <MyEvents />
        </NotificationProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /My Events/i }),
      ).toBeInTheDocument();
    });

    const titles = extractCardTitles([
      "Alpha Workshop",
      "Beta Meetup",
      "Zeta Gathering",
    ]);
    // My events uses same data as upcoming for this test
    expect(titles.slice(0, 3)).toEqual([
      expect.stringMatching(/Alpha Workshop/),
      expect.stringMatching(/Beta Meetup/),
      expect.stringMatching(/Zeta Gathering/),
    ]);
  });
});
