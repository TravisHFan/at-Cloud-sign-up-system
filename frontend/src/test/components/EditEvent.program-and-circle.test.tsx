import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import EditEvent from "../../pages/EditEvent";

// Mock services
const mockedEventService = vi.hoisted(() => ({
  getEvent: vi.fn(),
  updateEvent: vi.fn(),
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

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe("EditEvent - Program & Mentor Circle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedEventService.getEvent.mockResolvedValue({
      id: "evt-123",
      title: "Edit Me",
      type: "Mentor Circle",
      format: "Online",
      agenda: "Discuss plans",
      date: "2025-12-01",
      time: "10:00",
      endTime: "11:00",
      roles: [],
      signedUp: 0,
      totalSlots: 0,
      createdBy: "u1",
      createdAt: new Date().toISOString(),
      organizer: "Edit Or (Administrator)",
      organizerDetails: [],
      // existing program linkage
      programId: "p2",
      mentorCircle: "M",
    });
    mockedEventService.updateEvent.mockResolvedValue({ id: "evt-123" });
  });

  it("loads existing program/circle and updates them in payload", async () => {
    render(
      <Wrapper>
        <EditEvent />
      </Wrapper>
    );

    await waitFor(() =>
      expect(screen.getByDisplayValue("Edit Me")).toBeInTheDocument()
    );

    // Program should be pre-selected to p2
    const programSelect = screen.getByLabelText(
      /program/i
    ) as HTMLSelectElement;
    expect(programSelect.value).toBe("p2");

    // Circle shown because type is Mentor Circle and program selected
    const circleSelect = await screen.findByLabelText(
      /circle \(for mentor circles\)/i
    );
    expect((circleSelect as HTMLSelectElement).value).toBe("M");

    // Change both
    fireEvent.change(programSelect, { target: { value: "p1" } });
    fireEvent.change(circleSelect, { target: { value: "E" } });

    // Choose notification option to enable update
    const dontSend = screen.getByRole("radio", {
      name: /don’t send notifications now/i,
    });
    fireEvent.click(dontSend);

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /update event/i }));

    await waitFor(() => {
      expect(mockedEventService.updateEvent).toHaveBeenCalledWith(
        "evt-123",
        expect.objectContaining({ programId: "p1", mentorCircle: "E" })
      );
    });
  });
});
