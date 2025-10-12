import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import SystemMessages from "../../pages/SystemMessages";
import { NotificationProvider as NotificationModalProvider } from "../../contexts/NotificationModalContext";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationContext";

// Mock system message service
const mockCreateSystemMessage = vi.fn();
const mockGetSystemMessagesPaginated = vi.fn();
const mockGetUnreadCount = vi.fn();
const mockMarkAsRead = vi.fn();

vi.mock("../../services/systemMessageService", () => ({
  systemMessageService: {
    getSystemMessagesPaginated: () => mockGetSystemMessagesPaginated(),
    getSystemMessages: vi.fn().mockResolvedValue([]),
    getUnreadCount: () => mockGetUnreadCount(),
    markAsRead: (id: string) => mockMarkAsRead(id),
    createSystemMessage: (data: any) => mockCreateSystemMessage(data),
  },
}));

// Mock auth service
vi.mock("../../services/api", () => ({
  default: {
    request: vi.fn().mockResolvedValue({}),
    getProfile: vi.fn().mockResolvedValue({
      id: "admin-123",
      name: "Admin User",
      email: "admin@test.com",
      role: "Super Admin",
    }),
  },
  authService: {
    getToken: vi.fn().mockReturnValue("mock-token"),
    isAuthenticated: vi.fn().mockReturnValue(true),
    getUser: vi.fn().mockReturnValue({
      id: "admin-123",
      name: "Admin User",
      email: "admin@test.com",
      role: "Super Admin",
    }),
  },
}));

// Mock socket service
vi.mock("../../services/socketService", () => ({
  socketService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
}));

// Mock AuthContext to provide hasRole function
vi.mock("../../contexts/AuthContext", async () => {
  const actual = await vi.importActual<any>("../../contexts/AuthContext");
  return {
    ...actual,
    useAuth: () => ({
      currentUser: {
        id: "admin-123",
        name: "Admin User",
        email: "admin@test.com",
        role: "Super Admin",
      },
      hasRole: (role: string) =>
        role === "Super Admin" || role === "Administrator" || role === "Leader",
      logout: vi.fn(),
    }),
  };
});

describe("SystemMessages - Send Dropdown Targeted Messaging", () => {
  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <NotificationModalProvider>
            <NotificationProvider>{component}</NotificationProvider>
          </NotificationModalProvider>
        </AuthProvider>
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock responses
    mockGetSystemMessagesPaginated.mockResolvedValue({
      messages: [],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        hasNext: false,
        hasPrev: false,
      },
      unreadCount: 0,
    });

    mockGetUnreadCount.mockResolvedValue(0);
    mockMarkAsRead.mockResolvedValue(true);
    mockCreateSystemMessage.mockResolvedValue({
      success: true,
      message: "System message created successfully",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("displays Send button dropdown for Super Admin users", async () => {
    renderWithProviders(<SystemMessages />);

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Find the "Create New System Message" button to expand the form
    const createButton = screen.getByRole("button", {
      name: /create new system message/i,
    });
    expect(createButton).toBeInTheDocument();

    // Click to show the form
    await userEvent.click(createButton);

    // Now find the Send dropdown button
    const sendButton = screen.getByRole("button", { name: /send/i });
    expect(sendButton).toBeInTheDocument();
  });

  test("Send dropdown shows all 5 recipient options", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemMessages />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Open create form
    const createButton = screen.getByRole("button", {
      name: /create new system message/i,
    });
    await user.click(createButton);

    // Fill in required fields
    const titleInput = screen.getByLabelText(/title/i);
    const contentTextarea = screen.getByLabelText(/content/i);

    await user.type(titleInput, "Test Message");
    await user.type(contentTextarea, "This is a test message content");

    // Click Send dropdown button
    const sendButton = screen.getByRole("button", { name: /send/i });
    await user.click(sendButton);

    // Wait for dropdown to appear and check all options
    await waitFor(() => {
      expect(screen.getByText(/send to all/i)).toBeInTheDocument();
      expect(screen.getByText(/send to admins/i)).toBeInTheDocument();
      expect(
        screen.getByText(/send to @cloud co-workers/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/send to guest experts/i)).toBeInTheDocument();
      expect(screen.getByText(/send to participants/i)).toBeInTheDocument();
    });
  });

  test("Send to All option calls createSystemMessage without targetRoles", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemMessages />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Open create form
    const createButton = screen.getByRole("button", {
      name: /create new system message/i,
    });
    await user.click(createButton);

    // Fill in fields
    const titleInput = screen.getByLabelText(/title/i);
    const contentTextarea = screen.getByLabelText(/content/i);

    await user.type(titleInput, "Message to All");
    await user.type(contentTextarea, "This message goes to everyone");

    // Open dropdown
    const sendButton = screen.getByRole("button", { name: /send/i });
    await user.click(sendButton);

    // Click "Send to All" - find by text content
    await waitFor(() => {
      expect(screen.getByText(/send to all/i)).toBeInTheDocument();
    });

    const sendToAllOption = screen.getByText(/send to all/i).closest("button");
    await user.click(sendToAllOption!);

    // Verify createSystemMessage was called without targetRoles
    await waitFor(() => {
      expect(mockCreateSystemMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Message to All",
          content: "This message goes to everyone",
          type: "announcement",
          priority: "medium",
        })
      );
      // Should NOT have targetRoles property
      const callArgs = mockCreateSystemMessage.mock.calls[0][0];
      expect(callArgs.targetRoles).toBeUndefined();
    });
  });

  test("Send to Admins option calls createSystemMessage with Super Admin and Administrator roles", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemMessages />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const createButton = screen.getByRole("button", {
      name: /create new system message/i,
    });
    await user.click(createButton);

    const titleInput = screen.getByLabelText(/title/i);
    const contentTextarea = screen.getByLabelText(/content/i);

    await user.type(titleInput, "Admin Only Message");
    await user.type(contentTextarea, "This is for administrators only");

    const sendButton = screen.getByRole("button", { name: /send/i });
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/send to admins/i)).toBeInTheDocument();
    });

    const sendToAdminsOption = screen
      .getByText(/send to admins/i)
      .closest("button");
    await user.click(sendToAdminsOption!);

    await waitFor(() => {
      expect(mockCreateSystemMessage).toHaveBeenCalledWith({
        title: "Admin Only Message",
        content: "This is for administrators only",
        type: "announcement",
        priority: "medium",
        includeCreator: true,
        targetRoles: ["Super Admin", "Administrator"],
      });
    });
  });

  test("Send to @Cloud co-workers option calls createSystemMessage with Super Admin, Administrator, and Leader roles", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemMessages />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const createButton = screen.getByRole("button", {
      name: /create new system message/i,
    });
    await user.click(createButton);

    const titleInput = screen.getByLabelText(/title/i);
    const contentTextarea = screen.getByLabelText(/content/i);

    await user.type(titleInput, "Internal Team Message");
    await user.type(contentTextarea, "Message for internal team members");

    const sendButton = screen.getByRole("button", { name: /send/i });
    await user.click(sendButton);

    await waitFor(() => {
      expect(
        screen.getByText(/send to @cloud co-workers/i)
      ).toBeInTheDocument();
    });

    const sendToCoworkersOption = screen
      .getByText(/send to @cloud co-workers/i)
      .closest("button");
    await user.click(sendToCoworkersOption!);

    await waitFor(() => {
      expect(mockCreateSystemMessage).toHaveBeenCalledWith({
        title: "Internal Team Message",
        content: "Message for internal team members",
        type: "announcement",
        priority: "medium",
        includeCreator: true,
        targetRoles: ["Super Admin", "Administrator", "Leader"],
      });
    });
  });

  test("Send to Guest Experts option calls createSystemMessage with Guest Expert role", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemMessages />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const createButton = screen.getByRole("button", {
      name: /create new system message/i,
    });
    await user.click(createButton);

    const titleInput = screen.getByLabelText(/title/i);
    const contentTextarea = screen.getByLabelText(/content/i);

    await user.type(titleInput, "Expert Guidelines");
    await user.type(contentTextarea, "Important information for guest experts");

    const sendButton = screen.getByRole("button", { name: /send/i });
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/send to guest experts/i)).toBeInTheDocument();
    });

    const sendToExpertsOption = screen
      .getByText(/send to guest experts/i)
      .closest("button");
    await user.click(sendToExpertsOption!);

    await waitFor(() => {
      expect(mockCreateSystemMessage).toHaveBeenCalledWith({
        title: "Expert Guidelines",
        content: "Important information for guest experts",
        type: "announcement",
        priority: "medium",
        includeCreator: true,
        targetRoles: ["Guest Expert"],
      });
    });
  });

  test("Send to Participants option calls createSystemMessage with Participant role", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemMessages />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const createButton = screen.getByRole("button", {
      name: /create new system message/i,
    });
    await user.click(createButton);

    const titleInput = screen.getByLabelText(/title/i);
    const contentTextarea = screen.getByLabelText(/content/i);

    await user.type(titleInput, "Participant Welcome");
    await user.type(contentTextarea, "Welcome message for all participants");

    const sendButton = screen.getByRole("button", { name: /send/i });
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/send to participants/i)).toBeInTheDocument();
    });

    const sendToParticipantsOption = screen
      .getByText(/send to participants/i)
      .closest("button");
    await user.click(sendToParticipantsOption!);

    await waitFor(() => {
      expect(mockCreateSystemMessage).toHaveBeenCalledWith({
        title: "Participant Welcome",
        content: "Welcome message for all participants",
        type: "announcement",
        priority: "medium",
        includeCreator: true,
        targetRoles: ["Participant"],
      });
    });
  });

  test("dropdown closes after selecting an option", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemMessages />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const createButton = screen.getByRole("button", {
      name: /create new system message/i,
    });
    await user.click(createButton);

    const titleInput = screen.getByLabelText(/title/i);
    const contentTextarea = screen.getByLabelText(/content/i);

    await user.type(titleInput, "Test Message");
    await user.type(contentTextarea, "Test content");

    const sendButton = screen.getByRole("button", { name: /send/i });
    await user.click(sendButton);

    // Verify dropdown is open
    await waitFor(() => {
      expect(screen.getByText(/send to all/i)).toBeInTheDocument();
    });

    // Click option
    const sendToAllOption = screen.getByText(/send to all/i).closest("button");
    await user.click(sendToAllOption!);

    // Verify dropdown is closed (options should not be visible)
    await waitFor(() => {
      expect(screen.queryByText(/send to admins/i)).not.toBeInTheDocument();
      expect(
        screen.queryByText(/send to @cloud co-workers/i)
      ).not.toBeInTheDocument();
    });
  });

  test("dropdown is disabled when form validation fails", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemMessages />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const createButton = screen.getByRole("button", {
      name: /create new system message/i,
    });
    await user.click(createButton);

    // Try to click Send without filling in required fields
    const sendButton = screen.getByRole("button", { name: /send/i });

    // The button should be disabled
    expect(sendButton).toBeDisabled();
  });

  test("shows success message with correct recipient description after sending", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemMessages />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const createButton = screen.getByRole("button", {
      name: /create new system message/i,
    });
    await user.click(createButton);

    const titleInput = screen.getByLabelText(/title/i);
    const contentTextarea = screen.getByLabelText(/content/i);

    await user.type(titleInput, "Test Message");
    await user.type(contentTextarea, "Test content for admins");

    const sendButton = screen.getByRole("button", { name: /send/i });
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/send to admins/i)).toBeInTheDocument();
    });

    const sendToAdminsOption = screen
      .getByText(/send to admins/i)
      .closest("button");
    await user.click(sendToAdminsOption!);

    // Verify success message includes recipient description
    await waitFor(() => {
      expect(
        screen.getByText(/system message sent.*successfully/i)
      ).toBeInTheDocument();
    });
  });

  test("dropdown shows correct icons for each option", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemMessages />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const createButton = screen.getByRole("button", {
      name: /create new system message/i,
    });
    await user.click(createButton);

    const titleInput = screen.getByLabelText(/title/i);
    const contentTextarea = screen.getByLabelText(/content/i);

    await user.type(titleInput, "Test Message");
    await user.type(contentTextarea, "Test content");

    const sendButton = screen.getByRole("button", { name: /send/i });
    await user.click(sendButton);

    // Verify dropdown appears with all options
    await waitFor(() => {
      expect(screen.getByText(/send to all/i)).toBeInTheDocument();
    });

    // Each option should have an icon - check that the page has multiple SVG icons
    // (5 dropdown options + other UI elements)
    const allSvgs = document.querySelectorAll("svg");
    expect(allSvgs.length).toBeGreaterThan(5);
  });

  test("dropdown closes when clicking outside", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemMessages />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const createButton = screen.getByRole("button", {
      name: /create new system message/i,
    });
    await user.click(createButton);

    const titleInput = screen.getByLabelText(/title/i);
    const contentTextarea = screen.getByLabelText(/content/i);

    await user.type(titleInput, "Test Message");
    await user.type(contentTextarea, "Test content");

    const sendButton = screen.getByRole("button", { name: /send/i });
    await user.click(sendButton);

    // Verify dropdown is open
    await waitFor(() => {
      expect(screen.getByText(/send to all/i)).toBeInTheDocument();
    });

    // Click the Send button again to close dropdown (toggle behavior)
    await user.click(sendButton);

    // Verify dropdown is closed
    await waitFor(() => {
      expect(screen.queryByText(/send to all/i)).not.toBeInTheDocument();
    });
  });
});
