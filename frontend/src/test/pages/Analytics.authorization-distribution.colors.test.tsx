import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Analytics from "../../pages/Analytics";
import { NotificationProvider } from "../../contexts/NotificationModalContext";

// Auth mock granting access
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: { id: "u1", role: "Super Admin" },
    isAuthenticated: true,
    isLoading: false,
    canCreateEvents: true,
    canManageUsers: true,
    hasRole: () => true,
  }),
}));

// Socket service noop
vi.mock("../../services/socketService", () => ({
  socketService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    joinEventRoom: vi.fn(),
    leaveEventRoom: vi.fn(),
  },
}));

// Mock analytics data hook
vi.mock("../../hooks/useBackendIntegration", () => ({
  useAnalyticsData: () => ({
    isLoading: false,
    isError: false,
    error: null,
    eventAnalytics: {
      upcomingEvents: 0,
      passedEvents: 0,
      totalEvents: 0,
      upcomingStats: {
        totalSlots: 0,
        signedUp: 0,
        availableSlots: 0,
        fillRate: 0,
      },
      passedStats: { totalSlots: 0, signedUp: 0, fillRate: 0 },
      averageSignupRate: 0,
      formatStats: { "In-person": 3 },
      mostActiveParticipants: [],
      engagementStats: { low: 0, medium: 0, high: 0, elite: 0 },
    },
    users: [],
    roleStats: {
      superAdmin: 1,
      administrators: 2,
      leaders: 3,
      guestExperts: 4,
      participants: 5,
      atCloudLeaders: 6,
    },
    engagementMetrics: {
      mostActiveUsers: [],
      distribution: {},
      averageEngagement: 0,
    },
  }),
}));

describe("Analytics Authorization Distribution styling & icons", () => {
  it("renders colored badges and an icon for each role row", () => {
    render(
      <MemoryRouter>
        <NotificationProvider>
          <Analytics />
        </NotificationProvider>
      </MemoryRouter>
    );

    const rows = [
      {
        label: /^Super Admin:$/i,
        testId: /role-dist-super-admin/,
        classes: ["bg-purple-100", "text-purple-800"],
      },
      {
        label: /^Administrators:$/i,
        testId: /role-dist-administrator/,
        classes: ["bg-red-100", "text-red-800"],
      },
      {
        label: /^Leaders:$/i,
        testId: /role-dist-leader/,
        classes: ["bg-yellow-100", "text-yellow-800"],
      },
      {
        label: /^Guest Experts:$/i,
        testId: /role-dist-guest-expert/,
        classes: ["bg-cyan-100", "text-cyan-800"],
      },
      {
        label: /^Participants:$/i,
        testId: /role-dist-participant/,
        classes: ["bg-green-100", "text-green-800"],
      },
      {
        label: /^@Cloud Co-workers:$/i,
        testId: /role-dist-cloud-co-workers/,
        classes: ["bg-orange-100", "text-orange-800"],
      },
    ];

    rows.forEach(({ label, testId, classes }) => {
      const heading = screen.getByText(label);
      // Check icon (svg) exists within the same parent element
      const parent = heading.closest("span")?.parentElement;
      expect(parent).toBeTruthy();
      const svgs = parent?.querySelectorAll("svg");
      expect(svgs && svgs.length).toBeGreaterThan(0);

      const badge = screen.getByTestId(testId);
      classes.forEach((cls) => expect(badge.className).toContain(cls));
    });
  });
});
