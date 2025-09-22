import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import NewEvent from "../../pages/CreateEvent";

// Hoisted mocks for API services used by CreateEvent
const mockedEventService = vi.hoisted(() => ({
  getEventTemplates: vi.fn().mockResolvedValue({
    allowedTypes: ["Mentor Circle", "Conference"],
    templates: {
      "Mentor Circle": [
        { name: "Mentor", description: "", maxParticipants: 5 },
        { name: "Mentees", description: "", maxParticipants: 50 },
      ],
      Conference: [{ name: "Attendee", description: "", maxParticipants: 100 }],
    },
  }),
  createEvent: vi.fn().mockResolvedValue({ id: "evt1" }),
}));

const mockedProgramService = vi.hoisted(() => ({
  list: vi
    .fn()
    .mockResolvedValue([
      { id: "p1", title: "EMBA 2025", programType: "EMBA Mentor Circles" },
    ]),
  getById: vi.fn().mockResolvedValue({
    id: "p1",
    title: "EMBA 2025",
    mentorsByCircle: {
      E: [
        {
          userId: "u1",
          firstName: "Alice",
          lastName: "Mentor",
          email: "alice@example.com",
          roleInAtCloud: "Leader",
          gender: "female",
        },
      ],
    },
  }),
}));

const mockedSearchService = vi.hoisted(() => ({
  searchUsers: vi.fn().mockImplementation(async (_q: string) => ({
    results: [
      {
        id: "u2",
        firstName: "Bob",
        lastName: "Leader",
        email: "bob@example.com",
        role: "Leader",
        gender: "male",
      },
    ],
  })),
}));

vi.mock("../../services/api", () => ({
  eventService: mockedEventService,
  programService: mockedProgramService,
  searchService: mockedSearchService,
  authService: {
    getProfile: vi.fn().mockResolvedValue({
      id: "u0",
      username: "creator",
      firstName: "Creator",
      lastName: "User",
      email: "creator@example.com",
      phone: "1234567890",
      role: "Leader",
      isAtCloudLeader: true,
      roleInAtCloud: "Leader",
      gender: "male",
    }),
  },
  fileService: {
    uploadImage: vi.fn(),
  },
  // Silence useUsersApi background fetches
  userService: {
    getUsers: vi.fn().mockResolvedValue({
      users: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalUsers: 0,
        hasNext: false,
        hasPrev: false,
      },
    }),
  },
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe("CreateEvent MentorsPicker UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("authToken", "test-token");
  });

  it("hides mentors until circle selected, then shows inherited mentors", async () => {
    render(
      <Wrapper>
        <NewEvent />
      </Wrapper>
    );

    // Wait for templates and programs to load
    await screen.findByLabelText(/program/i);

    // Select Program first so Mentor Circle type is available
    fireEvent.change(screen.getByLabelText(/program/i), {
      target: { value: "p1" },
    });

    // Choose Mentor Circle type
    const typeSelect = await screen.findByLabelText(/event type/i);
    fireEvent.change(typeSelect, { target: { value: "Mentor Circle" } });

    // Circle select appears, mentors should still be hidden
    await screen.findByLabelText(/circle \(for mentor circles\)/i);
    expect(screen.queryByText(/mentors/i)).toBeNull();

    // Choose circle E -> mentors should appear with inherited Alice Mentor
    fireEvent.change(screen.getByLabelText(/circle \(for mentor circles\)/i), {
      target: { value: "E" },
    });

    // Mentors label and inherited mentor row
    await screen.findByText(/mentors/i);
    await screen.findByText(/Alice Mentor/);
    // Inherited badge should be present
    expect(screen.getByText(/inherited/i)).toBeInTheDocument();
  });

  it("allows adding event-only mentors and submits mentorIds only for additions", async () => {
    render(
      <Wrapper>
        <NewEvent />
      </Wrapper>
    );

    // Fill minimal required fields
    await screen.findByLabelText(/program/i);
    fireEvent.change(screen.getByLabelText(/program/i), {
      target: { value: "p1" },
    });

    const typeSelect = await screen.findByLabelText(/event type/i);
    fireEvent.change(typeSelect, { target: { value: "Mentor Circle" } });
    fireEvent.change(screen.getByLabelText(/circle \(for mentor circles\)/i), {
      target: { value: "E" },
    });

    // Required fields for submit
    fireEvent.change(screen.getByLabelText(/event title/i), {
      target: { value: "Mentor Circle Kickoff" },
    });
    fireEvent.change(screen.getByLabelText(/time zone/i), {
      target: { value: "America/Los_Angeles" },
    });

    const today = new Date();
    today.setDate(today.getDate() + 1);
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: dateStr },
    });
    fireEvent.change(screen.getByLabelText(/start time/i), {
      target: { value: "10:00" },
    });
    fireEvent.change(screen.getByLabelText(/end date/i), {
      target: { value: dateStr },
    });
    fireEvent.change(screen.getByLabelText(/end time/i), {
      target: { value: "11:00" },
    });
    fireEvent.change(screen.getByLabelText(/^format/i), {
      target: { value: "Online" },
    });
    fireEvent.change(screen.getByLabelText(/event agenda and schedule/i), {
      target: { value: "10:00 Intro, 10:15 Mentoring, 11:00 Close" },
    });

    // Open mentor search and add Bob Leader (event-only)
    fireEvent.click(screen.getByRole("button", { name: /add mentors/i }));
    const input = await screen.findByPlaceholderText(/search mentors/i);
    fireEvent.change(input, { target: { value: "bob" } });

    // Wait for results and pick Bob
    await waitFor(() =>
      expect(mockedSearchService.searchUsers).toHaveBeenCalled()
    );
    const result = await screen.findByText(/Bob Leader/);
    fireEvent.click(result);

    // Choose notification option (required before submit)
    fireEvent.click(
      screen.getByRole("radio", { name: /don’t send notifications now/i })
    );

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /create event/i }));

    await waitFor(() => {
      expect(mockedEventService.createEvent).toHaveBeenCalled();
      const payload = mockedEventService.createEvent.mock.calls[0][0];
      // Only custom mentor IDs should be sent; inherited mentors are merged server-side
      expect(payload).toEqual(
        expect.objectContaining({
          programId: "p1",
          mentorCircle: "E",
          mentorIds: ["u2"],
        })
      );
    });
  });
});
