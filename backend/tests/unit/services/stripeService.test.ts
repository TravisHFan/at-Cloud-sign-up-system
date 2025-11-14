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
      fullPrice: 2000, // $20.00 in cents
      classRepDiscount: 0,
      earlyBirdDiscount: 0,
      finalPrice: 2000, // $20.00 in cents
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
        classRepDiscount: 500, // $5.00 in cents
        finalPrice: 1500, // $15.00 in cents
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
        earlyBirdDiscount: 300, // $3.00 in cents
        finalPrice: 1700, // $17.00 in cents
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
        classRepDiscount: 500, // $5.00 in cents
        earlyBirdDiscount: 300, // $3.00 in cents
        finalPrice: 1200, // $12.00 in cents
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
        finalPrice: 2000, // $20.00 in cents
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
      programTitle: "Test Mentor Circle",
      fullPrice: 1999, // $19.99 in cents
      classRepDiscount: 0,
      earlyBirdDiscount: 0,
      finalPrice: 1999, // $19.99 in cents
      isClassRep: false,
      isEarlyBird: false,
    };

    it("should handle decimal prices correctly (avoid floating point issues)", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_006" });

      await createCheckoutSession({
        ...baseParams,
        fullPrice: 1999, // $19.99 in cents
        finalPrice: 1999,
      });

      const callArgs = mockSessionCreate.mock.calls[0][0];

      // Should round correctly to cents
      expect(callArgs.line_items[0].price_data.unit_amount).toBe(1999);
    });

    it("should handle prices with many decimal places", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_007" });

      await createCheckoutSession({
        ...baseParams,
        fullPrice: 2000, // $20.00 in cents
        finalPrice: 2000,
      });

      const callArgs = mockSessionCreate.mock.calls[0][0];

      // Should round to nearest cent
      expect(callArgs.line_items[0].price_data.unit_amount).toBe(2000);
    });

    it("should reject zero price (free after discounts)", async () => {
      // Stripe requires minimum $0.50 - zero price should be rejected
      await expect(
        createCheckoutSession({
          ...baseParams,
          fullPrice: 500, // $5.00 in cents
          classRepDiscount: 500, // $5.00 in cents
          finalPrice: 0,
          isClassRep: true,
        })
      ).rejects.toThrow(
        /Cannot create payment for \$0\.00\. Stripe requires a minimum of \$0\.50/
      );

      // Session creation should not be called
      expect(mockSessionCreate).not.toHaveBeenCalled();
    });

    it("should format decimal discounts correctly in description", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_009" });

      await createCheckoutSession({
        ...baseParams,
        fullPrice: 1999, // $19.99 in cents
        classRepDiscount: 450, // $4.50 in cents
        finalPrice: 1549, // $15.49 in cents
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
      fullPrice: 2000, // $20.00 in cents
      classRepDiscount: 500, // $5.00 in cents
      earlyBirdDiscount: 300, // $3.00 in cents
      finalPrice: 1200, // $12.00 in cents
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
        fullPrice: "2000", // in cents
        classRepDiscount: "500", // in cents
        earlyBirdDiscount: "300", // in cents
        finalPrice: "1200", // in cents
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
      fullPrice: 2000, // $20.00 in cents
      classRepDiscount: 0,
      earlyBirdDiscount: 0,
      finalPrice: 2000, // $20.00 in cents
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
      fullPrice: 2000, // $20.00 in cents
      classRepDiscount: 0,
      earlyBirdDiscount: 0,
      finalPrice: 2000, // $20.00 in cents
      isClassRep: false,
      isEarlyBird: false,
    };

    it("should handle very large prices", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_017" });

      await createCheckoutSession({
        ...baseParams,
        fullPrice: 999999, // $9999.99 in cents
        finalPrice: 999999,
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

    it("should reject discount larger than price (edge case)", async () => {
      // When discount exceeds price, result is $0.00 which is below Stripe's $0.50 minimum
      await expect(
        createCheckoutSession({
          ...baseParams,
          fullPrice: 1000, // $10.00 in cents
          classRepDiscount: 1500, // $15.00 in cents
          finalPrice: 0, // Capped at 0, not negative
          isClassRep: true,
        })
      ).rejects.toThrow(
        /Cannot create payment for \$0\.00\. Stripe requires a minimum of \$0\.50/
      );

      // Should not create negative price - validation catches it first
      expect(mockSessionCreate).not.toHaveBeenCalled();
    });
  });

  describe("createCheckoutSession - Promo Code Discounts", () => {
    const baseParams = {
      userId: "user123",
      userEmail: "test@example.com",
      programId: "prog123",
      programTitle: "Test Program",
      fullPrice: 5000, // $50.00 in cents
      classRepDiscount: 0,
      earlyBirdDiscount: 0,
      finalPrice: 5000,
      isClassRep: false,
      isEarlyBird: false,
    };

    it("should include promo code with dollar discount in description and metadata", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_promo_001" });

      await createCheckoutSession({
        ...baseParams,
        promoCode: "SAVE10",
        promoDiscountAmount: 1000, // $10.00
        finalPrice: 4000, // $40.00
      });

      const callArgs = mockSessionCreate.mock.calls[0][0];

      // Check description
      const description =
        callArgs.line_items[0].price_data.product_data.description;
      expect(description).toContain("Promo Code (SAVE10): -$10.00");

      // Check metadata
      expect(callArgs.metadata.promoCode).toBe("SAVE10");
      expect(callArgs.metadata.promoDiscountAmount).toBe("1000");
    });

    it("should include promo code with percentage discount in description and metadata", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_promo_002" });

      await createCheckoutSession({
        ...baseParams,
        promoCode: "TWENTY",
        promoDiscountPercent: 20, // 20%
        finalPrice: 4000, // $40.00
      });

      const callArgs = mockSessionCreate.mock.calls[0][0];

      // Check description
      const description =
        callArgs.line_items[0].price_data.product_data.description;
      expect(description).toContain("Promo Code (TWENTY): -20%");

      // Check metadata
      expect(callArgs.metadata.promoCode).toBe("TWENTY");
      expect(callArgs.metadata.promoDiscountPercent).toBe("20");
    });

    it("should handle all discounts together (class rep + early bird + promo)", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_promo_003" });

      await createCheckoutSession({
        ...baseParams,
        classRepDiscount: 500, // $5.00
        earlyBirdDiscount: 300, // $3.00
        promoCode: "EXTRA5",
        promoDiscountAmount: 500, // $5.00
        finalPrice: 3700, // $37.00
        isClassRep: true,
        isEarlyBird: true,
      });

      const callArgs = mockSessionCreate.mock.calls[0][0];

      // Check all discounts in description
      const description =
        callArgs.line_items[0].price_data.product_data.description;
      expect(description).toContain("Original price: $50.00");
      expect(description).toContain("Class Rep Discount: -$5.00");
      expect(description).toContain("Early Bird Discount: -$3.00");
      expect(description).toContain("Promo Code (EXTRA5): -$5.00");

      // Check final price
      expect(callArgs.line_items[0].price_data.unit_amount).toBe(3700);
    });

    it("should include purchaseId in metadata when provided", async () => {
      mockSessionCreate.mockResolvedValue({ id: "cs_test_purchase_001" });

      await createCheckoutSession({
        ...baseParams,
        purchaseId: "purchase_abc123",
      });

      const callArgs = mockSessionCreate.mock.calls[0][0];

      expect(callArgs.metadata.purchaseId).toBe("purchase_abc123");
    });
  });
});

describe("Stripe Service - Refunds", () => {
  let mockRefundsCreate: ReturnType<typeof vi.fn>;
  let mockRefundsRetrieve: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRefundsCreate = vi.fn();
    mockRefundsRetrieve = vi.fn();
    (stripe as any).refunds = {
      create: mockRefundsCreate,
      retrieve: mockRefundsRetrieve,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should process refund with payment intent ID", async () => {
    const mockRefund = {
      id: "re_test_001",
      amount: 2000,
      status: "succeeded",
      payment_intent: "pi_test_001",
    };
    mockRefundsCreate.mockResolvedValue(mockRefund);

    const { processRefund } = await import(
      "../../../src/services/stripeService"
    );

    const result = await processRefund({
      paymentIntentId: "pi_test_001",
      amount: 2000,
      reason: "requested_by_customer",
    });

    expect(mockRefundsCreate).toHaveBeenCalledWith({
      payment_intent: "pi_test_001",
      amount: 2000,
      reason: "requested_by_customer",
      metadata: {},
    });
    expect(result).toEqual(mockRefund);
  });

  it("should include metadata when processing refund", async () => {
    mockRefundsCreate.mockResolvedValue({ id: "re_test_002" });

    const { processRefund } = await import(
      "../../../src/services/stripeService"
    );

    await processRefund({
      paymentIntentId: "pi_test_002",
      amount: 1500,
      metadata: {
        purchaseId: "purchase_123",
        reason: "Duplicate charge",
      },
    });

    expect(mockRefundsCreate).toHaveBeenCalledWith({
      payment_intent: "pi_test_002",
      amount: 1500,
      reason: undefined,
      metadata: {
        purchaseId: "purchase_123",
        reason: "Duplicate charge",
      },
    });
  });

  it("should round amount to nearest cent", async () => {
    mockRefundsCreate.mockResolvedValue({ id: "re_test_003" });

    const { processRefund } = await import(
      "../../../src/services/stripeService"
    );

    await processRefund({
      paymentIntentId: "pi_test_003",
      amount: 1999.7, // Should round to 2000
    });

    expect(mockRefundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2000,
      })
    );
  });

  it("should retrieve refund by ID", async () => {
    const mockRefund = {
      id: "re_test_004",
      amount: 3000,
      status: "succeeded",
    };
    mockRefundsRetrieve.mockResolvedValue(mockRefund);

    const { getRefund } = await import("../../../src/services/stripeService");

    const result = await getRefund("re_test_004");

    expect(mockRefundsRetrieve).toHaveBeenCalledWith("re_test_004");
    expect(result).toEqual(mockRefund);
  });

  it("should handle refund errors", async () => {
    mockRefundsCreate.mockRejectedValue(
      new Error("Insufficient funds for refund")
    );

    const { processRefund } = await import(
      "../../../src/services/stripeService"
    );

    await expect(
      processRefund({
        paymentIntentId: "pi_test_error",
        amount: 5000,
      })
    ).rejects.toThrow("Insufficient funds for refund");
  });
});

describe("Stripe Service - Payment Intent & Checkout Retrieval", () => {
  let mockPaymentIntentsRetrieve: ReturnType<typeof vi.fn>;
  let mockSessionsRetrieve: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPaymentIntentsRetrieve = vi.fn();
    mockSessionsRetrieve = vi.fn();
    (stripe as any).paymentIntents = {
      retrieve: mockPaymentIntentsRetrieve,
    };
    (stripe.checkout.sessions as any).retrieve = mockSessionsRetrieve;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should retrieve payment intent by ID", async () => {
    const mockPaymentIntent = {
      id: "pi_test_001",
      amount: 2000,
      status: "succeeded",
      metadata: { programId: "prog123" },
    };
    mockPaymentIntentsRetrieve.mockResolvedValue(mockPaymentIntent);

    const { getPaymentIntent } = await import(
      "../../../src/services/stripeService"
    );

    const result = await getPaymentIntent("pi_test_001");

    expect(mockPaymentIntentsRetrieve).toHaveBeenCalledWith("pi_test_001");
    expect(result).toEqual(mockPaymentIntent);
  });

  it("should retrieve checkout session by ID", async () => {
    const mockSession = {
      id: "cs_test_001",
      payment_status: "paid",
      metadata: { userId: "user123" },
    };
    mockSessionsRetrieve.mockResolvedValue(mockSession);

    const { getCheckoutSession } = await import(
      "../../../src/services/stripeService"
    );

    const result = await getCheckoutSession("cs_test_001");

    expect(mockSessionsRetrieve).toHaveBeenCalledWith("cs_test_001");
    expect(result).toEqual(mockSession);
  });
});

describe("Stripe Service - Webhook Events", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should construct webhook event with valid signature", async () => {
    const payload = JSON.stringify({ type: "checkout.session.completed" });
    const signature = "valid_signature";

    const mockEvent = {
      id: "evt_test_001",
      type: "checkout.session.completed",
      data: {},
    };

    const mockConstructEvent = vi.fn().mockReturnValue(mockEvent);
    (stripe as any).webhooks = {
      constructEvent: mockConstructEvent,
    };

    const { constructWebhookEvent } = await import(
      "../../../src/services/stripeService"
    );

    const result = constructWebhookEvent(payload, signature);

    expect(mockConstructEvent).toHaveBeenCalled();
    expect(result).toEqual(mockEvent);
  });
});

describe("Stripe Service - Donation Customer Management", () => {
  let mockCustomersList: ReturnType<typeof vi.fn>;
  let mockCustomersCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCustomersList = vi.fn();
    mockCustomersCreate = vi.fn();
    (stripe as any).customers = {
      list: mockCustomersList,
      create: mockCustomersCreate,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return existing customer if found by email", async () => {
    const existingCustomer = {
      id: "cus_existing_001",
      email: "donor@example.com",
    };
    mockCustomersList.mockResolvedValue({
      data: [existingCustomer],
    });

    const { getOrCreateDonationCustomer } = await import(
      "../../../src/services/stripeService"
    );

    const customerId = await getOrCreateDonationCustomer({
      userId: "user123",
      email: "donor@example.com",
      name: "John Donor",
    });

    expect(mockCustomersList).toHaveBeenCalledWith({
      email: "donor@example.com",
      limit: 1,
    });
    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(customerId).toBe("cus_existing_001");
  });

  it("should create new customer if none exists", async () => {
    mockCustomersList.mockResolvedValue({ data: [] });
    const newCustomer = {
      id: "cus_new_001",
      email: "newdonor@example.com",
    };
    mockCustomersCreate.mockResolvedValue(newCustomer);

    const { getOrCreateDonationCustomer } = await import(
      "../../../src/services/stripeService"
    );

    const customerId = await getOrCreateDonationCustomer({
      userId: "user456",
      email: "newdonor@example.com",
      name: "Jane Donor",
    });

    expect(mockCustomersList).toHaveBeenCalled();
    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: "newdonor@example.com",
      name: "Jane Donor",
      metadata: {
        userId: "user456",
        source: "donation",
      },
    });
    expect(customerId).toBe("cus_new_001");
  });
});

describe("Stripe Service - Donation Checkout Sessions", () => {
  let mockSessionCreate: ReturnType<typeof vi.fn>;
  let mockCustomersList: ReturnType<typeof vi.fn>;
  let mockCustomersCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSessionCreate = vi.fn();
    mockCustomersList = vi.fn();
    mockCustomersCreate = vi.fn();
    (stripe.checkout.sessions as any).create = mockSessionCreate;
    (stripe as any).customers = {
      list: mockCustomersList,
      create: mockCustomersCreate,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create donation checkout session for immediate donation", async () => {
    mockCustomersList.mockResolvedValue({
      data: [{ id: "cus_test_001" }],
    });
    mockSessionCreate.mockResolvedValue({
      id: "cs_donation_001",
      url: "https://checkout.stripe.com/pay/cs_donation_001",
    });

    const { createDonationCheckoutSession } = await import(
      "../../../src/services/stripeService"
    );

    const today = new Date();
    const result = await createDonationCheckoutSession({
      donationId: "donation_123",
      userId: "user123",
      userEmail: "donor@example.com",
      userName: "John Donor",
      amount: 5000, // $50.00
      giftDate: today,
    });

    const callArgs = mockSessionCreate.mock.calls[0][0];

    expect(callArgs.line_items[0].price_data.unit_amount).toBe(5000);
    expect(callArgs.line_items[0].price_data.product_data.name).toBe(
      "Ministry Donation"
    );
    expect(
      callArgs.line_items[0].price_data.product_data.description
    ).toContain("One-time donation to our ministry");
    expect(callArgs.metadata).toMatchObject({
      donationId: "donation_123",
      userId: "user123",
      type: "donation",
      donationType: "one-time",
    });
  });

  it("should create donation checkout session for future-dated donation", async () => {
    mockCustomersList.mockResolvedValue({
      data: [{ id: "cus_test_002" }],
    });
    mockSessionCreate.mockResolvedValue({ id: "cs_donation_002" });

    const { createDonationCheckoutSession } = await import(
      "../../../src/services/stripeService"
    );

    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);

    await createDonationCheckoutSession({
      donationId: "donation_456",
      userId: "user456",
      userEmail: "donor2@example.com",
      userName: "Jane Donor",
      amount: 10000, // $100.00
      giftDate: futureDate,
    });

    const callArgs = mockSessionCreate.mock.calls[0][0];

    expect(
      callArgs.line_items[0].price_data.product_data.description
    ).toContain("scheduled for");
  });

  it("should reject donation amount below $1.00", async () => {
    const { createDonationCheckoutSession } = await import(
      "../../../src/services/stripeService"
    );

    await expect(
      createDonationCheckoutSession({
        donationId: "donation_low",
        userId: "user789",
        userEmail: "donor3@example.com",
        userName: "Bob Donor",
        amount: 50, // $0.50 - below minimum
        giftDate: new Date(),
      })
    ).rejects.toThrow("Donation amount must be at least $1.00");

    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it("should include billing address collection", async () => {
    mockCustomersList.mockResolvedValue({
      data: [{ id: "cus_test_003" }],
    });
    mockSessionCreate.mockResolvedValue({ id: "cs_donation_003" });

    const { createDonationCheckoutSession } = await import(
      "../../../src/services/stripeService"
    );

    await createDonationCheckoutSession({
      donationId: "donation_789",
      userId: "user999",
      userEmail: "donor4@example.com",
      userName: "Alice Donor",
      amount: 2500,
      giftDate: new Date(),
    });

    const callArgs = mockSessionCreate.mock.calls[0][0];

    expect(callArgs.billing_address_collection).toBe("required");
    expect(callArgs.customer).toBe("cus_test_003");
  });
});
