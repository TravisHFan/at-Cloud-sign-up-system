/**
 * Unit Tests for Stripe Service
 *
 * Tests the checkout session creation logic including:
 * - Discount calculation and display
 * - Line item generation
 * - Metadata creation
 * - Price formatting
 *
 * Specifically validates the fix for negative line items bug:
 * Stripe doesn't allow negative amounts in payment mode, so discounts
 * are shown in the product description instead of separate line items.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Stripe from "stripe";
import {
  createCheckoutSession,
  stripe,
} from "../../../src/services/stripeService";

// Mock the Stripe instance
vi.mock("stripe", () => {
  const MockStripe = vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: vi.fn(),
        retrieve: vi.fn(),
      },
    },
  }));
  return { default: MockStripe };
});

describe("Stripe Service Unit Tests", () => {
  let mockSessionCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSessionCreate = vi.fn();
    (stripe.checkout.sessions as any).create = mockSessionCreate;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createCheckoutSession - Discount Handling", () => {
    const baseParams = {
      userId: "user123",
      userEmail: "test@example.com",
      programId: "prog123",
      programTitle: "Test Mentor Circle",
      fullPrice: 20.0,
      classRepDiscount: 0,
      earlyBirdDiscount: 0,
      finalPrice: 20.0,
      isClassRep: false,
      isEarlyBird: false,
    };

    it("should create session with full price (no discounts)", async () => {
      mockSessionCreate.mockResolvedValue({
        id: "cs_test_001",
        url: "https://checkout.stripe.com/pay/cs_test_001",
      });

      await createCheckoutSession(baseParams);

      expect(mockSessionCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockSessionCreate.mock.calls[0][0];

      // Should have single line item with full price
      expect(callArgs.line_items).toHaveLength(1);
      expect(callArgs.line_items[0].price_data.unit_amount).toBe(2000); // $20 in cents
      expect(callArgs.line_items[0].price_data.product_data.name).toBe(
        "Test Mentor Circle"
      );
      expect(callArgs.line_items[0].price_data.product_data.description).toBe(
        "Program enrollment"
      );
    });

    it("should show class rep discount in description, not as negative line item", async () => {
      mockSessionCreate.mockResolvedValue({
        id: "cs_test_002",
        url: "https://checkout.stripe.com/pay/cs_test_002",
      });

      await createCheckoutSession({
        ...baseParams,
        classRepDiscount: 5.0,
        finalPrice: 15.0,
        isClassRep: true,
      });

      const callArgs = mockSessionCreate.mock.calls[0][0];

      // Should NOT have separate negative line item (the bug we fixed)
      expect(callArgs.line_items).toHaveLength(1);

      // Should have final price, not full price
      expect(callArgs.line_items[0].price_data.unit_amount).toBe(1500); // $15 in cents

      // Should show discount in description
      const description =
        callArgs.line_items[0].price_data.product_data.description;
      expect(description).toContain("Original price: $20.00");
      expect(description).toContain("Class Rep Discount: -$5.00");
    });

    it("should show early bird discount in description", async () => {
      mockSessionCreate.mockResolvedValue({
        id: "cs_test_003",
        url: "https://checkout.stripe.com/pay/cs_test_003",
      });

      await createCheckoutSession({
        ...baseParams,
        earlyBirdDiscount: 3.0,
        finalPrice: 17.0,
        isEarlyBird: true,
      });

      const callArgs = mockSessionCreate.mock.calls[0][0];

      expect(callArgs.line_items).toHaveLength(1);
      expect(callArgs.line_items[0].price_data.unit_amount).toBe(1700); // $17 in cents

      const description =
        callArgs.line_items[0].price_data.product_data.description;
      expect(description).toContain("Original price: $20.00");
      expect(description).toContain("Early Bird Discount: -$3.00");
    });

    it("should show both discounts when both are applied", async () => {
      mockSessionCreate.mockResolvedValue({
        id: "cs_test_004",
        url: "https://checkout.stripe.com/pay/cs_test_004",
      });

      await createCheckoutSession({
        ...baseParams,
        classRepDiscount: 5.0,
        earlyBirdDiscount: 3.0,
        finalPrice: 12.0,
        isClassRep: true,
        isEarlyBird: true,
      });

      const callArgs = mockSessionCreate.mock.calls[0][0];

      expect(callArgs.line_items).toHaveLength(1);
      expect(callArgs.line_items[0].price_data.unit_amount).toBe(1200); // $12 in cents

      const description =
        callArgs.line_items[0].price_data.product_data.description;
      expect(description).toContain("Original price: $20.00");
      expect(description).toContain("Class Rep Discount: -$5.00");
      expect(description).toContain("Early Bird Discount: -$3.00");
    });

    it("should not show discount details when finalPrice equals fullPrice", async () => {
      mockSessionCreate.mockResolvedValue({
        id: "cs_test_005",
        url: "https://checkout.stripe.com/pay/cs_test_005",
      });

      await createCheckoutSession({
        ...baseParams,
        // isClassRep and isEarlyBird flags set but discounts are 0
        isClassRep: true,
        isEarlyBird: true,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        finalPrice: 20.0,
      });

      const callArgs = mockSessionCreate.mock.calls[0][0];

      const description =
        callArgs.line_items[0].price_data.product_data.description;
      expect(description).toBe("Program enrollment");
      expect(description).not.toContain("Original price");
      expect(description).not.toContain("Discount");
    });
  });

  describe("createCheckoutSession - Price Formatting", () => {
    const baseParams = {
      userId: "user123",
      userEmail: "test@example.com",
      programId: "prog123",
      programTitle: "Test Program",
      fullPrice: 19.99,
      classRepDiscount: 0,
      earlyBirdDiscount: 0,
      finalPrice: 19.99,
      isClassRep: false,
      isEarlyBird: false,
    };

    it("should handle decimal prices correctly (avoid floating point issues)", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_006" });

      await createCheckoutSession({
        ...baseParams,
        fullPrice: 19.99,
        finalPrice: 19.99,
      });

      const callArgs = mockSessionCreate.mock.calls[0][0];

      // Should round correctly to cents
      expect(callArgs.line_items[0].price_data.unit_amount).toBe(1999);
    });

    it("should handle prices with many decimal places", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_007" });

      await createCheckoutSession({
        ...baseParams,
        fullPrice: 19.9999999,
        finalPrice: 19.9999999,
      });

      const callArgs = mockSessionCreate.mock.calls[0][0];

      // Should round to nearest cent
      expect(callArgs.line_items[0].price_data.unit_amount).toBe(2000);
    });

    it("should handle zero price (free after discounts)", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_008" });

      await createCheckoutSession({
        ...baseParams,
        fullPrice: 5.0,
        classRepDiscount: 5.0,
        finalPrice: 0,
        isClassRep: true,
      });

      const callArgs = mockSessionCreate.mock.calls[0][0];

      expect(callArgs.line_items[0].price_data.unit_amount).toBe(0);
    });

    it("should format decimal discounts correctly in description", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_009" });

      await createCheckoutSession({
        ...baseParams,
        fullPrice: 19.99,
        classRepDiscount: 4.5,
        finalPrice: 15.49,
        isClassRep: true,
      });

      const callArgs = mockSessionCreate.mock.calls[0][0];
      const description =
        callArgs.line_items[0].price_data.product_data.description;

      expect(description).toContain("Original price: $19.99");
      expect(description).toContain("Class Rep Discount: -$4.50");
    });
  });

  describe("createCheckoutSession - Metadata", () => {
    const baseParams = {
      userId: "user123",
      userEmail: "test@example.com",
      programId: "prog123",
      programTitle: "Test Program",
      fullPrice: 20.0,
      classRepDiscount: 5.0,
      earlyBirdDiscount: 3.0,
      finalPrice: 12.0,
      isClassRep: true,
      isEarlyBird: true,
    };

    it("should include all purchase details in metadata", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_010" });

      await createCheckoutSession(baseParams);

      const callArgs = mockSessionCreate.mock.calls[0][0];

      expect(callArgs.metadata).toEqual({
        userId: "user123",
        programId: "prog123",
        programTitle: "Test Program",
        fullPrice: "20",
        classRepDiscount: "5",
        earlyBirdDiscount: "3",
        finalPrice: "12",
        isClassRep: "true",
        isEarlyBird: "true",
      });
    });

    it("should store boolean flags as strings in metadata", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_011" });

      await createCheckoutSession({
        ...baseParams,
        isClassRep: false,
        isEarlyBird: false,
      });

      const callArgs = mockSessionCreate.mock.calls[0][0];

      // Metadata must be strings
      expect(callArgs.metadata.isClassRep).toBe("false");
      expect(callArgs.metadata.isEarlyBird).toBe("false");
    });
  });

  describe("createCheckoutSession - Session Configuration", () => {
    const baseParams = {
      userId: "user123",
      userEmail: "test@example.com",
      programId: "prog123",
      programTitle: "Test Program",
      fullPrice: 20.0,
      classRepDiscount: 0,
      earlyBirdDiscount: 0,
      finalPrice: 20.0,
      isClassRep: false,
      isEarlyBird: false,
    };

    it("should configure payment mode correctly", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_012" });

      await createCheckoutSession(baseParams);

      const callArgs = mockSessionCreate.mock.calls[0][0];

      expect(callArgs.mode).toBe("payment");
      expect(callArgs.payment_method_types).toEqual(["card"]);
    });

    it("should include customer email", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_013" });

      await createCheckoutSession(baseParams);

      const callArgs = mockSessionCreate.mock.calls[0][0];

      expect(callArgs.customer_email).toBe("test@example.com");
    });

    it("should require billing address", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_014" });

      await createCheckoutSession(baseParams);

      const callArgs = mockSessionCreate.mock.calls[0][0];

      expect(callArgs.billing_address_collection).toBe("required");
    });

    it("should set success and cancel URLs", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_015" });

      await createCheckoutSession(baseParams);

      const callArgs = mockSessionCreate.mock.calls[0][0];

      expect(callArgs.success_url).toBeDefined();
      expect(callArgs.cancel_url).toContain("prog123");
    });

    it("should set quantity to 1 for program enrollment", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_016" });

      await createCheckoutSession(baseParams);

      const callArgs = mockSessionCreate.mock.calls[0][0];

      expect(callArgs.line_items[0].quantity).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    const baseParams = {
      userId: "user123",
      userEmail: "test@example.com",
      programId: "prog123",
      programTitle: "Test Program",
      fullPrice: 20.0,
      classRepDiscount: 0,
      earlyBirdDiscount: 0,
      finalPrice: 20.0,
      isClassRep: false,
      isEarlyBird: false,
    };

    it("should handle very large prices", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_017" });

      await createCheckoutSession({
        ...baseParams,
        fullPrice: 9999.99,
        finalPrice: 9999.99,
      });

      const callArgs = mockSessionCreate.mock.calls[0][0];

      expect(callArgs.line_items[0].price_data.unit_amount).toBe(999999);
    });

    it("should handle program titles with special characters", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_018" });

      await createCheckoutSession({
        ...baseParams,
        programTitle: "Mentor Circle: Leadership & Innovation (2025)",
      });

      const callArgs = mockSessionCreate.mock.calls[0][0];

      expect(callArgs.line_items[0].price_data.product_data.name).toBe(
        "Mentor Circle: Leadership & Innovation (2025)"
      );
    });

    it("should handle discount larger than price (edge case)", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_019" });

      await createCheckoutSession({
        ...baseParams,
        fullPrice: 10.0,
        classRepDiscount: 15.0,
        finalPrice: 0, // Capped at 0, not negative
        isClassRep: true,
      });

      const callArgs = mockSessionCreate.mock.calls[0][0];

      // Should not create negative price
      expect(
        callArgs.line_items[0].price_data.unit_amount
      ).toBeGreaterThanOrEqual(0);
    });
  });
});
