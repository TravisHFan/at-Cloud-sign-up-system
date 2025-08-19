import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EventDetail from "../../pages/EventDetail";
import { NotificationProvider } from "../../contexts/NotificationModalContext";

vi.mock("../../services/guestApi", () => ({
  __esModule: true,
  default: {
    getEventGuests: vi.fn(async () => ({
      guests: [
        {
          id: "g1",
          roleId: "r1",
          fullName: "Alpha Guest",
          email: "a@e.com",
          phone: "+1 555",
        },
        {
          id: "g2",
          roleId: "r2",
          fullName: "Beta Guest",
          email: "b@e.com",
          phone: "+1 555",
        },
        {
          id: "g3",
          roleId: "r1",
          fullName: "Gamma Guest",
          email: "c@e.com",
          phone: "+1 555",
        },
      ],
    })),
  },
}));

vi.mock("../../services/socketService", () => ({
  socketService: {
    connect: vi.fn(),
    joinEventRoom: vi.fn(async () => {}),
    leaveEventRoom: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({
    success: () => {},
    error: () => {},
    info: () => {},
    warning: () => {},
  }),
  NotificationProvider: ({ children }: any) => children,
}));

vi.mock("../../services/api", () => ({
  __esModule: true,
  eventService: {
    // minimal event response with two roles
    getEvent: vi.fn(async (id: string) => ({
      id,
      title: "Test Event",
      type: "Meeting",
      date: "2025-12-01",
      time: "10:00",
      endTime: "12:00",
      timeZone: "America/New_York",
      roles: [
        { id: "r1", name: "Role A", maxParticipants: 2, currentSignups: [] },
        { id: "r2", name: "Role B", maxParticipants: 3, currentSignups: [] },
      ],
      totalSignups: 0,
      totalSlots: 5,
      createdBy: { id: "u1" },
      createdAt: new Date().toISOString(),
      description: "desc",
      isHybrid: false,
      status: "upcoming",
      attendees: [],
    })),
    signUpForEvent: vi.fn(),
    updateWorkshopGroupTopic: vi.fn(),
    cancelSignup: vi.fn(),
    removeUserFromRole: vi.fn(),
    moveUserBetweenRoles: vi.fn(),
    deleteEvent: vi.fn(),
    updateEvent: vi.fn(),
    assignUserToRole: vi.fn(),
  },
}));

// Simulate current user role as admin through a simple context shim if required
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: {
      id: "admin",
      role: "Administrator",
      roleInAtCloud: "Administrator",
    },
  }),
}));

describe("EventDetail admin guest view", () => {
  it("groups and displays guests by role for admins", async () => {
    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/events/e1"]}>
          <Routes>
            <Route path="/events/:id" element={<EventDetail />} />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    // Wait for guests to load and render
    await waitFor(() => {
      expect(screen.getAllByText(/Guests:/i).length).toBeGreaterThan(0);
    });

    // Role A has 2 guests
    expect(screen.getAllByText(/Alpha Guest|Gamma Guest/).length).toBe(2);
    // Role B has 1 guest
    expect(screen.getByText(/Beta Guest/)).toBeInTheDocument();
  });
});
