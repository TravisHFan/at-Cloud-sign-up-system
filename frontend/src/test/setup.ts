import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// 1) Quiet noisy logs from expected network/socket failures in jsdom
beforeAll(() => {
  const originalError = console.error;
  const originalWarn = console.warn;

  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const msg = args?.[0];
    if (
      typeof msg === "string" &&
      (msg.includes("API Request failed") ||
        msg.includes("Token validation failed") ||
        msg.includes("System Message API Request failed") ||
        msg.includes("Notification API Request failed") ||
        msg.includes("Socket connection error") ||
        msg.includes("not configured to support act("))
    ) {
      // Suppress expected noisy errors in tests
      return;
    }
    // Forward anything else
    return originalError.apply(console, args as [unknown, ...unknown[]]);
  });

  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    const msg = args?.[0];
    if (
      typeof msg === "string" &&
      (msg.includes("Socket connection timeout") ||
        msg.includes("Cannot join event room") ||
        msg.includes("Invalid namespace error detected"))
    ) {
      return;
    }
    return originalWarn.apply(console, args as [unknown, ...unknown[]]);
  });
});

// 1.1) Lightweight global fetch stub for known auth/notification endpoints
// Avoid real network errors (ECONNREFUSED) while preserving behavior shape
const ORIGINAL_FETCH: typeof fetch | undefined = globalThis.fetch;
function jsonResponse(payload: unknown, status = 200) {
  // Use native Response if available; otherwise provide a minimal shim
  if (typeof Response !== "undefined") {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
  const urlStr =
    typeof input === "string" ? input : (input as Request).url ?? String(input);
  let pathname = "";
  try {
    const u = new URL(urlStr);
    pathname = u.pathname;
  } catch {
    // Not an absolute URL; try to treat as pathname directly
    pathname = urlStr;
  }

  const method = (init?.method || "GET").toUpperCase();

  // Normalize to handle both absolute and relative '/api/*' paths
  const isAuth =
    pathname.includes("/api/auth/") ||
    pathname.endsWith("/api/auth") ||
    pathname === "/auth/profile";
  const isNotifications = pathname.includes("/api/notifications");

  // Stub auth profile and refresh minimally
  if (isAuth) {
    if (pathname.includes("/auth/profile")) {
      return jsonResponse({
        success: true,
        message: "ok",
        data: {
          user: {
            id: "test-user",
            username: "tester",
            email: "tester@example.com",
            role: "Administrator",
            isAtCloudLeader: true,
            roleInAtCloud: "Administrator",
          },
        },
      });
    }
    if (pathname.includes("/auth/refresh-token")) {
      return jsonResponse({
        success: true,
        message: "ok",
        data: {
          accessToken: "test-token",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      });
    }
    // Generic auth success
    return jsonResponse({ success: true, message: "ok", data: {} });
  }

  // Stub unified notifications endpoints
  if (isNotifications) {
    if (pathname.includes("/notifications/unread-counts")) {
      return jsonResponse({
        success: true,
        message: "ok",
        data: { bellNotifications: 0, systemMessages: 0, total: 0 },
      });
    }

    if (pathname.includes("/notifications/bell")) {
      if (method === "PATCH" || method === "DELETE" || method === "POST") {
        return jsonResponse({ success: true, message: "ok", data: {} });
      }
      return jsonResponse({
        success: true,
        message: "ok",
        data: { notifications: [], unreadCount: 0 },
      });
    }

    if (pathname.includes("/notifications/system")) {
      if (method === "PATCH" || method === "DELETE" || method === "POST") {
        return jsonResponse({ success: true, message: "ok", data: {} });
      }
      return jsonResponse({
        success: true,
        message: "ok",
        data: { messages: [] },
      });
    }

    // Fallback notifications success
    return jsonResponse({ success: true, message: "ok", data: {} });
  }

  // Otherwise, forward to original fetch (tests typically mock specific API calls)
  return ORIGINAL_FETCH!(input as any, init);
});

// 2) Stub socket.io-client to avoid real websocket attempts in tests
vi.mock("socket.io-client", () => {
  type Listener = (...args: unknown[]) => void;
  class FakeSocket {
    connected = false as boolean;
    private listeners: Record<string, Listener[]> = {};
    on(event: string, cb: Listener) {
      (this.listeners[event] ||= []).push(cb);
    }
    off(event: string, cb?: Listener) {
      if (!this.listeners[event]) return;
      if (!cb) {
        delete this.listeners[event];
        return;
      }
      this.listeners[event] = (this.listeners[event] || []).filter(
        (fn) => fn !== cb
      );
    }
    emit(_event: string, _payload?: unknown) {
      // no-op
    }
    connect() {
      // no-op
    }
    disconnect() {
      // no-op
    }
    removeAllListeners() {
      this.listeners = {};
    }
  }
  const io = () => new FakeSocket();
  return { io, Socket: FakeSocket };
});

// 2.1) Ensure services/api exposes authService and userService in tests that don't mock them explicitly
vi.mock("../services/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../services/api")>();
  // If both services are already present (test provided an explicit mock), keep them
  if ((mod as any).authService && (mod as any).userService) return mod;
  return {
    __esModule: true,
    ...mod,
    authService: (mod as any).authService || {
      getProfile: vi.fn(async () => ({
        id: "test-user",
        username: "tester",
        email: "tester@example.com",
        role: "Administrator",
        isAtCloudLeader: true,
        roleInAtCloud: "Administrator",
      })),
      refreshToken: vi.fn(async () => ({
        accessToken: "test-token",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      })),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      verifyEmail: vi.fn(),
      resendVerification: vi.fn(),
      forgotPassword: vi.fn(),
      resetPassword: vi.fn(),
    },
    // Provide a lightweight userService for hooks in useUsersApi
    userService: (mod as any).userService || {
      getProfile: vi.fn(async () => ({
        id: "test-user",
        username: "tester",
        email: "tester@example.com",
        firstName: "Test",
        lastName: "User",
        role: "Administrator",
        roleInAtCloud: "Administrator",
        avatar: null,
        gender: "male",
        phone: null,
        createdAt: new Date().toISOString(),
        emailVerified: true,
      })),
      getUsers: vi.fn(async () => ({
        users: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalUsers: 0,
          hasNext: false,
          hasPrev: false,
        },
      })),
      getUserStats: vi.fn(async () => ({})),
      getUser: vi.fn(async (_id: string) => ({
        id: _id,
        username: "user",
        email: "user@example.com",
        firstName: "User",
        lastName: "One",
        role: "Participant",
        roleInAtCloud: "Participant",
      })),
      updateProfile: vi.fn(async (_updates: unknown) => ({ success: true })),
    },
  } as typeof mod & { authService: any };
});

// 3) Mock browser history API for React Router to prevent "globalHistory.replaceState is not a function" errors
beforeAll(() => {
  // Mock the global history object that React Router uses
  Object.defineProperty(window, "history", {
    value: {
      length: 1,
      action: "POP",
      location: {
        pathname: "/",
        search: "",
        hash: "",
        state: null,
        key: "default",
      },
      pushState: vi.fn(),
      replaceState: vi.fn(),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      listen: vi.fn(() => vi.fn()), // Returns unsubscribe function
    },
    writable: true,
    configurable: true,
  });

  // Also mock the globalHistory object that may be used by React Router
  (globalThis as any).globalHistory = window.history;
});

// Ensure RTL unmounts components between tests
afterEach(() => {
  cleanup();
});
