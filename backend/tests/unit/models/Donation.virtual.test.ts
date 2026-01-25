// Donation.virtual.test.ts - Tests for Donation virtual fields
import { describe, test, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";

// Mock LoggerService
vi.mock("../../../src/services/LoggerService", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

describe("Donation Model - Virtual Fields", () => {
  let Donation: typeof import("../../../src/models/Donation").default;

  beforeEach(async () => {
    vi.clearAllMocks();
    Donation = (await import("../../../src/models/Donation")).default;
  });

  describe("calculatedRemainingOccurrences virtual", () => {
    test("calculates remaining occurrences from endAfterOccurrences and currentOccurrence", () => {
      const donation = new Donation({
        userId: new mongoose.Types.ObjectId(),
        type: "recurring",
        amount: 5000,
        currency: "usd",
        frequency: "monthly",
        status: "active",
        endAfterOccurrences: 12,
        currentOccurrence: 3,
      });

      // Should be 12 - 3 = 9 remaining
      expect((donation as any).calculatedRemainingOccurrences).toBe(9);
    });

    test("returns 0 when all occurrences are used", () => {
      const donation = new Donation({
        userId: new mongoose.Types.ObjectId(),
        type: "recurring",
        amount: 5000,
        currency: "usd",
        frequency: "monthly",
        status: "active",
        endAfterOccurrences: 6,
        currentOccurrence: 6,
      });

      expect((donation as any).calculatedRemainingOccurrences).toBe(0);
    });

    test("returns 0 when currentOccurrence exceeds endAfterOccurrences", () => {
      const donation = new Donation({
        userId: new mongoose.Types.ObjectId(),
        type: "recurring",
        amount: 5000,
        currency: "usd",
        frequency: "monthly",
        status: "active",
        endAfterOccurrences: 5,
        currentOccurrence: 7, // Edge case: already exceeded
      });

      // Math.max(0, 5 - 7) = 0
      expect((donation as any).calculatedRemainingOccurrences).toBe(0);
    });

    test("returns remainingOccurrences when endAfterOccurrences is not set", () => {
      const donation = new Donation({
        userId: new mongoose.Types.ObjectId(),
        type: "recurring",
        amount: 5000,
        currency: "usd",
        frequency: "monthly",
        status: "active",
        remainingOccurrences: 8,
        // No endAfterOccurrences
      });

      expect((donation as any).calculatedRemainingOccurrences).toBe(8);
    });

    test("returns remainingOccurrences when endAfterOccurrences is falsy", () => {
      const donation = new Donation({
        userId: new mongoose.Types.ObjectId(),
        type: "recurring",
        amount: 5000,
        currency: "usd",
        frequency: "monthly",
        status: "active",
        remainingOccurrences: 8,
        endAfterOccurrences: 0, // Falsy value
      });

      expect((donation as any).calculatedRemainingOccurrences).toBe(8);
    });

    test("handles one-time donations (no occurrences)", () => {
      const donation = new Donation({
        userId: new mongoose.Types.ObjectId(),
        type: "one-time",
        amount: 10000,
        currency: "usd",
        status: "completed",
      });

      // Should return undefined remainingOccurrences
      expect((donation as any).calculatedRemainingOccurrences).toBeUndefined();
    });
  });
});
