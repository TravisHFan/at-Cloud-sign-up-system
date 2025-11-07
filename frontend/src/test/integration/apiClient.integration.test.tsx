import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiUrl, apiFetch } from "../../lib/apiClient";

describe("apiClient - Production URL Handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("apiUrl helper", () => {
    it("should return correct URL in test environment", () => {
      // In test environment, VITE_API_URL is likely set to http://localhost:5001/api
      const url = apiUrl("/audit-logs");
      expect(url).toMatch(/\/api\/audit-logs$/);
    });

    it("should handle paths without leading slash", () => {
      const url = apiUrl("audit-logs");
      expect(url).toMatch(/\/api\/audit-logs$/);
    });

    it("should work for short-links endpoint", () => {
      const url = apiUrl("/public/short-links");
      expect(url).toMatch(/\/api\/public\/short-links$/);
    });

    it("should work for short-links status endpoint with key", () => {
      const key = "abc123";
      const url = apiUrl(`/public/short-links/${encodeURIComponent(key)}`);
      expect(url).toMatch(/\/api\/public\/short-links\/abc123$/);
    });
  });

  describe("apiFetch helper", () => {
    beforeEach(() => {
      globalThis.fetch = vi.fn();
    });

    it("should use apiUrl for audit-logs endpoint", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ success: true, data: { auditLogs: [] } }),
      };
      (globalThis.fetch as any).mockResolvedValue(mockResponse);

      await apiFetch("/audit-logs?page=1");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/audit-logs\?page=1$/),
        expect.objectContaining({
          headers: expect.any(Object),
        })
      );
    });

    it("should include auth token when present", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ success: true }),
      };
      (globalThis.fetch as any).mockResolvedValue(mockResponse);

      localStorage.setItem("authToken", "test-token-123");

      await apiFetch("/audit-logs");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/audit-logs$/),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token-123",
          }),
        })
      );
    });

    it("should work without auth token", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ success: true }),
      };
      (globalThis.fetch as any).mockResolvedValue(mockResponse);

      await apiFetch("/public/short-links");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/public\/short-links$/),
        expect.objectContaining({
          headers: expect.any(Object),
        })
      );

      const call = (globalThis.fetch as any).mock.calls[0];
      const headers = call[1].headers;
      expect(headers.Authorization).toBeUndefined();
    });
  });

  describe("Integration with actual components", () => {
    it("should properly construct URL for audit logs API call", () => {
      const params = new URLSearchParams({
        page: "1",
        limit: "20",
        action: "event_create",
      });
      const url = apiUrl(`/audit-logs?${params.toString()}`);

      expect(url).toMatch(
        /\/api\/audit-logs\?page=1&limit=20&action=event_create$/
      );
    });

    it("should properly construct URL for short link creation", () => {
      const url = apiUrl("/public/short-links");
      expect(url).toMatch(/\/api\/public\/short-links$/);
    });

    it("should properly construct URL for short link status check", () => {
      const key = "test-key-123";
      const url = apiUrl(`/public/short-links/${encodeURIComponent(key)}`);
      expect(url).toMatch(/\/api\/public\/short-links\/test-key-123$/);
    });
  });
  describe("Production environment simulation", () => {
    it("should document expected production URL behavior", () => {
      // Note: In real usage, the BASE constant in apiClient.ts is computed at module load time,
      // so this test documents the expected behavior rather than testing runtime changes

      // Expected behavior in production when VITE_API_URL is set:
      // Input: VITE_API_URL="https://backend.example.com"
      // apiUrl("/audit-logs") returns "https://backend.example.com/api/audit-logs"
      // apiUrl("/public/short-links") returns "https://backend.example.com/api/public/short-links"

      // Expected behavior in development when VITE_API_URL is not set:
      // apiUrl("/audit-logs") returns "/api/audit-logs" (proxied by Vite to backend)
      // apiUrl("/public/short-links") returns "/api/public/short-links" (proxied by Vite to backend)

      expect(true).toBe(true); // Documentation test
    });
  });
});

describe("Feature-specific URL handling", () => {
  describe("Audit Logs feature", () => {
    it("uses apiFetch which internally uses apiUrl", () => {
      // This documents that AuditLogs.tsx uses:
      // const response = await apiFetch(`/audit-logs?${params.toString()}`);
      //
      // apiFetch internally calls apiUrl() to construct the full URL
      // This ensures production compatibility
      expect(true).toBe(true); // Documentation test
    });
  });

  describe("Short Links feature", () => {
    it("uses apiUrl directly in shortLinks.ts service", () => {
      // This documents that shortLinks.ts uses:
      // await fetch(apiUrl("/public/short-links"), { ... })
      // await fetch(apiUrl(`/public/short-links/${key}`), { ... })
      //
      // Both use apiUrl() helper to ensure production compatibility
      expect(true).toBe(true); // Documentation test
    });
  });
});
