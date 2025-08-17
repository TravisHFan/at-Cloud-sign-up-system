import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  NotificationProvider,
  useNotifications,
} from "../../contexts/NotificationContext";
import { NotificationProvider as NotificationModalProvider } from "../../contexts/NotificationModalContext";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";

// Mock API getProfile to return updated role after role-change message
vi.mock("../../services/api", async (orig) => {
  const actual = await (orig as any).default?.();
  return {
    ...(actual || {}),
    authService: {
      getProfile: vi.fn(async () => ({
        id: "u1",
        username: "demo",
        firstName: "Demo",
        lastName: "User",
        email: "demo@example.com",
        role: "Leader",
        isAtCloudLeader: true,
        roleInAtCloud: "Team Lead",
        gender: "male",
        avatar: null,
      })),
      login: vi.fn(),
      logout: vi.fn(),
    },
  } as any;
});

function renderAll() {
  const wrapper = ({ children }: any) => (
    <AuthProvider>
      <NotificationModalProvider>
        <NotificationProvider>{children}</NotificationProvider>
      </NotificationModalProvider>
    </AuthProvider>
  );
  const notifications = renderHook(() => useNotifications(), { wrapper });
  const auth = renderHook(() => useAuth(), { wrapper });
  return { notifications, auth };
}

describe("Role change reflects without refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("authToken", "t");
  });

  it("updates AuthContext role when auth_level_change system message arrives", async () => {
    const { notifications, auth } = renderAll();

    // Simulate system message 'message_created' for role change
    await act(async () => {
      // Access internal handler via exposed context path by simulating the bell echo
      (notifications.result.current as any).addNotification({
        type: "SYSTEM_MESSAGE",
        title: "📋 Your System Access Level Updated",
        message: "Participant → Leader",
        isRead: false,
        userId: "",
        systemMessage: {
          id: "role1",
          type: "auth_level_change",
        },
      });
    });

    // NotificationContext will call authService.getProfile and update AuthContext
    await waitFor(() => {
      expect(auth.result.current.currentUser?.role).toBe("Leader");
      expect(auth.result.current.currentUser?.isAtCloudLeader).toBe("Yes");
      expect(auth.result.current.currentUser?.roleInAtCloud).toBe("Team Lead");
    });
  });
});
