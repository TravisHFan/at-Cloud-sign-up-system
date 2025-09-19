import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act } from "react";

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

// Provide a no-op NotificationProvider to avoid internal polling intervals/timers
vi.mock("../../contexts/NotificationContext", () => ({
  NotificationProvider: ({ children }: any) => children,
  useNotifications: () => ({
    counts: { systemMessages: 1, bellNotifications: 0, total: 1 },
    refresh: vi.fn(),
    // Minimal fields used by SystemMessages
    systemMessages: [
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
    markSystemMessageAsRead: vi.fn(),
    reloadSystemMessages: vi.fn(),
  }),
}));

import { NotificationProvider } from "../../contexts/NotificationContext";
import SystemMessages from "../../pages/SystemMessages";

function renderSystemMessagesWithHash() {
  // Polyfill scrollIntoView for jsdom (cast through unknown to avoid any-disable)
  (
    window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }
  ).scrollIntoView = vi.fn();

  render(
    <NotificationProvider>
      <MemoryRouter initialEntries={["/dashboard/system-messages#m-highlight"]}>
        <Routes>
          <Route
            path="/dashboard/system-messages"
            element={<SystemMessages />}
          />
        </Routes>
      </MemoryRouter>
    </NotificationProvider>
  );
}

describe("SystemMessages — hash highlight duration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Use fake timers so we don't wait for real timeouts
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Clear any leftover timers/intervals created during the test
    vi.clearAllTimers();
    // Restore timers to avoid leaking fake timers to other tests
    vi.useRealTimers();
  });

  it("adds and then removes temporary ring classes after ~2s", async () => {
    renderSystemMessagesWithHash();

    // Flush async effects and data load without relying on waitFor/findBy (which use timers)
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const container = document.getElementById("m-highlight");
    expect(container).toBeTruthy();

    // Yield a microtask wrapped in act to allow the effect that adds classes to run
    await act(async () => {
      await Promise.resolve();
    });
    expect(container!.className).toContain("ring-2");
    expect(container!.className).toContain("ring-blue-500");
    expect(container!.className).toContain("ring-opacity-75");

    // Fast-forward ~2.1s to allow the removal timeout to fire
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    // Yield after timers to allow the removal callback to mutate classList
    await act(async () => {
      await Promise.resolve();
    });

    // Ensure no pending timers remain that could keep the test environment busy
    act(() => {
      vi.runOnlyPendingTimers();
    });
    // Classes removed
    expect(container!.className).not.toContain("ring-2");
    expect(container!.className).not.toContain("ring-blue-500");
    expect(container!.className).not.toContain("ring-opacity-75");
  });
});
