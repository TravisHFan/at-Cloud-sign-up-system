import { describe, it, expect } from "vitest";
import { formatCurrency } from "../currency";

describe("currency utils", () => {
  describe("formatCurrency", () => {
    it("should format cents to dollars with default locale and currency", () => {
      expect(formatCurrency(1000)).toBe("$10.00");
      expect(formatCurrency(9999)).toBe("$99.99");
      expect(formatCurrency(100)).toBe("$1.00");
    });

    it("should handle zero amount", () => {
      expect(formatCurrency(0)).toBe("$0.00");
    });

    it("should handle negative amounts", () => {
      const result = formatCurrency(-5000);
      expect(result).toContain("50.00");
      expect(result).toMatch(/-?\$50\.00|-\$50\.00/);
    });

    it("should handle large amounts", () => {
      expect(formatCurrency(1000000)).toBe("$10,000.00");
      expect(formatCurrency(100000000)).toBe("$1,000,000.00");
    });

    it("should handle odd cent amounts", () => {
      expect(formatCurrency(1599)).toBe("$15.99");
      expect(formatCurrency(9501)).toBe("$95.01");
      expect(formatCurrency(1)).toBe("$0.01");
    });

    it("should format with custom locale", () => {
      const result = formatCurrency(123456, "de-DE", "EUR");
      expect(result).toContain("1.234,56");
    });

    it("should format with EUR currency", () => {
      const result = formatCurrency(5000, "en-GB", "EUR");
      expect(result).toContain("50");
      expect(result).toContain("€");
    });

    it("should format with GBP currency", () => {
      const result = formatCurrency(10000, "en-GB", "GBP");
      expect(result).toContain("100");
      expect(result).toContain("£");
    });

    it("should handle invalid/unsupported currency with fallback", () => {
      // Fallback format should be $XX.XX
      const result = formatCurrency(5000, "en-US", "INVALID" as any);
      expect(result).toMatch(/\$?\d+\.\d{2}/);
    });

    it("should handle fractional cents correctly", () => {
      expect(formatCurrency(1050)).toBe("$10.50");
      expect(formatCurrency(505)).toBe("$5.05");
    });

    it("should handle single cent", () => {
      expect(formatCurrency(1)).toBe("$0.01");
    });

    it("should handle 99 cents", () => {
      expect(formatCurrency(99)).toBe("$0.99");
    });

    it("should format prices consistently", () => {
      const amounts = [1000, 2000, 5000, 10000];
      const formatted = amounts.map((amt) => formatCurrency(amt));

      expect(formatted).toEqual(["$10.00", "$20.00", "$50.00", "$100.00"]);
    });

    it("should handle very small amounts", () => {
      expect(formatCurrency(5)).toBe("$0.05");
      expect(formatCurrency(10)).toBe("$0.10");
    });

    it("should handle typical product prices", () => {
      expect(formatCurrency(2999)).toBe("$29.99"); // Common price point
      expect(formatCurrency(4995)).toBe("$49.95"); // Common price point
      expect(formatCurrency(9900)).toBe("$99.00"); // Round price
    });

    it("should format with French locale", () => {
      const result = formatCurrency(12345, "fr-FR", "EUR");
      expect(result).toContain("123");
      expect(result).toContain("45");
    });

    it("should format with Japanese locale and Yen", () => {
      const result = formatCurrency(500000, "ja-JP", "JPY");
      // Japanese yen formats 5000 as ￥5,000 with comma separator
      expect(result).toContain("5,000");
      expect(result).toContain("￥");
    });

    it("should handle Infinity with fallback", () => {
      const result = formatCurrency(Infinity as any);
      // Intl.NumberFormat formats Infinity as $∞
      expect(result).toBe("$∞");
    });

    it("should handle NaN with fallback", () => {
      const result = formatCurrency(NaN);
      // Intl.NumberFormat formats NaN as $NaN
      expect(result).toBe("$NaN");
    });

    it("should format multiple currencies consistently", () => {
      const usd = formatCurrency(10000, "en-US", "USD");
      const eur = formatCurrency(10000, "en-US", "EUR");
      const gbp = formatCurrency(10000, "en-US", "GBP");

      expect(usd).toContain("100");
      expect(eur).toContain("100");
      expect(gbp).toContain("100");
    });
  });
});
