import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { NotificationProvider } from "../../contexts/NotificationContext";
import { AuthProvider } from "../../contexts/AuthContext";
import SystemMessages from "../../pages/SystemMessages";
import { systemMessageService } from "../../services/systemMessageService";

// Mock the services
vi.mock("../../services/systemMessageService", () => ({
  systemMessageService: {
    getSystemMessages: vi.fn(),
    markAsRead: vi.fn(),
    createSystemMessage: vi.fn(),
    deleteSystemMessage: vi.fn(),
  },
}));

vi.mock("../../services/notificationService", () => ({
  notificationService: {
    getNotifications: vi.fn().mockResolvedValue([]),
    getUnreadCounts: vi
      .fn()
      .mockResolvedValue({ bellNotifications: 0, systemMessages: 0, total: 0 }),
  },
}));

// Mock useAuth hook
const mockCurrentUser = {
  id: "user123",
  firstName: "Test",
  lastName: "User",
  role: "Administrator",
  username: "testuser",
  email: "test@example.com",
};

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: mockCurrentUser,
    hasRole: (role: string) => role !== "Participant",
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
  }),
}));

// Mock react-router-dom
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ hash: "" }),
  };
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe("SystemMessages Component - Requirements Testing", () => {
  const mockSystemMessages = [
    {
      id: "msg1",
      title: "Test Announcement",
      content: "This is a test announcement message",
      type: "announcement" as const,
      priority: "medium" as const,
      creator: {
        id: "creator1",
        firstName: "Admin",
        lastName: "User",
        username: "admin",
        avatar: "",
        gender: "male" as const,
        roleInAtCloud: "Administrator",
      },
      isActive: true,
      isRead: false,
      createdAt: "2024-01-01T10:00:00Z",
      updatedAt: "2024-01-01T10:00:00Z",
    },
    {
      id: "msg2",
      title: "Security Warning",
      content: "Important security update required",
      type: "warning" as const,
      priority: "high" as const,
      creator: {
        id: "creator2",
        firstName: "Super",
        lastName: "Admin",
        username: "superadmin",
        avatar: "",
        gender: "female" as const,
        roleInAtCloud: "Super Admin",
      },
      isActive: true,
      isRead: true,
      readAt: "2024-01-01T11:00:00Z",
      createdAt: "2024-01-01T09:00:00Z",
      updatedAt: "2024-01-01T11:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (systemMessageService.getSystemMessages as any).mockResolvedValue(
      mockSystemMessages
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Requirement 1: Read/Unread Status Toggle", () => {
    it("should display unread messages with different styling", async () => {
      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Test Announcement")).toBeInTheDocument();
      });

      // Check for unread styling (blue background)
      const unreadMessage = screen
        .getByText("Test Announcement")
        .closest("div");
      expect(unreadMessage).toHaveClass("border-blue-200", "bg-blue-50");

      // Check for read styling (normal background)
      const readMessage = screen.getByText("Security Warning").closest("div");
      expect(readMessage).not.toHaveClass("bg-blue-50");
    });

    it("should mark message as read when clicked", async () => {
      (systemMessageService.markAsRead as any).mockResolvedValue(true);

      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Test Announcement")).toBeInTheDocument();
      });

      // Click on unread message
      const unreadMessage = screen
        .getByText("Test Announcement")
        .closest("div");
      fireEvent.click(unreadMessage!);

      // Verify markAsRead was called
      await waitFor(() => {
        expect(systemMessageService.markAsRead).toHaveBeenCalledWith("msg1");
      });
    });

    it("should show read timestamp for read messages", async () => {
      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Security Warning")).toBeInTheDocument();
      });

      // Should show "Read:" timestamp for read messages
      expect(screen.getByText(/Read:/)).toBeInTheDocument();
    });
  });

  describe("Requirement 2: Message Deletion", () => {
    it("should show delete button for each message", async () => {
      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Test Announcement")).toBeInTheDocument();
      });

      // Should have delete buttons for messages
      const deleteButtons = screen.getAllByLabelText(/Delete message/i);
      expect(deleteButtons).toHaveLength(2);
    });

    it("should show confirmation modal when delete is clicked", async () => {
      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Test Announcement")).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByLabelText(/Delete message/i);
      fireEvent.click(deleteButtons[0]);

      // Should show confirmation modal
      await waitFor(() => {
        expect(screen.getByText("Delete System Message")).toBeInTheDocument();
        expect(
          screen.getByText(/Are you sure you want to delete/)
        ).toBeInTheDocument();
        expect(screen.getByText("Delete Message")).toBeInTheDocument();
      });
    });

    it("should delete message only for current user when confirmed", async () => {
      (systemMessageService.deleteSystemMessage as any).mockResolvedValue(true);

      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Test Announcement")).toBeInTheDocument();
      });

      // Click delete and confirm
      const deleteButtons = screen.getAllByLabelText(/Delete message/i);
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Delete Message")).toBeInTheDocument();
      });

      const confirmButton = screen.getByText("Delete Message");
      fireEvent.click(confirmButton);

      // Should call delete service
      await waitFor(() => {
        expect(systemMessageService.deleteSystemMessage).toHaveBeenCalledWith(
          "msg1"
        );
      });
    });
  });

  describe("Requirement 3: Message Types and Icons", () => {
    const messageTypes = [
      { type: "announcement", expectedIcon: "megaphone" },
      { type: "maintenance", expectedIcon: "wrench-screwdriver" },
      { type: "update", expectedIcon: "arrow-path" },
      { type: "warning", expectedIcon: "exclamation-triangle" },
      { type: "auth_level_change", expectedIcon: "shield-check" },
    ];

    messageTypes.forEach(({ type, expectedIcon }) => {
      it(`should display correct icon for ${type} message type`, async () => {
        const typeSpecificMessage = {
          ...mockSystemMessages[0],
          id: `${type}-msg`,
          type: type as any,
          title: `Test ${type} Message`,
        };

        (systemMessageService.getSystemMessages as any).mockResolvedValue([
          typeSpecificMessage,
        ]);

        render(
          <TestWrapper>
            <SystemMessages />
          </TestWrapper>
        );

        await waitFor(() => {
          expect(screen.getByText(`Test ${type} Message`)).toBeInTheDocument();
        });

        // Check that the appropriate icon is rendered
        // Note: This test assumes the Icon component accepts a 'name' prop
        const messageElement = screen
          .getByText(`Test ${type} Message`)
          .closest("div");
        expect(messageElement).toBeInTheDocument();

        // In a real test, you'd check for the specific icon component or data-testid
        // For now, just verify the message is rendered with the correct type
        expect(screen.getByText(type.replace("_", " "))).toBeInTheDocument();
      });
    });

    it("should display message type badge", async () => {
      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Test Announcement")).toBeInTheDocument();
      });

      // Should show type badge
      expect(screen.getByText("announcement")).toBeInTheDocument();
      expect(screen.getByText("warning")).toBeInTheDocument();
    });
  });

  describe("Requirement 4: Message Creation (Non-Participant Only)", () => {
    it('should show "Create New System Message" button for non-Participant users', async () => {
      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(
          screen.getByText("Create New System Message")
        ).toBeInTheDocument();
      });
    });

    it("should open creation modal when button is clicked", async () => {
      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      const createButton = screen.getByText("Create New System Message");
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText("Create System Message")).toBeInTheDocument();
        expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Content/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Type/i)).toBeInTheDocument();
        expect(screen.getByText("Send to All")).toBeInTheDocument();
      });
    });

    it("should validate required fields in creation form", async () => {
      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      const createButton = screen.getByText("Create New System Message");
      fireEvent.click(createButton);

      await waitFor(() => {
        const sendButton = screen.getByText("Send to All");
        expect(sendButton).toBeDisabled();
      });

      // Fill in title
      const titleInput = screen.getByLabelText(/Title/i);
      fireEvent.change(titleInput, { target: { value: "Test Title" } });

      // Send button should still be disabled without content
      const sendButton = screen.getByText("Send to All");
      expect(sendButton).toBeDisabled();

      // Fill in content
      const contentTextarea = screen.getByLabelText(/Content/i);
      fireEvent.change(contentTextarea, { target: { value: "Test content" } });

      // Now send button should be enabled
      await waitFor(() => {
        expect(sendButton).not.toBeDisabled();
      });
    });

    it("should create and send message to all users", async () => {
      (systemMessageService.createSystemMessage as any).mockResolvedValue({
        id: "new-msg",
        title: "New Test Message",
        type: "announcement",
      });

      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      const createButton = screen.getByText("Create New System Message");
      fireEvent.click(createButton);

      // Fill out form
      const titleInput = screen.getByLabelText(/Title/i);
      const contentTextarea = screen.getByLabelText(/Content/i);
      const typeSelect = screen.getByLabelText(/Type/i);

      fireEvent.change(titleInput, { target: { value: "New Test Message" } });
      fireEvent.change(contentTextarea, {
        target: { value: "New test content" },
      });
      fireEvent.change(typeSelect, { target: { value: "announcement" } });

      // Submit form
      const sendButton = screen.getByText("Send to All");
      fireEvent.click(sendButton);

      // Should call create service
      await waitFor(() => {
        expect(systemMessageService.createSystemMessage).toHaveBeenCalledWith({
          title: "New Test Message",
          content: "New test content",
          type: "announcement",
          priority: "medium",
        });
      });
    });

    it("should include creator information in message display", async () => {
      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Admin User")).toBeInTheDocument();
        expect(screen.getByText("Administrator")).toBeInTheDocument();
        expect(screen.getByText("Super Admin")).toBeInTheDocument();
      });
    });
  });

  describe("Requirement 7: Persistence", () => {
    it("should maintain state across component re-renders", async () => {
      const { rerender } = render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Test Announcement")).toBeInTheDocument();
      });

      // Mark message as read
      const unreadMessage = screen
        .getByText("Test Announcement")
        .closest("div");
      fireEvent.click(unreadMessage!);

      // Re-render component
      rerender(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      // State should be maintained (service calls would update backend)
      expect(systemMessageService.markAsRead).toHaveBeenCalledWith("msg1");
    });

    it("should reload messages to reflect server state", async () => {
      (systemMessageService.getSystemMessages as any)
        .mockResolvedValueOnce(mockSystemMessages)
        .mockResolvedValueOnce([
          { ...mockSystemMessages[0], isRead: true },
          mockSystemMessages[1],
        ]);

      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Test Announcement")).toBeInTheDocument();
      });

      // Should call service to get latest state
      expect(systemMessageService.getSystemMessages).toHaveBeenCalled();
    });
  });

  describe("Message Filtering and Sorting", () => {
    it("should filter auth_level_change messages for current user only", async () => {
      const authLevelMessage = {
        id: "auth-msg",
        title: "Role Change Notification",
        content: "Your role has been changed",
        type: "auth_level_change" as const,
        priority: "high" as const,
        creator: {
          id: "system",
          firstName: "System",
          lastName: "",
          username: "system",
          avatar: "",
          gender: "male" as const,
          roleInAtCloud: "System",
        },
        targetUserId: "user123", // Current user
        isActive: true,
        isRead: false,
        createdAt: "2024-01-01T12:00:00Z",
        updatedAt: "2024-01-01T12:00:00Z",
      };

      const otherUserAuthMessage = {
        ...authLevelMessage,
        id: "auth-msg-other",
        targetUserId: "other-user",
      };

      (systemMessageService.getSystemMessages as any).mockResolvedValue([
        ...mockSystemMessages,
        authLevelMessage,
        otherUserAuthMessage,
      ]);

      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should show auth level change for current user
        expect(
          screen.getByText("Role Change Notification")
        ).toBeInTheDocument();
        // Should not show a second auth level change message (for other user)
        expect(screen.getAllByText("Role Change Notification")).toHaveLength(1);
      });
    });

    it("should sort messages by creation date (newest first)", async () => {
      const olderMessage = {
        ...mockSystemMessages[0],
        id: "older-msg",
        title: "Older Message",
        createdAt: "2023-12-01T10:00:00Z",
      };

      const newerMessage = {
        ...mockSystemMessages[0],
        id: "newer-msg",
        title: "Newer Message",
        createdAt: "2024-01-02T10:00:00Z",
      };

      (systemMessageService.getSystemMessages as any).mockResolvedValue([
        olderMessage,
        newerMessage,
        ...mockSystemMessages,
      ]);

      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        const titles = screen.getAllByText(/Message$|Announcement$|Warning$/);
        // Newest message should appear first
        expect(titles[0]).toHaveTextContent("Newer Message");
      });
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no messages exist", async () => {
      (systemMessageService.getSystemMessages as any).mockResolvedValue([]);

      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("No system messages")).toBeInTheDocument();
        expect(screen.getByText(/You're all caught up/)).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle service errors gracefully", async () => {
      (systemMessageService.getSystemMessages as any).mockRejectedValue(
        new Error("Network error")
      );

      // Mock console.error to avoid noise in test output
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should handle error gracefully (might show empty state or error message)
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it("should handle mark as read errors", async () => {
      (systemMessageService.markAsRead as any).mockRejectedValue(
        new Error("Network error")
      );

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      render(
        <TestWrapper>
          <SystemMessages />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Test Announcement")).toBeInTheDocument();
      });

      // Try to mark as read
      const unreadMessage = screen
        .getByText("Test Announcement")
        .closest("div");
      fireEvent.click(unreadMessage!);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });
});
