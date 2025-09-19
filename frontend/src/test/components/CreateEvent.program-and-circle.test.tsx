import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import NewEvent from "../../pages/CreateEvent";

// hoisted mocks
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
  list: vi.fn().mockResolvedValue([
    { id: "p1", title: "EMBA 2025", programType: "EMBA Mentor Circles" },
    {
      id: "p2",
      title: "ECW Spring",
      programType: "Effective Communication Workshops",
    },
  ]),
}));

vi.mock("../../services/api", () => ({
  eventService: mockedEventService,
  programService: mockedProgramService,
  authService: {
    getProfile: vi.fn().mockResolvedValue({
      id: "u1",
      username: "mentor",
      firstName: "Mentor",
      lastName: "User",
      email: "mentor@example.com",
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

describe("CreateEvent - Program & Mentor Circle wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("authToken", "test-token");
  });

  it("shows Program select and Mentor Circle when type is Mentor Circle and submits with programId/mentorCircle", async () => {
    render(
      <Wrapper>
        <NewEvent />
      </Wrapper>
    );

    // Wait for templates and programs to load
    const typeSelect = await screen.findByLabelText(/event type/i);
    await waitFor(() =>
      expect(screen.getByLabelText(/program/i)).toBeInTheDocument()
    );

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/event title/i), {
      target: { value: "Mentor Circle Kickoff" },
    });
    fireEvent.change(typeSelect, { target: { value: "Mentor Circle" } });
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
      target: {
        value: "10:00 Intro, 10:15 Mentoring, 11:00 Close",
      },
    });

    // Select a Program
    const programSelect = screen.getByLabelText(/program/i);
    fireEvent.change(programSelect, { target: { value: "p1" } });

    // Mentor Circle select should appear
    const circleSelect = await screen.findByLabelText(
      /circle \(for mentor circles\)/i
    );
    fireEvent.change(circleSelect, { target: { value: "E" } });

    // Choose notification option (required before submit)
    const dontSend = screen.getByRole("radio", {
      name: /don’t send notifications now/i,
    });
    fireEvent.click(dontSend);

    // Submit
    const createBtn = screen.getByRole("button", { name: /create event/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(mockedEventService.createEvent).toHaveBeenCalled();
      const payload = mockedEventService.createEvent.mock.calls[0][0];
      expect(payload).toEqual(
        expect.objectContaining({ programId: "p1", mentorCircle: "E" })
      );
    });
  });
});
