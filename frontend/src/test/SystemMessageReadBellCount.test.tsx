import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import {
  NotificationProvider,
  useNotifications,
} from "../contexts/NotificationContext";
import { AuthProvider } from "../contexts/AuthContext";
import { systemMessageService } from "../services/systemMessageService";
import { notificationService } from "../services/notificationService";
import type { SystemMessage, Notification } from "../types/notification";

// Mock the services
vi.mock("../services/systemMessageService", () => ({
  systemMessageService: {
    markAsRead: vi.fn(),
    getSystemMessages: vi.fn(),
  },
}));

vi.mock("../services/notificationService", () => ({
  notificationService: {
    getNotifications: vi.fn(),
    markAsRead: vi.fn(),
  },
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: {
      id: "test-user-1",
      firstName: "Test",
      lastName: "User",
      role: "Participant",
    },
  }),
}));

vi.mock("../hooks/useSocket", () => ({
  useSocket: () => ({
    socket: {
      connected: true,
      on: vi.fn(),
      off: vi.fn(),
    },
  }),
}));

// Test component that uses the NotificationContext
function TestComponent() {
  const {
    systemMessages,
    markSystemMessageAsRead,
    notifications,
    unreadCount,
    totalUnreadCount,
  } = useNotifications();

  const unreadSystemMessage = systemMessages.find((msg) => !msg.isRead);

  return (
    <div>
      <div data-testid="system-messages-count">{systemMessages.length}</div>
      <div data-testid="unread-system-messages-count">
        {systemMessages.filter((msg) => !msg.isRead).length}
      </div>
      <div data-testid="bell-notifications-count">{notifications.length}</div>
      <div data-testid="unread-bell-count">{unreadCount}</div>
      <div data-testid="total-unread-count">{totalUnreadCount}</div>

      {unreadSystemMessage && (
        <button
          data-testid="mark-as-read-button"
          onClick={() => markSystemMessageAsRead(unreadSystemMessage.id)}
        >
          Mark as Read
        </button>
      )}

      <div data-testid="system-messages">
        {systemMessages.map((msg) => (
          <div
            key={msg.id}
            data-testid={`system-message-${msg.id}`}
            data-read={msg.isRead}
          >
            {msg.title} - {msg.isRead ? "Read" : "Unread"}
          </div>
        ))}
      </div>

      <div data-testid="bell-notifications">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            data-testid={`bell-notification-${notification.id}`}
            data-read={notification.isRead}
          >
            {notification.title} - {notification.isRead ? "Read" : "Unread"}
          </div>
        ))}
      </div>
    </div>
  );
}

// Mock initial data
const mockSystemMessages: SystemMessage[] = [
  {
    id: "msg-1",
    title: "Test System Message 1",
    content: "Test content 1",
    type: "announcement",
    priority: "medium",
    creator: "admin",
    createdAt: "2024-01-01T10:00:00Z",
    updatedAt: "2024-01-01T10:00:00Z",
    isRead: false,
    isActive: true,
  },
  {
    id: "msg-2",
    title: "Test System Message 2",
    content: "Test content 2",
    type: "announcement",
    priority: "high",
    creator: "admin",
    createdAt: "2024-01-01T11:00:00Z",
    updatedAt: "2024-01-01T11:00:00Z",
    isRead: true,
    isActive: true,
  },
];

const mockBellNotifications: Notification[] = [
  {
    id: "msg-1", // Same ID as system message
    title: "Test System Message 1",
    message: "Test content 1",
    type: "SYSTEM_MESSAGE",
    priority: "medium",
    createdAt: "2024-01-01T10:00:00Z",
    isRead: false,
    userId: "test-user-1",
    systemMessage: {
      id: "msg-1",
      type: "announcement",
      creator: "admin",
    },
  },
  {
    id: "msg-2",
    title: "Test System Message 2",
    message: "Test content 2",
    type: "SYSTEM_MESSAGE",
    priority: "high",
    createdAt: "2024-01-01T11:00:00Z",
    isRead: true,
    userId: "test-user-1",
    systemMessage: {
      id: "msg-2",
      type: "announcement",
      creator: "admin",
    },
  },
];

describe("System Message Read Status and Bell Count Integration", () => {
  beforeEach(() => {
    // Mock the service responses
    vi.mocked(systemMessageService.getSystemMessages).mockResolvedValue(
      mockSystemMessages
    );
    vi.mocked(systemMessageService.markAsRead).mockResolvedValue(undefined);

    // Mock notifications service to return bell notifications
    const { notificationService } = require("../services/notificationService");
    vi.mocked(notificationService.getNotifications).mockResolvedValue(
      mockBellNotifications
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should update both system message and bell notification when marking as read", async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <TestComponent />
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    );

    // Wait for initial data to load
    await waitFor(() => {
      expect(screen.getByTestId("system-messages-count")).toHaveTextContent(
        "2"
      );
    });

    // Check initial state
    expect(
      screen.getByTestId("unread-system-messages-count")
    ).toHaveTextContent("1");
    expect(screen.getByTestId("unread-bell-count")).toHaveTextContent("1");
    expect(screen.getByTestId("total-unread-count")).toHaveTextContent("1");

    // Check that the unread system message is shown as unread
    const unreadSystemMessage = screen.getByTestId("system-message-msg-1");
    expect(unreadSystemMessage).toHaveAttribute("data-read", "false");
    expect(unreadSystemMessage).toHaveTextContent("Unread");

    // Check that the corresponding bell notification is also unread
    const unreadBellNotification = screen.getByTestId(
      "bell-notification-msg-1"
    );
    expect(unreadBellNotification).toHaveAttribute("data-read", "false");
    expect(unreadBellNotification).toHaveTextContent("Unread");

    // Click the mark as read button
    const markAsReadButton = screen.getByTestId("mark-as-read-button");
    fireEvent.click(markAsReadButton);

    // Verify the API was called
    expect(systemMessageService.markAsRead).toHaveBeenCalledWith("msg-1");

    // Check that the UI updates immediately without refresh
    await waitFor(() => {
      // System message should be marked as read
      expect(screen.getByTestId("system-message-msg-1")).toHaveAttribute(
        "data-read",
        "true"
      );
      expect(screen.getByTestId("system-message-msg-1")).toHaveTextContent(
        "Read"
      );

      // Bell notification should also be marked as read
      expect(screen.getByTestId("bell-notification-msg-1")).toHaveAttribute(
        "data-read",
        "true"
      );
      expect(screen.getByTestId("bell-notification-msg-1")).toHaveTextContent(
        "Read"
      );

      // Unread counts should decrease immediately
      expect(
        screen.getByTestId("unread-system-messages-count")
      ).toHaveTextContent("0");
      expect(screen.getByTestId("unread-bell-count")).toHaveTextContent("0");
      expect(screen.getByTestId("total-unread-count")).toHaveTextContent("0");
    });
  });

  it("should handle the case when system message and bell notification have different read states", async () => {
    // Mock a scenario where system message and bell notification might be out of sync
    const asyncSystemMessages = [
      {
        ...mockSystemMessages[0],
        isRead: true, // System message is read
      },
      mockSystemMessages[1],
    ];

    const asyncBellNotifications = [
      {
        ...mockBellNotifications[0],
        isRead: false, // But bell notification is still unread
      },
      mockBellNotifications[1],
    ];

    vi.mocked(systemMessageService.getSystemMessages).mockResolvedValue(
      asyncSystemMessages
    );
    const { notificationService } = require("../services/notificationService");
    vi.mocked(notificationService.getNotifications).mockResolvedValue(
      asyncBellNotifications
    );

    render(
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <TestComponent />
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    );

    // Wait for initial data to load
    await waitFor(() => {
      expect(screen.getByTestId("system-messages-count")).toHaveTextContent(
        "2"
      );
    });

    // Initial state: system message is read but bell notification is unread
    expect(
      screen.getByTestId("unread-system-messages-count")
    ).toHaveTextContent("0");
    expect(screen.getByTestId("unread-bell-count")).toHaveTextContent("1");

    // The system message should show as read
    expect(screen.getByTestId("system-message-msg-1")).toHaveAttribute(
      "data-read",
      "true"
    );

    // The bell notification should show as unread
    expect(screen.getByTestId("bell-notification-msg-1")).toHaveAttribute(
      "data-read",
      "false"
    );
  });
});
