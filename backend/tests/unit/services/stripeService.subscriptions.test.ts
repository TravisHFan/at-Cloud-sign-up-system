/**
 * Unit Tests for Stripe Service - Subscription Management
 *
 * Tests subscription-related functions that were previously uncovered:
 * - updateDonationSubscription
 * - pauseDonationSubscription
 * - resumeDonationSubscription
 * - cancelDonationSubscription
 * - getDonationSubscription
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Stripe from "stripe";
import {
  updateDonationSubscription,
  pauseDonationSubscription,
  resumeDonationSubscription,
  cancelDonationSubscription,
  getDonationSubscription,
  stripe,
} from "../../../src/services/stripeService";

// Mock Stripe
vi.mock("stripe", () => {
  const MockStripe = vi.fn().mockImplementation(() => ({
    subscriptions: {
      retrieve: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    },
    prices: {
      create: vi.fn(),
    },
  }));
  return { default: MockStripe };
});

describe("Stripe Service - Subscription Management", () => {
  let mockSubscriptionRetrieve: ReturnType<typeof vi.fn>;
  let mockSubscriptionUpdate: ReturnType<typeof vi.fn>;
  let mockSubscriptionCancel: ReturnType<typeof vi.fn>;
  let mockPriceCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSubscriptionRetrieve = vi.fn();
    mockSubscriptionUpdate = vi.fn();
    mockSubscriptionCancel = vi.fn();
    mockPriceCreate = vi.fn();

    (stripe.subscriptions as any).retrieve = mockSubscriptionRetrieve;
    (stripe.subscriptions as any).update = mockSubscriptionUpdate;
    (stripe.subscriptions as any).cancel = mockSubscriptionCancel;
    (stripe.prices as any).create = mockPriceCreate;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("updateDonationSubscription", () => {
    it("should update subscription amount by creating new price", async () => {
      const mockSubscription = {
        id: "sub_123",
        items: {
          data: [
            {
              id: "si_123",
              price: {
                id: "price_old",
                unit_amount: 1000, // $10.00
              },
            },
          ],
        },
      };

      mockSubscriptionRetrieve.mockResolvedValue(mockSubscription);
      mockPriceCreate.mockResolvedValue({ id: "price_new" });
      mockSubscriptionUpdate.mockResolvedValue({
        ...mockSubscription,
        items: { data: [{ id: "si_123", price: { id: "price_new" } }] },
      });

      const result = await updateDonationSubscription({
        subscriptionId: "sub_123",
        amount: 2000, // $20.00
      });

      expect(mockSubscriptionRetrieve).toHaveBeenCalledWith("sub_123");
      expect(mockPriceCreate).toHaveBeenCalledWith({
        currency: "usd",
        unit_amount: 2000,
        recurring: {
          interval: "month",
          interval_count: 1,
        },
        product_data: {
          name: "Recurring Ministry Donation",
        },
        metadata: {
          frequency: "monthly",
        },
      });
      expect(mockSubscriptionUpdate).toHaveBeenCalledWith("sub_123", {
        proration_behavior: "none",
        items: [
          {
            id: "si_123",
            price: "price_new",
          },
        ],
      });
      expect(result.items.data[0].price.id).toBe("price_new");
    });

    it("should update subscription frequency to weekly", async () => {
      const mockSubscription = {
        id: "sub_456",
        items: {
          data: [
            {
              id: "si_456",
              price: {
                id: "price_monthly",
                unit_amount: 5000,
              },
            },
          ],
        },
      };

      mockSubscriptionRetrieve.mockResolvedValue(mockSubscription);
      mockPriceCreate.mockResolvedValue({ id: "price_weekly" });
      mockSubscriptionUpdate.mockResolvedValue(mockSubscription);

      await updateDonationSubscription({
        subscriptionId: "sub_456",
        frequency: "weekly",
      });

      expect(mockPriceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          recurring: {
            interval: "week",
            interval_count: 1,
          },
          metadata: {
            frequency: "weekly",
          },
        })
      );
    });

    it("should update subscription frequency to biweekly", async () => {
      const mockSubscription = {
        id: "sub_789",
        items: {
          data: [
            {
              id: "si_789",
              price: {
                id: "price_old",
                unit_amount: 3000,
              },
            },
          ],
        },
      };

      mockSubscriptionRetrieve.mockResolvedValue(mockSubscription);
      mockPriceCreate.mockResolvedValue({ id: "price_biweekly" });
      mockSubscriptionUpdate.mockResolvedValue(mockSubscription);

      await updateDonationSubscription({
        subscriptionId: "sub_789",
        frequency: "biweekly",
      });

      expect(mockPriceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          recurring: {
            interval: "week",
            interval_count: 2,
          },
        })
      );
    });

    it("should update subscription frequency to quarterly", async () => {
      const mockSubscription = {
        id: "sub_quarterly",
        items: {
          data: [
            {
              id: "si_quarterly",
              price: {
                id: "price_monthly",
                unit_amount: 10000,
              },
            },
          ],
        },
      };

      mockSubscriptionRetrieve.mockResolvedValue(mockSubscription);
      mockPriceCreate.mockResolvedValue({ id: "price_quarterly" });
      mockSubscriptionUpdate.mockResolvedValue(mockSubscription);

      await updateDonationSubscription({
        subscriptionId: "sub_quarterly",
        frequency: "quarterly",
      });

      expect(mockPriceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          recurring: {
            interval: "month",
            interval_count: 3,
          },
        })
      );
    });

    it("should update subscription frequency to annually", async () => {
      const mockSubscription = {
        id: "sub_annual",
        items: {
          data: [
            {
              id: "si_annual",
              price: {
                id: "price_monthly",
                unit_amount: 12000,
              },
            },
          ],
        },
      };

      mockSubscriptionRetrieve.mockResolvedValue(mockSubscription);
      mockPriceCreate.mockResolvedValue({ id: "price_annual" });
      mockSubscriptionUpdate.mockResolvedValue(mockSubscription);

      await updateDonationSubscription({
        subscriptionId: "sub_annual",
        frequency: "annually",
      });

      expect(mockPriceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          recurring: {
            interval: "year",
            interval_count: 1,
          },
        })
      );
    });

    it("should schedule subscription cancellation with end date", async () => {
      const mockSubscription = {
        id: "sub_enddate",
        items: {
          data: [
            {
              id: "si_enddate",
              price: {
                id: "price_123",
                unit_amount: 1500,
              },
            },
          ],
        },
      };

      const endDate = new Date("2025-12-31T23:59:59Z");
      mockSubscriptionRetrieve.mockResolvedValue(mockSubscription);
      mockSubscriptionUpdate.mockResolvedValue({
        ...mockSubscription,
        cancel_at: Math.floor(endDate.getTime() / 1000),
      });

      const result = await updateDonationSubscription({
        subscriptionId: "sub_enddate",
        endDate,
      });

      expect(mockSubscriptionUpdate).toHaveBeenCalledWith("sub_enddate", {
        proration_behavior: "none",
        cancel_at: Math.floor(endDate.getTime() / 1000),
      });
      expect(result.cancel_at).toBe(Math.floor(endDate.getTime() / 1000));
    });

    it("should remove scheduled cancellation when endDate is null", async () => {
      const mockSubscription = {
        id: "sub_remove_cancel",
        items: {
          data: [
            {
              id: "si_remove",
              price: {
                id: "price_456",
                unit_amount: 2500,
              },
            },
          ],
        },
        cancel_at: 1735689599, // Previously scheduled
      };

      mockSubscriptionRetrieve.mockResolvedValue(mockSubscription);
      mockSubscriptionUpdate.mockResolvedValue({
        ...mockSubscription,
        cancel_at: null,
      });

      const result = await updateDonationSubscription({
        subscriptionId: "sub_remove_cancel",
        endDate: null,
      });

      expect(mockSubscriptionUpdate).toHaveBeenCalledWith("sub_remove_cancel", {
        proration_behavior: "none",
        cancel_at: null,
      });
      expect(result.cancel_at).toBeNull();
    });

    it("should update both amount and frequency together", async () => {
      const mockSubscription = {
        id: "sub_combo",
        items: {
          data: [
            {
              id: "si_combo",
              price: {
                id: "price_old",
                unit_amount: 1000,
              },
            },
          ],
        },
      };

      mockSubscriptionRetrieve.mockResolvedValue(mockSubscription);
      mockPriceCreate.mockResolvedValue({ id: "price_new_combo" });
      mockSubscriptionUpdate.mockResolvedValue(mockSubscription);

      await updateDonationSubscription({
        subscriptionId: "sub_combo",
        amount: 3000,
        frequency: "weekly",
      });

      expect(mockPriceCreate).toHaveBeenCalledWith({
        currency: "usd",
        unit_amount: 3000,
        recurring: {
          interval: "week",
          interval_count: 1,
        },
        product_data: {
          name: "Recurring Ministry Donation",
        },
        metadata: {
          frequency: "weekly",
        },
      });
    });

    it("should round amount to nearest cent", async () => {
      const mockSubscription = {
        id: "sub_round",
        items: {
          data: [
            {
              id: "si_round",
              price: {
                id: "price_old",
                unit_amount: 1000,
              },
            },
          ],
        },
      };

      mockSubscriptionRetrieve.mockResolvedValue(mockSubscription);
      mockPriceCreate.mockResolvedValue({ id: "price_rounded" });
      mockSubscriptionUpdate.mockResolvedValue(mockSubscription);

      await updateDonationSubscription({
        subscriptionId: "sub_round",
        amount: 1599.7, // Should round to 1600
      });

      expect(mockPriceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          unit_amount: 1600,
        })
      );
    });
  });

  describe("pauseDonationSubscription", () => {
    it("should pause a subscription", async () => {
      mockSubscriptionUpdate.mockResolvedValue({
        id: "sub_pause",
        pause_collection: { behavior: "void" },
      });

      const result = await pauseDonationSubscription("sub_pause");

      expect(mockSubscriptionUpdate).toHaveBeenCalledWith("sub_pause", {
        pause_collection: {
          behavior: "void",
        },
      });
      expect(result.pause_collection).toBeDefined();
      expect(result.pause_collection?.behavior).toBe("void");
    });
  });

  describe("resumeDonationSubscription", () => {
    it("should resume a paused subscription", async () => {
      mockSubscriptionUpdate.mockResolvedValue({
        id: "sub_resume",
        pause_collection: null,
      });

      const result = await resumeDonationSubscription("sub_resume");

      expect(mockSubscriptionUpdate).toHaveBeenCalledWith("sub_resume", {
        pause_collection: null,
      });
      expect(result.pause_collection).toBeNull();
    });
  });

  describe("cancelDonationSubscription", () => {
    it("should cancel a subscription immediately", async () => {
      mockSubscriptionCancel.mockResolvedValue({
        id: "sub_cancel",
        status: "canceled",
        canceled_at: Date.now() / 1000,
      });

      const result = await cancelDonationSubscription("sub_cancel");

      expect(mockSubscriptionCancel).toHaveBeenCalledWith("sub_cancel");
      expect(result.status).toBe("canceled");
      expect(result.canceled_at).toBeDefined();
    });
  });

  describe("getDonationSubscription", () => {
    it("should retrieve a subscription by ID", async () => {
      const mockSubscription = {
        id: "sub_retrieve",
        status: "active",
        current_period_end: 1735689599,
        items: {
          data: [
            {
              id: "si_123",
              price: {
                id: "price_123",
                unit_amount: 5000,
                recurring: {
                  interval: "month",
                  interval_count: 1,
                },
              },
            },
          ],
        },
      };

      mockSubscriptionRetrieve.mockResolvedValue(mockSubscription);

      const result = await getDonationSubscription("sub_retrieve");

      expect(mockSubscriptionRetrieve).toHaveBeenCalledWith("sub_retrieve");
      expect(result.id).toBe("sub_retrieve");
      expect(result.status).toBe("active");
      expect(result.items.data[0].price.unit_amount).toBe(5000);
    });
  });
});
