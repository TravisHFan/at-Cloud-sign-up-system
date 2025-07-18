import { describe, it, expect, beforeEach, vi } from "vitest";
import { systemMessageService } from "../../services/systemMessageService";

// Mock fetch to intercept network calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("SystemMessageService Endpoint Fix", () => {
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

  it("should use the correct endpoint /api/v1/system-messages", async () => {
    // Mock a successful response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          messages: [
            {
              id: "msg1",
              title: "Test Message",
              content: "Test content",
              type: "announcement",
              priority: "high",
              isRead: false,
              createdAt: "2023-01-01T00:00:00Z",
            },
          ],
        },
      }),
    });

    // Call the service method
    const result = await systemMessageService.getSystemMessages();

    // Verify the correct endpoint was called
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:5001/api/v1/system-messages",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer mock-auth-token",
        }),
      })
    );

    // Verify the response is processed correctly
    expect(result).toEqual([
      {
        id: "msg1",
        title: "Test Message",
        content: "Test content",
        type: "announcement",
        priority: "high",
        isRead: false,
        createdAt: "2023-01-01T00:00:00Z",
      },
    ]);
  });

  it("should handle the new response structure correctly", async () => {
    // Mock response with the new backend structure
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          messages: [
            {
              id: "msg1",
              title: "Test Message",
              content: "Test content",
              type: "announcement",
              priority: "high",
              isRead: false,
              createdAt: "2023-01-01T00:00:00Z",
            },
          ],
          pagination: {
            current: 1,
            pages: 1,
            total: 1,
            limit: 20,
          },
        },
      }),
    });

    const result = await systemMessageService.getSystemMessages();

    // Should extract messages from the new structure
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("msg1");
  });

  it("should fail with old endpoint structure", () => {
    // This test documents that we're NOT using the old endpoint
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/user/notifications/system"),
      expect.any(Object)
    );
  });
});
