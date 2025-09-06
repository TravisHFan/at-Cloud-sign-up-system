import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import UserTable from "../../components/management/UserTable";
import type { User } from "../../types/management";

// Mock the useAuth hook
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: {
      id: "current-user-id",
      role: "Administrator",
    },
  }),
}));

describe("UserTable - Guest Expert Aquamarine Styling", () => {
  const mockUser: User = {
    id: "guest-expert-1",
    username: "guestexpert",
    firstName: "Guest",
    lastName: "Expert",
    email: "guest@example.com",
    role: "Guest Expert",
    isAtCloudLeader: "No",
    joinDate: "2025-01-01",
    gender: "male" as const,
    isActive: true,
  };

  const mockGetActionsForUser = vi.fn(() => []);
  const mockOnToggleDropdown = vi.fn();

  it("should apply aquamarine color styling to Guest Expert role badges", () => {
    render(
      <MemoryRouter>
        <UserTable
          users={[mockUser]}
          getActionsForUser={mockGetActionsForUser}
          openDropdown={null}
          onToggleDropdown={mockOnToggleDropdown}
          currentUserRole="Administrator"
        />
      </MemoryRouter>
    );

    // Find all role badges for Guest Expert (desktop and mobile views)
    const roleBadges = screen.getAllByText("Guest Expert");

    // Filter to get only the badge elements (not name elements)
    const actualBadges = roleBadges.filter((element) =>
      element.classList.contains("rounded-full")
    );

    expect(actualBadges.length).toBeGreaterThan(0);

    // Check that all badges have the aquamarine styling classes
    actualBadges.forEach((badge) => {
      expect(badge).toHaveClass("bg-cyan-50", "text-cyan-700");

      // Ensure it doesn't have other role colors
      expect(badge).not.toHaveClass("bg-green-100", "text-green-800");
      expect(badge).not.toHaveClass("bg-yellow-100", "text-yellow-800");
      expect(badge).not.toHaveClass("bg-red-100", "text-red-800");
      expect(badge).not.toHaveClass("bg-purple-100", "text-purple-800");
      expect(badge).not.toHaveClass("bg-blue-100", "text-blue-800");
    });
  });
  it("should apply aquamarine color styling to Guest Expert role badges in mobile view", () => {
    // Mock mobile screen size
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 500, // Mobile width
    });

    render(
      <MemoryRouter>
        <UserTable
          users={[mockUser]}
          getActionsForUser={mockGetActionsForUser}
          openDropdown={null}
          onToggleDropdown={mockOnToggleDropdown}
          currentUserRole="Administrator"
        />
      </MemoryRouter>
    );

    // Find the role badge for Guest Expert (should be rendered in mobile card view too)
    const roleBadges = screen.getAllByText("Guest Expert");
    expect(roleBadges.length).toBeGreaterThan(0);

    // Check that at least one has the aquamarine styling classes
    const aquamarineStyledBadge = roleBadges.find(
      (badge) =>
        badge.classList.contains("bg-cyan-50") &&
        badge.classList.contains("text-cyan-700")
    );
    expect(aquamarineStyledBadge).toBeDefined();
  });

  it("should maintain correct color styling for other roles", () => {
    const otherRoleUsers: User[] = [
      { ...mockUser, id: "participant-1", role: "Participant" },
      { ...mockUser, id: "leader-1", role: "Leader" },
      { ...mockUser, id: "admin-1", role: "Administrator" },
      { ...mockUser, id: "super-admin-1", role: "Super Admin" },
    ];

    render(
      <MemoryRouter>
        <UserTable
          users={otherRoleUsers}
          getActionsForUser={mockGetActionsForUser}
          openDropdown={null}
          onToggleDropdown={mockOnToggleDropdown}
          currentUserRole="Super Admin"
        />
      </MemoryRouter>
    );

    // Check that other roles maintain their correct colors
    const participantBadges = screen
      .getAllByText("Participant")
      .filter((el) => el.classList.contains("rounded-full"));
    expect(participantBadges.length).toBeGreaterThan(0);
    participantBadges.forEach((badge) => {
      expect(badge).toHaveClass("bg-green-100", "text-green-800");
    });

    const leaderBadges = screen
      .getAllByText("Leader")
      .filter((el) => el.classList.contains("rounded-full"));
    expect(leaderBadges.length).toBeGreaterThan(0);
    leaderBadges.forEach((badge) => {
      expect(badge).toHaveClass("bg-yellow-100", "text-yellow-800");
    });

    const adminBadges = screen
      .getAllByText("Administrator")
      .filter((el) => el.classList.contains("rounded-full"));
    expect(adminBadges.length).toBeGreaterThan(0);
    adminBadges.forEach((badge) => {
      expect(badge).toHaveClass("bg-red-100", "text-red-800");
    });

    const superAdminBadges = screen
      .getAllByText("Super Admin")
      .filter((el) => el.classList.contains("rounded-full"));
    expect(superAdminBadges.length).toBeGreaterThan(0);
    superAdminBadges.forEach((badge) => {
      expect(badge).toHaveClass("bg-purple-100", "text-purple-800");
    });
  });
});
