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

vi.mock("../../hooks/useAnalyticsResources", () => ({
  useAnalyticsOverviewResource: () => ({
    data: {
      overview: {
        totalEvents: 42,
        totalUsers: 120,
        totalRegistrations: 80,
        activeParticipants: 18,
        averageSignupRate: 57.3,
        activeUsers: 12,
        upcomingEvents: 10,
        recentRegistrations: 4,
      },
      growth: {
        userGrowthRate: 0,
        eventGrowthRate: 0,
        registrationGrowthRate: 0,
      },
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
  useEventAnalyticsResource: () => ({
    data: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
  useAttendanceAnalyticsResource: () => ({
    data: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
  useProgramAnalyticsResource: () => ({
    data: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
  useFinancialSummaryResource: () => ({
    data: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
  useDonationAnalyticsResource: () => ({
    data: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
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
