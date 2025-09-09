import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Stable auth mocks
const STABLE_USER = Object.freeze({ id: "user-1", role: "Administrator" });
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: STABLE_USER, hasRole: () => true }),
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
            id: "a11y-1",
            title: "New Event: A11y Test",
            content: "This message should expose accessible link text.",
            type: "announcement",
            priority: "medium",
            createdAt: new Date().toISOString(),
            isRead: false,
            isActive: true,
            metadata: { eventId: "evt-1" },
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
          id: "a11y-1",
          title: "New Event: A11y Test",
          content: "This message should expose accessible link text.",
          type: "announcement",
          priority: "medium",
          createdAt: new Date().toISOString(),
          isRead: false,
          isActive: true,
          metadata: { eventId: "evt-1" },
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

// AuthContext (component consumes this provider even if button not clicked)
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: STABLE_USER,
    loading: false,
    hasRole: () => true,
  }),
  AuthProvider: ({ children }: any) => children,
}));

import { NotificationProvider } from "../../contexts/NotificationContext";
import { NotificationProvider as NotificationModalProvider } from "../../contexts/NotificationModalContext";
import SystemMessages from "../../pages/SystemMessages";

function renderSystemMessages() {
  return render(
    <NotificationModalProvider>
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/system-messages"]}>
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

describe("SystemMessages — lightweight a11y snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes a proper page heading and an accessible event details link", async () => {
    renderSystemMessages();

    // Page heading
    const heading = await screen.findByRole("heading", {
      name: /System Messages/i,
    });
    expect(heading).toBeInTheDocument();

    // Message heading also present
    expect(
      await screen.findByRole("heading", { name: /New Event: A11y Test/i })
    ).toBeInTheDocument();

    // CTA link has accessible name and correct href
    const link = await screen.findByRole("link", {
      name: /View Event Details/i,
    });
    expect(link).toHaveAttribute("href", "/dashboard/event/evt-1");
  });
});
