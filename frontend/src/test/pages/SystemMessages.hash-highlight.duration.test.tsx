import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Stable auth mocks
const STABLE_USER = Object.freeze({ id: "user-1", role: "User" });
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: STABLE_USER, hasRole: () => false }),
}));

// Silence socket usage in NotificationContext
vi.mock("../../hooks/useSocket", () => ({
  useSocket: () => ({ socket: undefined, connected: false }),
}));

// Mock backend services used by NotificationContext and SystemMessages
vi.mock("../../services/systemMessageService", async () => {
  const actual = await vi.importActual<any>(
    "../../services/systemMessageService"
  );
  return {
    ...actual,
    systemMessageService: {
      getSystemMessagesPaginated: vi.fn().mockResolvedValue({
        messages: [
          {
            id: "m-highlight",
            title: "Highlight Me",
            content: "Should get ring- classes briefly",
            type: "announcement",
            priority: "medium",
            createdAt: new Date().toISOString(),
            isRead: false,
            isActive: true,
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: 1,
          hasNext: false,
          hasPrev: false,
        },
        unreadCount: 1,
      }),
      getSystemMessages: vi.fn().mockResolvedValue([
        {
          id: "m-highlight",
          title: "Highlight Me",
          content: "Should get ring- classes briefly",
          type: "announcement",
          priority: "medium",
          createdAt: new Date().toISOString(),
          isRead: false,
          isActive: true,
        },
      ]),
      getUnreadCount: vi.fn().mockResolvedValue(1),
      markAsRead: vi.fn().mockResolvedValue(true),
      deleteSystemMessage: vi.fn().mockResolvedValue(true),
      createSystemMessage: vi.fn(),
    },
  };
});

vi.mock("../../services/notificationService", async () => {
  const actual = await vi.importActual<any>(
    "../../services/notificationService"
  );
  return {
    ...actual,
    notificationService: {
      getNotifications: vi.fn().mockResolvedValue([]),
      markAsRead: vi.fn().mockResolvedValue(undefined),
      markAllAsRead: vi.fn().mockResolvedValue(undefined),
      deleteNotification: vi.fn().mockResolvedValue(undefined),
      getUnreadCounts: vi.fn().mockResolvedValue({
        bellNotifications: 0,
        systemMessages: 1,
        total: 1,
      }),
    },
  };
});

// AuthContext (some components import from contexts/AuthContext)
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: STABLE_USER,
    loading: false,
    hasRole: () => false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

import { NotificationProvider } from "../../contexts/NotificationContext";
import { NotificationProvider as NotificationModalProvider } from "../../contexts/NotificationModalContext";
import SystemMessages from "../../pages/SystemMessages";

function renderSystemMessagesWithHash() {
  // Polyfill scrollIntoView for jsdom (cast through unknown to avoid any-disable)
  (
    window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }
  ).scrollIntoView = vi.fn();

  render(
    <NotificationModalProvider>
      <NotificationProvider>
        <MemoryRouter
          initialEntries={["/dashboard/system-messages#m-highlight"]}
        >
          <Routes>
            <Route
              path="/dashboard/system-messages"
              element={<SystemMessages />}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    </NotificationModalProvider>
  );
}

describe("SystemMessages — hash highlight duration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure real timers for this suite
    vi.useRealTimers();
  });

  it("adds and then removes temporary ring classes after ~2s", async () => {
    renderSystemMessagesWithHash();

    await screen.findByText(/Highlight Me/i);
    const container = document.getElementById("m-highlight");
    expect(container).toBeTruthy();

    // Wait for the effect to add highlight classes
    await waitFor(() => {
      expect(container!.className).toContain("ring-2");
      expect(container!.className).toContain("ring-blue-500");
      expect(container!.className).toContain("ring-opacity-75");
    });

    // Wait ~2.1s (real time) to allow the removal timeout to fire
    await new Promise((resolve) => setTimeout(resolve, 2100));

    // Classes removed
    expect(container!.className).not.toContain("ring-2");
    expect(container!.className).not.toContain("ring-blue-500");
    expect(container!.className).not.toContain("ring-opacity-75");
  });
});
