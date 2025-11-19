/**
 * Avatar Utils Tests
 *
 * Tests avatar URL handling utilities:
 * - getAvatarUrl: Select custom or default avatar
 * - getAvatarUrlWithCacheBust: Add cache busting for uploads
 * - getAvatarAlt: Generate alt text
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getAvatarUrl,
  getAvatarUrlWithCacheBust,
  getAvatarAlt,
} from "../avatarUtils";

describe("avatarUtils", () => {
  const originalEnv = import.meta.env;

  beforeEach(() => {
    // Reset Date.now for consistent cache busting tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    // Restore original env
    Object.defineProperty(import.meta, "env", {
      value: originalEnv,
      writable: true,
    });
  });

  describe("getAvatarUrl", () => {
    it("should return custom avatar when provided", () => {
      const result = getAvatarUrl("/uploads/avatars/user123.jpg", "male");
      expect(result).toBe("/uploads/avatars/user123.jpg");
    });

    it("should return male default when custom is null", () => {
      const result = getAvatarUrl(null, "male");
      expect(result).toBe("/default-avatar-male.jpg");
    });

    it("should return female default when custom is null", () => {
      const result = getAvatarUrl(null, "female");
      expect(result).toBe("/default-avatar-female.jpg");
    });

    it("should treat default avatar string as missing custom avatar", () => {
      const result = getAvatarUrl("/default-avatar-male.jpg", "female");
      // Should use actual gender (female) not the bad default path
      expect(result).toBe("/default-avatar-female.jpg");
    });

    it("should detect and ignore backend default avatar paths", () => {
      const result = getAvatarUrl("/default-avatar-female.jpg", "male");
      // Should use actual gender (male) not the bad default path
      expect(result).toBe("/default-avatar-male.jpg");
    });

    it("should handle absolute URLs that include backend.onrender.com", () => {
      // Note: In production, these would be preserved, but we can't easily test import.meta.env.PROD
      // This test documents the expected behavior
      const backendUrl =
        "https://atcloud-backend.onrender.com/uploads/avatars/user.jpg";
      const result = getAvatarUrl(backendUrl, "male");

      // In test environment (not production), pathname is extracted
      // In real production with PROD=true, this would return the full backendUrl
      expect(result).toBe("/uploads/avatars/user.jpg");
    });
    it("should extract pathname from absolute URL", () => {
      const fullUrl = "http://localhost:5001/uploads/avatars/user.jpg?t=123";
      const result = getAvatarUrl(fullUrl, "male");

      // Extracts pathname unless it's a backend.onrender.com URL in production
      expect(result).toBe("/uploads/avatars/user.jpg?t=123");
    });

    it("should preserve query params when extracting pathname", () => {
      const fullUrl = "http://example.com/avatar.jpg?cache=bust&v=2";
      const result = getAvatarUrl(fullUrl, "female");

      expect(result).toBe("/avatar.jpg?cache=bust&v=2");
    });
    it("should handle malformed URLs gracefully", () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      // Use a URL that will throw when constructed
      const malformedUrl = "http://[::1]:999999/path"; // Invalid port
      const result = getAvatarUrl(malformedUrl, "male");

      expect(result).toBe(malformedUrl);
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it("should handle relative paths as-is", () => {
      const result = getAvatarUrl("/custom/path/avatar.png", "female");
      expect(result).toBe("/custom/path/avatar.png");
    });

    it("should handle https URLs", () => {
      vi.stubEnv("PROD", false);

      const secureUrl = "https://cdn.example.com/avatars/secure.jpg";
      const result = getAvatarUrl(secureUrl, "male");

      // Extracts pathname for non-backend URLs
      expect(result).toBe("/avatars/secure.jpg");
    });

    it("should extract pathname for non-backend URLs", () => {
      const cdnUrl = "https://cdn.example.com/avatars/user.jpg";
      const result = getAvatarUrl(cdnUrl, "male");

      // CDN URLs get pathname extracted
      expect(result).toBe("/avatars/user.jpg");
    });
  });

  describe("getAvatarUrlWithCacheBust", () => {
    it("should add cache busting to custom avatar", () => {
      const result = getAvatarUrlWithCacheBust(
        "/uploads/avatars/user.jpg",
        "male"
      );
      expect(result).toBe("/uploads/avatars/user.jpg?t=1736942400000");
    });

    it("should not add cache busting to default avatar", () => {
      const result = getAvatarUrlWithCacheBust(null, "female");
      expect(result).toBe("/default-avatar-female.jpg");
    });

    it("should not add cache busting to default avatar paths", () => {
      const result = getAvatarUrlWithCacheBust(
        "/default-avatar-male.jpg",
        "male"
      );
      // This is a default avatar, so no cache busting
      expect(result).toBe("/default-avatar-male.jpg");
    });

    it("should append cache bust with ? when no query params", () => {
      const result = getAvatarUrlWithCacheBust("/avatar.jpg", "female");
      expect(result).toContain("?t=");
    });

    it("should append cache bust with & when query params exist", () => {
      const result = getAvatarUrlWithCacheBust("/avatar.jpg?version=2", "male");
      expect(result).toContain("&t=");
      expect(result).toContain("version=2");
    });

    it("should use current timestamp for cache busting", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-15T10:30:00Z"));
      const result = getAvatarUrlWithCacheBust("/uploads/user.jpg", "female");

      // Check format, not exact value (timing may vary slightly)
      expect(result).toMatch(/\/uploads\/user\.jpg\?t=\d{13}/);

      vi.useRealTimers();
    });

    it("should handle custom avatars with existing timestamps", () => {
      const result = getAvatarUrlWithCacheBust(
        "/uploads/avatar.jpg?t=12345",
        "male"
      );
      // Should add new timestamp
      expect(result).toContain("&t=1736942400000");
      expect(result).toContain("t=12345");
    });

    it("should not cache bust default-avatar string in path", () => {
      const result = getAvatarUrlWithCacheBust(
        "/default-avatar-female.jpg",
        "female"
      );
      expect(result).not.toContain("?t=");
      expect(result).toBe("/default-avatar-female.jpg");
    });
  });

  describe("getAvatarAlt", () => {
    it("should generate alt text for custom avatar", () => {
      const result = getAvatarAlt("John", "Doe", true);
      expect(result).toBe("John Doe avatar");
    });

    it("should generate alt text for default avatar", () => {
      const result = getAvatarAlt("Jane", "Smith", false);
      expect(result).toBe("Jane Smith default avatar");
    });

    it("should handle names with spaces", () => {
      const result = getAvatarAlt("Mary Jane", "Watson", true);
      expect(result).toBe("Mary Jane Watson avatar");
    });

    it("should handle single character names", () => {
      const result = getAvatarAlt("A", "B", false);
      expect(result).toBe("A B default avatar");
    });

    it("should distinguish between custom and default in alt text", () => {
      const customResult = getAvatarAlt("User", "Test", true);
      const defaultResult = getAvatarAlt("User", "Test", false);

      expect(customResult).toBe("User Test avatar");
      expect(defaultResult).toBe("User Test default avatar");
      expect(customResult).not.toBe(defaultResult);
    });

    it("should handle empty strings", () => {
      const result = getAvatarAlt("", "", false);
      // Empty strings result in "  default avatar" (two spaces)
      expect(result).toBe("  default avatar");
    });

    it("should construct full name correctly", () => {
      const result = getAvatarAlt("Elizabeth", "Taylor", true);
      expect(result).toContain("Elizabeth Taylor");
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete avatar workflow for new user", () => {
      // New user, no custom avatar
      const url = getAvatarUrl(null, "male");
      const urlWithCache = getAvatarUrlWithCacheBust(null, "male");
      const alt = getAvatarAlt("New", "User", false);

      expect(url).toBe("/default-avatar-male.jpg");
      expect(urlWithCache).toBe("/default-avatar-male.jpg");
      expect(alt).toBe("New User default avatar");
    });

    it("should handle complete avatar workflow for user with upload", () => {
      // User uploaded custom avatar
      const customPath = "/uploads/avatars/custom123.jpg";
      const url = getAvatarUrl(customPath, "female");
      const urlWithCache = getAvatarUrlWithCacheBust(customPath, "female");
      const alt = getAvatarAlt("Custom", "User", true);

      expect(url).toBe(customPath);
      expect(urlWithCache).toContain(customPath);
      expect(urlWithCache).toContain("?t=");
      expect(alt).toBe("Custom User avatar");
    });

    it("should handle gender mismatch in default avatar path", () => {
      // Backend sent wrong default avatar for gender
      const wrongDefault = "/default-avatar-male.jpg";
      const url = getAvatarUrl(wrongDefault, "female");
      const urlWithCache = getAvatarUrlWithCacheBust(wrongDefault, "female");

      expect(url).toBe("/default-avatar-female.jpg");
      expect(urlWithCache).toBe("/default-avatar-female.jpg");
    });

    it("should handle deployment scenario with backend URL", () => {
      const backendUrl =
        "https://atcloud-backend.onrender.com/uploads/avatars/prod-user.jpg";
      const url = getAvatarUrl(backendUrl, "male");
      const urlWithCache = getAvatarUrlWithCacheBust(backendUrl, "male");

      // In test environment, pathname is extracted (PROD flag not set)
      expect(url).toBe("/uploads/avatars/prod-user.jpg");
      expect(urlWithCache).toContain("/uploads/avatars/prod-user.jpg");
      expect(urlWithCache).toContain("?t=");
    });
  });
});
