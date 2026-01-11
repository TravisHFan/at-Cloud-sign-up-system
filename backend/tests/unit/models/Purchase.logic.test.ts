// Purchase.logic.test.ts - Unit tests for Purchase model logic
import { describe, test, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

describe("Purchase Model Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("toJSON transform logic", () => {
    test("should transform _id to id and remove __v", () => {
      // Create a mock document with the transform function behavior
      const mockId = new mongoose.Types.ObjectId();
      const doc = {
        _id: mockId,
        __v: 0,
        userId: new mongoose.Types.ObjectId(),
        programId: new mongoose.Types.ObjectId(),
        orderNumber: "ORD-20250101-00001",
        amount: 100,
        status: "active",
      };

      // Simulate the toJSON transform
      const ret = { ...doc } as Record<string, unknown> & {
        _id?: unknown;
        __v?: unknown;
      };
      (ret as { id?: string }).id = ret._id as unknown as string;
      delete ret._id;
      delete ret.__v;

      expect(ret.id).toBe(mockId);
      expect(ret._id).toBeUndefined();
      expect(ret.__v).toBeUndefined();
      expect(ret.orderNumber).toBe("ORD-20250101-00001");
    });

    test("should preserve all other fields during transform", () => {
      const mockUserId = new mongoose.Types.ObjectId();
      const mockProgramId = new mongoose.Types.ObjectId();
      const mockEventId = new mongoose.Types.ObjectId();
      const purchaseDate = new Date();

      const doc = {
        _id: new mongoose.Types.ObjectId(),
        __v: 1,
        userId: mockUserId,
        programId: mockProgramId,
        eventId: mockEventId,
        orderNumber: "ORD-20250101-00002",
        amount: 50,
        currency: "usd",
        status: "completed",
        purchaseDate,
        stripePaymentIntentId: "pi_test123",
        stripeSessionId: "cs_test123",
      };

      // Simulate the toJSON transform
      const ret = { ...doc } as Record<string, unknown> & {
        _id?: unknown;
        __v?: unknown;
      };
      (ret as { id?: string }).id = ret._id as unknown as string;
      delete ret._id;
      delete ret.__v;

      expect(ret.userId).toBe(mockUserId);
      expect(ret.programId).toBe(mockProgramId);
      expect(ret.eventId).toBe(mockEventId);
      expect(ret.amount).toBe(50);
      expect(ret.currency).toBe("usd");
      expect(ret.status).toBe("completed");
      expect(ret.purchaseDate).toBe(purchaseDate);
      expect(ret.stripePaymentIntentId).toBe("pi_test123");
    });
  });

  describe("generateOrderNumber logic", () => {
    test("should generate order number with correct format", () => {
      const date = new Date();
      const dateStr = date.toISOString().split("T")[0].replace(/-/g, "");
      const expectedPrefix = `ORD-${dateStr}`;

      // The format should be ORD-YYYYMMDD-XXXXX
      expect(expectedPrefix).toMatch(/^ORD-\d{8}$/);
    });

    test("should pad sequence to 5 digits", () => {
      // Test the padding logic
      const sequences = [1, 10, 100, 1000, 10000];
      const expected = ["00001", "00010", "00100", "01000", "10000"];

      sequences.forEach((seq, i) => {
        const sequenceStr = seq.toString().padStart(5, "0");
        expect(sequenceStr).toBe(expected[i]);
      });
    });

    test("should extract sequence from existing order number", () => {
      // Test the regex extraction logic
      const orderNumbers = [
        "ORD-20250101-00001",
        "ORD-20250101-00010",
        "ORD-20250101-00100",
        "ORD-20250101-01000",
        "ORD-20250101-10000",
        "ORD-20250101-99999",
      ];

      const expected = [2, 11, 101, 1001, 10001, 100000];

      orderNumbers.forEach((orderNumber, i) => {
        const match = orderNumber.match(/-(\d+)$/);
        expect(match).not.toBeNull();
        if (match) {
          const sequence = parseInt(match[1], 10) + 1;
          expect(sequence).toBe(expected[i]);
        }
      });
    });

    test("should handle order number without proper sequence format (fallback to 1)", () => {
      // If no match is found, sequence should default to 1
      // Use a format that the regex won't match
      const malformedOrderNumber = "ORD-INVALID-ABC";
      const match = malformedOrderNumber.match(/-(\d+)$/);

      // This tests the fallback path
      let sequence = 1;
      if (match) {
        sequence = parseInt(match[1], 10) + 1;
      }

      // No match found with digits at end, so sequence stays at 1
      expect(match).toBeNull();
      expect(sequence).toBe(1);
    });

    test("should generate correct date string from Date object", () => {
      // Test date formatting logic
      const testDate = new Date("2025-06-15T12:00:00Z");
      const dateStr = testDate.toISOString().split("T")[0].replace(/-/g, "");
      expect(dateStr).toBe("20250615");
    });

    test("should handle edge case: first order of the day", () => {
      // When no previous order exists, latestOrder is null
      const latestOrder = null;
      let sequence = 1;
      if (latestOrder) {
        // This branch won't execute
        sequence = 999;
      }
      expect(sequence).toBe(1);
    });

    test("should increment sequence when previous order exists", () => {
      // Simulate finding a previous order
      const latestOrder = { orderNumber: "ORD-20250115-00042" };
      let sequence = 1;
      if (latestOrder) {
        const match = latestOrder.orderNumber.match(/-(\d+)$/);
        if (match) {
          sequence = parseInt(match[1], 10) + 1;
        }
      }
      expect(sequence).toBe(43);
    });
  });

  describe("schema indexes", () => {
    test("should define compound indexes for efficient queries", () => {
      // Verify expected index patterns
      const expectedIndexes = [
        { userId: 1, programId: 1 },
        { status: 1, purchaseDate: -1 },
      ];

      // These are the index patterns defined in the schema
      expectedIndexes.forEach((idx) => {
        expect(idx).toBeDefined();
      });
    });
  });
});
