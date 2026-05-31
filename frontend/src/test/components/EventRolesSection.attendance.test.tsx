import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EventRolesSection from "../../components/EventDetail/EventRolesSection";
import { eventService } from "../../services/api";
import type { EventData } from "../../types/event";

vi.mock("../../components/events/EventRoleSignup", () => ({
  default: () => <div data-testid="event-role-signup" />,
}));

vi.mock("../../components/EventDetail/GuestList", () => ({
  default: () => <div data-testid="guest-list" />,
}));

vi.mock("../../services/api", () => ({
  eventService: {
    updateRegistrationAttendance: vi.fn(),
  },
}));

const baseEvent: EventData = {
  id: "event-1",
  title: "Attendance Event",
  type: "Workshop",
  date: "2026-06-01",
  endDate: "2026-06-01",
  time: "10:00",
  endTime: "12:00",
  location: "Room A",
  organizer: "Organizer",
  format: "In-person",
  status: "completed",
  roles: [
    {
      id: "role-1",
      name: "Participant",
      description: "Participant role",
      maxParticipants: 10,
      currentSignups: [
        {
          registrationId: "reg-1",
          userId: "user-1",
          username: "person",
          firstName: "Test",
          lastName: "Person",
          email: "person@example.com",
          registrationStatus: "active",
          attendanceConfirmed: false,
        },
      ],
    },
  ],
  signedUp: 1,
  totalSlots: 10,
  createdBy: "admin-1",
  createdAt: "2026-05-01T00:00:00.000Z",
};

const defaultProps = {
  event: baseEvent,
  isPassedEvent: true,
  managementMode: false,
  currentUserId: "admin-1",
  currentUserRole: "Administrator" as const,
  canNavigateToProfiles: true,
  isCurrentUserOrganizer: false,
  guestsByRole: {},
  notification: {
    success: vi.fn(),
    error: vi.fn(),
  },
  setCancelConfirm: vi.fn(),
  setEditGuest: vi.fn(),
  handleNameCardClick: vi.fn(),
  draggedUserId: null,
  draggedGuestId: null,
  handleDragOver: vi.fn(),
  handleDrop: vi.fn(),
  handleDragStart: vi.fn(),
  handleGuestDragStart: vi.fn(),
  handleDragEnd: vi.fn(),
  setEvent: vi.fn(),
  handleManagementCancel: vi.fn(),
  setResendLinkConfirm: vi.fn(),
  handleRoleSignup: vi.fn(),
  handleRoleCancel: vi.fn(),
  hasReachedMaxRoles: false,
  maxRolesForUser: 3,
  isRoleAllowedForUser: vi.fn(() => true),
  canManageSignups: false,
  canManageAttendance: true,
};

describe("EventRolesSection attendance controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(eventService.updateRegistrationAttendance).mockResolvedValue(
      baseEvent,
    );
  });

  it("shows attendance controls for completed events when attendance can be managed", () => {
    render(<EventRolesSection {...defaultProps} />);

    expect(screen.getByText("Not recorded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
  });

  it("does not show attendance controls for ongoing/upcoming events", () => {
    render(
      <EventRolesSection
        {...defaultProps}
        event={{ ...baseEvent, status: "ongoing" }}
        isPassedEvent={false}
        canManageSignups
        canManageAttendance={false}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Yes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "No" }),
    ).not.toBeInTheDocument();
  });

  it("updates attendance without showing a success confirmation modal", async () => {
    const notification = {
      success: vi.fn(),
      error: vi.fn(),
    };

    render(<EventRolesSection {...defaultProps} notification={notification} />);

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => {
      expect(eventService.updateRegistrationAttendance).toHaveBeenCalledWith(
        "event-1",
        "reg-1",
        true,
      );
    });
    expect(notification.success).not.toHaveBeenCalled();
  });
});
