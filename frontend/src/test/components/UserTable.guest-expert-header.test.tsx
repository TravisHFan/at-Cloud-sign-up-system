import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import UserTable from "../../components/management/UserTable";
import type { User } from "../../types/management";

// Mock data
const mockUsers: User[] = [
  {
    id: "1",
    username: "johndoe",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    role: "Administrator",
    isAtCloudLeader: "Yes",
    roleInAtCloud: "Senior Pastor",
    joinDate: "2024-01-01",
    gender: "male",
    isActive: true,
    avatar: null,
  },
];

// Mock props
const mockGuestExpertProps = {
  users: mockUsers,
  getActionsForUser: vi.fn(() => []),
  openDropdown: null,
  onToggleDropdown: vi.fn(),
  currentUserRole: "Guest Expert",
};

const mockParticipantProps = {
  ...mockGuestExpertProps,
  currentUserRole: "Participant",
};

const mockAdminProps = {
  ...mockGuestExpertProps,
  currentUserRole: "Administrator",
};

// Mock hooks and components
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: { id: "current-user", role: "Guest Expert" },
    isAuthenticated: true,
  }),
}));

vi.mock("../../components/management/ActionDropdown", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="action-dropdown">{children}</div>
  ),
}));

vi.mock("../../components/ui/UserRoleBadge", () => ({
  default: ({ role }: { role: string }) => (
    <span data-testid="role-badge">{role}</span>
  ),
}));

// Wrapper component for router
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe("UserTable - Role-Specific Headers", () => {
  it("should show limited table view for Guest Expert users", () => {
    render(
      <TestWrapper>
        <UserTable {...mockGuestExpertProps} />
      </TestWrapper>
    );

    // Should show table header for limited users
    expect(screen.getByText("Community Members")).toBeInTheDocument();

    // Should show member count
    expect(screen.getByText("Showing 1 members")).toBeInTheDocument();

    // Should only show basic columns
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();

    // Should not show administrative columns
    expect(screen.queryByText("Email")).not.toBeInTheDocument();
    expect(screen.queryByText("Phone")).not.toBeInTheDocument();
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
  });

  it("should show Participant header for Participant users", () => {
    render(
      <TestWrapper>
        <UserTable {...mockParticipantProps} />
      </TestWrapper>
    );

    // Should show same table header as Guest Expert (limited users)
    expect(screen.getByText("Community Members")).toBeInTheDocument();

    // Should show member count
    expect(screen.getByText("Showing 1 members")).toBeInTheDocument();

    // Should only show basic columns (same as Guest Expert)
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();

    // Should not show administrative columns
    expect(screen.queryByText("Email")).not.toBeInTheDocument();
    expect(screen.queryByText("Phone")).not.toBeInTheDocument();
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
  });

  it("should show admin header for Administrator users", () => {
    render(
      <TestWrapper>
        <UserTable {...mockAdminProps} />
      </TestWrapper>
    );

    // Should show Admin table header
    expect(screen.getByText("All Users")).toBeInTheDocument();

    // Should show user count (not members)
    expect(screen.getByText("Showing 1 users")).toBeInTheDocument();

    // Should show all administrative columns
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("System Authorization Level")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("should show layout differences between Guest Expert and Administrator roles", () => {
    const { rerender } = render(
      <TestWrapper>
        <UserTable {...mockGuestExpertProps} />
      </TestWrapper>
    );

    // Guest Expert should show limited view
    expect(screen.getByText("Community Members")).toBeInTheDocument();
    expect(screen.queryByText("Email")).not.toBeInTheDocument();
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();

    // Re-render with Administrator role
    rerender(
      <TestWrapper>
        <UserTable {...mockAdminProps} />
      </TestWrapper>
    );

    // Administrator should show full view
    expect(screen.getByText("All Users")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });
});
