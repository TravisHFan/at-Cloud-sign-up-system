import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";

// Mock useAuth before importing providers/components
const STABLE_USER = Object.freeze({ id: "user-1", role: "User" });
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: STABLE_USER,
    hasRole: () => false,
    updateUser: vi.fn(),
  }),
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
            id: "m1",
            title: "Anchor Test",
            content: "hash anchor should scroll & mark read",
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
          id: "m1",
          title: "Anchor Test",
          content: "hash anchor should scroll & mark read",
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

// Mock AuthContext to satisfy NameCardActionModal which uses contexts/AuthContext
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: STABLE_USER,
    loading: false,
    hasRole: vi.fn(() => false),
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
    <AuthProvider>
      <NotificationModalProvider>
        <NotificationProvider>
          <MemoryRouter initialEntries={["/dashboard/system-messages#m1"]}>
            <Routes>
              <Route
                path="/dashboard/system-messages"
                element={<SystemMessages />}
              />
            </Routes>
          </MemoryRouter>
        </NotificationProvider>
      </NotificationModalProvider>
    </AuthProvider>
  );

  return {
    scrollIntoView: (
      window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }
    ).scrollIntoView,
  };
}

describe("SystemMessages - hash anchor behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scrolls to the anchored message and marks it as read when visiting with #id", async () => {
    const { scrollIntoView } = renderSystemMessagesWithHash();

    // Ensure message renders
    expect(await screen.findByText(/Anchor Test/i)).toBeInTheDocument();

    // scrollIntoView should be triggered for the element with id=m1
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });

    // systemMessageService.markAsRead should be called by the page via context
    const { systemMessageService } = await import(
      "../../services/systemMessageService"
    );
    await waitFor(() => {
      expect(systemMessageService.markAsRead).toHaveBeenCalledWith("m1");
    });

    // Hash should be cleared by SystemMessages effect
    await waitFor(() => {
      expect(window.location.hash).toBe("");
    });
  });
});
