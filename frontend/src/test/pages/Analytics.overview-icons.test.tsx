import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Analytics from "../../pages/Analytics";
import { NotificationProvider } from "../../contexts/NotificationModalContext";

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

vi.mock("../../hooks/useBackendIntegration", () => ({
  useAnalyticsData: () => ({
    isLoading: false,
    isError: false,
    error: null,
    eventAnalytics: {
      totalEvents: 42,
      upcomingEvents: 10,
      passedEvents: 32,
      averageSignupRate: 57.3,
      upcomingStats: {
        totalSlots: 0,
        signedUp: 0,
        availableSlots: 0,
        fillRate: 0,
      },
      passedStats: { totalSlots: 0, signedUp: 0, fillRate: 0 },
      formatStats: {},
      mostActiveParticipants: [],
      engagementStats: { low: 0, medium: 0, high: 0, elite: 0 },
    },
    users: [],
    roleStats: {
      total: 120,
      superAdmin: 1,
      administrators: 2,
      leaders: 3,
      guestExperts: 4,
      participants: 5,
      atCloudLeaders: 6,
    },
    engagementMetrics: {
      uniqueParticipants: 18,
      mostActiveUsers: [],
      distribution: {},
      averageEngagement: 0,
    },
  }),
}));

describe("Analytics overview cards icons", () => {
  it("renders four overview cards each with an icon and value", () => {
    render(
      <MemoryRouter>
        <NotificationProvider>
          <Analytics />
        </NotificationProvider>
      </MemoryRouter>
    );

    const container = screen.getByTestId("analytics-overview-cards");
    const cards = container.querySelectorAll(
      "[data-testid^='analytics-card-']"
    );
    expect(cards.length).toBe(4);
    cards.forEach((card) => {
      const svg = card.querySelector("svg");
      expect(svg).toBeTruthy();
      const valueEl = card.querySelector("p[aria-label$='value']");
      expect(valueEl?.textContent).toMatch(/\d|%/);
    });
  });
});
