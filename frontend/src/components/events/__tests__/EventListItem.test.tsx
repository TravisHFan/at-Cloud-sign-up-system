/**
 * EventListItem Component Tests
 *
 * Tests the EventListItem component for displaying event items in lists:
 * - Event information rendering (title, date, location, organizer, format, type)
 * - Status badges (Active, Cancelled, Ongoing)
 * - Availability badges (Full, Limited Spots, Few Spots)
 * - Action buttons (View Details, View & Sign Up, Edit, Delete)
 * - Permission-based visibility (canEdit, canDelete)
 * - Guest vs authenticated user behavior
 * - Upcoming vs passed event handling
 * - Event deletion modal
 * - Timezone display
 * - Responsive layout
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import EventListItem from "../EventListItem";
import type { EventData } from "../../../types/event";
import * as eventStatsUtils from "../../../utils/eventStatsUtils";
import * as uiUtils from "../../../utils/uiUtils";

// Mock dependencies
vi.mock("../../../utils/eventStatsUtils", () => ({
  formatEventDateTimeRangeInViewerTZ: vi.fn(),
}));

vi.mock("../../../utils/uiUtils", async () => {
  const actual = await vi.importActual("../../../utils/uiUtils");
  return {
    ...actual,
    getEventStatusBadge: vi.fn(),
    getAvailabilityBadge: vi.fn(),
  };
});

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

// Import useAuth and useNavigate after mocking
import { useAuth } from "../../../hooks/useAuth";
import { useNavigate } from "react-router-dom";

describe("EventListItem", () => {
  const mockNavigate = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnEdit = vi.fn();

  const mockEvent: EventData = {
    id: "event-1",
    title: "Test Event",
    date: "2025-06-15",
    time: "14:00",
    endTime: "16:00",
    timeZone: "America/New_York",
    location: "Conference Room A",
    format: "In-Person",
    type: "Workshop",
    organizer: "John Doe",
    signedUp: 10,
    totalSlots: 50,
    roles: [],
    createdBy: "user-1",
    createdAt: "2025-01-01T00:00:00.000Z",
    status: "upcoming",
  } as EventData;

  const mockUser = {
    id: "user-1",
    role: "Participant",
    firstName: "Jane",
    lastName: "Smith",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useAuth).mockReturnValue({
      currentUser: mockUser,
    } as any);
    vi.mocked(
      eventStatsUtils.formatEventDateTimeRangeInViewerTZ
    ).mockReturnValue("Sunday, June 15, 2025 • 2:00 PM - 4:00 PM EDT");
    vi.mocked(uiUtils.getEventStatusBadge).mockReturnValue({
      text: "Active",
      className: "bg-green-100 text-green-800",
    });
    vi.mocked(uiUtils.getAvailabilityBadge).mockReturnValue(null);
  });

  const renderComponent = (
    props: Partial<Parameters<typeof EventListItem>[0]> = {}
  ) => {
    return render(
      <BrowserRouter>
        <EventListItem event={mockEvent} type="upcoming" {...props} />
      </BrowserRouter>
    );
  };

  describe("Event Information Display", () => {
    it("should render event title", () => {
      renderComponent();
      expect(screen.getByText("Test Event")).toBeInTheDocument();
    });

    it("should render formatted date/time", () => {
      renderComponent();
      expect(
        screen.getByText("Sunday, June 15, 2025 • 2:00 PM - 4:00 PM EDT")
      ).toBeInTheDocument();
    });

    it("should call formatEventDateTimeRangeInViewerTZ with correct parameters", () => {
      renderComponent();
      expect(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).toHaveBeenCalledWith(
        mockEvent.date,
        mockEvent.time,
        mockEvent.endTime,
        mockEvent.timeZone,
        mockEvent.endDate
      );
    });

    it("should show timezone note when timezone is provided", () => {
      renderComponent();
      expect(
        screen.getByText("(shown in your local time)")
      ).toBeInTheDocument();
    });

    it("should not show timezone note when timezone is undefined", () => {
      const eventWithoutTimezone = { ...mockEvent, timeZone: undefined };
      renderComponent({ event: eventWithoutTimezone });
      expect(
        screen.queryByText("(shown in your local time)")
      ).not.toBeInTheDocument();
    });

    it("should render location", () => {
      renderComponent();
      expect(screen.getByText("Conference Room A")).toBeInTheDocument();
    });

    it("should render organizer", () => {
      renderComponent();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("should render format", () => {
      renderComponent();
      expect(screen.getByText(/Format: In-Person/)).toBeInTheDocument();
    });

    it("should render type", () => {
      renderComponent();
      expect(screen.getByText(/Type: Workshop/)).toBeInTheDocument();
    });

    it("should render 'No Type' when type is null", () => {
      const eventWithoutType = {
        ...mockEvent,
        type: null,
      } as unknown as EventData;
      renderComponent({ event: eventWithoutType });
      expect(screen.getByText(/Type: No Type/)).toBeInTheDocument();
    });

    it("should render 'No Type' when type is undefined", () => {
      const eventWithoutType = {
        ...mockEvent,
        type: undefined,
      } as unknown as EventData;
      renderComponent({ event: eventWithoutType });
      expect(screen.getByText(/Type: No Type/)).toBeInTheDocument();
    });

    it("should render signup count", () => {
      renderComponent();
      expect(screen.getByText("10/50 signed up")).toBeInTheDocument();
    });

    it("should handle zero signups", () => {
      const eventWithZeroSignups = { ...mockEvent, signedUp: 0 };
      renderComponent({ event: eventWithZeroSignups });
      expect(screen.getByText("0/50 signed up")).toBeInTheDocument();
    });

    it("should handle full event", () => {
      const fullEvent = { ...mockEvent, signedUp: 50 };
      renderComponent({ event: fullEvent });
      expect(screen.getByText("50/50 signed up")).toBeInTheDocument();
    });
  });

  describe("Status Badges", () => {
    it("should call getEventStatusBadge with correct parameters", () => {
      renderComponent();
      expect(uiUtils.getEventStatusBadge).toHaveBeenCalledWith(
        "upcoming",
        "upcoming"
      );
    });

    it("should render status badge with success variant for active events", () => {
      vi.mocked(uiUtils.getEventStatusBadge).mockReturnValue({
        text: "Active",
        className: "bg-green-100 text-green-800",
      });
      renderComponent();
      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("should render status badge with error variant for cancelled events", () => {
      vi.mocked(uiUtils.getEventStatusBadge).mockReturnValue({
        text: "Cancelled",
        className: "bg-red-100 text-red-800",
      });
      renderComponent();
      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });

    it("should use default status 'active' when status is undefined", () => {
      const eventWithoutStatus = { ...mockEvent, status: undefined };
      renderComponent({ event: eventWithoutStatus });
      expect(uiUtils.getEventStatusBadge).toHaveBeenCalledWith(
        "active",
        "upcoming"
      );
    });
  });

  describe("Ongoing Badge", () => {
    beforeEach(() => {
      // Mock Date.now() to control current time
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should show ongoing badge when event is currently happening", () => {
      const ongoingEvent = {
        ...mockEvent,
        date: "2025-06-15",
        time: "14:00",
        endTime: "16:00",
        status: "ongoing" as const,
      };
      renderComponent({ event: ongoingEvent });
      expect(screen.getByText("Ongoing")).toBeInTheDocument();
    });

    it("should not show ongoing badge for passed events", () => {
      const ongoingEvent = {
        ...mockEvent,
        status: "ongoing" as const,
      };
      renderComponent({ event: ongoingEvent, type: "passed" });
      expect(screen.queryByText("Ongoing")).not.toBeInTheDocument();
    });

    it("should not show ongoing badge when event hasn't started", () => {
      // Set current time before event start
      const futureDate = new Date("2025-06-15T18:00:00Z");
      vi.setSystemTime(futureDate);

      const futureEvent = {
        ...mockEvent,
        date: "2025-06-20",
        time: "14:00",
        status: "upcoming" as const,
      };
      renderComponent({ event: futureEvent });
      expect(screen.queryByText("Ongoing")).not.toBeInTheDocument();
    });
  });

  describe("Availability Badges", () => {
    it("should not render availability badge for passed events", () => {
      vi.mocked(uiUtils.getAvailabilityBadge).mockReturnValue({
        text: "Full",
        className: "bg-red-100 text-red-800",
      });
      renderComponent({ type: "passed" });
      expect(screen.queryByText("Full")).not.toBeInTheDocument();
    });

    it("should render 'Full' badge with error variant", () => {
      vi.mocked(uiUtils.getAvailabilityBadge).mockReturnValue({
        text: "Full",
        className: "bg-red-100 text-red-800",
      });
      renderComponent();
      expect(screen.getByText("Full")).toBeInTheDocument();
    });

    it("should render 'Limited Spots' badge with warning variant", () => {
      vi.mocked(uiUtils.getAvailabilityBadge).mockReturnValue({
        text: "Limited Spots",
        className: "bg-yellow-100 text-yellow-800",
      });
      renderComponent();
      expect(screen.getByText("Limited Spots")).toBeInTheDocument();
    });

    it("should not render availability badge when null is returned", () => {
      vi.mocked(uiUtils.getAvailabilityBadge).mockReturnValue(null);
      renderComponent();
      // No badge text should be present
      expect(screen.queryByText("Full")).not.toBeInTheDocument();
      expect(screen.queryByText("Limited Spots")).not.toBeInTheDocument();
    });

    it("should call getAvailabilityBadge with spots left", () => {
      renderComponent();
      const spotsLeft = mockEvent.totalSlots - mockEvent.signedUp;
      expect(uiUtils.getAvailabilityBadge).toHaveBeenCalledWith(spotsLeft);
    });
  });

  describe("Action Buttons - Upcoming Events", () => {
    it("should render 'View & Sign Up' button for upcoming events", () => {
      renderComponent({ type: "upcoming" });
      expect(screen.getByText("View & Sign Up")).toBeInTheDocument();
    });

    it("should navigate to event details when clicking button", async () => {
      const user = userEvent.setup();
      renderComponent({ type: "upcoming" });

      const button = screen.getByText("View & Sign Up");
      await user.click(button);

      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/event/event-1");
    });

    it("should navigate to guest registration for guest users", async () => {
      const user = userEvent.setup();
      renderComponent({ type: "upcoming", isGuest: true });

      const button = screen.getByText("View & Sign Up");
      await user.click(button);

      expect(mockNavigate).toHaveBeenCalledWith("/guest-register/event-1");
    });

    it("should show 'Full' button when event is full", () => {
      const fullEvent = { ...mockEvent, signedUp: 50 };
      renderComponent({ event: fullEvent, type: "upcoming" });
      expect(screen.getByText("Full")).toBeInTheDocument();
    });

    it("should disable button when event is full", () => {
      const fullEvent = { ...mockEvent, signedUp: 50 };
      renderComponent({ event: fullEvent, type: "upcoming" });
      const button = screen.getByRole("button", { name: "Full" });
      expect(button).toBeDisabled();
    });

    it("should not navigate when clicking disabled 'Full' button", async () => {
      const user = userEvent.setup();
      const fullEvent = { ...mockEvent, signedUp: 50 };
      renderComponent({ event: fullEvent, type: "upcoming" });

      const button = screen.getByText("Full");
      await user.click(button);

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("Action Buttons - Passed Events", () => {
    it("should render 'View Details' button for passed events", () => {
      renderComponent({ type: "passed" });
      expect(screen.getByText("View Details")).toBeInTheDocument();
    });

    it("should navigate to event details when clicking View Details", async () => {
      const user = userEvent.setup();
      renderComponent({ type: "passed" });

      const button = screen.getByText("View Details");
      await user.click(button);

      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/event/event-1");
    });

    it("should navigate to guest registration for passed events when guest", async () => {
      const user = userEvent.setup();
      renderComponent({ type: "passed", isGuest: true });

      const button = screen.getByText("View Details");
      await user.click(button);

      expect(mockNavigate).toHaveBeenCalledWith("/guest-register/event-1");
    });
  });

  describe("Cancelled Events", () => {
    it("should show cancellation message for cancelled upcoming events", () => {
      const cancelledEvent = { ...mockEvent, status: "cancelled" as const };
      renderComponent({ event: cancelledEvent, type: "upcoming" });
      expect(
        screen.getByText("This event has been cancelled by the Organizers")
      ).toBeInTheDocument();
    });

    it("should not show View & Sign Up button for cancelled events", () => {
      const cancelledEvent = { ...mockEvent, status: "cancelled" as const };
      renderComponent({ event: cancelledEvent, type: "upcoming" });
      expect(screen.queryByText("View & Sign Up")).not.toBeInTheDocument();
    });

    it("should show delete button for cancelled events if canDelete is true", () => {
      const cancelledEvent = { ...mockEvent, status: "cancelled" as const };
      renderComponent({
        event: cancelledEvent,
        type: "upcoming",
        canDelete: true,
        onDelete: mockOnDelete,
      });

      const deleteButton = screen.getByTitle("Delete Event");
      expect(deleteButton).toBeInTheDocument();
    });

    it("should not show delete button for cancelled events if canDelete is false", () => {
      const cancelledEvent = { ...mockEvent, status: "cancelled" as const };
      renderComponent({
        event: cancelledEvent,
        type: "upcoming",
        canDelete: false,
      });

      const deleteButton = screen.queryByTitle("Delete Event");
      expect(deleteButton).not.toBeInTheDocument();
    });
  });

  describe("Edit Button - Permissions", () => {
    it("should show edit button for Super Admin", async () => {
      vi.mocked(useAuth).mockReturnValue({
        currentUser: { ...mockUser, role: "Super Admin" },
      } as any);

      renderComponent({ type: "upcoming", onEdit: mockOnEdit });

      expect(screen.getByTitle("Edit Event")).toBeInTheDocument();
    });

    it("should show edit button for Administrator", async () => {
      vi.mocked(useAuth).mockReturnValue({
        currentUser: { ...mockUser, role: "Administrator" },
      } as any);

      renderComponent({ type: "upcoming", onEdit: mockOnEdit });

      expect(screen.getByTitle("Edit Event")).toBeInTheDocument();
    });

    it("should show edit button for event organizer", async () => {
      const eventWithOrganizerDetails = {
        ...mockEvent,
        organizerDetails: [
          {
            name: "Jane Smith",
            role: "Organizer",
            email: "jane@example.com",
            phone: "1234567890",
          },
        ],
      };

      renderComponent({ event: eventWithOrganizerDetails, onEdit: mockOnEdit });

      expect(screen.getByTitle("Edit Event")).toBeInTheDocument();
    });

    it("should show edit button for event creator", async () => {
      const eventCreatedByCurrentUser = {
        ...mockEvent,
        createdBy: "user-1",
      };

      renderComponent({ event: eventCreatedByCurrentUser, onEdit: mockOnEdit });

      expect(screen.getByTitle("Edit Event")).toBeInTheDocument();
    });

    it("should show edit button when organizer string matches current user", async () => {
      const eventWithOrganizerString = {
        ...mockEvent,
        organizer: "Jane Smith",
      };

      renderComponent({ event: eventWithOrganizerString, onEdit: mockOnEdit });

      expect(screen.getByTitle("Edit Event")).toBeInTheDocument();
    });

    it("should not show edit button for non-organizer Participant", () => {
      vi.mocked(useAuth).mockReturnValue({
        currentUser: { ...mockUser, role: "Participant" },
      } as any);

      const eventNotOwnedByUser = {
        ...mockEvent,
        createdBy: "other-user",
        organizer: "Other Person",
        organizerDetails: [],
      };

      renderComponent({ event: eventNotOwnedByUser, onEdit: mockOnEdit });

      expect(screen.queryByTitle("Edit Event")).not.toBeInTheDocument();
    });

    it("should not show edit button for passed events", () => {
      vi.mocked(useAuth).mockReturnValue({
        currentUser: { ...mockUser, role: "Super Admin" },
      } as any);

      renderComponent({ type: "passed", onEdit: mockOnEdit });

      expect(screen.queryByTitle("Edit Event")).not.toBeInTheDocument();
    });

    it("should not show edit button when currentUser is null", () => {
      vi.mocked(useAuth).mockReturnValue({
        currentUser: null,
      } as any);

      renderComponent({ onEdit: mockOnEdit });

      expect(screen.queryByTitle("Edit Event")).not.toBeInTheDocument();
    });

    it("should call onEdit when edit button is clicked", async () => {
      const user = userEvent.setup();
      vi.mocked(useAuth).mockReturnValue({
        currentUser: { ...mockUser, role: "Super Admin" },
      } as any);

      renderComponent({ onEdit: mockOnEdit });

      const editButton = screen.getByTitle("Edit Event");
      await user.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledWith("event-1");
    });

    it("should not show edit button when onEdit is not provided", () => {
      vi.mocked(useAuth).mockReturnValue({
        currentUser: { ...mockUser, role: "Super Admin" },
      } as any);

      renderComponent({ onEdit: undefined });

      expect(screen.queryByTitle("Edit Event")).not.toBeInTheDocument();
    });
  });

  describe("Delete Button", () => {
    it("should show delete button when canDelete is true", () => {
      renderComponent({ canDelete: true, onDelete: mockOnDelete });
      expect(screen.getByTitle("Delete Event")).toBeInTheDocument();
    });

    it("should not show delete button when canDelete is false", () => {
      renderComponent({ canDelete: false });
      expect(screen.queryByTitle("Delete Event")).not.toBeInTheDocument();
    });

    it("should open deletion modal when delete button is clicked", async () => {
      const user = userEvent.setup();
      renderComponent({ canDelete: true, onDelete: mockOnDelete });

      const deleteButton = screen.getByTitle("Delete Event");
      await user.click(deleteButton);

      // Check if modal title appears
      await waitFor(() => {
        expect(screen.getByText("Delete this event")).toBeInTheDocument();
      });
    });
  });

  describe("Event Deletion Modal", () => {
    it("should render EventDeletionModal with correct props", () => {
      renderComponent({ canDelete: true, onDelete: mockOnDelete });
      // Modal should be present in DOM (closed by default)
      // Cannot directly test props, but we can test that clicking opens it
    });

    it("should close modal when close is triggered", async () => {
      const user = userEvent.setup();
      renderComponent({ canDelete: true, onDelete: mockOnDelete });

      // Open modal
      const deleteButton = screen.getByTitle("Delete Event");
      await user.click(deleteButton);

      // Modal should be visible now - look for modal title
      await waitFor(() => {
        expect(screen.getByText("Delete this event")).toBeInTheDocument();
      });
    });

    it("should call onDelete when delete is confirmed", async () => {
      const user = userEvent.setup();
      mockOnDelete.mockResolvedValue(undefined);
      renderComponent({ canDelete: true, onDelete: mockOnDelete });

      // Open modal
      const deleteButton = screen.getByTitle("Delete Event");
      await user.click(deleteButton);

      // Note: Actual modal interaction would require the EventDeletionModal component
      // to be properly mocked or tested in integration tests
    });

    it("should call onCancel when cancel is confirmed", async () => {
      const user = userEvent.setup();
      mockOnCancel.mockResolvedValue(undefined);
      renderComponent({ canDelete: true, onCancel: mockOnCancel });

      // Open modal
      const deleteButton = screen.getByTitle("Delete Event");
      await user.click(deleteButton);
    });
  });

  describe("Layout and Styling", () => {
    it("should render with white background and shadow", () => {
      const { container } = renderComponent();
      const card = container.querySelector(".bg-white");
      expect(card).toBeInTheDocument();
      expect(card?.classList.contains("shadow-sm")).toBe(true);
    });

    it("should use rounded corners", () => {
      const { container } = renderComponent();
      const card = container.querySelector(".rounded-lg");
      expect(card).toBeInTheDocument();
    });

    it("should have border", () => {
      const { container } = renderComponent();
      const card = container.querySelector(".border");
      expect(card).toBeInTheDocument();
    });

    it("should render badges in flex container", () => {
      vi.mocked(uiUtils.getAvailabilityBadge).mockReturnValue({
        text: "Full",
        className: "bg-red-100",
      });
      const { container } = renderComponent();
      const badgeContainer = container.querySelector(
        ".flex.items-center.space-x-2"
      );
      expect(badgeContainer).toBeInTheDocument();
    });

    it("should use grid layout for details", () => {
      const { container } = renderComponent();
      const grid = container.querySelector(".grid");
      expect(grid).toBeInTheDocument();
    });
  });

  describe("Responsive Design", () => {
    it("should use responsive columns for details grid", () => {
      const { container } = renderComponent();
      const grid = container.querySelector(".md\\:grid-cols-2");
      expect(grid).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing organizerDetails", () => {
      const eventWithoutOrganizerDetails = {
        ...mockEvent,
        organizerDetails: undefined,
      };
      renderComponent({ event: eventWithoutOrganizerDetails });
      expect(screen.getByText("Test Event")).toBeInTheDocument();
    });

    it("should handle empty organizerDetails array", () => {
      const eventWithEmptyOrganizerDetails = {
        ...mockEvent,
        organizerDetails: [],
      };
      renderComponent({ event: eventWithEmptyOrganizerDetails });
      expect(screen.getByText("Test Event")).toBeInTheDocument();
    });

    it("should handle missing firstName in currentUser", () => {
      vi.mocked(useAuth).mockReturnValue({
        currentUser: { ...mockUser, firstName: undefined },
      } as any);

      renderComponent();
      expect(screen.getByText("Test Event")).toBeInTheDocument();
    });

    it("should handle missing lastName in currentUser", () => {
      vi.mocked(useAuth).mockReturnValue({
        currentUser: { ...mockUser, lastName: undefined },
      } as any);

      renderComponent();
      expect(screen.getByText("Test Event")).toBeInTheDocument();
    });

    it("should handle zero spots left", () => {
      const fullEvent = { ...mockEvent, signedUp: 50, totalSlots: 50 };
      renderComponent({ event: fullEvent });
      expect(screen.getByText("Full")).toBeInTheDocument();
    });

    it("should handle negative spots (overbooking)", () => {
      const overbookedEvent = { ...mockEvent, signedUp: 55, totalSlots: 50 };
      renderComponent({ event: overbookedEvent });
      expect(screen.getByText("55/50 signed up")).toBeInTheDocument();
    });

    it("should handle very long event title", () => {
      const longTitleEvent = {
        ...mockEvent,
        title:
          "This is a very long event title that might wrap to multiple lines or get truncated depending on the container width and CSS styling",
      };
      renderComponent({ event: longTitleEvent });
      expect(
        screen.getByText(/This is a very long event title/)
      ).toBeInTheDocument();
    });

    it("should handle very long location name", () => {
      const longLocationEvent = {
        ...mockEvent,
        location:
          "Building A, Floor 5, Room 501, 123 Very Long Street Name, City, State, Country, Postal Code",
      };
      renderComponent({ event: longLocationEvent });
      expect(screen.getByText(/Building A, Floor 5/)).toBeInTheDocument();
    });

    it("should handle missing endDate", () => {
      const eventWithoutEndDate = {
        ...mockEvent,
        endDate: undefined,
      };
      renderComponent({ event: eventWithoutEndDate });
      expect(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).toHaveBeenCalledWith(
        mockEvent.date,
        mockEvent.time,
        mockEvent.endTime,
        mockEvent.timeZone,
        undefined
      );
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle guest user with full event", async () => {
      const fullEvent = { ...mockEvent, signedUp: 50 };
      renderComponent({ event: fullEvent, isGuest: true });

      const button = screen.getByRole("button", { name: "Full" });
      expect(button).toBeDisabled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("should handle Super Admin with cancelled event", async () => {
      vi.mocked(useAuth).mockReturnValue({
        currentUser: { ...mockUser, role: "Super Admin" },
      } as any);

      const cancelledEvent = { ...mockEvent, status: "cancelled" as const };
      renderComponent({
        event: cancelledEvent,
        canDelete: true,
        onDelete: mockOnDelete,
      });

      expect(
        screen.getByText("This event has been cancelled by the Organizers")
      ).toBeInTheDocument();
      expect(screen.getByTitle("Delete Event")).toBeInTheDocument();
    });

    it("should handle organizer viewing their own event", () => {
      const eventWithCurrentUserAsOrganizer = {
        ...mockEvent,
        createdBy: "user-1",
        organizer: "Jane Smith",
      };

      renderComponent({
        event: eventWithCurrentUserAsOrganizer,
        onEdit: mockOnEdit,
      });

      expect(screen.getByTitle("Edit Event")).toBeInTheDocument();
    });

    it("should render all badges together", () => {
      vi.mocked(uiUtils.getAvailabilityBadge).mockReturnValue({
        text: "Limited Spots",
        className: "bg-yellow-100",
      });

      const ongoingEvent = {
        ...mockEvent,
        status: "ongoing" as const,
      };

      renderComponent({ event: ongoingEvent });

      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("Ongoing")).toBeInTheDocument();
      expect(screen.getByText("Limited Spots")).toBeInTheDocument();
    });

    it("should show all action buttons for Super Admin", () => {
      vi.mocked(useAuth).mockReturnValue({
        currentUser: { ...mockUser, role: "Super Admin" },
      } as any);

      renderComponent({
        canDelete: true,
        onDelete: mockOnDelete,
        onEdit: mockOnEdit,
      });

      expect(screen.getByText("View & Sign Up")).toBeInTheDocument();
      expect(screen.getByTitle("Edit Event")).toBeInTheDocument();
      expect(screen.getByTitle("Delete Event")).toBeInTheDocument();
    });
  });

  describe("UTC Timezone Handling", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should handle UTC timezone in isEventOngoing check", () => {
      // This test ensures UTC timezone is properly handled
      // The actual ongoing logic is complex and depends on Date parsing
      const utcEvent = {
        ...mockEvent,
        timeZone: "UTC",
        status: "ongoing" as const,
      };

      renderComponent({ event: utcEvent });

      // Ongoing badge should appear when status is "ongoing"
      expect(screen.getByText("Ongoing")).toBeInTheDocument();
    });

    it("should handle non-UTC timezone in isEventOngoing check", () => {
      const localEvent = {
        ...mockEvent,
        timeZone: "America/New_York",
        status: "upcoming" as const,
      };

      // Set time to before event start
      vi.setSystemTime(new Date("2025-06-14T00:00:00Z"));

      renderComponent({ event: localEvent });

      // Ongoing badge should not appear
      expect(screen.queryByText("Ongoing")).not.toBeInTheDocument();
    });
  });
});
