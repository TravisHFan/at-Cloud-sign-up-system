import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SystemMessages from "../pages/SystemMessages";
import { AuthProvider } from "../contexts/AuthContext";
import { NotificationProvider as NotificationModalProvider } from "../contexts/NotificationModalContext";
import { NotificationProvider } from "../contexts/NotificationContext";

// Mock systemMessageService to provide one new-event message via paginated API
vi.mock("../services/systemMessageService", async () => {
  const actual = await vi.importActual<any>("../services/systemMessageService");
  return {
    ...actual,
    systemMessageService: {
      getSystemMessagesPaginated: vi.fn().mockResolvedValue({
        messages: [
          {
            id: "m_evt1",
            title: "New Event: Test Event",
            content: "A new event Test Event has been created.",
            type: "announcement",
            priority: "medium",
            createdAt: new Date().toISOString(),
            isRead: false,
            metadata: { eventId: "evt123", kind: "new_event" },
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
      getSystemMessages: vi.fn().mockResolvedValue([]),
      getUnreadCount: vi.fn().mockResolvedValue(1),
      markAsRead: vi.fn().mockResolvedValue(true),
    },
  };
});

describe("SystemMessages new event CTA", () => {
  it("renders View Event Details button for new event message", async () => {
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

    // Wait for the async messages to load and the CTA link to render
    const btn = await screen.findByRole("link", {
      name: /view event details/i,
    });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("href", "/dashboard/event/evt123");
  });
});
