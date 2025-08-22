import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MinistryStatsCard from "../../components/common/MinistryStatsCard";

// Mock API analytics service used inside component
vi.mock("../../services/api", () => {
  const analyticsService = {
    getEventAnalytics: vi.fn().mockResolvedValue({
      upcomingEvents: [
        {
          id: "evt-1",
          roles: [
            { id: "r1", maxParticipants: 5, registrations: [{ userId: "u1" }] },
            { id: "r2", maxParticipants: 5, currentCount: 2 },
          ],
        },
      ],
      completedEvents: [
        {
          id: "evt-2",
          roles: [
            {
              id: "r1",
              maxParticipants: 10,
              registrations: [{ userId: "u2" }, { userId: "u3" }],
            },
          ],
        },
      ],
    }),
  };
  return { analyticsService };
});

describe("MinistryStatsCard totals", () => {
  it("shows non-zero Total Signups and correct Available Spots using fallbacks", async () => {
    render(<MinistryStatsCard />);

    // Wait for stats to render by checking a known label appears
    const totalEventsLabel = await screen.findByText(/Total Events/i);
    expect(totalEventsLabel).toBeInTheDocument();

    // Total Events = 2
    expect(screen.getByText(/^2$/)).toBeInTheDocument();

    // Total Signups (upcoming only in component) = registrations(1) + currentCount(2) = 3
    // Fallback: simply assert the value 3 is somewhere after render
    expect(screen.getAllByText(/^3$/).length).toBeGreaterThan(0);

    // Available Spots is computed from upcoming events only: (5 + 5) - 3 = 7
    const availableLabel = screen.getByText(/Available Spots/i);
    expect(availableLabel).toBeInTheDocument();
    expect(screen.getAllByText(/^7$/).length).toBeGreaterThan(0);
  });
});
