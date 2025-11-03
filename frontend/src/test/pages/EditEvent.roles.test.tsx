import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import EditEvent from "../../pages/EditEvent";

const mockedEventService = vi.hoisted(() => ({
  getEvent: vi.fn(),
  getEventTemplates: vi.fn(),
  updateEvent: vi.fn(),
}));

vi.mock("../../services/api", () => ({
  eventService: mockedEventService,
  programService: {
    list: vi.fn().mockResolvedValue([]),
  },
  fileService: {
    uploadImage: vi.fn(),
  },
  // Needed by useUsersApi hook used in organizer selection
  userService: {
    getUsers: vi.fn().mockResolvedValue({
      users: [
        {
          id: "u1",
          username: "user1",
          email: "user1@example.com",
          firstName: "User",
          lastName: "One",
          role: "Leader",
          isAtCloudLeader: true,
          roleInAtCloud: "Leader",
          avatar: null,
          gender: "female",
          phone: "555-1111",
          createdAt: new Date().toISOString(),
          emailVerified: true,
        },
      ],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalUsers: 1,
        hasNext: false,
        hasPrev: false,
      },
    }),
  },
  authService: {
    getProfile: vi.fn().mockResolvedValue({
      id: "admin1",
      username: "admin",
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
      role: "Administrator",
      isAtCloudLeader: true,
      roleInAtCloud: "Administrator",
      gender: "male",
    }),
  },
  // Needed by useEventDataLoader hook
  roleTemplateService: {
    getAllRolesTemplates: vi.fn().mockResolvedValue({}),
  },
  purchaseService: {
    checkProgramAccess: vi.fn().mockResolvedValue({ hasAccess: true }),
  },
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <NotificationProvider>{children}</NotificationProvider>
  </AuthProvider>
);

describe("EditEvent — roles UI protections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("authToken", "test-token");
  });

  it("disables Remove for roles with registrants, enforces min capacity, and includes roles in update payload", async () => {
    // Mock templates
    mockedEventService.getEventTemplates.mockResolvedValue({
      allowedTypes: ["Conference"],
      templates: {
        Conference: [
          { name: "Zoom Host", description: "", maxParticipants: 1 },
          { name: "Attendee", description: "", maxParticipants: 100 },
        ],
      },
    });

    // Mock event
    mockedEventService.getEvent.mockResolvedValue({
      id: "evt1",
      title: "Conf",
      type: "Conference",
      date: "2030-01-01",
      endDate: "2030-01-01",
      time: "10:00",
      endTime: "11:00",
      timeZone: "America/Los_Angeles",
      location: "Online",
      organizer: "Admin User (Administrator)",
      format: "Online",
      agenda: "Agenda",
      signedUp: 2,
      totalSlots: 102,
      roles: [
        {
          id: "r1",
          name: "Zoom Host",
          description: "",
          maxParticipants: 2,
          currentSignups: [
            { userId: "u1", username: "u1" },
            { userId: "u2", username: "u2" },
          ],
        },
        {
          id: "r2",
          name: "Attendee",
          description: "",
          maxParticipants: 100,
          currentSignups: [],
        },
      ],
      createdBy: {
        id: "admin1",
        firstName: "Admin",
        lastName: "User",
        role: "Administrator",
      },
      createdAt: new Date().toISOString(),
    });

    mockedEventService.updateEvent.mockResolvedValue({ id: "evt1" });

    render(
      <MemoryRouter initialEntries={["/events/evt1/edit"]}>
        <Wrapper>
          <Routes>
            <Route path="/events/:id/edit" element={<EditEvent />} />
          </Routes>
        </Wrapper>
      </MemoryRouter>
    );

    // Wait for roles section to appear
    await screen.findByText(/Configure Event Roles for Conference/i);

    // Enable customization
    fireEvent.click(screen.getByRole("button", { name: /customize roles/i }));

    // Remove button for first role should be disabled due to 2 registrants
    const removeBtn = screen.getAllByRole("button", {
      name: /remove/i,
    })[0] as HTMLButtonElement;
    expect(removeBtn).toBeDisabled();

    // Capacity min should be 2; trying to set to 1 keeps it at 2
    const capInput = screen.getAllByLabelText(
      /max participants/i
    )[0] as HTMLInputElement;
    expect(capInput.min).toBe("2");
    fireEvent.change(capInput, { target: { value: "1" } });
    await waitFor(() => expect(capInput.value).toBe("2"));

    // Select notification preference (required)
    fireEvent.click(
      screen.getByRole("radio", {
        name: /don't send notifications now.*i'll notify users later/i,
      })
    );

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /update event/i }));

    await waitFor(() => {
      expect(mockedEventService.updateEvent).toHaveBeenCalled();
      const [eventId, payload] = mockedEventService.updateEvent.mock.calls[0];
      expect(eventId).toBe("evt1");
      expect(payload).toEqual(
        expect.objectContaining({
          roles: expect.arrayContaining([
            expect.objectContaining({ id: "r1", maxParticipants: 2 }),
            expect.objectContaining({ id: "r2" }),
          ]),
        })
      );
    });
  });
});
