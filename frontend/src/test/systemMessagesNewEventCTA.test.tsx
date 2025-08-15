import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SystemMessages from "../pages/SystemMessages";
import { AuthProvider } from "../contexts/AuthContext";
import { NotificationProvider as NotificationModalProvider } from "../contexts/NotificationModalContext";

// Mock NotificationContext to supply a new-event system message with metadata.eventId
vi.mock("../contexts/NotificationContext", () => ({
  useNotifications: () => ({
    systemMessages: [
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
    markSystemMessageAsRead: vi.fn(),
    reloadSystemMessages: vi.fn(),
  }),
  NotificationProvider: ({ children }: any) => children,
}));

describe("SystemMessages new event CTA", () => {
  it("renders View Event Details button for new event message", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/system-messages"]}>
        <AuthProvider>
          <NotificationModalProvider>
            <SystemMessages />
          </NotificationModalProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    const btn = screen.getByRole("link", { name: /view event details/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("href", "/dashboard/event/evt123");
  });
});
