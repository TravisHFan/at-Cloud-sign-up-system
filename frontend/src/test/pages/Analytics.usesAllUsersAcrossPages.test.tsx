import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Analytics from "../../pages/Analytics";

// Mock auth with admin access
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: { id: "admin", role: "Administrator" } }),
}));

// Mock analytics backend hook minimal shape
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
      formatStats: {},
      mostActiveParticipants: [],
      engagementStats: { low: 0, medium: 0, high: 0, elite: 0 },
    },
    users: [],
    roleStats: {
      superAdmin: 0,
      administrators: 0,
      leaders: 0,
      guestExperts: 0,
      participants: 0,
      atCloudLeaders: 0,
    },
    engagementMetrics: {
      mostActiveUsers: [],
      distribution: {},
      averageEngagement: 0,
    },
    exportData: vi.fn(),
  }),
}));

// Capture calls and provide paginated responses
const getUsersMock = vi.fn();
vi.mock("../../services/api", async (orig) => {
  const actual =
    (await (orig as any).default?.call?.(null)) ??
    (await import("../../services/api"));
  return {
    ...actual,
    userService: {
      ...actual.userService,
      getUsers: (...args: any[]) => getUsersMock(...args),
    },
  };
});

// Avoid toast noise
vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({ success: vi.fn(), error: vi.fn() }),
}));

describe("Analytics users aggregation across pagination", () => {
  beforeEach(() => {
    getUsersMock.mockReset();
  });

  it("counts all users from multiple pages, not just the first 20", async () => {
    // Simulate two pages: first returns 20 users, hasNext true; second returns 5 users, hasNext false
    const makeUser = (i: number) => ({
      id: `u${i}`,
      username: `user${i}`,
      email: `u${i}@ex.com`,
      role: i % 2 === 0 ? "Participant" : "Leader",
      firstName: `F${i}`,
      lastName: `L${i}`,
      isActive: true,
    });

    const page1Users = Array.from({ length: 20 }, (_, i) => makeUser(i + 1));
    const page2Users = Array.from({ length: 5 }, (_, i) => makeUser(i + 21));

    getUsersMock.mockImplementation(async ({ page }: any) => {
      if (page === 1 || page === undefined) {
        return {
          users: page1Users,
          pagination: {
            currentPage: 1,
            totalPages: 2,
            totalUsers: 25,
            hasNext: true,
            hasPrev: false,
          },
        };
      }
      return {
        users: page2Users,
        pagination: {
          currentPage: 2,
          totalPages: 2,
          totalUsers: 25,
          hasNext: false,
          hasPrev: true,
        },
      };
    });

    render(
      <MemoryRouter initialEntries={["/analytics"]}>
        <Routes>
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </MemoryRouter>
    );

    // The "Total Users" value should be 25, not 20
    await waitFor(() => {
      // Value is rendered in a p with aria-label="total-users-value"
      const valueEl = screen.getByLabelText(/total-users-value/i);
      expect(valueEl).toBeTruthy();
      expect(valueEl.textContent).toMatch(/25/);
    });
  });
});
