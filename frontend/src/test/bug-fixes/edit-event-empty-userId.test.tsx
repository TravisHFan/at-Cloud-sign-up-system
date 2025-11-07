/**
 * Bug Fix Test: Edit Event with Empty userId in organizerDetails
 *
 * Issue: When editing an event and updating the title, the system would fail with:
 * "Validation failed: Cast to ObjectId failed for value "" (type string) at path "userId""
 *
 * Root Cause: The organizerDetails array was including organizers with empty string IDs,
 * which caused MongoDB validation to fail when trying to cast "" to an ObjectId.
 *
 * Fix: Filter out organizers with empty or whitespace-only IDs before mapping to organizerDetails.
 */

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
  userService: {
    getUsers: vi.fn().mockResolvedValue({
      users: [
        {
          id: "valid-user-1",
          username: "user1",
          email: "user1@example.com",
          firstName: "Valid",
          lastName: "User",
          role: "Leader",
          roleInAtCloud: "Leader",
          gender: "male",
          avatar: null,
        },
      ],
      total: 1,
      page: 1,
      totalPages: 1,
    }),
  },
  roleTemplateService: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: {
      id: "current-user-id",
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      role: "Leader",
      roleInAtCloud: "Leader",
      gender: "male",
      avatar: null,
    },
    isAuthenticated: true,
    loading: false,
  }),
}));

describe("Bug Fix: Edit Event with empty userId in organizerDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should filter out organizers with empty IDs when updating event", async () => {
    // Setup: Event with valid main organizer
    mockedEventService.getEvent.mockResolvedValue({
      id: "event-123",
      title: "Test Event",
      type: "Meeting",
      format: "In-person",
      date: "2025-12-01",
      time: "10:00",
      endTime: "12:00",
      location: "Conference Room",
      timeZone: "America/Los_Angeles",
      organizer: "Test User (Leader)",
      purpose: "Test purpose",
      agenda: "Test agenda",
      disclaimer: "",
      hostedBy: "@Cloud Ministry",
      roles: [
        {
          id: "r1",
          name: "Participant",
          description: "Test role",
          maxParticipants: 10,
          currentSignups: [],
        },
      ],
      createdBy: {
        id: "current-user-id",
        firstName: "Test",
        lastName: "User",
        role: "Leader",
        roleInAtCloud: "Leader",
        gender: "male",
        avatar: null,
        email: "test@example.com",
        phone: "555-0100",
      },
      organizerDetails: [],
      status: "upcoming",
    });

    mockedEventService.updateEvent.mockResolvedValue({});

    render(
      <AuthProvider>
        <NotificationProvider>
          <MemoryRouter initialEntries={["/events/event-123/edit"]}>
            <Routes>
              <Route path="/events/:id/edit" element={<EditEvent />} />
              <Route path="/dashboard/upcoming" element={<div>Success</div>} />
            </Routes>
          </MemoryRouter>
        </NotificationProvider>
      </AuthProvider>
    );

    // Wait for event to load
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Event")).toBeInTheDocument();
    });

    // Edit the title
    const titleInput = screen.getByPlaceholderText(/enter event title/i);
    fireEvent.change(titleInput, {
      target: { value: "Updated Test Event" },
    });

    // Select notification preference
    const sendRadio = screen.getAllByRole("radio")[0]; // First radio is "send"
    fireEvent.click(sendRadio);

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /update event/i }));

    // Verify updateEvent was called
    await waitFor(() => {
      expect(mockedEventService.updateEvent).toHaveBeenCalled();
    });

    // Get the payload that was sent
    const [eventId, payload] = mockedEventService.updateEvent.mock.calls[0];

    // Assertions
    expect(eventId).toBe("event-123");
    expect(payload.title).toBe("Updated Test Event");

    // Critical assertion: organizerDetails should be an empty array (no invalid organizers)
    expect(payload.organizerDetails).toEqual([]);

    // Ensure no organizers with empty userId were sent
    const hasEmptyUserId = payload.organizerDetails.some(
      (org: { userId?: string }) => !org.userId || org.userId.trim() === ""
    );
    expect(hasEmptyUserId).toBe(false);
  });

  it("should include valid organizers but filter out ones with empty IDs", async () => {
    // Setup: Event with one valid organizer and simulate one with empty ID
    mockedEventService.getEvent.mockResolvedValue({
      id: "event-456",
      title: "Another Event",
      type: "Workshop",
      format: "Online",
      date: "2025-12-10",
      time: "14:00",
      endTime: "16:00",
      location: "Online",
      timeZone: "America/New_York",
      organizer: "Test User (Leader), Valid User (Leader)",
      zoomLink: "https://zoom.us/j/123456789",
      meetingId: "123 456 789",
      passcode: "test123",
      purpose: "Workshop purpose",
      agenda: "Workshop agenda",
      disclaimer: "",
      hostedBy: "@Cloud Ministry",
      roles: [
        {
          id: "r1",
          name: "Attendee",
          description: "Workshop attendee",
          maxParticipants: 20,
          currentSignups: [],
        },
      ],
      createdBy: {
        id: "current-user-id",
        firstName: "Test",
        lastName: "User",
        role: "Leader",
        roleInAtCloud: "Leader",
        gender: "male",
        avatar: null,
        email: "test@example.com",
        phone: "555-0100",
      },
      organizerDetails: [
        {
          userId: "valid-user-1",
          name: "Valid User",
          role: "Leader",
          email: "valid@example.com",
          phone: "555-0200",
          gender: "male",
          avatar: null,
        },
      ],
      status: "upcoming",
    });

    mockedEventService.updateEvent.mockResolvedValue({});

    render(
      <AuthProvider>
        <NotificationProvider>
          <MemoryRouter initialEntries={["/events/event-456/edit"]}>
            <Routes>
              <Route path="/events/:id/edit" element={<EditEvent />} />
              <Route path="/dashboard/upcoming" element={<div>Success</div>} />
            </Routes>
          </MemoryRouter>
        </NotificationProvider>
      </AuthProvider>
    );

    // Wait for event to load
    await waitFor(() => {
      expect(screen.getByDisplayValue("Another Event")).toBeInTheDocument();
    });

    // Make a change
    const titleInput = screen.getByPlaceholderText(/enter event title/i);
    fireEvent.change(titleInput, {
      target: { value: "Updated Workshop" },
    });

    // Select notification preference
    const sendRadio = screen.getAllByRole("radio")[0]; // First radio is "send"
    fireEvent.click(sendRadio);

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /update event/i }));

    await waitFor(() => {
      expect(mockedEventService.updateEvent).toHaveBeenCalled();
    });

    const [, payload] = mockedEventService.updateEvent.mock.calls[0];

    // Should include the valid organizer
    expect(payload.organizerDetails).toHaveLength(1);
    expect(payload.organizerDetails[0].userId).toBe("valid-user-1");

    // Should NOT include any organizers with empty userId
    const hasEmptyUserId = payload.organizerDetails.some(
      (org: { userId?: string }) => !org.userId || org.userId.trim() === ""
    );
    expect(hasEmptyUserId).toBe(false);
  });
});
