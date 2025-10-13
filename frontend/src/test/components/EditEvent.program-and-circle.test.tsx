import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import EditEvent from "../../pages/EditEvent";

// Mock services
const mockedEventService = vi.hoisted(() => ({
  getEvent: vi.fn(),
  updateEvent: vi.fn().mockResolvedValue(undefined),
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

const mockedRolesTemplateService = vi.hoisted(() => ({
  getAllTemplates: vi.fn().mockResolvedValue({
    Conference: [],
    "Mentor Circle": [],
    Webinar: [],
    "Effective Communication Workshop": [],
  }),
}));

vi.mock("../../services/api", () => ({
  eventService: mockedEventService,
  programService: mockedProgramService,
  rolesTemplateService: mockedRolesTemplateService,
  authService: {
    getProfile: vi.fn().mockResolvedValue({
      id: "u1",
      username: "editor",
      firstName: "Edit",
      lastName: "Or",
      email: "editor@example.com",
      role: "Administrator",
      isAtCloudLeader: true,
      roleInAtCloud: "Administrator",
      gender: "male",
    }),
  },
  userService: {
    getUsers: vi.fn().mockResolvedValue({
      users: [],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalUsers: 0,
        hasNext: false,
        hasPrev: false,
      },
    }),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: "evt-123" }),
  };
});

describe("EditEvent - Program Labels", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.setItem("authToken", "test-token");

    mockedEventService.getEvent.mockResolvedValue({
      id: "evt-123",
      title: "Edit Me",
      type: "Conference",
      format: "Online",
      date: "2025-12-15",
      time: "10:00",
      endTime: "11:00",
      timeZone: "America/Los_Angeles",
      location: "",
      zoomLink: "",
      meetingId: "",
      passcode: "",
      disclaimer: "",
      hostedBy: "",
      organizer: "Edit Or (Administrator)",
      purpose: "",
      agenda: "TBD",
      roles: [],
      signedUp: 0,
      totalSlots: 0,
      organizerDetails: [],
      createdBy: "u1",
      createdAt: new Date().toISOString(),
      // existing program linkage - now uses programLabels array
      programLabels: ["p2"],
    });
    mockedEventService.updateEvent.mockResolvedValue({ id: "evt-123" });
  });

  it("Program Labels", async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <EditEvent />
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Edit Me")).toBeInTheDocument();
    });

    // Select additional program using modal
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /select programs/i })
      ).toBeInTheDocument()
    );
    const selectProgramsBtn = screen.getByRole("button", {
      name: /select programs/i,
    });
    fireEvent.click(selectProgramsBtn);
    await waitFor(() =>
      expect(screen.getByText(/EMBA 2025/i)).toBeInTheDocument()
    );
    const embaProgram = screen.getByText(/EMBA 2025/i).closest("button");
    fireEvent.click(embaProgram!);
    // Program is now selected and appears as a chip
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /select programs/i })
      ).toBeInTheDocument()
    );

    // Choose notification option to enable update
    const sendRadio = screen.getByRole("radio", {
      name: /^send notifications now/i,
    });
    fireEvent.click(sendRadio);

    // Submit
    const submitButton = screen.getByText(/update event/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockedEventService.updateEvent).toHaveBeenCalledWith(
        "evt-123",
        expect.objectContaining({
          programLabels: expect.arrayContaining(["p1", "p2"]),
        })
      );
      // Verify programId and mentorCircle are NOT in payload
      const callArgs = mockedEventService.updateEvent.mock.calls[0][1];
      expect(callArgs).not.toHaveProperty("programId");
      expect(callArgs).not.toHaveProperty("mentorCircle");
    });
  });
});
