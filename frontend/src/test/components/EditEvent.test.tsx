import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import EditEvent from "../../pages/EditEvent";
import { eventService, authService } from "../../services/api";

// Mock the API service
vi.mock("../../services/api", () => ({
  eventService: {
    getEvent: vi.fn(),
    updateEvent: vi.fn(),
  },
  authService: {
    getProfile: vi.fn(),
    logout: vi.fn(),
  },
  // Needed by useUsersApi hook used in organizer selection
  userService: {
    getUsers: vi.fn().mockResolvedValue({
      users: [
        {
          id: "u-main",
          username: "main",
          email: "main@example.com",
          firstName: "Main",
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
        {
          id: "u-co1",
          username: "alice",
          email: "alice@example.com",
          firstName: "Alice",
          lastName: "Alpha",
          role: "Administrator",
          isAtCloudLeader: false,
          roleInAtCloud: "Admin",
          avatar: null,
          gender: "female",
          phone: "555-2222",
          createdAt: new Date().toISOString(),
          emailVerified: true,
        },
        {
          id: "u-co2",
          username: "bob",
          email: "bob@example.com",
          firstName: "Bob",
          lastName: "Beta",
          role: "Leader",
          isAtCloudLeader: true,
          roleInAtCloud: "Leader",
          avatar: null,
          gender: "male",
          phone: "555-3333",
          createdAt: new Date().toISOString(),
          emailVerified: true,
        },
        {
          id: "u-current",
          username: "editor",
          email: "editor@example.com",
          firstName: "Edit",
          lastName: "Or",
          role: "Administrator",
          isAtCloudLeader: false,
          roleInAtCloud: "Admin",
          avatar: null,
          gender: "male",
          phone: "555-0000",
          createdAt: new Date().toISOString(),
          emailVerified: true,
        },
      ],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalUsers: 4,
        hasNext: false,
        hasPrev: false,
      },
    }),
  },
}));

// Mock react-router-dom hooks
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: "test-event-id" }),
  };
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe("EditEvent - Field Update Bug Fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful user context
    vi.mocked(eventService.getEvent).mockResolvedValue({
      id: "test-event-id",
      title: "Test Event",
      type: "Effective Communication Workshop",
      format: "Online",
      date: "2025-12-01",
      time: "10:00",
      endTime: "12:00",
      roles: [],
      signedUp: 0,
      totalSlots: 0,
      createdBy: "u-main",
      createdAt: new Date().toISOString(),
      organizer: "Test User (Leader)",
      purpose: "Test purpose",
      agenda: "Test agenda",
      location: "",
      zoomLink: "",
      meetingId: "",
      passcode: "",
      disclaimer: "",
      hostedBy: "",
      organizerDetails: [],
    });

    vi.mocked(eventService.updateEvent).mockResolvedValue({
      id: "test-event-id",
      title: "Test Event",
      type: "Effective Communication Workshop",
      format: "Online",
      date: "2025-12-01",
      time: "10:00",
      endTime: "12:00",
      roles: [],
      signedUp: 0,
      totalSlots: 0,
      organizer: "Test User (Leader)",
      purpose: "Test purpose",
      location: "",
      createdBy: "u-main",
      createdAt: new Date().toISOString(),
    });
  });

  it("disables Update button until a field is changed, then enables it", async () => {
    render(
      <TestWrapper>
        <EditEvent />
      </TestWrapper>
    );

    // Wait for form load
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Event")).toBeInTheDocument();
    });

    const updateBtn = screen.getByRole("button", { name: /update event/i });
    expect(updateBtn).toBeDisabled();

    // Change a field
    const titleInput = screen.getByPlaceholderText(/enter event title/i);
    fireEvent.change(titleInput, { target: { value: "Test Event (edited)" } });

    // Now button should be enabled
    await waitFor(() => {
      expect(updateBtn).not.toBeDisabled();
    });
  });

  it("should include all Zoom fields in update payload for Online events", async () => {
    render(
      <TestWrapper>
        <EditEvent />
      </TestWrapper>
    );

    // Wait for the form to load
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Event")).toBeInTheDocument();
    });

    // Wait for Zoom fields to be visible (they should be visible for Online format)
    await waitFor(() => {
      expect(screen.getByText("Zoom Information")).toBeInTheDocument();
    });

    // Fill in Zoom fields using placeholder text or name attribute
    const zoomLinkInput = screen.getByPlaceholderText(
      /enter zoom meeting link/i
    );
    const meetingIdInput = screen.getByPlaceholderText(/enter meeting id/i);
    const passcodeInput = screen.getByPlaceholderText(/enter passcode/i);

    fireEvent.change(zoomLinkInput, {
      target: { value: "https://zoom.us/j/123456789" },
    });
    fireEvent.change(meetingIdInput, {
      target: { value: "123 456 789" },
    });
    fireEvent.change(passcodeInput, {
      target: { value: "secret123" },
    });

    // Submit the form
    const submitButton = screen.getByText(/update event/i);
    fireEvent.click(submitButton);

    // Verify that updateEvent was called with all Zoom fields
    await waitFor(() => {
      expect(eventService.updateEvent).toHaveBeenCalledWith(
        "test-event-id",
        expect.objectContaining({
          zoomLink: "https://zoom.us/j/123456789",
          meetingId: "123 456 789",
          passcode: "secret123",
        })
      );
    });
  });

  it("should include all Zoom fields in update payload for Hybrid events", async () => {
    // Mock hybrid event
    vi.mocked(eventService.getEvent).mockResolvedValue({
      id: "test-event-id",
      title: "Hybrid Event",
      type: "Effective Communication Workshop",
      format: "Hybrid Participation",
      date: "2025-12-01",
      time: "10:00",
      endTime: "12:00",
      roles: [],
      signedUp: 0,
      totalSlots: 0,
      createdBy: "u-main",
      createdAt: new Date().toISOString(),
      organizer: "Test User (Leader)",
      purpose: "Test purpose",
      agenda: "Test agenda",
      location: "Conference Room A",
      zoomLink: "",
      meetingId: "",
      passcode: "",
      disclaimer: "",
      hostedBy: "",
      organizerDetails: [],
    });

    render(
      <TestWrapper>
        <EditEvent />
      </TestWrapper>
    );

    // Wait for the form to load
    await waitFor(() => {
      expect(screen.getByDisplayValue("Hybrid Event")).toBeInTheDocument();
    });

    // Wait for Zoom fields to be visible (they should be visible for Hybrid format)
    await waitFor(() => {
      expect(screen.getByText("Zoom Information")).toBeInTheDocument();
    });

    // Fill in Zoom fields using placeholder text
    const zoomLinkInput = screen.getByPlaceholderText(
      /enter zoom meeting link/i
    );
    const meetingIdInput = screen.getByPlaceholderText(/enter meeting id/i);
    const passcodeInput = screen.getByPlaceholderText(/enter passcode/i);

    fireEvent.change(zoomLinkInput, {
      target: { value: "https://zoom.us/j/987654321" },
    });
    fireEvent.change(meetingIdInput, {
      target: { value: "987 654 321" },
    });
    fireEvent.change(passcodeInput, {
      target: { value: "hybrid123" },
    });

    // Submit the form
    const submitButton = screen.getByText(/update event/i);
    fireEvent.click(submitButton);

    // Verify that updateEvent was called with all Zoom fields
    await waitFor(() => {
      expect(eventService.updateEvent).toHaveBeenCalledWith(
        "test-event-id",
        expect.objectContaining({
          zoomLink: "https://zoom.us/j/987654321",
          meetingId: "987 654 321",
          passcode: "hybrid123",
        })
      );
    });
  });

  it("should include hostedBy field in update payload", async () => {
    render(
      <TestWrapper>
        <EditEvent />
      </TestWrapper>
    );

    // Wait for the form to load
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Event")).toBeInTheDocument();
    });

    // Make a minimal change to enable the Update button
    const titleInput = screen.getByPlaceholderText(/enter event title/i);
    fireEvent.change(titleInput, { target: { value: "Test Event (edited)" } });

    // Note: hostedBy field is disabled in the actual component,
    // so this test verifies it's included in the payload (even if empty)
    // Submit the form without changing hostedBy (since it's disabled)
    const submitButton = screen.getByText(/update event/i);
    fireEvent.click(submitButton);

    // Verify that updateEvent was called and hostedBy is included in the payload
    await waitFor(() => {
      expect(eventService.updateEvent).toHaveBeenCalledWith(
        "test-event-id",
        expect.objectContaining({
          hostedBy: "", // The form sends empty string, which is fine as long as the field is included
        })
      );
    });
  });

  it("should allow clearing Zoom fields", async () => {
    // Mock event with existing Zoom data
    vi.mocked(eventService.getEvent).mockResolvedValue({
      id: "test-event-id",
      title: "Test Event",
      type: "Effective Communication Workshop",
      format: "Online",
      date: "2025-12-01",
      time: "10:00",
      endTime: "12:00",
      roles: [],
      signedUp: 0,
      totalSlots: 0,
      createdBy: "u-main",
      createdAt: new Date().toISOString(),
      organizer: "Test User (Leader)",
      purpose: "Test purpose",
      agenda: "Test agenda",
      location: "",
      zoomLink: "https://zoom.us/j/existing",
      meetingId: "existing meeting",
      passcode: "existing pass",
      disclaimer: "",
      hostedBy: "",
      organizerDetails: [],
    });

    render(
      <TestWrapper>
        <EditEvent />
      </TestWrapper>
    );

    // Wait for the form to load with existing data
    await waitFor(() => {
      expect(
        screen.getByDisplayValue("https://zoom.us/j/existing")
      ).toBeInTheDocument();
    });

    // Wait for Zoom fields to be visible
    await waitFor(() => {
      expect(screen.getByText("Zoom Information")).toBeInTheDocument();
    });

    // Clear Zoom fields using placeholder text
    const zoomLinkInput = screen.getByPlaceholderText(
      /enter zoom meeting link/i
    );
    const meetingIdInput = screen.getByPlaceholderText(/enter meeting id/i);
    const passcodeInput = screen.getByPlaceholderText(/enter passcode/i);

    fireEvent.change(zoomLinkInput, { target: { value: "" } });
    fireEvent.change(meetingIdInput, { target: { value: "" } });
    fireEvent.change(passcodeInput, { target: { value: "" } });

    // Submit the form
    const submitButton = screen.getByText(/update event/i);
    fireEvent.click(submitButton);

    // Verify that updateEvent was called with empty Zoom fields
    await waitFor(() => {
      expect(eventService.updateEvent).toHaveBeenCalledWith(
        "test-event-id",
        expect.objectContaining({
          zoomLink: "",
          meetingId: "",
          passcode: "",
        })
      );
    });
  });

  it("should exclude Zoom fields for In-person events", async () => {
    // Mock in-person event
    vi.mocked(eventService.getEvent).mockResolvedValue({
      id: "test-event-id",
      title: "In-person Event",
      type: "Effective Communication Workshop",
      format: "In-person",
      date: "2025-12-01",
      time: "10:00",
      endTime: "12:00",
      roles: [],
      signedUp: 0,
      totalSlots: 0,
      createdBy: "u-main",
      createdAt: new Date().toISOString(),
      organizer: "Test User (Leader)",
      purpose: "Test purpose",
      agenda: "Test agenda",
      location: "Conference Room A",
      zoomLink: "",
      meetingId: "",
      passcode: "",
      disclaimer: "",
      hostedBy: "",
      organizerDetails: [],
    });

    render(
      <TestWrapper>
        <EditEvent />
      </TestWrapper>
    );

    // Wait for the form to load
    await waitFor(() => {
      expect(screen.getByDisplayValue("In-person Event")).toBeInTheDocument();
    });

    // Make a minimal change to enable the Update button
    const titleInput = screen.getByPlaceholderText(/enter event title/i);
    fireEvent.change(titleInput, {
      target: { value: "In-person Event (edited)" },
    });

    // Verify that Zoom fields are not visible for In-person events
    expect(screen.queryByText("Zoom Information")).not.toBeInTheDocument();

    // Submit the form
    const submitButton = screen.getByText(/update event/i);
    fireEvent.click(submitButton);

    // Verify that updateEvent was called without Zoom fields
    await waitFor(() => {
      const updateCall = vi.mocked(eventService.updateEvent).mock.calls[0][1];
      expect(updateCall).not.toHaveProperty("zoomLink");
      expect(updateCall).not.toHaveProperty("meetingId");
      expect(updateCall).not.toHaveProperty("passcode");
    });
  });

  it("does not auto-add editor as organizer and preserves co-organizer order", async () => {
    // Simulate authenticated editor
    localStorage.setItem("authToken", "test-token");
    const currentUser = {
      id: "u-current",
      username: "editor",
      email: "editor@example.com",
      phone: "555-0000",
      firstName: "Edit",
      lastName: "Or",
      gender: "male",
      role: "Administrator",
      isAtCloudLeader: false,
      roleInAtCloud: "Admin",
      avatar: null,
    } as any;
    // Mock authService.getProfile to return current user
    vi.mocked(authService.getProfile).mockResolvedValue(currentUser as any);

    // Event with main organizer and two co-organizers in a specific order
    vi.mocked(eventService.getEvent).mockResolvedValue({
      id: "test-event-id",
      title: "Ordered Org Event",
      type: "Conference",
      format: "In-person",
      date: "2025-12-01",
      time: "10:00",
      endTime: "12:00",
      createdAt: new Date().toISOString(),
      roles: [],
      signedUp: 0,
      totalSlots: 0,
      organizer: "Main One (Leader)",
      createdBy: {
        id: "u-main",
        firstName: "Main",
        lastName: "One",
        role: "Leader",
        roleInAtCloud: "Leader",
        email: "main@example.com",
        phone: "555-1111",
        gender: "female",
        avatar: undefined,
      },
      organizerDetails: [
        // Note: includes main organizer entry first to ensure we filter it out
        {
          userId: "u-main",
          name: "Main One",
          role: "Leader",
          email: "main@example.com",
          phone: "555-1111",
          avatar: null,
          gender: "female",
        },
        {
          userId: "u-co1",
          name: "Alice Alpha",
          role: "Administrator",
          email: "alice@example.com",
          phone: "555-2222",
          avatar: null,
          gender: "female",
        },
        {
          userId: "u-co2",
          name: "Bob Beta",
          role: "Leader",
          email: "bob@example.com",
          phone: "555-3333",
          avatar: null,
          gender: "male",
        },
      ],
      purpose: "Maintain purpose",
      agenda: "Maintain agenda",
      location: "Room 1",
      zoomLink: "",
      meetingId: "",
      passcode: "",
      disclaimer: "",
      hostedBy: "",
    });

    render(
      <TestWrapper>
        <EditEvent />
      </TestWrapper>
    );

    // Wait for event to load
    await waitFor(() => {
      expect(screen.getByDisplayValue("Ordered Org Event")).toBeInTheDocument();
    });

    // Submit without changing organizers
    // Make a minimal change to enable the Update button
    const titleInput = screen.getByPlaceholderText(/enter event title/i);
    fireEvent.change(titleInput, {
      target: { value: "Ordered Org Event (edited)" },
    });
    fireEvent.click(screen.getByText(/update event/i));

    await waitFor(() => {
      expect(eventService.updateEvent).toHaveBeenCalled();
    });

    const payload = vi.mocked(eventService.updateEvent).mock.calls[0][1];
    expect(Array.isArray(payload.organizerDetails)).toBe(true);

    // Should only include the two co-organizers (not the main, not the editor)
    const ids = payload.organizerDetails.map((o: any) => o.userId);
    expect(ids).toEqual(["u-co1", "u-co2"]);
    expect(ids).not.toContain("u-main");
    expect(ids).not.toContain("u-current");
  });
});
