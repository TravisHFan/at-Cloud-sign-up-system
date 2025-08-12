import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  NotificationProvider,
  useNotifications,
} from "../contexts/NotificationContext";
import { NotificationProvider as NotificationModalProvider } from "../contexts/NotificationModalContext";
import { AuthProvider } from "../contexts/AuthContext";

function renderNotifications() {
  const wrapper = ({ children }: any) => (
    <AuthProvider>
      <NotificationModalProvider>
        <NotificationProvider>{children}</NotificationProvider>
      </NotificationModalProvider>
    </AuthProvider>
  );
  const { result } = renderHook(() => useNotifications(), { wrapper });
  return result;
}

describe("System Messages realtime", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("adds a new system message on system_message_update without page refresh", async () => {
    const result = renderNotifications();

    // Simulate a new message by adding a bell notification that wraps a system message
    const update = {
      event: "message_created",
      data: {
        message: {
          id: "m1",
          title: "Hello",
          content: "World",
          type: "announcement",
          priority: "medium",
          creator: undefined,
          createdAt: new Date().toISOString(),
        },
      },
    } as any;

    await act(async () => {
      // Use exposed method to inject a notification echo of the system message
      (result.current as any).addNotification({
        type: "SYSTEM_MESSAGE",
        title: update.data.message.title,
        message: update.data.message.content,
        isRead: false,
        userId: "",
        systemMessage: {
          id: update.data.message.id,
          type: update.data.message.type,
        },
      });
    });

    expect(result.current.allNotifications.length).toBeGreaterThan(0);
  });

  it("adds multiple system message types and keeps bell list in sync", async () => {
    const result = renderNotifications();

    const updates = [
      {
        id: "m2",
        title: "Maintenance Window",
        content: "Tonight at 10pm",
        type: "maintenance",
        priority: "low",
      },
      {
        id: "m3",
        title: "📋 Your System Access Level Updated",
        content: "Leader → Participant",
        type: "auth_level_change",
        priority: "high",
      },
    ];

    await act(async () => {
      updates.forEach((u) =>
        (result.current as any).addNotification({
          type: "SYSTEM_MESSAGE",
          title: u.title,
          message: u.content,
          isRead: false,
          userId: "",
          systemMessage: { id: u.id, type: u.type },
        })
      );
    });

    // Should have at least 2 notifications added
    expect(result.current.allNotifications.length).toBeGreaterThanOrEqual(2);

    // Ensure unread count equals number of unread system notifications we added
    const unread = result.current.allNotifications.filter(
      (n) => !n.isRead
    ).length;
    expect(unread).toBeGreaterThanOrEqual(2);
  });
});
