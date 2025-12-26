/**
 * Privacy Utilities Unit Tests
 *
 * Tests privacy-focused utility functions:
 * - hashEmail: SHA256 hashing with normalization
 * - truncateIpToCidr: IP anonymization for privacy
 */

import { describe, it, expect } from "vitest";
import { hashEmail, truncateIpToCidr } from "../../../src/utils/privacy";
import crypto from "crypto";

describe("privacy utilities", () => {
  describe("hashEmail", () => {
    it("should hash email with SHA256", () => {
      const email = "test@example.com";
      const expected = crypto
        .createHash("sha256")
        .update("test@example.com")
        .digest("hex");

      const result = hashEmail(email);

      expect(result).toBe(expected);
    });

    it("should lowercase email before hashing", () => {
      const uppercase = "TEST@EXAMPLE.COM";
      const lowercase = "test@example.com";

      const resultUpper = hashEmail(uppercase);
      const resultLower = hashEmail(lowercase);

      expect(resultUpper).toBe(resultLower);
    });

    it("should trim whitespace before hashing", () => {
      const withWhitespace = "  test@example.com  ";
      const trimmed = "test@example.com";

      const resultWhitespace = hashEmail(withWhitespace);
      const resultTrimmed = hashEmail(trimmed);

      expect(resultWhitespace).toBe(resultTrimmed);
    });

    it("should handle mixed case and whitespace", () => {
      const messy = "  TEST@EXAMPLE.COM  ";
      const clean = "test@example.com";

      const resultMessy = hashEmail(messy);
      const resultClean = hashEmail(clean);

      expect(resultMessy).toBe(resultClean);
    });

    it("should produce consistent hashes", () => {
      const email = "user@domain.org";

      const hash1 = hashEmail(email);
      const hash2 = hashEmail(email);

      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different emails", () => {
      const email1 = "user1@example.com";
      const email2 = "user2@example.com";

      const hash1 = hashEmail(email1);
      const hash2 = hashEmail(email2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("truncateIpToCidr", () => {
    describe("IPv4 addresses", () => {
      it("should truncate IPv4 to /24 CIDR", () => {
        const result = truncateIpToCidr("192.168.1.100");

        expect(result).toBe("192.168.1.0/24");
      });

      it("should handle different IPv4 addresses", () => {
        expect(truncateIpToCidr("10.0.0.1")).toBe("10.0.0.0/24");
        expect(truncateIpToCidr("172.16.255.200")).toBe("172.16.255.0/24");
        expect(truncateIpToCidr("8.8.8.8")).toBe("8.8.8.0/24");
      });

      it("should extract IPv4 from longer strings (e.g., proxied IPs)", () => {
        const result = truncateIpToCidr("::ffff:192.168.1.50");

        expect(result).toBe("192.168.1.0/24");
      });
    });

    describe("IPv6 addresses", () => {
      it("should truncate IPv6 to /48 CIDR (first 3 hextets)", () => {
        const result = truncateIpToCidr(
          "2001:0db8:85a3:0000:0000:8a2e:0370:7334"
        );

        expect(result).toBe("2001:0db8:85a3::/48");
      });

      it("should handle compressed IPv6 addresses", () => {
        const result = truncateIpToCidr("2001:db8:85a3::1");

        expect(result).toBe("2001:db8:85a3::/48");
      });

      it("should handle IPv6 with zone identifier", () => {
        // "fe80::1%eth0" after removing zone becomes "fe80::1"
        // When split by ":" and filtered for non-empty, only gives ["fe80", "1"]
        // This is less than 3 hextets, so returns null
        const result = truncateIpToCidr("fe80::1%eth0");

        expect(result).toBeNull();
      });

      it("should handle full IPv6 with zone identifier", () => {
        // Full IPv6 with zone: after cleanup has enough hextets
        const result = truncateIpToCidr("2001:db8:85a3::1%eth0");

        expect(result).toBe("2001:db8:85a3::/48");
      });
    });

    describe("edge cases", () => {
      it("should return null for undefined", () => {
        const result = truncateIpToCidr(undefined);

        expect(result).toBeNull();
      });

      it("should return null for null", () => {
        const result = truncateIpToCidr(null);

        expect(result).toBeNull();
      });

      it("should return null for empty string", () => {
        const result = truncateIpToCidr("");

        expect(result).toBeNull();
      });

      it("should return null for invalid IP format", () => {
        expect(truncateIpToCidr("not-an-ip")).toBeNull();
        expect(truncateIpToCidr("abc.def.ghi.jkl")).toBeNull();
      });

      it("should return null for partial IPv4", () => {
        expect(truncateIpToCidr("192.168")).toBeNull();
        expect(truncateIpToCidr("192.168.1")).toBeNull();
      });

      it("should return null for IPv6 with less than 3 hextets", () => {
        expect(truncateIpToCidr("2001:db8")).toBeNull();
      });

      it("should handle localhost IPv4", () => {
        const result = truncateIpToCidr("127.0.0.1");

        expect(result).toBe("127.0.0.0/24");
      });

      it("should handle 'unknown' string", () => {
        const result = truncateIpToCidr("unknown");

        expect(result).toBeNull();
      });
    });
  });
});
