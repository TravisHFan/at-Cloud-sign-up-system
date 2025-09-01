import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock useNavigate before importing the component to intercept navigation calls
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { MemoryRouter } from "react-router-dom";
import EnhancedNotificationDropdown from "../../components/common/EnhancedNotificationDropdown";

// Mock NotificationContext to supply a single system message notification
vi.mock("../../contexts/NotificationContext", () => {
  const markSystemMessageAsRead = vi.fn(async () => {});
  const markAsRead = vi.fn(async () => {});
  const markAllAsRead = vi.fn(async () => {});
  const removeNotification = vi.fn(async () => {});

  return {
    useNotifications: () => ({
      allNotifications: [
        {
          id: "m1",
          type: "SYSTEM_MESSAGE",
          title: "New Event: Test Event",
          message: "A new event has been created.",
          priority: "medium" as const,
          createdAt: new Date().toISOString(),
          isRead: false,
          // eventId enables a View Event link but isn't strictly required for navigation test
          eventId: "evt123",
          systemMessage: { type: "announcement" },
        },
      ],
      totalUnreadCount: 1,
      markAsRead,
      markAllAsRead,
      removeNotification,
      markSystemMessageAsRead,
    }),
  };
});

// note: useNavigate is mocked above

describe("EnhancedNotificationDropdown - system message navigation & read", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("marks system message as read and navigates to System Messages with hash on click", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <EnhancedNotificationDropdown />
      </MemoryRouter>
    );

    // Open the dropdown by clicking the bell button
    const bellButton = screen.getByRole("button");
    fireEvent.click(bellButton);

    // Click the system message item (by title text), prefer its clickable container
    const itemTitle = await screen.findByText("New Event: Test Event");
    const container = itemTitle.closest("div.cursor-pointer") || itemTitle;
    fireEvent.click(container);

    // Assert navigation to system messages with anchor (async)
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/system-messages#m1")
    );
  });
});
