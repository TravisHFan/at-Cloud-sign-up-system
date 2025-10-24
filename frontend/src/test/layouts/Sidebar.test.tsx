/**
 * Sidebar Component Tests
 *
 * Tests role-based navigation item visibility, especially for admin-only features
 * like Income History, Promo Codes, and Published Events.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "../../layouts/dashboard/Sidebar";
import type { AuthUser } from "../../types";

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("Sidebar Component - Income History Link Visibility", () => {
  const mockSetSidebarOpen = vi.fn();

  const createMockUser = (role: string): Partial<AuthUser> => ({
    id: "test-user-id",
    username: "testuser",
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    role: role as any,
    isAtCloudLeader: "No" as any,
    gender: "Male" as any,
  });

  const mockAuthContextBase = {
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Super Admin Role", () => {
    it("shows Income History link for Super Admin", () => {
      mockUseAuth.mockReturnValue({
        currentUser: createMockUser("Super Admin"),
        ...mockAuthContextBase,
      });

      render(
        <MemoryRouter>
          <Sidebar
            userRole="Super Admin"
            sidebarOpen={true}
            setSidebarOpen={mockSetSidebarOpen}
          />
        </MemoryRouter>
      );

      expect(screen.getByText("Income History")).toBeInTheDocument();
    });
  });

  describe("Administrator Role", () => {
    it("shows Income History link for Administrator", () => {
      mockUseAuth.mockReturnValue({
        currentUser: createMockUser("Administrator"),
        ...mockAuthContextBase,
      });

      render(
        <MemoryRouter>
          <Sidebar
            userRole="Administrator"
            sidebarOpen={true}
            setSidebarOpen={mockSetSidebarOpen}
          />
        </MemoryRouter>
      );

      expect(screen.getByText("Income History")).toBeInTheDocument();
    });
  });

  describe("Leader Role", () => {
    it("does NOT show Income History link for Leader", () => {
      mockUseAuth.mockReturnValue({
        currentUser: createMockUser("Leader"),
        ...mockAuthContextBase,
      });

      render(
        <MemoryRouter>
          <Sidebar
            userRole="Leader"
            sidebarOpen={true}
            setSidebarOpen={mockSetSidebarOpen}
          />
        </MemoryRouter>
      );

      expect(screen.queryByText("Income History")).not.toBeInTheDocument();
    });
  });

  describe("Participant Role", () => {
    it("does NOT show Income History link for Participant", () => {
      mockUseAuth.mockReturnValue({
        currentUser: createMockUser("Participant"),
        ...mockAuthContextBase,
      });

      render(
        <MemoryRouter>
          <Sidebar
            userRole="Participant"
            sidebarOpen={true}
            setSidebarOpen={mockSetSidebarOpen}
          />
        </MemoryRouter>
      );

      expect(screen.queryByText("Income History")).not.toBeInTheDocument();
    });
  });

  describe("Guest Expert Role", () => {
    it("does NOT show Income History link for Guest Expert", () => {
      mockUseAuth.mockReturnValue({
        currentUser: createMockUser("Guest Expert"),
        ...mockAuthContextBase,
      });

      render(
        <MemoryRouter>
          <Sidebar
            userRole="Guest Expert"
            sidebarOpen={true}
            setSidebarOpen={mockSetSidebarOpen}
          />
        </MemoryRouter>
      );

      expect(screen.queryByText("Income History")).not.toBeInTheDocument();
    });
  });

  describe("Admin-Only Features Verification", () => {
    it("shows all admin features for Super Admin", () => {
      mockUseAuth.mockReturnValue({
        currentUser: createMockUser("Super Admin"),
        ...mockAuthContextBase,
      });

      render(
        <MemoryRouter>
          <Sidebar
            userRole="Super Admin"
            sidebarOpen={true}
            setSidebarOpen={mockSetSidebarOpen}
          />
        </MemoryRouter>
      );

      // Admin-only features
      expect(screen.getByText("Published Events")).toBeInTheDocument();
      expect(screen.getByText("Promo Codes")).toBeInTheDocument();
      expect(screen.getByText("Income History")).toBeInTheDocument();
      expect(screen.getByText("Management")).toBeInTheDocument();
    });

    it("shows all admin features for Administrator", () => {
      mockUseAuth.mockReturnValue({
        currentUser: createMockUser("Administrator"),
        ...mockAuthContextBase,
      });

      render(
        <MemoryRouter>
          <Sidebar
            userRole="Administrator"
            sidebarOpen={true}
            setSidebarOpen={mockSetSidebarOpen}
          />
        </MemoryRouter>
      );

      // Admin-only features
      expect(screen.getByText("Published Events")).toBeInTheDocument();
      expect(screen.getByText("Promo Codes")).toBeInTheDocument();
      expect(screen.getByText("Income History")).toBeInTheDocument();
      expect(screen.getByText("Management")).toBeInTheDocument();
    });

    it("does NOT show admin features for Leader", () => {
      mockUseAuth.mockReturnValue({
        currentUser: createMockUser("Leader"),
        ...mockAuthContextBase,
      });

      render(
        <MemoryRouter>
          <Sidebar
            userRole="Leader"
            sidebarOpen={true}
            setSidebarOpen={mockSetSidebarOpen}
          />
        </MemoryRouter>
      );

      // Leader should see Published Events but NOT other admin-only features
      expect(screen.getByText("Published Events")).toBeInTheDocument();
      expect(screen.queryByText("Promo Codes")).not.toBeInTheDocument();
      expect(screen.queryByText("Income History")).not.toBeInTheDocument();
      // Leader sees "Community" instead of "Management"
      expect(screen.queryByText("Management")).not.toBeInTheDocument();
      expect(screen.getByText("Community")).toBeInTheDocument();
    });
  });
});
