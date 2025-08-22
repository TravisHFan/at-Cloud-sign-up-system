import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

// Mock auth to allow access to Analytics page
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: { id: "admin", role: "Administrator" } }),
}));

// Mock users/role stats (not under test here)
vi.mock("../../hooks/useUserData", () => ({
  useUserData: () => ({ users: [] }),
}));
vi.mock("../../hooks/useRoleStats", () => ({
  useRoleStats: () => ({
    total: 0,
    superAdmin: 0,
    administrators: 0,
    leaders: 0,
    participants: 0,
    atCloudLeaders: 0,
  }),
}));

// Mock backend analytics hook to provide events with registrations-only payload
vi.mock("../../hooks/useBackendIntegration", () => ({
  useAnalyticsData: () => ({
    eventAnalytics: {
      upcomingEvents: [
        {
          id: "evt-1",
          title: "Event One",
          format: "online",
          roles: [
            {
              id: "r1",
              name: "Participant",
              maxParticipants: 10,
              registrations: [
                {
                  userId: "u1",
                  user: {
                    id: "u1",
                    username: "user1",
                    firstName: "John",
                    lastName: "Doe",
                    systemAuthorizationLevel: "Leader",
                  },
                },
                {
                  userId: "u2",
                  user: {
                    id: "u2",
                    username: "user2",
                    firstName: "Jane",
                    lastName: "Smith",
                    systemAuthorizationLevel: "Participant",
                  },
                },
              ],
            },
          ],
        },
      ],
      completedEvents: [
        {
          id: "evt-2",
          title: "Event Two",
          format: "in-person",
          roles: [
            {
              id: "r1",
              name: "Participant",
              maxParticipants: 10,
              registrations: [
                {
                  userId: "u1",
                  user: {
                    id: "u1",
                    username: "user1",
                    firstName: "John",
                    lastName: "Doe",
                    systemAuthorizationLevel: "Leader",
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  }),
}));

import Analytics from "../../pages/Analytics";

describe("Analytics engagement fallbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Most Active Participants and Engagement Summary using registrations", async () => {
    render(<Analytics />);

    // Most Active Participants should show John Doe with 2 events
    const mostActiveHeading = await screen.findByText(
      /Most Active Participants/i
    );
    expect(mostActiveHeading).toBeInTheDocument();

    const listRegion = mostActiveHeading.closest("div") as HTMLElement;
    expect(listRegion).toBeTruthy();
    const john = screen.getByText("John Doe");
    expect(john).toBeInTheDocument();

    // The events badge may be a sibling rather than a direct descendant; search within the Most Active section
    expect(
      within(listRegion as HTMLElement).getByText(/2 events/i)
    ).toBeInTheDocument();

    // Engagement Summary
    const engagementHeading = screen.getByText(/Engagement Summary/i);
    expect(engagementHeading).toBeInTheDocument();
    const engagementSection = engagementHeading.closest("div") as HTMLElement;
    expect(engagementSection).toBeTruthy();

    // Total Role Signups = 3 (two in evt-1 + one in evt-2)
    expect(
      within(engagementSection).getByText(/Total Role Signups:/i)
    ).toBeInTheDocument();
    expect(within(engagementSection).getByText(/3\b/)).toBeInTheDocument();

    // Unique Participants = 2 (u1, u2)
    const uniqueRow = within(engagementSection).getByText(
      /Unique Participants:/i
    ).parentElement as HTMLElement;
    expect(uniqueRow).toBeTruthy();
    expect(within(uniqueRow).getByText(/^2$/)).toBeInTheDocument();

    // Total Unique Events = 2 (evt-1, evt-2)
    const totalEventsRow = within(engagementSection).getByText(
      /Total Unique Events:/i
    ).parentElement as HTMLElement;
    expect(totalEventsRow).toBeTruthy();
    expect(within(totalEventsRow).getByText(/^2$/)).toBeInTheDocument();

    // Avg. Roles per Participant = 1.5
    expect(
      within(engagementSection).getByText(/Avg\. Roles per Participant:/i)
    ).toBeInTheDocument();
    expect(within(engagementSection).getByText(/1\.5/)).toBeInTheDocument();
  });
});
