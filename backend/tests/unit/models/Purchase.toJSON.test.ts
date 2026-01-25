// Purchase.toJSON.test.ts - Tests for Purchase model toJSON transform
import { describe, test, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";

// We need to test the actual model's toJSON transform
// Import the Purchase model (will use existing model or create new)
vi.mock("../../../src/services/LoggerService", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

describe("Purchase Model - toJSON Transform", () => {
  let Purchase: typeof import("../../../src/models/Purchase").default;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamically import to ensure fresh mock state
    Purchase = (await import("../../../src/models/Purchase")).default;
  });

  test("toJSON transforms _id to id and removes __v", () => {
    const mockId = new mongoose.Types.ObjectId();
    const mockUserId = new mongoose.Types.ObjectId();
    const mockProgramId = new mongoose.Types.ObjectId();

    // Create a document-like object that simulates Mongoose document
    const doc = new Purchase({
      _id: mockId,
      userId: mockUserId,
      programId: mockProgramId,
      purchaseType: "program",
      orderNumber: "ORD-20250101-00001",
      fullPrice: 10000,
      classRepDiscount: 0,
      earlyBirdDiscount: 0,
      finalPrice: 10000,
      isClassRep: false,
      isEarlyBird: false,
      billingInfo: {
        fullName: "Test User",
        email: "test@example.com",
      },
      paymentMethod: {
        type: "card",
        cardBrand: "visa",
        last4: "4242",
      },
      status: "completed",
      purchaseDate: new Date(),
    });

    // Get the toJSON result
    const json = doc.toJSON();

    // Verify transform was applied
    expect(json.id).toBeDefined();
    expect((json as any)._id).toBeUndefined();
    expect((json as any).__v).toBeUndefined();
    expect(json.orderNumber).toBe("ORD-20250101-00001");
    expect(json.fullPrice).toBe(10000);
    expect(json.status).toBe("completed");
  });

  test("toJSON preserves all important fields", () => {
    const doc = new Purchase({
      userId: new mongoose.Types.ObjectId(),
      programId: new mongoose.Types.ObjectId(),
      eventId: new mongoose.Types.ObjectId(),
      purchaseType: "program",
      orderNumber: "ORD-20250115-00005",
      fullPrice: 2500,
      classRepDiscount: 0,
      earlyBirdDiscount: 0,
      finalPrice: 2500,
      isClassRep: false,
      isEarlyBird: false,
      billingInfo: {
        fullName: "Test User",
        email: "test@example.com",
      },
      paymentMethod: {
        type: "card",
      },
      status: "completed",
      purchaseDate: new Date("2025-01-15"),
      stripePaymentIntentId: "pi_test_123",
      stripeSessionId: "cs_test_456",
    });

    const json = doc.toJSON();

    expect(json.fullPrice).toBe(2500);
    expect(json.status).toBe("completed");
    expect(json.stripePaymentIntentId).toBe("pi_test_123");
    expect(json.stripeSessionId).toBe("cs_test_456");
  });
});

describe("Purchase Model - generateOrderNumber Static", () => {
  let Purchase: typeof import("../../../src/models/Purchase").default;

  beforeEach(async () => {
    vi.clearAllMocks();
    Purchase = (await import("../../../src/models/Purchase")).default;
  });

  test("generateOrderNumber creates valid order number format", async () => {
    // Mock findOne to return null (no existing orders)
    const findOneMock = vi.fn().mockReturnValue({
      sort: vi.fn().mockResolvedValue(null),
    });
    (Purchase as any).findOne = findOneMock;

    const orderNumber = await (Purchase as any).generateOrderNumber();

    // Should match format ORD-YYYYMMDD-00001
    expect(orderNumber).toMatch(/^ORD-\d{8}-00001$/);
  });

  test("generateOrderNumber increments from existing order", async () => {
    // Mock findOne to return existing order
    const findOneMock = vi.fn().mockReturnValue({
      sort: vi.fn().mockResolvedValue({
        orderNumber: "ORD-20250115-00042",
      }),
    });
    (Purchase as any).findOne = findOneMock;

    const orderNumber = await (Purchase as any).generateOrderNumber();

    // Should increment to 00043
    expect(orderNumber).toMatch(/^ORD-\d{8}-00043$/);
  });

  test("generateOrderNumber handles order number without matching sequence", async () => {
    // Edge case: existing order has malformed sequence
    const findOneMock = vi.fn().mockReturnValue({
      sort: vi.fn().mockResolvedValue({
        orderNumber: "ORD-20250115-XYZ", // No trailing digits
      }),
    });
    (Purchase as any).findOne = findOneMock;

    const orderNumber = await (Purchase as any).generateOrderNumber();

    // Should default to 00001 when regex doesn't match
    expect(orderNumber).toMatch(/^ORD-\d{8}-00001$/);
  });

  test("generateOrderNumber uses current date", async () => {
    const findOneMock = vi.fn().mockReturnValue({
      sort: vi.fn().mockResolvedValue(null),
    });
    (Purchase as any).findOne = findOneMock;

    const orderNumber = await (Purchase as any).generateOrderNumber();

    // Extract date from order number
    const match = orderNumber.match(/^ORD-(\d{8})-/);
    expect(match).not.toBeNull();

    if (match) {
      const orderDate = match[1];
      const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
      expect(orderDate).toBe(today);
    }
  });
});
