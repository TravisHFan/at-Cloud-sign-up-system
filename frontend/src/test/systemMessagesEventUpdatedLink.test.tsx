import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { vi, describe, test, expect } from "vitest";
import SystemMessages from "../pages/SystemMessages";
import { NotificationProvider as NotificationModalProvider } from "../contexts/NotificationModalContext";
import { AuthProvider } from "../contexts/AuthContext";
import { NotificationProvider } from "../contexts/NotificationContext";

// Mock services
vi.mock("../services/api", () => ({
  default: {
    request: vi.fn().mockResolvedValue({}),
    getProfile: vi.fn().mockResolvedValue({}),
  },
  authService: {
    getToken: vi.fn().mockReturnValue("mock-token"),
    isAuthenticated: vi.fn().mockReturnValue(true),
    getUser: vi.fn().mockReturnValue({ id: "user1", name: "Test User" }),
  },
}));

// Mock systemMessageService to provide paginated messages consumed by SystemMessages
vi.mock("../services/systemMessageService", async () => {
  const actual = await vi.importActual<any>("../services/systemMessageService");
  return {
    ...actual,
    systemMessageService: {
      getSystemMessagesPaginated: vi.fn().mockResolvedValue({
        messages: [
          {
            id: "sm1",
            title: "Event Updated: Team Meeting",
            content: 'The event "Team Meeting" has been updated.',
            type: "update",
            priority: "medium",
            isActive: true,
            isRead: false,
            createdAt: "2025-01-15T10:00:00Z",
            updatedAt: "2025-01-15T10:00:00Z",
            metadata: { eventId: "event123" },
          },
          {
            id: "sm2",
            title: "New Event: Weekly Standup",
            content: 'A new event "Weekly Standup" has been created.',
            type: "announcement",
            priority: "medium",
            isActive: true,
            isRead: false,
            createdAt: "2025-01-15T11:00:00Z",
            updatedAt: "2025-01-15T11:00:00Z",
            metadata: { eventId: "event456" },
          },
          {
            id: "sm3",
            title: "General Announcement",
            content: "This is a general system message without event details.",
            type: "announcement",
            priority: "low",
            isActive: true,
            isRead: false,
            createdAt: "2025-01-15T12:00:00Z",
            updatedAt: "2025-01-15T12:00:00Z",
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: 3,
          hasNext: false,
          hasPrev: false,
        },
        unreadCount: 3,
      }),
      getSystemMessages: vi.fn().mockResolvedValue([]),
      getUnreadCount: vi.fn().mockResolvedValue(3),
      markAsRead: vi.fn().mockResolvedValue(true),
    },
  };
});

vi.mock("../services/socketService", () => ({
  socketService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

describe("SystemMessages - Event Updated Link Button", () => {
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

  test("shows View Event Details button for Event Updated messages", async () => {
    renderWithProviders(<SystemMessages />);

    // Wait for system messages to load
    await screen.findByText("Event Updated: Team Meeting");

    // Check that the "View Event Details" button appears for the Event Updated message
    const eventUpdatedMessage = screen
      .getByText("Event Updated: Team Meeting")
      .closest("div");
    expect(eventUpdatedMessage).toBeInTheDocument();

    // Look for all View Event Details buttons
    const viewEventButtons = screen.getAllByRole("link", {
      name: /view event details/i,
    });

    // Find the specific button for the Event Updated message
    const eventUpdatedButton = viewEventButtons.find(
      (button) => button.getAttribute("href") === "/dashboard/event/event123"
    );
    expect(eventUpdatedButton).toBeInTheDocument();
    expect(eventUpdatedButton).toHaveAttribute(
      "href",
      "/dashboard/event/event123"
    );
  });

  test("shows View Event Details button for New Event messages", async () => {
    renderWithProviders(<SystemMessages />);

    // Wait for system messages to load
    await screen.findByText("New Event: Weekly Standup");

    // Check that the "View Event Details" button appears for the New Event message
    const newEventMessage = screen
      .getByText("New Event: Weekly Standup")
      .closest("div");
    expect(newEventMessage).toBeInTheDocument();

    // Look for the View Event Details button within the New Event message container
    const viewEventButtons = screen.getAllByRole("link", {
      name: /view event details/i,
    });

    // Should have buttons for both "Event Updated" and "New Event" messages
    expect(viewEventButtons).toHaveLength(2);

    // Check the href for the New Event button
    const newEventButton = viewEventButtons.find(
      (button) => button.getAttribute("href") === "/dashboard/event/event456"
    );
    expect(newEventButton).toBeInTheDocument();
  });

  test("does not show View Event Details button for general messages", async () => {
    renderWithProviders(<SystemMessages />);

    // Wait for system messages to load
    await screen.findByText("General Announcement");

    // Check that the general message doesn't have a View Event Details button
    const generalMessage = screen
      .getByText("General Announcement")
      .closest("div");
    expect(generalMessage).toBeInTheDocument();

    // Should only have 2 View Event Details buttons (for Event Updated and New Event)
    const viewEventButtons = screen.getAllByRole("link", {
      name: /view event details/i,
    });
    expect(viewEventButtons).toHaveLength(2);
  });

  test("View Event Details buttons have correct styling", async () => {
    renderWithProviders(<SystemMessages />);

    // Wait for system messages to load
    await screen.findByText("Event Updated: Team Meeting");

    // Check that View Event Details buttons have the gradient styling
    const viewEventButtons = screen.getAllByRole("link", {
      name: /view event details/i,
    });

    viewEventButtons.forEach((button) => {
      expect(button).toHaveClass("bg-gradient-to-r");
      expect(button).toHaveClass("from-blue-600");
      expect(button).toHaveClass("to-indigo-600");
      expect(button).toHaveClass("text-white");
      expect(button).toHaveClass("font-semibold");
      expect(button).toHaveClass("py-3");
      expect(button).toHaveClass("px-4");
      expect(button).toHaveClass("rounded-lg");
    });
  });
});
