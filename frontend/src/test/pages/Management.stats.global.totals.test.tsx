import { render, screen, within } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import Management from "../../pages/Management";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider as NotificationModalProvider } from "../../contexts/NotificationModalContext";
import { NotificationProvider } from "../../contexts/NotificationContext";

// Mock the userService to return a paginated users list (page size 10) and a larger global stats payload
vi.mock("../../services/api", async () => {
  const actual = await vi.importActual<any>("../../services/api");
  return {
    ...actual,
    userService: {
      ...actual.userService,
      getUsers: vi.fn().mockResolvedValue({
        users: Array.from({ length: 10 }).map((_, i) => ({
          id: `u${i + 1}`,
          username: `user${i + 1}`,
          email: `user${i + 1}@example.com`,
          firstName: `User${i + 1}`,
          lastName: "Test",
          role:
            i < 2
              ? "Administrator"
              : i < 3
              ? "Super Admin"
              : i < 6
              ? "Leader"
              : i < 8
              ? "Guest Expert"
              : "Participant",
          roleInAtCloud: i % 2 === 0 ? "Coach" : null,
          isAtCloudLeader: i % 3 === 0,
          avatar: null,
          gender: "male",
          phone: null,
          createdAt: "2025-01-01T00:00:00Z",
          joinedAt: "2025-01-01T00:00:00Z",
          lastActive: null,
          isActive: true,
          emailVerified: true,
        })),
        pagination: {
          currentPage: 1,
          totalPages: 5,
          totalUsers: 50,
          hasNext: true,
          hasPrev: false,
        },
      }),
      getUserStats: vi.fn().mockResolvedValue({
        success: true,
        data: {
          stats: {
            totalUsers: 50,
            activeUsers: 47,
            verifiedUsers: 45,
            atCloudLeaders: 18,
            roleDistribution: {
              "Super Admin": 3,
              Administrator: 7,
              Leader: 15,
              "Guest Expert": 5,
              Participant: 20,
            },
          },
        },
      }),
    },
  };
});

// Silence socket usage if any child component references it
vi.mock("../../services/socketService", () => ({
  default: { connect: vi.fn(), disconnect: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <BrowserRouter>
      <AuthProvider>
        <NotificationModalProvider>
          <NotificationProvider>{ui}</NotificationProvider>
        </NotificationModalProvider>
      </AuthProvider>
    </BrowserRouter>
  );

describe("Management Page — global stats reflect entire collection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("statistics cards use backend-wide totals (not current page length)", async () => {
    renderWithProviders(<Management />);

    // Total Users card should show 50 (global), not 10 (page length)
    const totalCard = await screen.findByText("Total Users");
    const cardEl = totalCard.closest("div");
    expect(cardEl).toBeInTheDocument();
    // Value updates asynchronously after stats load
    const valueEl = await within(cardEl as HTMLElement).findByText("50");
    expect(valueEl).toBeInTheDocument();
  });

  test("role distribution numbers come from backend stats roleDistribution", async () => {
    renderWithProviders(<Management />);

    // Verify a couple of role-specific counts from mocked backend stats
    const adminsCard = await screen.findByText("Administrators");
    expect(
      await within(adminsCard.closest("div") as HTMLElement).findByText("7")
    ).toBeInTheDocument();

    const leadersCard = await screen.findByText("Leaders");
    expect(
      await within(leadersCard.closest("div") as HTMLElement).findByText("15")
    ).toBeInTheDocument();

    const participantsCard = await screen.findByText("Participants");
    expect(
      await within(participantsCard.closest("div") as HTMLElement).findByText(
        "20"
      )
    ).toBeInTheDocument();
  });
});
