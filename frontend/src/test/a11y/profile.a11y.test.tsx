import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
// Lightweight accessibility smoke test to avoid axe/jsdom hangs

// Apply critical mocks BEFORE importing components/hooks that consume them

// Define a stable user object outside the mock factory to prevent re-renders
const mockUser = {
  id: "u1",
  username: "alice",
  firstName: "Alice",
  lastName: "Lee",
  email: "alice@example.com",
  gender: "female" as const,
  role: "Participant" as const,
  isAtCloudLeader: "No" as const,
};

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: mockUser,
    updateUser: vi.fn(),
  }),
}));

// Note: API is already safely mocked in global test setup (src/test/setup.ts)

// Mock NotificationModalContext to a no-op provider and toast helpers
vi.mock("../../contexts/NotificationModalContext", () => ({
  NotificationProvider: ({ children }: any) => children,
  useToastReplacement: () => ({
    success: () => {},
    error: () => {},
    warning: () => {},
    info: () => {},
  }),
}));

// Also mock NotificationContext (dropdown/toast stack) to inert implementations
vi.mock("../../contexts/NotificationContext", () => ({
  NotificationProvider: ({ children }: any) => children,
  useNotifications: () => ({
    show: () => {},
    remove: () => {},
    clear: () => {},
    notifications: [],
  }),
}));

import Profile from "../../pages/Profile";
import { NotificationProvider as NotificationModalProvider } from "../../contexts/NotificationModalContext";

describe("Profile page accessibility", () => {
  // Ensure there are no fake timers interfering with component timers
  beforeEach(() => {
    if ((vi as any).isFakeTimers?.()) {
      vi.useRealTimers();
    }
  });

  it("exposes a page heading, accessible avatar image, and key actions", () => {
    const { unmount } = render(
      <NotificationModalProvider>
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </NotificationModalProvider>
    );

    // Page heading (sync)
    const heading = screen.getByRole("heading", { name: /My Profile/i });
    expect(heading).toBeInTheDocument();

    // Avatar image has alt text (sync)
    const avatar = screen.getByAltText(/Profile Avatar/i);
    expect(avatar).toBeInTheDocument();

    // Change Password CTA is a link with accessible name and correct href (sync)
    const changePwd = screen.getByRole("link", {
      name: /Change Password/i,
    });
    expect(changePwd).toHaveAttribute("href", "/dashboard/change-password");

    // Edit Profile button present (sync)
    const editBtn = screen.getByRole("button", {
      name: /Edit Profile/i,
    });
    expect(editBtn).toBeInTheDocument();

    // System Information section heading present when not editing (sync)
    const sysInfo = screen.getByRole("heading", {
      name: /System Information/i,
    });
    expect(sysInfo).toBeInTheDocument();

    unmount();
  });
});
