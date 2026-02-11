/**
 * EmailDeduplication Unit Tests
 *
 * Tests email deduplication functionality:
 * - isDedupeEnabled: check environment variable
 * - isDuplicate: detect duplicate emails
 * - Cache expiration and purging
 * - Key generation from email options
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EmailDeduplication } from "../../../../src/services/email/EmailDeduplication";

describe("EmailDeduplication - Unit Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear cache before each test
    EmailDeduplication.__clearDedupeCacheForTests();
    // Reset environment
    process.env = { ...originalEnv };
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.useRealTimers();
  });

  describe("isDedupeEnabled", () => {
    it("should return false when EMAIL_DEDUP_ENABLE is not set", () => {
      delete process.env.EMAIL_DEDUP_ENABLE;
      expect(EmailDeduplication.isDedupeEnabled()).toBe(false);
    });

    it("should return false when EMAIL_DEDUP_ENABLE is not 'true'", () => {
      process.env.EMAIL_DEDUP_ENABLE = "false";
      expect(EmailDeduplication.isDedupeEnabled()).toBe(false);

      process.env.EMAIL_DEDUP_ENABLE = "1";
      expect(EmailDeduplication.isDedupeEnabled()).toBe(false);

      process.env.EMAIL_DEDUP_ENABLE = "yes";
      expect(EmailDeduplication.isDedupeEnabled()).toBe(false);
    });

    it("should return true when EMAIL_DEDUP_ENABLE is 'true'", () => {
      process.env.EMAIL_DEDUP_ENABLE = "true";
      expect(EmailDeduplication.isDedupeEnabled()).toBe(true);
    });
  });

  describe("isDuplicate", () => {
    it("should return false when deduplication is disabled", () => {
      delete process.env.EMAIL_DEDUP_ENABLE;

      const options = {
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test content</p>",
      };

      // Should never be duplicate when disabled
      expect(EmailDeduplication.isDuplicate(options)).toBe(false);
      expect(EmailDeduplication.isDuplicate(options)).toBe(false);
      expect(EmailDeduplication.isDuplicate(options)).toBe(false);
    });

    it("should detect duplicate emails within TTL window", () => {
      process.env.EMAIL_DEDUP_ENABLE = "true";
      process.env.EMAIL_DEDUP_TTL_MS = "60000"; // 1 minute

      const options = {
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test content</p>",
      };

      // First send - not duplicate
      expect(EmailDeduplication.isDuplicate(options)).toBe(false);

      // Immediate second send - should be duplicate
      expect(EmailDeduplication.isDuplicate(options)).toBe(true);
    });

    it("should allow same email after TTL expires", () => {
      process.env.EMAIL_DEDUP_ENABLE = "true";
      process.env.EMAIL_DEDUP_TTL_MS = "60000"; // 1 minute

      const options = {
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test content</p>",
      };

      // First send
      expect(EmailDeduplication.isDuplicate(options)).toBe(false);

      // Advance time past TTL
      vi.advanceTimersByTime(61000);

      // Should not be duplicate after TTL
      expect(EmailDeduplication.isDuplicate(options)).toBe(false);
    });

    it("should treat different recipients as different emails", () => {
      process.env.EMAIL_DEDUP_ENABLE = "true";

      const options1 = {
        to: "user1@example.com",
        subject: "Test Subject",
        html: "<p>Test content</p>",
      };

      const options2 = {
        to: "user2@example.com",
        subject: "Test Subject",
        html: "<p>Test content</p>",
      };

      expect(EmailDeduplication.isDuplicate(options1)).toBe(false);
      expect(EmailDeduplication.isDuplicate(options2)).toBe(false);
    });

    it("should treat different subjects as different emails", () => {
      process.env.EMAIL_DEDUP_ENABLE = "true";

      const options1 = {
        to: "test@example.com",
        subject: "Subject A",
        html: "<p>Test content</p>",
      };

      const options2 = {
        to: "test@example.com",
        subject: "Subject B",
        html: "<p>Test content</p>",
      };

      expect(EmailDeduplication.isDuplicate(options1)).toBe(false);
      expect(EmailDeduplication.isDuplicate(options2)).toBe(false);
    });

    it("should treat different content as different emails", () => {
      process.env.EMAIL_DEDUP_ENABLE = "true";

      const options1 = {
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Content A</p>",
      };

      const options2 = {
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Content B</p>",
      };

      expect(EmailDeduplication.isDuplicate(options1)).toBe(false);
      expect(EmailDeduplication.isDuplicate(options2)).toBe(false);
    });

    it("should handle array of recipients (uses first)", () => {
      process.env.EMAIL_DEDUP_ENABLE = "true";

      const options = {
        to: ["first@example.com", "second@example.com"],
        subject: "Test Subject",
        html: "<p>Test content</p>",
      };

      expect(EmailDeduplication.isDuplicate(options)).toBe(false);
      expect(EmailDeduplication.isDuplicate(options)).toBe(true);
    });

    it("should handle empty recipient gracefully", () => {
      process.env.EMAIL_DEDUP_ENABLE = "true";

      const options = {
        to: "",
        subject: "Test Subject",
        html: "<p>Test content</p>",
      };

      // Should not throw
      expect(EmailDeduplication.isDuplicate(options)).toBe(false);
    });

    it("should use default TTL when invalid value provided", () => {
      process.env.EMAIL_DEDUP_ENABLE = "true";
      process.env.EMAIL_DEDUP_TTL_MS = "invalid";

      const options = {
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test content</p>",
      };

      // Should use default 120000ms (2 minutes)
      expect(EmailDeduplication.isDuplicate(options)).toBe(false);

      // Still within default TTL
      vi.advanceTimersByTime(60000);
      expect(EmailDeduplication.isDuplicate(options)).toBe(true);

      // Past default TTL
      vi.advanceTimersByTime(70000); // Total 130000ms
      expect(EmailDeduplication.isDuplicate(options)).toBe(false);
    });

    it("should use default TTL when negative value provided", () => {
      process.env.EMAIL_DEDUP_ENABLE = "true";
      process.env.EMAIL_DEDUP_TTL_MS = "-1000";

      const options = {
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test content</p>",
      };

      // Should use default TTL, not negative
      expect(EmailDeduplication.isDuplicate(options)).toBe(false);
      expect(EmailDeduplication.isDuplicate(options)).toBe(true);
    });

    it("should include text content in dedup key", () => {
      process.env.EMAIL_DEDUP_ENABLE = "true";

      const options1 = {
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Same HTML</p>",
        text: "Text version A",
      };

      const options2 = {
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Same HTML</p>",
        text: "Text version B",
      };

      expect(EmailDeduplication.isDuplicate(options1)).toBe(false);
      expect(EmailDeduplication.isDuplicate(options2)).toBe(false);
    });

    it("should purge expired entries on subsequent calls", () => {
      process.env.EMAIL_DEDUP_ENABLE = "true";
      process.env.EMAIL_DEDUP_TTL_MS = "10000";

      const options1 = {
        to: "user1@example.com",
        subject: "Subject 1",
        html: "<p>Content 1</p>",
      };

      const options2 = {
        to: "user2@example.com",
        subject: "Subject 2",
        html: "<p>Content 2</p>",
      };

      // Add first email
      expect(EmailDeduplication.isDuplicate(options1)).toBe(false);

      // Advance time past TTL for first email
      vi.advanceTimersByTime(15000);

      // Add second email - this triggers purge
      expect(EmailDeduplication.isDuplicate(options2)).toBe(false);

      // First email should no longer be in cache
      expect(EmailDeduplication.isDuplicate(options1)).toBe(false);
    });
  });

  describe("__clearDedupeCacheForTests", () => {
    it("should clear the cache", () => {
      process.env.EMAIL_DEDUP_ENABLE = "true";

      const options = {
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test content</p>",
      };

      expect(EmailDeduplication.isDuplicate(options)).toBe(false);
      expect(EmailDeduplication.isDuplicate(options)).toBe(true);

      // Clear cache
      EmailDeduplication.__clearDedupeCacheForTests();

      // Should not be duplicate after cache clear
      expect(EmailDeduplication.isDuplicate(options)).toBe(false);
    });
  });

  describe("Edge cases - key generation", () => {
    beforeEach(() => {
      process.env.EMAIL_DEDUP_ENABLE = "true";
      process.env.EMAIL_DEDUP_TTL_MS = "60000";
    });

    it("should handle empty array for to field", () => {
      const options = {
        to: [] as string[],
        subject: "Test Subject",
        html: "<p>Test content</p>",
      };

      // Should not throw and should generate a key with empty email
      expect(EmailDeduplication.isDuplicate(options)).toBe(false);
      expect(EmailDeduplication.isDuplicate(options)).toBe(true);
    });

    it("should handle undefined to field gracefully", () => {
      const options = {
        to: undefined as unknown as string,
        subject: "Test Subject",
        html: "<p>Test content</p>",
      };

      expect(EmailDeduplication.isDuplicate(options)).toBe(false);
      expect(EmailDeduplication.isDuplicate(options)).toBe(true);
    });

    it("should handle missing subject", () => {
      const options = {
        to: "test@example.com",
        subject: undefined as unknown as string,
        html: "<p>Test content</p>",
      };

      expect(EmailDeduplication.isDuplicate(options)).toBe(false);
      expect(EmailDeduplication.isDuplicate(options)).toBe(true);
    });

    it("should handle missing html content", () => {
      const options = {
        to: "test@example.com",
        subject: "Test Subject",
        html: undefined as unknown as string,
      };

      expect(EmailDeduplication.isDuplicate(options)).toBe(false);
      expect(EmailDeduplication.isDuplicate(options)).toBe(true);
    });

    it("should differentiate emails with whitespace in addresses", () => {
      const options1 = {
        to: " test@example.com ",
        subject: "Test",
        html: "<p>Content</p>",
      };
      const options2 = {
        to: "test@example.com",
        subject: "Test",
        html: "<p>Content</p>",
      };

      expect(EmailDeduplication.isDuplicate(options1)).toBe(false);
      // Trimming should make them the same key
      expect(EmailDeduplication.isDuplicate(options2)).toBe(true);
    });
  });
});
