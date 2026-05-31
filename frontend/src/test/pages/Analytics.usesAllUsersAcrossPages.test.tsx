import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Analytics from "../../pages/Analytics";

// Mock auth with admin access
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: { id: "admin", role: "Administrator" } }),
}));

// Mock analytics resources. The people tab still needs event analytics for
// engagement, but this test focuses on the paginated user fetch.
vi.mock("../../hooks/useAnalyticsResources", () => ({
  useAnalyticsOverviewResource: () => ({
    data: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
  useEventAnalyticsResource: () => ({
    data: { upcomingEvents: [], completedEvents: [] },
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

  it("counts all users from multiple pages on the People tab", async () => {
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
      <MemoryRouter initialEntries={["/analytics?tab=people"]}>
        <Routes>
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("role-dist-leader").textContent).toBe("13");
      expect(screen.getByTestId("role-dist-participant").textContent).toBe(
        "12"
      );
    });
  });
});
