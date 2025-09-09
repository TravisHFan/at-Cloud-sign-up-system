import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SystemMessages from "../pages/SystemMessages";
import { AuthProvider } from "../contexts/AuthContext";
import { NotificationProvider as NotificationModalProvider } from "../contexts/NotificationModalContext";
import { NotificationProvider } from "../contexts/NotificationContext";

// Mock AuthContext
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user123",
      firstName: "Test",
      lastName: "User",
      role: "Member",
      roleInAtCloud: "Member",
    },
    loading: false,
    hasRole: vi.fn(() => false), // Mock hasRole function to return false for all roles
  }),
  AuthProvider: ({ children }: any) => children,
}));

// Silence socket usage in NotificationContext
vi.mock("../hooks/useSocket", () => ({
  useSocket: () => ({ socket: undefined, connected: false }),
}));

// Mock systemMessageService to supply paginated messages
vi.mock("../services/systemMessageService", async () => {
  const actual = await vi.importActual<any>("../services/systemMessageService");
  return {
    ...actual,
    systemMessageService: {
      getSystemMessagesPaginated: vi.fn().mockResolvedValue({
        messages: [
          {
            id: "m_rec1",
            title: "New Recurring Program: Weekly Team Meeting",
            content:
              "A new recurring program Weekly Team Meeting has been created for 2025-02-01 at 10:00. This will meet every two weeks.",
            type: "announcement",
            priority: "medium",
            createdAt: new Date().toISOString(),
            isRead: false,
            metadata: { eventId: "event_series_123", kind: "new_event" },
          },
          {
            id: "m_evt2",
            title: "New Event: Single Event",
            content: "A new event Single Event has been created.",
            type: "announcement",
            priority: "medium",
            createdAt: new Date().toISOString(),
            isRead: false,
            metadata: { eventId: "single_event_456", kind: "new_event" },
          },
          {
            id: "m_gen1",
            title: "General Announcement",
            content: "This is a general announcement without event metadata.",
            type: "announcement",
            priority: "medium",
            createdAt: new Date().toISOString(),
            isRead: false,
            metadata: { kind: "general" },
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

describe("SystemMessages - Recurring Program CTA", () => {
  it("shows View Event Details button for New Recurring Program messages", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/system-messages"]}>
        <AuthProvider>
          <NotificationModalProvider>
            <NotificationProvider>
              <SystemMessages />
            </NotificationProvider>
          </NotificationModalProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // Wait for system messages to load
    await screen.findByText("New Recurring Program: Weekly Team Meeting");

    // Check that the "View Event Details" button appears for the recurring program message
    const recurringMessage = screen
      .getByText("New Recurring Program: Weekly Team Meeting")
      .closest("div");
    expect(recurringMessage).toBeInTheDocument();

    // Look for all View Event Details buttons
    const viewEventButtons = screen.getAllByRole("link", {
      name: /view event details/i,
    });

    // Should have buttons for both "New Recurring Program" and "New Event" messages (but not general)
    expect(viewEventButtons).toHaveLength(2);

    // Find the specific button for the recurring program message
    const recurringProgramButton = viewEventButtons.find(
      (button) =>
        button.getAttribute("href") === "/dashboard/event/event_series_123"
    );
    expect(recurringProgramButton).toBeInTheDocument();
    expect(recurringProgramButton).toHaveAttribute(
      "href",
      "/dashboard/event/event_series_123"
    );
  });

  it("View Event Details button for recurring program has correct styling", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/system-messages"]}>
        <AuthProvider>
          <NotificationModalProvider>
            <NotificationProvider>
              <SystemMessages />
            </NotificationProvider>
          </NotificationModalProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // Wait for system messages to load
    await screen.findByText("New Recurring Program: Weekly Team Meeting");

    const viewEventButtons = screen.getAllByRole("link", {
      name: /view event details/i,
    });

    const recurringProgramButton = viewEventButtons.find(
      (button) =>
        button.getAttribute("href") === "/dashboard/event/event_series_123"
    );

    // Check that the button has the correct CSS classes for styling
    expect(recurringProgramButton).toHaveClass(
      "block",
      "w-full",
      "text-center",
      "bg-gradient-to-r",
      "from-blue-600",
      "to-indigo-600"
    );
  });

  it("does not show View Event Details button for general messages without eventId", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/system-messages"]}>
        <AuthProvider>
          <NotificationModalProvider>
            <NotificationProvider>
              <SystemMessages />
            </NotificationProvider>
          </NotificationModalProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // Wait for system messages to load
    await screen.findByText("General Announcement");

    // Check that the general message doesn't have a View Event Details button
    const generalMessage = screen
      .getByText("General Announcement")
      .closest("div");
    expect(generalMessage).toBeInTheDocument();

    // Should only have 2 View Event Details buttons (for recurring program and single event, not general)
    const viewEventButtons = screen.getAllByRole("link", {
      name: /view event details/i,
    });
    expect(viewEventButtons).toHaveLength(2);

    // Verify none of the buttons link to a general announcement
    viewEventButtons.forEach((button) => {
      expect(button.getAttribute("href")).not.toBeNull();
      expect(button.getAttribute("href")).toMatch(/^\/dashboard\/event\//);
    });
  });
});
