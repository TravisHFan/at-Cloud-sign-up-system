import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import EventDetail from "../../pages/EventDetail";

vi.mock("../../services/api", () => ({
  eventService: {
    getEvent: vi.fn(async () => ({
      id: "e1",
      title: "Multi-Program Event",
      type: "Conference",
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
      // programLabels replace programId/mentorCircle
      programLabels: ["prog1", "prog2"],
    })),
  },
  programService: {
    getById: vi.fn(async (id: string) => {
      if (id === "prog1") return { id: "prog1", title: "EMBA 2025" };
      if (id === "prog2") return { id: "prog2", title: "ECW Spring" };
      return null;
    }),
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

describe("EventDetail - Associated Programs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders associated programs section with program badges", async () => {
    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/events/e1"]}>
          <Routes>
            <Route path="/events/:id" element={<EventDetail />} />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    // Wait for programs to load and be displayed
    await waitFor(() =>
      expect(screen.getByText(/Associated Programs/i)).toBeInTheDocument()
    );

    // Check that program names are displayed
    await waitFor(() => {
      expect(screen.getByText("EMBA 2025")).toBeInTheDocument();
      expect(screen.getByText("ECW Spring")).toBeInTheDocument();
    });
  });
});
