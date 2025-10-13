import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import NewEvent from "../../pages/CreateEvent";

// Use vi.hoisted to avoid "Cannot access before initialization" with vi.mock hoisting
const mockedEventService = vi.hoisted(() => ({
  createEvent: vi.fn().mockResolvedValue({ success: true }),
}));

const mockedRolesTemplateService = vi.hoisted(() => ({
  getAllTemplates: vi.fn().mockResolvedValue({
    "Effective Communication Workshop": [
      {
        _id: "tpl1",
        name: "ECW Template",
        roles: [
          {
            name: "Participant",
            description: "General participant",
            maxParticipants: 10,
          },
        ],
      },
    ],
  }),
}));

vi.mock("../../services/api", () => ({
  eventService: mockedEventService,
  rolesTemplateService: mockedRolesTemplateService,
  // Provide minimal mocks to satisfy CreateEvent dependencies during render
  programService: {
    list: vi.fn().mockResolvedValue([
      {
        id: "p1",
        title: "ECW Spring",
        programType: "Effective Communication Workshops",
      },
    ]),
    getById: vi.fn().mockResolvedValue({ mentors: [] }),
  },
  userService: {
    getUsers: vi.fn().mockResolvedValue({ users: [], total: 0 }),
  },
  authService: {
    getProfile: vi.fn().mockResolvedValue({
      id: "u1",
      username: "testuser",
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      phone: "1234567890",
      role: "Leader",
      isAtCloudLeader: true,
      roleInAtCloud: "Leader",
      gender: "male",
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

describe("CreateEvent - purpose optional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits successfully without purpose and preview shows fallback", async () => {
    // Simulate authenticated state so AuthProvider populates currentUser
    localStorage.setItem("authToken", "test-token");

    render(
      <Wrapper>
        <NewEvent />
      </Wrapper>
    );

    // Wait for templates to load so selects are enabled
    const typeSelect = await screen.findByLabelText(/event type/i);
    // Select required Program first
    await waitFor(() =>
      expect(screen.getByLabelText(/program/i)).toBeInTheDocument()
    );
    const programSelect = screen.getByLabelText(/program/i);
    fireEvent.change(programSelect, { target: { value: "p1" } });

    // Fill minimal required fields
    fireEvent.change(screen.getByLabelText(/event title/i), {
      target: { value: "No Purpose Event" },
    });

    fireEvent.change(typeSelect, {
      target: { value: "Effective Communication Workshop" },
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

    // Agenda is required
    fireEvent.change(screen.getByLabelText(/event agenda and schedule/i), {
      target: { value: "Agenda: 10:00 Welcome, 10:15 Session, 11:00 Close" },
    });

    // Purpose intentionally left blank

    // Choose notification option (required before submit)
    const dontSend = screen.getByRole("radio", {
      name: /don’t send notifications now/i,
    });
    fireEvent.click(dontSend);

    // Open preview to verify fallback purpose text
    const previewBtn = screen.getByRole("button", { name: /preview/i });
    fireEvent.click(previewBtn);

    // Expect preview to render and show fallback purpose text
    await screen.findByText(/event preview/i);
    expect(screen.getByText(/no purpose provided\./i)).toBeInTheDocument();

    // Close preview to return to form for submission
    const editBtn = screen.getByRole("button", { name: /edit event/i });
    fireEvent.click(editBtn);

    // Submit
    const createBtn = screen.getByRole("button", { name: /create event/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(mockedEventService.createEvent).toHaveBeenCalled();
      const payload = mockedEventService.createEvent.mock.calls[0][0];
      expect(
        "purpose" in payload
          ? payload.purpose === undefined || payload.purpose === ""
          : true
      ).toBe(true);
    });
  });
});
