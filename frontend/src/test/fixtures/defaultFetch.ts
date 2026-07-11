import { vi } from "vitest";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Opt-in defaults for component tests that render authenticated application
 * chrome but are not testing its background auth/notification requests.
 */
export function installDefaultFetchMock() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl =
        typeof input === "string"
          ? input
          : ((input as Request).url ?? String(input));
      let pathname = rawUrl;
      try {
        pathname = new URL(rawUrl).pathname;
      } catch {
        // Relative test URLs are already pathnames.
      }

      const method = (init?.method || "GET").toUpperCase();
      const isAuth =
        pathname.includes("/api/auth/") ||
        pathname.endsWith("/api/auth") ||
        pathname === "/auth/profile";

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
        return jsonResponse({ success: true, message: "ok", data: {} });
      }

      if (pathname.includes("/api/notifications")) {
        if (pathname.includes("/notifications/unread-counts")) {
          return jsonResponse({
            success: true,
            message: "ok",
            data: { bellNotifications: 0, systemMessages: 0, total: 0 },
          });
        }
        if (pathname.includes("/notifications/bell")) {
          return jsonResponse({
            success: true,
            message: "ok",
            data:
              method === "GET"
                ? { notifications: [], unreadCount: 0 }
                : {},
          });
        }
        if (pathname.includes("/notifications/system")) {
          return jsonResponse({
            success: true,
            message: "ok",
            data: method === "GET" ? { messages: [] } : {},
          });
        }
        return jsonResponse({ success: true, message: "ok", data: {} });
      }

      if (pathname.includes("/events/") && pathname.endsWith("/access")) {
        return jsonResponse({
          success: true,
          message: "ok",
          data: {
            hasAccess: true,
            requiresPurchase: false,
            accessReason: "test-default",
          },
        });
      }

      if (pathname === "/api/users" || pathname === "/users") {
        return jsonResponse({
          success: true,
          message: "ok",
          data: {
            users: [],
            pagination: {
              currentPage: 1,
              totalPages: 0,
              totalUsers: 0,
              hasNext: false,
              hasPrev: false,
            },
          },
        });
      }

      throw new Error(`Unhandled test fetch: ${method} ${pathname}`);
    }),
  );
}
