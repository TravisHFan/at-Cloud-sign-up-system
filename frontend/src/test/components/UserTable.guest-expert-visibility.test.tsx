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
  {
    id: "2",
    username: "janesmith",
    firstName: "Jane",
    lastName: "Smith",
    email: "jane@example.com",
    role: "Participant",
    isAtCloudLeader: "No",
    joinDate: "2024-01-02",
    gender: "female",
    isActive: true,
    avatar: null,
  },
];

// Mock props
const mockProps = {
  users: mockUsers,
  getActionsForUser: vi.fn(() => []),
  openDropdown: null,
  onToggleDropdown: vi.fn(),
  currentUserRole: "Guest Expert",
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

describe("UserTable - Guest Expert Limited Visibility", () => {
  it("should show limited view for Guest Expert users (same as Participant)", () => {
    render(
      <TestWrapper>
        <UserTable {...mockProps} />
      </TestWrapper>
    );

    // Should show limited table header
    expect(screen.getByText("Community Members")).toBeInTheDocument();
    expect(screen.getByText("Showing 2 members")).toBeInTheDocument();

    // Should show user names (basic user list) - use getAllByText for responsive design
    expect(screen.getAllByText("John Doe")).toHaveLength(2); // Desktop + mobile
    expect(screen.getAllByText("Jane Smith")).toHaveLength(2); // Desktop + mobile

    // Should NOT show sensitive columns
    expect(screen.queryByText("john@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("jane@example.com")).not.toBeInTheDocument();

    // Should NOT show action buttons
    expect(screen.queryByTestId("user-actions")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();

    // Should show @Cloud roles in the Role column for limited visibility
    expect(screen.getAllByText("Senior Pastor")).toHaveLength(2); // John's roleInAtCloud (desktop + mobile)
    // Jane has no roleInAtCloud, so should show "—" (em dash)
    expect(screen.getAllByText("—")).toHaveLength(2); // em dash (desktop + mobile)

    // Should NOT show join dates
    expect(screen.queryByText("2024-01-01")).not.toBeInTheDocument();
    expect(screen.queryByText("2024-01-02")).not.toBeInTheDocument();

    // Should NOT show status toggle
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
    expect(screen.queryByText("Inactive")).not.toBeInTheDocument();

    // Should show limited table headers
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();

    // Should NOT show full access headers
    expect(screen.queryByText("Email")).not.toBeInTheDocument();
    expect(
      screen.queryByText("System Authorization Level")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Role in @Cloud")).not.toBeInTheDocument();
    expect(screen.queryByText("Join Date")).not.toBeInTheDocument();
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
  });

  it("should show role badges for Guest Expert users (read-only)", () => {
    render(
      <TestWrapper>
        <UserTable {...mockProps} />
      </TestWrapper>
    );

    // Should show @Cloud roles in Role column (not system authorization levels)
    expect(screen.getAllByText("Senior Pastor")).toHaveLength(2); // John's roleInAtCloud (desktop + mobile)

    // Should show em dash for users without @Cloud role
    const emDashes = screen.getAllByText("—");
    expect(emDashes).toHaveLength(2); // Jane has no roleInAtCloud (desktop + mobile)
  });

  it("should not show profile links for Guest Expert users", () => {
    render(
      <TestWrapper>
        <UserTable {...mockProps} />
      </TestWrapper>
    );

    // Should not have clickable profile links in limited view
    // In limited view, names should be plain text, not links
    const johnElements = screen.getAllByText("John Doe");
    johnElements.forEach((element) => {
      expect(element.closest("a")).toBeNull();
    });

    const janeElements = screen.getAllByText("Jane Smith");
    janeElements.forEach((element) => {
      expect(element.closest("a")).toBeNull();
    });
  });
});
