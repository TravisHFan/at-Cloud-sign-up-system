import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import NewEvent from "../../pages/CreateEvent";

// hoisted mocks
const mockedEventService = vi.hoisted(() => ({
  createEvent: vi.fn().mockResolvedValue({ id: "evt1" }),
}));

const mockedRolesTemplateService = vi.hoisted(() => ({
  getAllTemplates: vi.fn().mockResolvedValue({
    "Mentor Circle": [
      {
        _id: "tpl1",
        name: "Mentor Circle Template",
        roles: [
          { name: "Mentor", description: "", maxParticipants: 5 },
          {
            name: "Attendee",
            description: "No special role",
            maxParticipants: 30,
          },
        ],
      },
    ],
    Conference: [
      {
        _id: "tpl2",
        name: "Conference Template",
        roles: [{ name: "Attendee", description: "", maxParticipants: 100 }],
      },
    ],
  }),
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
  // getById returns unified mentors array (circles no longer used)
  getById: vi.fn().mockResolvedValue({
    mentors: [],
  }),
}));

vi.mock("../../services/api", () => ({
  eventService: mockedEventService,
  rolesTemplateService: mockedRolesTemplateService,
  programService: mockedProgramService,
  // Provide a minimal userService to satisfy any imports from hooks/components
  userService: {
    getUsers: vi.fn().mockResolvedValue({ users: [], total: 0 }),
  },
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

describe("CreateEvent - Program Labels wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("authToken", "test-token");
  });

  it("shows Program multi-select and submits with programLabels array", async () => {
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

    // Select programs in multi-select (set selected property)
    const programSelect = screen.getByLabelText(
      /program/i
    ) as HTMLSelectElement;
    const p1Option = within(programSelect as HTMLElement).getByRole("option", {
      name: /EMBA 2025/i,
    }) as HTMLOptionElement;
    const p2Option = within(programSelect as HTMLElement).getByRole("option", {
      name: /ECW Spring/i,
    }) as HTMLOptionElement;

    p1Option.selected = true;
    p2Option.selected = true;
    fireEvent.change(programSelect);
    await waitFor(() => {
      expect(p1Option.selected).toBe(true);
      expect(p2Option.selected).toBe(true);
    });

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/event title/i), {
      target: { value: "Multi-Program Event" },
    });
    fireEvent.change(typeSelect, { target: { value: "Conference" } });
    await waitFor(() => expect(typeSelect).toHaveValue("Conference"));
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
        expect.objectContaining({ programLabels: ["p1", "p2"] })
      );
      // Verify programId and mentorCircle are NOT in payload
      expect(payload).not.toHaveProperty("programId");
      expect(payload).not.toHaveProperty("mentorCircle");
    });
  });
});
