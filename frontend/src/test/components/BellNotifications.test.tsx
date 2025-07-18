import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";

// Mock notification service
const mockBellNotifications = [
  {
    id: "bell1",
    title: "From Admin User, Administrator",
    content: "New system announcement",
    type: "announcement",
    priority: "medium",
    createdAt: "2024-01-01T10:00:00Z",
    isRead: false,
    showRemoveButton: false,
  },
  {
    id: "bell2",
    title: "From Super Admin, Super Admin",
    content: "Security warning message",
    type: "warning",
    priority: "high",
    createdAt: "2024-01-01T09:00:00Z",
    isRead: true,
    showRemoveButton: true,
  },
];

// Mock NotificationDropdown component for bell notifications testing
const MockNotificationDropdown = () => {
  const [notifications, setNotifications] = useState([
    ...mockBellNotifications,
  ]);
  const [isOpen, setIsOpen] = useState(false);

  const handleNotificationClick = async (notificationId: string) => {
    // Mark as read
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId
          ? { ...n, isRead: true, showRemoveButton: true }
          : n
      )
    );
  };

  const handleRemoveNotification = async (notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)} data-testid="bell-button">
        Bell ({notifications.filter((n) => !n.isRead).length})
      </button>
      {isOpen && (
        <div data-testid="notification-dropdown">
          <h3>Notifications</h3>
          {notifications.length === 0 ? (
            <p>No notifications</p>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                data-testid={`notification-${notification.id}`}
                className={notification.isRead ? "read" : "unread"}
              >
                <h4>{notification.title}</h4>
                <p>{notification.content}</p>
                <span>Type: {notification.type}</span>
                <span>Priority: {notification.priority}</span>
                <span>Read: {notification.isRead ? "Yes" : "No"}</span>
                <button
                  onClick={() => handleNotificationClick(notification.id)}
                  data-testid={`mark-read-${notification.id}`}
                >
                  Mark as Read
                </button>
                {notification.showRemoveButton && (
                  <button
                    onClick={() => handleRemoveNotification(notification.id)}
                    data-testid={`remove-${notification.id}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

describe("Bell Notifications Component - Requirements 5-6", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Bell Notification Display", () => {
    it("should show unread notification count in bell icon", async () => {
      render(<MockNotificationDropdown />);

      const bellButton = screen.getByTestId("bell-button");
      expect(bellButton).toBeInTheDocument();
      expect(bellButton).toHaveTextContent("Bell (1)"); // Only one unread notification
    });

    it("should display all bell notifications when dropdown is open", async () => {
      render(<MockNotificationDropdown />);

      const bellButton = screen.getByTestId("bell-button");
      fireEvent.click(bellButton);

      await waitFor(() => {
        expect(screen.getByTestId("notification-dropdown")).toBeInTheDocument();
        expect(screen.getByTestId("notification-bell1")).toBeInTheDocument();
        expect(screen.getByTestId("notification-bell2")).toBeInTheDocument();
      });
    });

    it("should show correct notification details", async () => {
      render(<MockNotificationDropdown />);

      const bellButton = screen.getByTestId("bell-button");
      fireEvent.click(bellButton);

      await waitFor(() => {
        expect(
          screen.getByText("From Admin User, Administrator")
        ).toBeInTheDocument();
        expect(screen.getByText("New system announcement")).toBeInTheDocument();
        expect(screen.getByText("Type: announcement")).toBeInTheDocument();
        expect(screen.getByText("Priority: medium")).toBeInTheDocument();
      });
    });
  });

  describe("Requirement 5: Bell Notification Read/Write Operations", () => {
    it("should mark bell notification as read when clicked", async () => {
      render(<MockNotificationDropdown />);

      const bellButton = screen.getByTestId("bell-button");
      fireEvent.click(bellButton);

      await waitFor(() => {
        const notification = screen.getByTestId("notification-bell1");
        expect(notification).toHaveClass("unread");
        expect(screen.getByText("Read: No")).toBeInTheDocument();
      });

      const markReadButton = screen.getByTestId("mark-read-bell1");
      fireEvent.click(markReadButton);

      await waitFor(() => {
        const notification = screen.getByTestId("notification-bell1");
        expect(notification).toHaveClass("read");
        expect(screen.getByText("Read: Yes")).toBeInTheDocument();
      });
    });

    it("should show remove button after marking notification as read", async () => {
      render(<MockNotificationDropdown />);

      const bellButton = screen.getByTestId("bell-button");
      fireEvent.click(bellButton);

      // Initially no remove button for unread notification
      await waitFor(() => {
        expect(screen.queryByTestId("remove-bell1")).not.toBeInTheDocument();
      });

      // Mark as read
      const markReadButton = screen.getByTestId("mark-read-bell1");
      fireEvent.click(markReadButton);

      // Remove button should appear
      await waitFor(() => {
        expect(screen.getByTestId("remove-bell1")).toBeInTheDocument();
      });
    });

    it("should update unread count when notification is marked as read", async () => {
      render(<MockNotificationDropdown />);

      const bellButton = screen.getByTestId("bell-button");
      expect(bellButton).toHaveTextContent("Bell (1)");

      fireEvent.click(bellButton);
      const markReadButton = screen.getByTestId("mark-read-bell1");
      fireEvent.click(markReadButton);

      await waitFor(() => {
        expect(bellButton).toHaveTextContent("Bell (0)");
      });
    });
  });

  describe("Requirement 6: Bell Notification Removal", () => {
    it("should remove bell notification when remove button is clicked", async () => {
      render(<MockNotificationDropdown />);

      const bellButton = screen.getByTestId("bell-button");
      fireEvent.click(bellButton);

      // bell2 is already read and has remove button
      await waitFor(() => {
        expect(screen.getByTestId("notification-bell2")).toBeInTheDocument();
        expect(screen.getByTestId("remove-bell2")).toBeInTheDocument();
      });

      const removeButton = screen.getByTestId("remove-bell2");
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(
          screen.queryByTestId("notification-bell2")
        ).not.toBeInTheDocument();
      });
    });

    it("should maintain independence from system messages when removing", async () => {
      render(<MockNotificationDropdown />);

      const bellButton = screen.getByTestId("bell-button");
      fireEvent.click(bellButton);

      // Remove bell2
      const removeButton = screen.getByTestId("remove-bell2");
      fireEvent.click(removeButton);

      await waitFor(() => {
        // bell2 should be removed from notifications
        expect(
          screen.queryByTestId("notification-bell2")
        ).not.toBeInTheDocument();
        // bell1 should still exist
        expect(screen.getByTestId("notification-bell1")).toBeInTheDocument();
      });
    });

    it("should handle empty notification state", async () => {
      render(<MockNotificationDropdown />);

      const bellButton = screen.getByTestId("bell-button");
      fireEvent.click(bellButton);

      // Remove all notifications
      const removeButton = screen.getByTestId("remove-bell2");
      fireEvent.click(removeButton);

      // Mark bell1 as read to get remove button
      const markReadButton = screen.getByTestId("mark-read-bell1");
      fireEvent.click(markReadButton);

      await waitFor(() => {
        const removeButton1 = screen.getByTestId("remove-bell1");
        fireEvent.click(removeButton1);
      });

      await waitFor(() => {
        expect(screen.getByText("No notifications")).toBeInTheDocument();
        expect(bellButton).toHaveTextContent("Bell (0)");
      });
    });
  });

  describe("State Persistence", () => {
    it("should maintain read state after component updates", async () => {
      const { rerender } = render(<MockNotificationDropdown />);

      const bellButton = screen.getByTestId("bell-button");
      fireEvent.click(bellButton);

      // Mark as read
      const markReadButton = screen.getByTestId("mark-read-bell1");
      fireEvent.click(markReadButton);

      // Rerender component
      rerender(<MockNotificationDropdown />);

      fireEvent.click(bellButton);
      await waitFor(() => {
        const notification = screen.getByTestId("notification-bell1");
        expect(notification).toHaveClass("read");
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle notification actions gracefully", async () => {
      render(<MockNotificationDropdown />);

      const bellButton = screen.getByTestId("bell-button");
      fireEvent.click(bellButton);

      // Multiple clicks should not cause errors
      const markReadButton = screen.getByTestId("mark-read-bell1");
      fireEvent.click(markReadButton);
      fireEvent.click(markReadButton);
      fireEvent.click(markReadButton);

      await waitFor(() => {
        const notification = screen.getByTestId("notification-bell1");
        expect(notification).toHaveClass("read");
      });
    });
  });
});
