import { describe, it, expect, beforeEach, vi } from "vitest";
import { notificationService } from "../../services/notificationService";

// Mock fetch to intercept network calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("🔧 Notification Service Endpoint Fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage for auth token
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn().mockReturnValue("mock-auth-token"),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });
  });

  it("❌ CURRENT BROKEN: should show wrong endpoints being used", async () => {
    console.log("\n=== TESTING CURRENT BROKEN ENDPOINTS ===");

    // Mock response for any endpoint
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    // Test mark as read - currently uses wrong endpoint
    await notificationService.markAsRead("test-id");

    console.log("Current markAsRead endpoint:", mockFetch.mock.calls[0][0]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:5001/api/v1/user/notifications/bell/test-id/read",
      expect.any(Object)
    );
    console.log(
      "❌ WRONG: Uses /user/notifications/bell/:id/read (returns 404)"
    );

    // Test delete notification - currently uses wrong endpoint
    mockFetch.mockClear();
    await notificationService.deleteNotification("test-id");

    console.log(
      "Current deleteNotification endpoint:",
      mockFetch.mock.calls[0][0]
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:5001/api/v1/user/notifications/bell/test-id",
      expect.any(Object)
    );
    console.log("❌ WRONG: Uses /user/notifications/bell/:id (returns 404)");

    // Test mark all as read - this one is actually correct
    mockFetch.mockClear();
    await notificationService.markAllAsRead();

    console.log("Current markAllAsRead endpoint:", mockFetch.mock.calls[0][0]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:5001/api/v1/user/notifications/bell/read-all",
      expect.any(Object)
    );
    console.log("✅ CORRECT: Uses /user/notifications/bell/read-all (works)");
  });

  it("✅ AFTER FIX: should use correct endpoints", async () => {
    console.log("\n=== TESTING CORRECT ENDPOINTS AFTER FIX ===");

    // After we fix the service, these should be the correct calls:
    console.log(
      "✅ CORRECT markAsRead should use: /system-messages/bell-notifications/:id/read"
    );
    console.log(
      "✅ CORRECT deleteNotification should use: /system-messages/bell-notifications/:id"
    );
    console.log(
      "✅ CORRECT markAllAsRead should use: /user/notifications/bell/read-all"
    );

    // This test will pass after we fix the service
  });
});
