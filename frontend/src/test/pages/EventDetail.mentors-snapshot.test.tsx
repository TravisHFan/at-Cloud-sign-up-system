import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import EventDetail from "../../pages/EventDetail";

vi.mock("../../services/api", () => ({
  eventService: {
    getEvent: vi.fn(async () => ({
      id: "e1",
      title: "Mentor Circle Session",
      type: "Mentor Circle",
      date: "2025-12-01",
      time: "10:00",
      endTime: "11:00",
      timeZone: "America/New_York",
      roles: [],
      totalSignups: 0,
      totalSlots: 20,
      createdBy: { id: "u1" },
      createdAt: new Date().toISOString(),
      description: "desc",
      status: "upcoming",
      attendees: [],
      // new mentors snapshot fields
      mentorCircle: "E",
      mentors: [
        {
          userId: "m1",
          name: "Alice Alpha",
          email: "a@x.com",
          gender: "female",
        },
        { userId: "m2", name: "Bob Beta", email: "b@x.com", gender: "male" },
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

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: {
      id: "u1",
      role: "Administrator",
      roleInAtCloud: "Administrator",
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
    },
  }),
}));

describe("EventDetail - Mentors snapshot rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders mentors section with circle label and mentor names", async () => {
    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/events/e1"]}>
          <Routes>
            <Route path="/events/:id" element={<EventDetail />} />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    await waitFor(() =>
      expect(screen.getByText(/Mentors/i)).toBeInTheDocument()
    );
    // UI renders "Mentors (Circle E)", so assert on that text format
    expect(screen.getByText(/\(Circle E\)/)).toBeInTheDocument();
    expect(screen.getByText("Alice Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bob Beta")).toBeInTheDocument();
  });
});
