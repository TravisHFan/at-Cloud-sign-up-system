/**
 * EventPurchaseService Unit Tests
 *
 * Tests the event purchase service functionality:
 * - Creating event purchases
 * - Checking purchase status
 * - Retrieving user's event purchases
 * - Getting purchase by ID
 * - Updating purchase status
 * - Getting event ticket sales
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";

// Mock dependencies before importing service
vi.mock("../../../../src/models/Event", () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock("../../../../src/models/Purchase", () => {
  const mockPurchase = vi.fn().mockImplementation((data) => ({
    ...data,
    save: vi.fn().mockResolvedValue(data),
  }));
  (mockPurchase as unknown as Record<string, unknown>).findOne = vi.fn();
  (mockPurchase as unknown as Record<string, unknown>).find = vi.fn();
  (mockPurchase as unknown as Record<string, unknown>).findById = vi.fn();
  (mockPurchase as unknown as Record<string, unknown>).findByIdAndUpdate =
    vi.fn();
  (mockPurchase as unknown as Record<string, unknown>).generateOrderNumber = vi
    .fn()
    .mockResolvedValue("EVT-2024-00001");
  return {
    default: mockPurchase,
    IPurchase: {},
  };
});

vi.mock("../../../../src/services/LoggerService", () => ({
  Logger: {
    getInstance: () => ({
      child: () => ({
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
      }),
    }),
  },
}));

import EventPurchaseService from "../../../../src/services/event/EventPurchaseService";
import Event from "../../../../src/models/Event";
import Purchase from "../../../../src/models/Purchase";

describe("EventPurchaseService", () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const eventId = new mongoose.Types.ObjectId().toString();
  const purchaseId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createEventPurchase", () => {
    const validParams = {
      userId,
      eventId,
      priceInCents: 5000,
      billingInfo: {
        fullName: "John Doe",
        email: "john@example.com",
      },
      paymentMethod: {
        type: "card" as const,
        last4: "4242",
        cardBrand: "visa",
      },
      stripeSessionId: "cs_test_123",
    };

    it("should create a purchase for a paid event", async () => {
      const mockEvent = {
        _id: eventId,
        pricing: { isFree: false, price: 5000 },
      };

      vi.mocked(Event.findById).mockResolvedValue(mockEvent as unknown);

      const result = await EventPurchaseService.createEventPurchase(
        validParams
      );

      expect(Event.findById).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.purchaseType).toBe("event");
      expect(result.status).toBe("pending");
    });

    it("should throw error if event not found", async () => {
      vi.mocked(Event.findById).mockResolvedValue(null);

      await expect(
        EventPurchaseService.createEventPurchase(validParams)
      ).rejects.toThrow("Event not found");
    });

    it("should throw error for free events", async () => {
      const mockEvent = {
        _id: eventId,
        pricing: { isFree: true },
      };

      vi.mocked(Event.findById).mockResolvedValue(mockEvent as unknown);

      await expect(
        EventPurchaseService.createEventPurchase(validParams)
      ).rejects.toThrow("Cannot purchase tickets for free events");
    });

    it("should throw error when event has no pricing (defaults to free)", async () => {
      const mockEvent = {
        _id: eventId,
        pricing: undefined,
      };

      vi.mocked(Event.findById).mockResolvedValue(mockEvent as unknown);

      await expect(
        EventPurchaseService.createEventPurchase(validParams)
      ).rejects.toThrow("Cannot purchase tickets for free events");
    });
  });

  describe("hasUserPurchasedEvent", () => {
    it("should return true if user has completed purchase", async () => {
      vi.mocked(Purchase.findOne).mockResolvedValue({
        _id: purchaseId,
        status: "completed",
      } as unknown);

      const result = await EventPurchaseService.hasUserPurchasedEvent(
        userId,
        eventId
      );

      expect(result).toBe(true);
      expect(Purchase.findOne).toHaveBeenCalledWith({
        userId: expect.any(mongoose.Types.ObjectId),
        purchaseType: "event",
        eventId: expect.any(mongoose.Types.ObjectId),
        status: "completed",
      });
    });

    it("should return false if no completed purchase exists", async () => {
      vi.mocked(Purchase.findOne).mockResolvedValue(null);

      const result = await EventPurchaseService.hasUserPurchasedEvent(
        userId,
        eventId
      );

      expect(result).toBe(false);
    });

    it("should handle ObjectId types for parameters", async () => {
      vi.mocked(Purchase.findOne).mockResolvedValue({
        _id: purchaseId,
        status: "completed",
      } as unknown);

      const result = await EventPurchaseService.hasUserPurchasedEvent(
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(eventId)
      );

      expect(result).toBe(true);
    });

    it("should return false on error", async () => {
      vi.mocked(Purchase.findOne).mockRejectedValue(new Error("DB error"));

      const result = await EventPurchaseService.hasUserPurchasedEvent(
        userId,
        eventId
      );

      expect(result).toBe(false);
    });
  });

  describe("getUserEventPurchases", () => {
    it("should apply limit when provided", async () => {
      const mockPurchases = [{ _id: purchaseId, status: "completed" }];
      const limitMock = vi.fn().mockResolvedValue(mockPurchases);
      const sortMock = vi.fn().mockReturnValue({ limit: limitMock });
      const populateMock = vi.fn().mockReturnValue({ sort: sortMock });
      vi.mocked(Purchase.find).mockReturnValue({
        populate: populateMock,
      } as unknown as mongoose.Query<unknown[], unknown>);

      const result = await EventPurchaseService.getUserEventPurchases(userId, {
        limit: 10,
      });

      expect(Purchase.find).toHaveBeenCalled();
      expect(limitMock).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockPurchases);
    });
  });

  describe("getPurchaseById", () => {
    it("should return purchase with populated fields", async () => {
      const mockPurchase = {
        _id: purchaseId,
        eventId: { title: "Test Event" },
        userId: { name: "John", email: "john@example.com" },
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        }),
      } as unknown as mongoose.Query<unknown, unknown>);

      const result = await EventPurchaseService.getPurchaseById(purchaseId);

      expect(result).toEqual(mockPurchase);
    });

    it("should return null if purchase not found", async () => {
      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(null),
        }),
      } as unknown as mongoose.Query<unknown, unknown>);

      const result = await EventPurchaseService.getPurchaseById(purchaseId);

      expect(result).toBeNull();
    });

    it("should handle ObjectId type for purchaseId", async () => {
      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(null),
        }),
      } as unknown as mongoose.Query<unknown, unknown>);

      await EventPurchaseService.getPurchaseById(
        new mongoose.Types.ObjectId(purchaseId)
      );

      expect(Purchase.findById).toHaveBeenCalled();
    });

    it("should throw error on database failure", async () => {
      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockRejectedValue(new Error("DB error")),
        }),
      } as unknown as mongoose.Query<unknown, unknown>);

      await expect(
        EventPurchaseService.getPurchaseById(purchaseId)
      ).rejects.toThrow("DB error");
    });
  });

  describe("updatePurchaseStatus", () => {
    it("should update purchase status successfully", async () => {
      const mockPurchase = {
        _id: purchaseId,
        status: "completed",
      };

      vi.mocked(Purchase.findByIdAndUpdate).mockResolvedValue(
        mockPurchase as unknown
      );

      const result = await EventPurchaseService.updatePurchaseStatus(
        purchaseId,
        "completed"
      );

      expect(result).toEqual(mockPurchase);
      expect(Purchase.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.any(mongoose.Types.ObjectId),
        { status: "completed" },
        { new: true }
      );
    });

    it("should include stripePaymentIntentId when provided", async () => {
      const mockPurchase = {
        _id: purchaseId,
        status: "completed",
        stripePaymentIntentId: "pi_test_123",
      };

      vi.mocked(Purchase.findByIdAndUpdate).mockResolvedValue(
        mockPurchase as unknown
      );

      await EventPurchaseService.updatePurchaseStatus(
        purchaseId,
        "completed",
        "pi_test_123"
      );

      expect(Purchase.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.any(mongoose.Types.ObjectId),
        { status: "completed", stripePaymentIntentId: "pi_test_123" },
        { new: true }
      );
    });

    it("should return null if purchase not found", async () => {
      vi.mocked(Purchase.findByIdAndUpdate).mockResolvedValue(null);

      const result = await EventPurchaseService.updatePurchaseStatus(
        purchaseId,
        "completed"
      );

      expect(result).toBeNull();
    });

    it("should handle ObjectId type for purchaseId", async () => {
      vi.mocked(Purchase.findByIdAndUpdate).mockResolvedValue({
        _id: purchaseId,
        status: "completed",
      } as unknown);

      await EventPurchaseService.updatePurchaseStatus(
        new mongoose.Types.ObjectId(purchaseId),
        "completed"
      );

      expect(Purchase.findByIdAndUpdate).toHaveBeenCalled();
    });

    it("should throw error on database failure", async () => {
      vi.mocked(Purchase.findByIdAndUpdate).mockRejectedValue(
        new Error("DB error")
      );

      await expect(
        EventPurchaseService.updatePurchaseStatus(purchaseId, "completed")
      ).rejects.toThrow("DB error");
    });

    it("should support all valid status values", async () => {
      vi.mocked(Purchase.findByIdAndUpdate).mockResolvedValue({
        _id: purchaseId,
      } as unknown);

      const statuses: Array<"pending" | "completed" | "failed" | "refunded"> = [
        "pending",
        "completed",
        "failed",
        "refunded",
      ];

      for (const status of statuses) {
        await EventPurchaseService.updatePurchaseStatus(purchaseId, status);
        expect(Purchase.findByIdAndUpdate).toHaveBeenCalledWith(
          expect.any(mongoose.Types.ObjectId),
          { status },
          { new: true }
        );
      }
    });
  });

  describe("getEventTicketSales", () => {
    it("should calculate sales correctly", async () => {
      const mockPurchases = [
        { status: "completed", finalPrice: 5000 },
        { status: "completed", finalPrice: 5000 },
        { status: "pending", finalPrice: 5000 },
        { status: "failed", finalPrice: 5000 },
      ];

      vi.mocked(Purchase.find).mockResolvedValue(
        mockPurchases as unknown as never
      );

      const result = await EventPurchaseService.getEventTicketSales(eventId);

      expect(result.totalSales).toBe(4);
      expect(result.completedPurchases).toBe(2);
      expect(result.totalRevenue).toBe(10000); // 5000 + 5000
    });

    it("should return zeros when no purchases exist", async () => {
      vi.mocked(Purchase.find).mockResolvedValue([] as unknown as never);

      const result = await EventPurchaseService.getEventTicketSales(eventId);

      expect(result.totalSales).toBe(0);
      expect(result.completedPurchases).toBe(0);
      expect(result.totalRevenue).toBe(0);
    });

    it("should handle ObjectId type for eventId", async () => {
      vi.mocked(Purchase.find).mockResolvedValue([] as unknown as never);

      await EventPurchaseService.getEventTicketSales(
        new mongoose.Types.ObjectId(eventId)
      );

      expect(Purchase.find).toHaveBeenCalled();
    });

    it("should throw error on database failure", async () => {
      vi.mocked(Purchase.find).mockRejectedValue(new Error("DB error"));

      await expect(
        EventPurchaseService.getEventTicketSales(eventId)
      ).rejects.toThrow("DB error");
    });
  });
});
