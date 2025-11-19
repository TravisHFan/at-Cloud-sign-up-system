/**
 * EventStatsCards Component Tests
 *
 * Tests the EventStatsCards component for displaying event statistics:
 * - Upcoming events stats (Total Events, Registered, Available Spots)
 * - Passed events stats (Total Events, Completed, Total Signups)
 * - Loading states
 * - Edge cases and null handling
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EventStatsCards from "../EventStatsCards";
import type { EventStats } from "../../../types/event";

describe("EventStatsCards", () => {
  describe("Upcoming Events", () => {
    const upcomingStats: EventStats = {
      totalEvents: 15,
      totalParticipants: 250,
      availableSpots: 100,
      completedEvents: 0,
    };

    it("should render total events card", () => {
      render(<EventStatsCards stats={upcomingStats} type="upcoming" />);

      expect(screen.getByText("Total Events")).toBeInTheDocument();
      expect(screen.getByText("15")).toBeInTheDocument();
    });

    it("should render registered participants card", () => {
      render(<EventStatsCards stats={upcomingStats} type="upcoming" />);

      expect(screen.getByText("Registered")).toBeInTheDocument();
      expect(screen.getByText("250")).toBeInTheDocument();
    });

    it("should render available spots card", () => {
      render(<EventStatsCards stats={upcomingStats} type="upcoming" />);

      expect(screen.getByText("Available Spots")).toBeInTheDocument();
      expect(screen.getByText("100")).toBeInTheDocument();
    });

    it("should display all three cards in grid layout", () => {
      const { container } = render(
        <EventStatsCards stats={upcomingStats} type="upcoming" />
      );

      const grid = container.querySelector(".grid");
      expect(grid).toBeInTheDocument();
      expect(grid?.classList.contains("md:grid-cols-3")).toBe(true);

      const cards = container.querySelectorAll(
        ".bg-white.rounded-lg.shadow-sm"
      );
      expect(cards).toHaveLength(3);
    });

    it("should render calendar icon for total events", () => {
      const { container } = render(
        <EventStatsCards stats={upcomingStats} type="upcoming" />
      );

      const blueIcon = container.querySelector(".bg-blue-100");
      expect(blueIcon).toBeInTheDocument();
    });

    it("should render people icon for registered", () => {
      const { container } = render(
        <EventStatsCards stats={upcomingStats} type="upcoming" />
      );

      const greenIcon = container.querySelector(".bg-green-100");
      expect(greenIcon).toBeInTheDocument();
    });

    it("should render building icon for available spots", () => {
      const { container } = render(
        <EventStatsCards stats={upcomingStats} type="upcoming" />
      );

      const orangeIcon = container.querySelector(".bg-orange-100");
      expect(orangeIcon).toBeInTheDocument();
    });

    it("should handle zero values", () => {
      const zeroStats: EventStats = {
        totalEvents: 0,
        totalParticipants: 0,
        availableSpots: 0,
        completedEvents: 0,
      };

      render(<EventStatsCards stats={zeroStats} type="upcoming" />);

      const zeros = screen.getAllByText("0");
      expect(zeros).toHaveLength(3);
    });

    it("should handle undefined values with fallback to 0", () => {
      const partialStats: EventStats = {
        totalEvents: undefined as any,
        totalParticipants: undefined as any,
        availableSpots: undefined as any,
        completedEvents: 0,
      };

      render(<EventStatsCards stats={partialStats} type="upcoming" />);

      const zeros = screen.getAllByText("0");
      expect(zeros).toHaveLength(3);
    });

    it("should display large numbers correctly", () => {
      const largeStats: EventStats = {
        totalEvents: 999,
        totalParticipants: 10000,
        availableSpots: 5000,
        completedEvents: 0,
      };

      render(<EventStatsCards stats={largeStats} type="upcoming" />);

      expect(screen.getByText("999")).toBeInTheDocument();
      expect(screen.getByText("10000")).toBeInTheDocument();
      expect(screen.getByText("5000")).toBeInTheDocument();
    });
  });

  describe("Passed Events", () => {
    const passedStats: EventStats = {
      totalEvents: 50,
      totalParticipants: 800,
      availableSpots: 0,
      completedEvents: 45,
    };

    it("should render total events card", () => {
      render(<EventStatsCards stats={passedStats} type="passed" />);

      expect(screen.getByText("Total Events")).toBeInTheDocument();
      expect(screen.getByText("50")).toBeInTheDocument();
    });

    it("should render completed events card", () => {
      render(<EventStatsCards stats={passedStats} type="passed" />);

      expect(screen.getByText("Completed")).toBeInTheDocument();
      expect(screen.getByText("45")).toBeInTheDocument();
    });

    it("should render total signups card", () => {
      render(<EventStatsCards stats={passedStats} type="passed" />);

      expect(screen.getByText("Total Signups")).toBeInTheDocument();
      expect(screen.getByText("800")).toBeInTheDocument();
    });

    it("should display all three cards in grid layout", () => {
      const { container } = render(
        <EventStatsCards stats={passedStats} type="passed" />
      );

      const cards = container.querySelectorAll(
        ".bg-white.rounded-lg.shadow-sm"
      );
      expect(cards).toHaveLength(3);
    });

    it("should render calendar icon for total events", () => {
      const { container } = render(
        <EventStatsCards stats={passedStats} type="passed" />
      );

      const blueIcon = container.querySelector(".bg-blue-100");
      expect(blueIcon).toBeInTheDocument();
    });

    it("should render checkmark icon for completed", () => {
      const { container } = render(
        <EventStatsCards stats={passedStats} type="passed" />
      );

      const greenIcon = container.querySelector(".bg-green-100");
      expect(greenIcon).toBeInTheDocument();
    });

    it("should render people icon for total signups", () => {
      const { container } = render(
        <EventStatsCards stats={passedStats} type="passed" />
      );

      const orangeIcon = container.querySelector(".bg-orange-100");
      expect(orangeIcon).toBeInTheDocument();
    });

    it("should handle all events completed scenario", () => {
      const allCompleted: EventStats = {
        totalEvents: 25,
        totalParticipants: 500,
        availableSpots: 0,
        completedEvents: 25,
      };

      render(<EventStatsCards stats={allCompleted} type="passed" />);

      // Both total events and completed events show 25
      const twentyFiveElements = screen.getAllByText("25");
      expect(twentyFiveElements).toHaveLength(2);
      expect(screen.getByText("500")).toBeInTheDocument();
    });

    it("should handle partial completion scenario", () => {
      const partialComplete: EventStats = {
        totalEvents: 100,
        totalParticipants: 2000,
        availableSpots: 0,
        completedEvents: 75,
      };

      render(<EventStatsCards stats={partialComplete} type="passed" />);

      expect(screen.getByText("100")).toBeInTheDocument();
      expect(screen.getByText("75")).toBeInTheDocument();
      expect(screen.getByText("2000")).toBeInTheDocument();
    });
  });

  describe("Loading State", () => {
    it("should render loading skeleton when stats is null", () => {
      const { container } = render(
        <EventStatsCards stats={null as any} type="upcoming" />
      );

      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons).toHaveLength(3);
    });

    it("should render loading skeleton when stats is undefined", () => {
      const { container } = render(
        <EventStatsCards stats={undefined as any} type="upcoming" />
      );

      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons).toHaveLength(3);
    });

    it("should have gray placeholder elements in loading state", () => {
      const { container } = render(
        <EventStatsCards stats={null as any} type="upcoming" />
      );

      const placeholders = container.querySelectorAll(".bg-gray-200");
      expect(placeholders.length).toBeGreaterThan(0);
    });

    it("should maintain grid layout in loading state", () => {
      const { container } = render(
        <EventStatsCards stats={null as any} type="upcoming" />
      );

      const grid = container.querySelector(".grid");
      expect(grid).toBeInTheDocument();
      expect(grid?.classList.contains("md:grid-cols-3")).toBe(true);
    });
  });

  describe("Type Switching", () => {
    const stats: EventStats = {
      totalEvents: 30,
      totalParticipants: 500,
      availableSpots: 200,
      completedEvents: 25,
    };

    it("should show different labels for upcoming vs passed", () => {
      const { rerender } = render(
        <EventStatsCards stats={stats} type="upcoming" />
      );

      expect(screen.getByText("Registered")).toBeInTheDocument();
      expect(screen.getByText("Available Spots")).toBeInTheDocument();
      expect(screen.queryByText("Completed")).not.toBeInTheDocument();
      expect(screen.queryByText("Total Signups")).not.toBeInTheDocument();

      rerender(<EventStatsCards stats={stats} type="passed" />);

      expect(screen.queryByText("Registered")).not.toBeInTheDocument();
      expect(screen.queryByText("Available Spots")).not.toBeInTheDocument();
      expect(screen.getByText("Completed")).toBeInTheDocument();
      expect(screen.getByText("Total Signups")).toBeInTheDocument();
    });

    it("should display same totalEvents value for both types", () => {
      const { rerender } = render(
        <EventStatsCards stats={stats} type="upcoming" />
      );

      expect(screen.getByText("30")).toBeInTheDocument();

      rerender(<EventStatsCards stats={stats} type="passed" />);

      expect(screen.getByText("30")).toBeInTheDocument();
    });

    it("should use totalParticipants for different labels", () => {
      const { rerender } = render(
        <EventStatsCards stats={stats} type="upcoming" />
      );

      let participantsSection = screen.getByText("500").closest("div");
      expect(participantsSection?.textContent).toContain("Registered");

      rerender(<EventStatsCards stats={stats} type="passed" />);

      participantsSection = screen.getByText("500").closest("div");
      expect(participantsSection?.textContent).toContain("Total Signups");
    });
  });

  describe("Styling and Layout", () => {
    const stats: EventStats = {
      totalEvents: 10,
      totalParticipants: 100,
      availableSpots: 50,
      completedEvents: 8,
    };

    it("should apply rounded corners to cards", () => {
      const { container } = render(
        <EventStatsCards stats={stats} type="upcoming" />
      );

      const cards = container.querySelectorAll(".rounded-lg");
      expect(cards.length).toBeGreaterThanOrEqual(3);
    });

    it("should apply shadow to cards", () => {
      const { container } = render(
        <EventStatsCards stats={stats} type="upcoming" />
      );

      const cards = container.querySelectorAll(".shadow-sm");
      expect(cards.length).toBeGreaterThanOrEqual(3);
    });

    it("should apply padding to cards", () => {
      const { container } = render(
        <EventStatsCards stats={stats} type="upcoming" />
      );

      const cards = container.querySelectorAll(".p-6");
      expect(cards.length).toBeGreaterThanOrEqual(3);
    });

    it("should use consistent icon background colors", () => {
      const { container } = render(
        <EventStatsCards stats={stats} type="upcoming" />
      );

      expect(container.querySelector(".bg-blue-100")).toBeInTheDocument();
      expect(container.querySelector(".bg-green-100")).toBeInTheDocument();
      expect(container.querySelector(".bg-orange-100")).toBeInTheDocument();
    });

    it("should display numbers in bold", () => {
      const { container } = render(
        <EventStatsCards stats={stats} type="upcoming" />
      );

      const boldNumbers = container.querySelectorAll(".font-bold.text-2xl");
      expect(boldNumbers).toHaveLength(3);
    });

    it("should display labels in medium font", () => {
      const { container } = render(
        <EventStatsCards stats={stats} type="upcoming" />
      );

      const labels = container.querySelectorAll(".font-medium.text-sm");
      expect(labels).toHaveLength(3);
    });
  });

  describe("Edge Cases", () => {
    it("should handle negative numbers (edge case)", () => {
      const negativeStats: EventStats = {
        totalEvents: -5,
        totalParticipants: -10,
        availableSpots: -20,
        completedEvents: -3,
      };

      render(<EventStatsCards stats={negativeStats} type="upcoming" />);

      expect(screen.getByText("-5")).toBeInTheDocument();
      expect(screen.getByText("-10")).toBeInTheDocument();
      expect(screen.getByText("-20")).toBeInTheDocument();
    });

    it("should handle very large numbers", () => {
      const largeStats: EventStats = {
        totalEvents: 999999,
        totalParticipants: 1000000,
        availableSpots: 500000,
        completedEvents: 800000,
      };

      render(<EventStatsCards stats={largeStats} type="upcoming" />);

      expect(screen.getByText("999999")).toBeInTheDocument();
      expect(screen.getByText("1000000")).toBeInTheDocument();
    });

    it("should handle decimal numbers by displaying as-is", () => {
      const decimalStats: EventStats = {
        totalEvents: 10.5 as any,
        totalParticipants: 100.75 as any,
        availableSpots: 50.25 as any,
        completedEvents: 8.5 as any,
      };

      render(<EventStatsCards stats={decimalStats} type="upcoming" />);

      expect(screen.getByText("10.5")).toBeInTheDocument();
      expect(screen.getByText("100.75")).toBeInTheDocument();
    });

    it("should render correctly with mixed valid and undefined values", () => {
      const mixedStats: EventStats = {
        totalEvents: 15,
        totalParticipants: undefined as any,
        availableSpots: 30,
        completedEvents: 0,
      };

      render(<EventStatsCards stats={mixedStats} type="upcoming" />);

      expect(screen.getByText("15")).toBeInTheDocument();
      expect(screen.getByText("0")).toBeInTheDocument();
      expect(screen.getByText("30")).toBeInTheDocument();
    });

    it("should handle all zero stats", () => {
      const zeroStats: EventStats = {
        totalEvents: 0,
        totalParticipants: 0,
        availableSpots: 0,
        completedEvents: 0,
      };

      render(<EventStatsCards stats={zeroStats} type="passed" />);

      const allZeros = screen.getAllByText("0");
      expect(allZeros).toHaveLength(3);
    });
  });

  describe("Responsive Design", () => {
    it("should have mobile-first single column grid", () => {
      const { container } = render(
        <EventStatsCards
          stats={{
            totalEvents: 10,
            totalParticipants: 100,
            availableSpots: 50,
            completedEvents: 8,
          }}
          type="upcoming"
        />
      );

      const grid = container.querySelector(".grid");
      expect(grid?.classList.contains("grid-cols-1")).toBe(true);
    });

    it("should have md breakpoint for 3 columns", () => {
      const { container } = render(
        <EventStatsCards
          stats={{
            totalEvents: 10,
            totalParticipants: 100,
            availableSpots: 50,
            completedEvents: 8,
          }}
          type="upcoming"
        />
      );

      const grid = container.querySelector(".grid");
      expect(grid?.classList.contains("md:grid-cols-3")).toBe(true);
    });

    it("should have gap between cards", () => {
      const { container } = render(
        <EventStatsCards
          stats={{
            totalEvents: 10,
            totalParticipants: 100,
            availableSpots: 50,
            completedEvents: 8,
          }}
          type="upcoming"
        />
      );

      const grid = container.querySelector(".grid");
      expect(grid?.classList.contains("gap-6")).toBe(true);
    });
  });
});
