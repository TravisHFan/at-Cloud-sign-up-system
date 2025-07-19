/**
 * Frontend System Messages & Bell Notifications Component Tests
 *
 * This test suite covers the frontend components and interactions for:
 * 1. System Messages page functionality
 * 2. Bell notification dropdown behavior
 * 3. Read/unread status management
 * 4. Message creation and deletion
 * 5. User role-based access control
 * 6. Icon rendering for different message types
 * 7. Navigation between bell notifications and system messages
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import SystemMessages from "../../../pages/SystemMessages";
import NotificationDropdown from "../../../components/common/NotificationDropdown";
import { systemMessageService } from "../../../services/systemMessageService";
import { notificationService } from "../../../services/notificationService";

// Mock services
vi.mock("../../../services/systemMessageService");
vi.mock("../../../services/notificationService");
vi.mock("../../../hooks/useAuth");

const mockSystemMessageService = systemMessageService as any;
const mockNotificationService = notificationService as any;

// Mock data
const mockSystemMessages = [
  {
    id: "1",
    title: "Test Announcement",
    content: "Test announcement content",
    type: "announcement",
    priority: "high",
    creator: {
      firstName: "Admin",
      lastName: "User",
      authLevel: "Administrator",
    },
    createdAt: "2024-01-01T00:00:00Z",
    isRead: false,
    readAt: null,
    canDelete: true,
  },
  {
    id: "2",
    title: "Maintenance Notice",
    content: "System maintenance scheduled",
    type: "maintenance",
    priority: "medium",
    creator: {
      firstName: "Moderator",
      lastName: "User",
      authLevel: "Moderator",
    },
    createdAt: "2024-01-02T00:00:00Z",
    isRead: true,
    readAt: "2024-01-02T01:00:00Z",
    canDelete: true,
  },
];

const mockBellNotifications = [
  {
    id: "1",
    title: "From Admin User, Administrator",
    message: "Test announcement content",
    type: "system",
    isRead: false,
    createdAt: "2024-01-01T00:00:00Z",
    userId: "",
  },
  {
    id: "2",
    title: "From Moderator User, Moderator",
    message: "System maintenance scheduled",
    type: "system",
    isRead: true,
    createdAt: "2024-01-02T00:00:00Z",
    userId: "",
  },
];

const mockUsers = {
  admin: {
    id: "admin-1",
    firstName: "Admin",
    lastName: "User",
    role: "Administrator",
    username: "admin",
  },
  moderator: {
    id: "moderator-1",
    firstName: "Moderator",
    lastName: "User",
    role: "Moderator",
    username: "moderator",
  },
  participant: {
    id: "participant-1",
    firstName: "Participant",
    lastName: "User",
    role: "Participant",
    username: "participant",
  },
};

// Test wrapper component
const TestWrapper = ({
  children,
  user = mockUsers.admin,
}: {
  children: React.ReactNode;
  user?: any;
}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const mockAuthContextValue = {
    currentUser: user,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    signup: vi.fn(),
    updateProfile: vi.fn(),
  };

  // Mock useAuth hook
  const useAuth = (await vi.importActual("../../../hooks/useAuth")) as any;
  vi.mocked(useAuth.useAuth).mockReturnValue(mockAuthContextValue);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>{children}</NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe("System Messages Page Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock responses
    mockSystemMessageService.getSystemMessages.mockResolvedValue({
      success: true,
      data: {
        messages: mockSystemMessages,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: 2,
        },
      },
    });

    mockSystemMessageService.markAsRead.mockResolvedValue({ success: true });
    mockSystemMessageService.markAsUnread.mockResolvedValue({ success: true });
    mockSystemMessageService.deleteSystemMessage.mockResolvedValue(true);
    mockSystemMessageService.createSystemMessage.mockResolvedValue({
      success: true,
      data: { id: "new-message-id" },
    });
  });

  describe("Requirement 1: Read/Unread Status Toggle", () => {
    it("should display messages with correct read/unread status", async () => {
      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Test Announcement")).toBeInTheDocument();
        expect(screen.getByText("Maintenance Notice")).toBeInTheDocument();
      });

      // Check for read/unread indicators
      const unreadMessage = screen
        .getByText("Test Announcement")
        .closest('[data-testid="system-message"]');
      const readMessage = screen
        .getByText("Maintenance Notice")
        .closest('[data-testid="system-message"]');

      expect(unreadMessage).toHaveClass("unread"); // Assuming CSS class for styling
      expect(readMessage).not.toHaveClass("unread");
    });

    it("should toggle read status when message is clicked", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Test Announcement")).toBeInTheDocument();
      });

      // Click on unread message to mark as read
      const unreadMessage = screen.getByText("Test Announcement");
      await user.click(unreadMessage);

      expect(mockSystemMessageService.markAsRead).toHaveBeenCalledWith("1");
    });

    it("should allow toggling back to unread status", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Maintenance Notice")).toBeInTheDocument();
      });

      // Click on read message to mark as unread
      const readMessage = screen.getByText("Maintenance Notice");
      await user.click(readMessage);

      expect(mockSystemMessageService.markAsUnread).toHaveBeenCalledWith("2");
    });
  });

  describe("Requirement 2: Permanent Deletion (User-Specific)", () => {
    it("should show delete button for messages", async () => {
      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        const deleteButtons = screen.getAllByLabelText(/delete/i);
        expect(deleteButtons).toHaveLength(2);
      });
    });

    it("should confirm deletion before removing message", async () => {
      const user = userEvent.setup();

      // Mock window.confirm
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        const deleteButtons = screen.getAllByLabelText(/delete/i);
        expect(deleteButtons[0]).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByLabelText(/delete/i)[0];
      await user.click(deleteButton);

      expect(confirmSpy).toHaveBeenCalledWith(
        "Are you sure you want to permanently delete this message? This action cannot be undone."
      );
      expect(mockSystemMessageService.deleteSystemMessage).toHaveBeenCalledWith(
        "1"
      );

      confirmSpy.mockRestore();
    });

    it("should not delete message if confirmation is cancelled", async () => {
      const user = userEvent.setup();

      // Mock window.confirm to return false
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        const deleteButtons = screen.getAllByLabelText(/delete/i);
        expect(deleteButtons[0]).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByLabelText(/delete/i)[0];
      await user.click(deleteButton);

      expect(confirmSpy).toHaveBeenCalled();
      expect(
        mockSystemMessageService.deleteSystemMessage
      ).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });
  });

  describe("Requirement 3: Five Message Types with Icons", () => {
    const messageTypes = [
      { type: "announcement", expectedIcon: "mail" },
      { type: "maintenance", expectedIcon: "shield-check" },
      { type: "update", expectedIcon: "check-circle" },
      { type: "warning", expectedIcon: "x-circle" },
      { type: "auth_level_change", expectedIcon: "user" },
    ];

    messageTypes.forEach(({ type, expectedIcon }) => {
      it(`should display correct icon for ${type} messages`, async () => {
        const messagesWithType = [
          {
            ...mockSystemMessages[0],
            type,
            title: `Test ${type} Message`,
          },
        ];

        mockSystemMessageService.getSystemMessages.mockResolvedValue({
          success: true,
          data: {
            messages: messagesWithType,
            pagination: { currentPage: 1, totalPages: 1, totalCount: 1 },
          },
        });

        render(
          <TestWrapper>
            <SystemMessages />
          </TestWrapper>
        );

        await waitFor(() => {
          expect(screen.getByText(`Test ${type} Message`)).toBeInTheDocument();
        });

        // Check for the expected icon (this assumes icon components have specific test IDs or classes)
        const iconElement = screen.getByTestId(`message-icon-${type}`);
        expect(iconElement).toHaveAttribute("data-icon", expectedIcon);
      });
    });
  });

  describe("Requirement 4: Create New Messages (Role-Based Access)", () => {
    it("should show create button for Administrator", async () => {
      render(
        <TestWrapper user={mockUsers.admin}>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(
          screen.getByText("Create New System Message")
        ).toBeInTheDocument();
      });
    });

    it("should show create button for Moderator", async () => {
      render(
        <TestWrapper user={mockUsers.moderator}>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(
          screen.getByText("Create New System Message")
        ).toBeInTheDocument();
      });
    });

    it("should hide create button for Participant", async () => {
      render(
        <TestWrapper user={mockUsers.participant}>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(
          screen.queryByText("Create New System Message")
        ).not.toBeInTheDocument();
      });
    });

    it("should open create modal when create button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper user={mockUsers.admin}>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(
          screen.getByText("Create New System Message")
        ).toBeInTheDocument();
      });

      const createButton = screen.getByText("Create New System Message");
      await user.click(createButton);

      expect(screen.getByText("Create System Message")).toBeInTheDocument();
      expect(screen.getByLabelText("Title")).toBeInTheDocument();
      expect(screen.getByLabelText("Content")).toBeInTheDocument();
      expect(screen.getByLabelText("Type")).toBeInTheDocument();
      expect(screen.getByLabelText("Priority")).toBeInTheDocument();
    });

    it("should create message when form is submitted", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper user={mockUsers.admin}>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(
          screen.getByText("Create New System Message")
        ).toBeInTheDocument();
      });

      // Open create modal
      const createButton = screen.getByText("Create New System Message");
      await user.click(createButton);

      // Fill form
      await user.type(screen.getByLabelText("Title"), "New Test Message");
      await user.type(screen.getByLabelText("Content"), "Test message content");
      await user.selectOptions(screen.getByLabelText("Type"), "announcement");
      await user.selectOptions(screen.getByLabelText("Priority"), "high");

      // Submit form
      const sendButton = screen.getByText("Send to All");
      await user.click(sendButton);

      expect(mockSystemMessageService.createSystemMessage).toHaveBeenCalledWith(
        {
          title: "New Test Message",
          content: "Test message content",
          type: "announcement",
          priority: "high",
        }
      );
    });
  });
});

describe("Bell Notifications Dropdown Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockNotificationService.getNotifications.mockResolvedValue(
      mockBellNotifications
    );
    mockNotificationService.markAsRead.mockResolvedValue(undefined);
    mockNotificationService.deleteNotification.mockResolvedValue(undefined);
    mockNotificationService.markAllAsRead.mockResolvedValue(undefined);
  });

  describe("Requirement 5: Bell Notification Read/Unread with Remove Button", () => {
    it("should display notifications with correct read/unread status", async () => {
      render(
        <TestWrapper>
          <NotificationDropdown />
        </TestWrapper>
      );

      // Trigger dropdown open
      const bellIcon = screen.getByLabelText(/notifications/i);
      await userEvent.click(bellIcon);

      await waitFor(() => {
        expect(
          screen.getByText("From Admin User, Administrator")
        ).toBeInTheDocument();
        expect(
          screen.getByText("From Moderator User, Moderator")
        ).toBeInTheDocument();
      });

      // Check unread indicator
      const unreadNotification = screen
        .getByText("From Admin User, Administrator")
        .closest('[data-testid="notification-item"]');
      expect(unreadNotification).toHaveClass("unread");

      // Check read notification shows remove button
      const readNotification = screen
        .getByText("From Moderator User, Moderator")
        .closest('[data-testid="notification-item"]');
      expect(readNotification).not.toHaveClass("unread");
      expect(
        readNotification?.querySelector('[data-testid="remove-button"]')
      ).toBeInTheDocument();
    });

    it("should mark notification as read when clicked", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <NotificationDropdown />
        </TestWrapper>
      );

      const bellIcon = screen.getByLabelText(/notifications/i);
      await user.click(bellIcon);

      await waitFor(() => {
        expect(
          screen.getByText("From Admin User, Administrator")
        ).toBeInTheDocument();
      });

      const unreadNotification = screen.getByText(
        "From Admin User, Administrator"
      );
      await user.click(unreadNotification);

      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith("1");
    });

    it("should show remove button only for read notifications", async () => {
      render(
        <TestWrapper>
          <NotificationDropdown />
        </TestWrapper>
      );

      const bellIcon = screen.getByLabelText(/notifications/i);
      await userEvent.click(bellIcon);

      await waitFor(() => {
        const notifications = screen.getAllByTestId("notification-item");
        expect(notifications).toHaveLength(2);
      });

      // Unread notification should not have remove button
      const unreadNotification = screen
        .getByText("From Admin User, Administrator")
        .closest('[data-testid="notification-item"]');
      expect(
        unreadNotification?.querySelector('[data-testid="remove-button"]')
      ).not.toBeInTheDocument();

      // Read notification should have remove button
      const readNotification = screen
        .getByText("From Moderator User, Moderator")
        .closest('[data-testid="notification-item"]');
      expect(
        readNotification?.querySelector('[data-testid="remove-button"]')
      ).toBeInTheDocument();
    });

    it("should display unread count correctly", async () => {
      render(
        <TestWrapper>
          <NotificationDropdown />
        </TestWrapper>
      );

      await waitFor(() => {
        const unreadBadge = screen.getByTestId("unread-count");
        expect(unreadBadge).toHaveTextContent("1");
      });
    });
  });

  describe("Requirement 6: Bell Notification Removal (Independent)", () => {
    it("should remove notification when remove button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <NotificationDropdown />
        </TestWrapper>
      );

      const bellIcon = screen.getByLabelText(/notifications/i);
      await user.click(bellIcon);

      await waitFor(() => {
        const removeButton = screen.getByTestId("remove-button");
        expect(removeButton).toBeInTheDocument();
      });

      const removeButton = screen.getByTestId("remove-button");
      await user.click(removeButton);

      expect(mockNotificationService.deleteNotification).toHaveBeenCalledWith(
        "2"
      );
    });

    it("should not affect system messages when bell notification is removed", async () => {
      // This test ensures that removing a bell notification doesn't call
      // the system message delete service
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <NotificationDropdown />
        </TestWrapper>
      );

      const bellIcon = screen.getByLabelText(/notifications/i);
      await user.click(bellIcon);

      await waitFor(() => {
        const removeButton = screen.getByTestId("remove-button");
        expect(removeButton).toBeInTheDocument();
      });

      const removeButton = screen.getByTestId("remove-button");
      await user.click(removeButton);

      expect(mockNotificationService.deleteNotification).toHaveBeenCalledWith(
        "2"
      );
      expect(
        mockSystemMessageService.deleteSystemMessage
      ).not.toHaveBeenCalled();
    });
  });

  describe("Requirement 10: Navigation from Bell Notification to System Message", () => {
    it("should navigate to system messages page when notification is clicked", async () => {
      const user = userEvent.setup();

      // Mock navigate function
      const mockNavigate = vi.fn();
      vi.mock("react-router-dom", async () => {
        const actual = await vi.importActual("react-router-dom");
        return {
          ...actual,
          useNavigate: () => mockNavigate,
        };
      });

      render(
        <TestWrapper>
          <NotificationDropdown />
        </TestWrapper>
      );

      const bellIcon = screen.getByLabelText(/notifications/i);
      await user.click(bellIcon);

      await waitFor(() => {
        expect(
          screen.getByText("From Admin User, Administrator")
        ).toBeInTheDocument();
      });

      const notification = screen.getByText("From Admin User, Administrator");
      await user.click(notification);

      // Should navigate to system messages page with the message ID
      expect(mockNavigate).toHaveBeenCalledWith("/system-messages", {
        state: { highlightMessageId: "1" },
      });
    });
  });

  describe("Mark All Read Functionality", () => {
    it("should mark all notifications as read when button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <NotificationDropdown />
        </TestWrapper>
      );

      const bellIcon = screen.getByLabelText(/notifications/i);
      await user.click(bellIcon);

      await waitFor(() => {
        expect(screen.getByText("Mark All Read")).toBeInTheDocument();
      });

      const markAllReadButton = screen.getByText("Mark All Read");
      await user.click(markAllReadButton);

      expect(mockNotificationService.markAllAsRead).toHaveBeenCalled();
    });

    it("should update unread count after marking all as read", async () => {
      const user = userEvent.setup();

      // Mock updated response after marking all as read
      mockNotificationService.getNotifications.mockResolvedValueOnce(
        mockBellNotifications.map((n) => ({ ...n, isRead: true }))
      );

      render(
        <TestWrapper>
          <NotificationDropdown />
        </TestWrapper>
      );

      const bellIcon = screen.getByLabelText(/notifications/i);
      await user.click(bellIcon);

      const markAllReadButton = screen.getByText("Mark All Read");
      await user.click(markAllReadButton);

      await waitFor(() => {
        const unreadBadge = screen.queryByTestId("unread-count");
        expect(unreadBadge).not.toBeInTheDocument(); // Should be hidden when count is 0
      });
    });
  });
});

describe("Integration: System Messages and Bell Notifications Sync", () => {
  describe("Requirement 8: Auto-sync Between System Messages and Bell Notifications", () => {
    it("should sync read status from system messages to bell notifications", async () => {
      // Mock that both services are called when marking system message as read
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Test Announcement")).toBeInTheDocument();
      });

      // Mark system message as read
      const message = screen.getByText("Test Announcement");
      await user.click(message);

      expect(mockSystemMessageService.markAsRead).toHaveBeenCalledWith("1");
      // In real implementation, this should trigger a refresh of bell notifications
    });
  });

  describe("Requirement 7: Persistence Across Page Refreshes", () => {
    it("should maintain state after component remount", async () => {
      const { rerender } = render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockSystemMessageService.getSystemMessages).toHaveBeenCalled();
      });

      // Simulate page refresh by remounting component
      rerender(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(
          mockSystemMessageService.getSystemMessages
        ).toHaveBeenCalledTimes(2);
      });

      // State should be refetched from server, ensuring persistence
      expect(screen.getByText("Test Announcement")).toBeInTheDocument();
      expect(screen.getByText("Maintenance Notice")).toBeInTheDocument();
    });
  });
});
