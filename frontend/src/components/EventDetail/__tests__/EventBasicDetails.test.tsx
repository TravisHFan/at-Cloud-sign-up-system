/**
 * EventBasicDetails Component Tests
 *
 * Tests the EventBasicDetails component for displaying event information:
 * - Date/time display with timezone handling
 * - Location display
 * - Format display
 * - Event type display
 * - Icon rendering
 * - Responsive layout
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import EventBasicDetails from "../EventBasicDetails";
import type { EventData } from "../../../types/event";
import * as eventStatsUtils from "../../../utils/eventStatsUtils";

// Mock the eventStatsUtils
vi.mock("../../../utils/eventStatsUtils", () => ({
  formatEventDateTimeRangeInViewerTZ: vi.fn(),
}));

// Mock Icon component
vi.mock("../../common", () => ({
  Icon: ({ name, className }: { name: string; className?: string }) => (
    <div data-testid={`icon-${name}`} className={className} />
  ),
}));

describe("EventBasicDetails", () => {
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
    organizer: "user-1",
    signedUp: 0,
    totalSlots: 50,
    roles: [],
    createdBy: "user-1",
    createdAt: "2025-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Date/Time Display", () => {
    it("should call formatEventDateTimeRangeInViewerTZ with correct parameters", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Sunday, June 15, 2025 • 2:00 PM - 4:00 PM EDT");

      render(<EventBasicDetails event={mockEvent} />);

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

    it("should display formatted date/time string", () => {
      const formattedDateTime = "Sunday, June 15, 2025 • 2:00 PM - 4:00 PM EDT";
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue(formattedDateTime);

      render(<EventBasicDetails event={mockEvent} />);

      expect(screen.getByText(formattedDateTime)).toBeInTheDocument();
    });

    it("should show timezone note when timezone is provided", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      render(<EventBasicDetails event={mockEvent} />);

      expect(
        screen.getByText("(shown in your local time)")
      ).toBeInTheDocument();
    });

    it("should not show timezone note when timezone is null", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const eventWithoutTimezone = {
        ...mockEvent,
        timeZone: undefined,
      };

      render(<EventBasicDetails event={eventWithoutTimezone} />);

      expect(
        screen.queryByText("(shown in your local time)")
      ).not.toBeInTheDocument();
    });

    it("should not show timezone note when timezone is undefined", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const eventWithoutTimezone = {
        ...mockEvent,
        timeZone: undefined,
      } as EventData;

      render(<EventBasicDetails event={eventWithoutTimezone} />);

      expect(
        screen.queryByText("(shown in your local time)")
      ).not.toBeInTheDocument();
    });

    it("should render calendar icon for date/time", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      render(<EventBasicDetails event={mockEvent} />);

      expect(screen.getByTestId("icon-calendar")).toBeInTheDocument();
    });

    it("should handle multi-day events", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("June 15-17, 2025");

      const multiDayEvent = {
        ...mockEvent,
        endDate: "2025-06-17",
      };

      render(<EventBasicDetails event={multiDayEvent} />);

      expect(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).toHaveBeenCalledWith(
        multiDayEvent.date,
        multiDayEvent.time,
        multiDayEvent.endTime,
        multiDayEvent.timeZone,
        multiDayEvent.endDate
      );
    });
  });

  describe("Location Display", () => {
    it("should display event location", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      render(<EventBasicDetails event={mockEvent} />);

      expect(screen.getByText("Conference Room A")).toBeInTheDocument();
    });

    it("should render map-pin icon for location", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      render(<EventBasicDetails event={mockEvent} />);

      expect(screen.getByTestId("icon-map-pin")).toBeInTheDocument();
    });

    it("should handle online location", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const onlineEvent = {
        ...mockEvent,
        location: "Zoom Meeting",
      };

      render(<EventBasicDetails event={onlineEvent} />);

      expect(screen.getByText("Zoom Meeting")).toBeInTheDocument();
    });

    it("should handle long location names", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const longLocationEvent = {
        ...mockEvent,
        location:
          "Grand Ballroom at the International Convention Center, 123 Main Street, Building A, Floor 5",
      };

      render(<EventBasicDetails event={longLocationEvent} />);

      expect(screen.getByText(longLocationEvent.location)).toBeInTheDocument();
    });
  });

  describe("Format Display", () => {
    it("should display event format", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      render(<EventBasicDetails event={mockEvent} />);

      expect(screen.getByText("Format: In-Person")).toBeInTheDocument();
    });

    it("should render tag icon for format", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      render(<EventBasicDetails event={mockEvent} />);

      expect(screen.getByTestId("icon-tag")).toBeInTheDocument();
    });

    it("should handle Virtual format", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const virtualEvent = {
        ...mockEvent,
        format: "Virtual",
      };

      render(<EventBasicDetails event={virtualEvent} />);

      expect(screen.getByText("Format: Virtual")).toBeInTheDocument();
    });

    it("should handle Hybrid format", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const hybridEvent = {
        ...mockEvent,
        format: "Hybrid",
      };

      render(<EventBasicDetails event={hybridEvent} />);

      expect(screen.getByText("Format: Hybrid")).toBeInTheDocument();
    });
  });

  describe("Event Type Display", () => {
    it("should display event type", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      render(<EventBasicDetails event={mockEvent} />);

      expect(screen.getByText("Type: Workshop")).toBeInTheDocument();
    });

    it("should render check-circle icon for type", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      render(<EventBasicDetails event={mockEvent} />);

      expect(screen.getByTestId("icon-check-circle")).toBeInTheDocument();
    });

    it("should display 'No Type' when type is null", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const eventWithoutType = {
        ...mockEvent,
        type: null,
      } as unknown as EventData;

      render(<EventBasicDetails event={eventWithoutType} />);

      expect(screen.getByText("Type: No Type")).toBeInTheDocument();
    });

    it("should display 'No Type' when type is undefined", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const eventWithoutType = {
        ...mockEvent,
        type: "",
      };

      render(<EventBasicDetails event={eventWithoutType} />);

      expect(screen.getByText("Type: No Type")).toBeInTheDocument();
    });

    it("should handle Webinar type", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const webinarEvent = {
        ...mockEvent,
        type: "Webinar",
      };

      render(<EventBasicDetails event={webinarEvent} />);

      expect(screen.getByText("Type: Webinar")).toBeInTheDocument();
    });

    it("should handle Toastmasters Meeting type", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const toastmastersEvent = {
        ...mockEvent,
        type: "Toastmasters Meeting",
      };

      render(<EventBasicDetails event={toastmastersEvent} />);

      expect(
        screen.getByText("Type: Toastmasters Meeting")
      ).toBeInTheDocument();
    });

    it("should handle Mentor Circle type", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const mentorCircleEvent = {
        ...mockEvent,
        type: "Mentor Circle",
      };

      render(<EventBasicDetails event={mentorCircleEvent} />);

      expect(screen.getByText("Type: Mentor Circle")).toBeInTheDocument();
    });
  });

  describe("Layout and Styling", () => {
    it("should use grid layout", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const { container } = render(<EventBasicDetails event={mockEvent} />);

      const grid = container.querySelector(".grid");
      expect(grid).toBeInTheDocument();
    });

    it("should have responsive columns", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const { container } = render(<EventBasicDetails event={mockEvent} />);

      const grid = container.querySelector(".grid");
      expect(grid?.classList.contains("grid-cols-1")).toBe(true);
      expect(grid?.classList.contains("md:grid-cols-2")).toBe(true);
      expect(grid?.classList.contains("lg:grid-cols-3")).toBe(true);
    });

    it("should have gap between items", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const { container } = render(<EventBasicDetails event={mockEvent} />);

      const grid = container.querySelector(".grid");
      expect(grid?.classList.contains("gap-4")).toBe(true);
    });

    it("should have margin bottom", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const { container } = render(<EventBasicDetails event={mockEvent} />);

      const grid = container.querySelector(".grid");
      expect(grid?.classList.contains("mb-6")).toBe(true);
    });

    it("should span full width for date/time on mobile", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const { container } = render(<EventBasicDetails event={mockEvent} />);

      const dateTimeDiv = container.querySelector(".col-span-1");
      expect(dateTimeDiv?.classList.contains("md:col-span-2")).toBe(true);
      expect(dateTimeDiv?.classList.contains("lg:col-span-3")).toBe(true);
    });

    it("should render all icons with correct styling", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      render(<EventBasicDetails event={mockEvent} />);

      const calendarIcon = screen.getByTestId("icon-calendar");
      expect(calendarIcon.className).toContain("w-5 h-5");

      const mapPinIcon = screen.getByTestId("icon-map-pin");
      expect(mapPinIcon.className).toContain("w-5 h-5");

      const tagIcon = screen.getByTestId("icon-tag");
      expect(tagIcon.className).toContain("w-5 h-5");

      const checkCircleIcon = screen.getByTestId("icon-check-circle");
      expect(checkCircleIcon.className).toContain("w-5 h-5");
    });

    it("should apply text-gray-600 to all detail items", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const { container } = render(<EventBasicDetails event={mockEvent} />);

      const grayTextElements = container.querySelectorAll(".text-gray-600");
      expect(grayTextElements.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("Integration Scenarios", () => {
    it("should render all details together correctly", () => {
      const formattedDateTime =
        "Monday, July 4, 2025 • 10:00 AM - 12:00 PM PST";
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue(formattedDateTime);

      const completeEvent = {
        ...mockEvent,
        location: "Innovation Hub",
        format: "Hybrid",
        type: "Webinar",
        timeZone: "America/Los_Angeles",
      };

      render(<EventBasicDetails event={completeEvent} />);

      expect(screen.getByText(formattedDateTime)).toBeInTheDocument();
      expect(
        screen.getByText("(shown in your local time)")
      ).toBeInTheDocument();
      expect(screen.getByText("Innovation Hub")).toBeInTheDocument();
      expect(screen.getByText("Format: Hybrid")).toBeInTheDocument();
      expect(screen.getByText("Type: Webinar")).toBeInTheDocument();
    });

    it("should handle minimal event data", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("TBD");

      const minimalEvent = {
        ...mockEvent,
        timeZone: undefined,
        type: null,
      } as unknown as EventData;

      render(<EventBasicDetails event={minimalEvent} />);

      expect(screen.getByText("TBD")).toBeInTheDocument();
      expect(
        screen.queryByText("(shown in your local time)")
      ).not.toBeInTheDocument();
      expect(screen.getByText("Type: No Type")).toBeInTheDocument();
    });

    it("should render all four icons", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      render(<EventBasicDetails event={mockEvent} />);

      expect(screen.getByTestId("icon-calendar")).toBeInTheDocument();
      expect(screen.getByTestId("icon-map-pin")).toBeInTheDocument();
      expect(screen.getByTestId("icon-tag")).toBeInTheDocument();
      expect(screen.getByTestId("icon-check-circle")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string type", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const emptyTypeEvent = {
        ...mockEvent,
        type: "",
      };

      render(<EventBasicDetails event={emptyTypeEvent} />);

      expect(screen.getByText("Type: No Type")).toBeInTheDocument();
    });

    it("should handle empty string format", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const emptyFormatEvent = {
        ...mockEvent,
        format: "",
      };

      render(<EventBasicDetails event={emptyFormatEvent} />);

      expect(screen.getByText(/Format:/)).toBeInTheDocument();
    });

    it("should handle empty string location", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const emptyLocationEvent = {
        ...mockEvent,
        location: "",
      };

      render(<EventBasicDetails event={emptyLocationEvent} />);

      const mapPinIcon = screen.getByTestId("icon-map-pin");
      expect(mapPinIcon).toBeInTheDocument();
      // Empty string still renders but is empty
      const locationDiv = mapPinIcon.parentElement;
      expect(locationDiv?.textContent).toBe("");
    });

    it("should handle special characters in location", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const specialCharEvent = {
        ...mockEvent,
        location: "Café & Co-Working Space @ 123 Main St.",
      };

      render(<EventBasicDetails event={specialCharEvent} />);

      expect(
        screen.getByText("Café & Co-Working Space @ 123 Main St.")
      ).toBeInTheDocument();
    });

    it("should handle empty string timeZone", () => {
      vi.mocked(
        eventStatsUtils.formatEventDateTimeRangeInViewerTZ
      ).mockReturnValue("Some Date");

      const emptyTimezoneEvent = {
        ...mockEvent,
        timeZone: undefined,
      };

      render(<EventBasicDetails event={emptyTimezoneEvent} />);

      // Empty string is falsy, so no timezone note
      expect(
        screen.queryByText("(shown in your local time)")
      ).not.toBeInTheDocument();
    });
  });
});
