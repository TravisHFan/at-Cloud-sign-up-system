import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Types } from "mongoose";

// Mock models
const mockCreate = vi.fn();
const mockFindById = vi.fn();
const mockFindOne = vi.fn();
const mockFind = vi.fn();
const mockCountDocuments = vi.fn();
const mockAggregate = vi.fn();
const mockSave = vi.fn();

vi.mock("../../../src/models/Donation", () => ({
  default: {
    create: (...args: any[]) => mockCreate(...args),
    findById: (...args: any[]) => mockFindById(...args),
    findOne: (...args: any[]) => mockFindOne(...args),
    find: (...args: any[]) => {
      const result = mockFind(...args);
      // Allow chaining for find
      return {
        ...result,
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(result),
      };
    },
  },
}));

vi.mock("../../../src/models/DonationTransaction", () => ({
  default: {
    create: (...args: any[]) => mockCreate(...args),
    find: (...args: any[]) => {
      const result = mockFind(...args);
      return {
        ...result,
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(result),
      };
    },
    countDocuments: (...args: any[]) => mockCountDocuments(...args),
    aggregate: (...args: any[]) => mockAggregate(...args),
  },
}));

vi.mock("../../../src/models/User", () => ({
  default: {
    findById: (...args: any[]) => mockFindById(...args),
  },
}));

import DonationService from "../../../src/services/DonationService";
import { DonationType, DonationFrequency } from "../../../src/models/Donation";

describe("DonationService", () => {
  const mockUserId = new Types.ObjectId().toString();
  const mockDonationId = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createDonation", () => {
    it("should create a one-time donation successfully", async () => {
      const mockUser = {
        _id: mockUserId,
        email: "test@example.com",
        stripeCustomerId: "cus_test123",
      };

      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        amount: 5000,
        type: "one-time",
        status: "pending",
        giftDate: new Date("2025-12-25"),
        stripeCustomerId: "cus_test123",
      };

      mockFindById.mockResolvedValue(mockUser);
      mockCreate.mockResolvedValue(mockDonation);

      const result = await DonationService.createDonation({
        userId: mockUserId,
        amount: 5000,
        type: "one-time" as DonationType,
        giftDate: new Date("2025-12-25"),
      });

      expect(result).toEqual(mockDonation);
      expect(mockFindById).toHaveBeenCalledWith(mockUserId);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser._id,
          amount: 5000,
          type: "one-time",
          status: "pending",
          giftDate: new Date("2025-12-25"),
        }),
      );
    });

    it("should create a recurring donation successfully", async () => {
      const mockUser = {
        _id: mockUserId,
        email: "test@example.com",
        stripeCustomerId: "cus_test123",
      };

      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        amount: 10000,
        type: "recurring",
        frequency: "monthly",
        status: "pending",
        startDate: new Date("2025-01-01"),
        nextPaymentDate: new Date("2025-01-01"),
        endAfterOccurrences: 12,
        remainingOccurrences: 12,
        currentOccurrence: 0,
        stripeCustomerId: "cus_test123",
      };

      mockFindById.mockResolvedValue(mockUser);
      mockCreate.mockResolvedValue(mockDonation);

      const result = await DonationService.createDonation({
        userId: mockUserId,
        amount: 10000,
        type: "recurring" as DonationType,
        frequency: "monthly" as DonationFrequency,
        startDate: new Date("2025-01-01"),
        endAfterOccurrences: 12,
      });

      expect(result).toEqual(mockDonation);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "recurring",
          frequency: "monthly",
          startDate: new Date("2025-01-01"),
          remainingOccurrences: 12,
          nextPaymentDate: new Date("2025-01-01"),
        }),
      );
    });

    it("should throw error for invalid amount (too low)", async () => {
      await expect(
        DonationService.createDonation({
          userId: mockUserId,
          amount: 50, // Less than $1.00 (100 cents)
          type: "one-time" as DonationType,
          giftDate: new Date("2025-12-25"),
        }),
      ).rejects.toThrow("Amount must be between $1.00 and $999,999.00");
    });

    it("should throw error for invalid amount (too high)", async () => {
      await expect(
        DonationService.createDonation({
          userId: mockUserId,
          amount: 100000000, // More than $999,999.00
          type: "one-time" as DonationType,
          giftDate: new Date("2025-12-25"),
        }),
      ).rejects.toThrow("Amount must be between $1.00 and $999,999.00");
    });

    it("should throw error for one-time donation without gift date", async () => {
      await expect(
        DonationService.createDonation({
          userId: mockUserId,
          amount: 5000,
          type: "one-time" as DonationType,
        }),
      ).rejects.toThrow("Gift date is required for one-time donations");
    });

    it("should throw error for recurring donation without frequency", async () => {
      await expect(
        DonationService.createDonation({
          userId: mockUserId,
          amount: 10000,
          type: "recurring" as DonationType,
          startDate: new Date("2025-01-01"),
        }),
      ).rejects.toThrow("Frequency is required for recurring donations");
    });

    it("should throw error for recurring donation without start date", async () => {
      await expect(
        DonationService.createDonation({
          userId: mockUserId,
          amount: 10000,
          type: "recurring" as DonationType,
          frequency: "monthly" as DonationFrequency,
        }),
      ).rejects.toThrow("Start date is required for recurring donations");
    });

    it("should throw error if user not found", async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        DonationService.createDonation({
          userId: mockUserId,
          amount: 5000,
          type: "one-time" as DonationType,
          giftDate: new Date("2025-12-25"),
        }),
      ).rejects.toThrow("User not found");
    });

    it("should use pending as stripeCustomerId if user does not have one", async () => {
      const mockUser = {
        _id: mockUserId,
        email: "test@example.com",
        stripeCustomerId: null,
      };

      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        amount: 5000,
        type: "one-time",
        status: "pending",
        giftDate: new Date("2025-12-25"),
        stripeCustomerId: "pending",
      };

      mockFindById.mockResolvedValue(mockUser);
      mockCreate.mockResolvedValue(mockDonation);

      const result = await DonationService.createDonation({
        userId: mockUserId,
        amount: 5000,
        type: "one-time" as DonationType,
        giftDate: new Date("2025-12-25"),
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeCustomerId: "pending",
        }),
      );
    });
  });

  describe("getUserDonationHistory", () => {
    it("should return transactions and pagination info", async () => {
      const mockTransactions = [
        {
          _id: new Types.ObjectId(),
          donationId: mockDonationId,
          userId: mockUserId,
          amount: 5000,
          type: "one-time",
          status: "completed",
          giftDate: new Date("2025-01-15"),
        },
      ];

      mockFind.mockResolvedValue(mockTransactions);
      mockCountDocuments.mockResolvedValue(1);

      const result = await DonationService.getUserDonationHistory(
        mockUserId,
        1,
        20,
        "giftDate",
        "desc",
      );

      expect(result).toEqual({
        transactions: mockTransactions,
        pending: mockTransactions, // mock returns same for both
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      });
    });

    it("should not include pending donations on pages after first", async () => {
      const mockTransactions = [
        {
          _id: new Types.ObjectId(),
          donationId: mockDonationId,
          userId: mockUserId,
          amount: 5000,
          type: "one-time",
          status: "completed",
          giftDate: new Date("2025-01-15"),
        },
      ];

      mockFind.mockResolvedValue(mockTransactions);
      mockCountDocuments.mockResolvedValue(25);

      const result = await DonationService.getUserDonationHistory(
        mockUserId,
        2,
        20,
        "giftDate",
        "desc",
      );

      expect(result.pending).toEqual([]);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 20,
        total: 25,
        totalPages: 2,
      });
    });
  });

  describe("getUserScheduledDonations", () => {
    it("should return scheduled and active donations", async () => {
      const mockDonations = [
        {
          _id: mockDonationId,
          userId: mockUserId,
          amount: 10000,
          type: "recurring",
          frequency: "monthly",
          status: "active",
          nextPaymentDate: new Date("2025-02-01"),
        },
      ];

      mockFind.mockResolvedValue(mockDonations);

      const result =
        await DonationService.getUserScheduledDonations(mockUserId);

      expect(result).toEqual(mockDonations);
      expect(mockFind).toHaveBeenCalledWith({
        userId: mockUserId,
        status: { $in: ["scheduled", "active", "on_hold"] },
      });
    });
  });

  describe("getUserDonationStats", () => {
    it("should return total amount and total gifts", async () => {
      const mockAggregateResult = [
        {
          _id: null,
          totalAmount: 50000,
          totalGifts: 5,
        },
      ];

      mockAggregate.mockResolvedValue(mockAggregateResult);

      const result = await DonationService.getUserDonationStats(mockUserId);

      expect(result).toEqual({
        totalAmount: 50000,
        totalGifts: 5,
      });
    });

    it("should return zeros if no donations found", async () => {
      mockAggregate.mockResolvedValue([]);

      const result = await DonationService.getUserDonationStats(mockUserId);

      expect(result).toEqual({
        totalAmount: 0,
        totalGifts: 0,
      });
    });
  });

  describe("updateDonation", () => {
    it("should update donation amount", async () => {
      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        amount: 5000,
        type: "one-time",
        status: "scheduled",
        save: mockSave,
      };

      mockFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      const result = await DonationService.updateDonation(
        mockDonationId.toString(),
        mockUserId,
        { amount: 10000 },
      );

      expect(mockDonation.amount).toBe(10000);
      expect(mockSave).toHaveBeenCalled();
    });

    it("should throw error if donation not found", async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(
        DonationService.updateDonation(mockDonationId.toString(), mockUserId, {
          amount: 10000,
        }),
      ).rejects.toThrow("Donation not found");
    });

    it("should throw error for completed donation", async () => {
      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        status: "completed",
      };

      mockFindOne.mockResolvedValue(mockDonation);

      await expect(
        DonationService.updateDonation(mockDonationId.toString(), mockUserId, {
          amount: 10000,
        }),
      ).rejects.toThrow("Cannot edit completed or cancelled donation");
    });

    it("should throw error for invalid amount in update", async () => {
      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        status: "scheduled",
      };

      mockFindOne.mockResolvedValue(mockDonation);

      await expect(
        DonationService.updateDonation(mockDonationId.toString(), mockUserId, {
          amount: 50, // Too low
        }),
      ).rejects.toThrow("Amount must be between $1.00 and $999,999.00");
    });

    it("should update frequency", async () => {
      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        type: "recurring",
        status: "scheduled",
        frequency: "monthly",
        save: mockSave,
      };

      mockFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationService.updateDonation(
        mockDonationId.toString(),
        mockUserId,
        { frequency: "weekly" },
      );

      expect(mockDonation.frequency).toBe("weekly");
      expect(mockSave).toHaveBeenCalled();
    });

    it("should update startDate and nextPaymentDate", async () => {
      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        type: "recurring",
        status: "scheduled",
        startDate: new Date("2025-01-01"),
        nextPaymentDate: new Date("2025-01-01"),
        save: mockSave,
      };

      mockFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      const newStartDate = new Date("2025-02-01");
      await DonationService.updateDonation(
        mockDonationId.toString(),
        mockUserId,
        { startDate: newStartDate },
      );

      expect(mockDonation.startDate).toEqual(newStartDate);
      expect(mockDonation.nextPaymentDate).toEqual(newStartDate);
      expect(mockSave).toHaveBeenCalled();
    });

    it("should update giftDate", async () => {
      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        type: "one-time",
        status: "scheduled",
        giftDate: null,
        save: mockSave,
      };

      mockFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      const giftDate = new Date("2025-03-01");
      await DonationService.updateDonation(
        mockDonationId.toString(),
        mockUserId,
        { giftDate },
      );

      expect(mockDonation.giftDate).toEqual(giftDate);
      expect(mockSave).toHaveBeenCalled();
    });

    it("should update endDate", async () => {
      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        type: "recurring",
        status: "scheduled",
        endDate: null,
        save: mockSave,
      };

      mockFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      const endDate = new Date("2025-12-31");
      await DonationService.updateDonation(
        mockDonationId.toString(),
        mockUserId,
        { endDate },
      );

      expect(mockDonation.endDate).toEqual(endDate);
      expect(mockSave).toHaveBeenCalled();
    });

    it("should update endAfterOccurrences and remainingOccurrences", async () => {
      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        type: "recurring",
        status: "scheduled",
        endAfterOccurrences: undefined,
        remainingOccurrences: undefined,
        save: mockSave,
      };

      mockFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationService.updateDonation(
        mockDonationId.toString(),
        mockUserId,
        { endAfterOccurrences: 12 },
      );

      expect(mockDonation.endAfterOccurrences).toBe(12);
      expect(mockDonation.remainingOccurrences).toBe(12);
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe("holdDonation", () => {
    it("should place active recurring donation on hold", async () => {
      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        type: "recurring",
        status: "active",
        save: mockSave,
      };

      mockFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationService.holdDonation(mockDonationId.toString(), mockUserId);

      expect(mockDonation.status).toBe("on_hold");
      expect(mockSave).toHaveBeenCalled();
    });

    it("should throw error for one-time donations", async () => {
      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        type: "one-time",
        status: "scheduled",
      };

      mockFindOne.mockResolvedValue(mockDonation);

      await expect(
        DonationService.holdDonation(mockDonationId.toString(), mockUserId),
      ).rejects.toThrow("Cannot hold one-time donations");
    });

    it("should throw error if donation not active", async () => {
      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        type: "recurring",
        status: "scheduled",
      };

      mockFindOne.mockResolvedValue(mockDonation);

      await expect(
        DonationService.holdDonation(mockDonationId.toString(), mockUserId),
      ).rejects.toThrow("Can only hold active donations");
    });
  });

  describe("resumeDonation", () => {
    it("should resume donation from hold", async () => {
      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        status: "on_hold",
        save: mockSave,
      };

      mockFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationService.resumeDonation(
        mockDonationId.toString(),
        mockUserId,
      );

      expect(mockDonation.status).toBe("active");
      expect(mockSave).toHaveBeenCalled();
    });

    it("should throw error if donation not on hold", async () => {
      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        status: "active",
      };

      mockFindOne.mockResolvedValue(mockDonation);

      await expect(
        DonationService.resumeDonation(mockDonationId.toString(), mockUserId),
      ).rejects.toThrow("Can only resume donations that are on hold");
    });
  });

  describe("cancelDonation", () => {
    it("should cancel a donation", async () => {
      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        status: "scheduled",
        save: mockSave,
      };

      mockFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationService.cancelDonation(
        mockDonationId.toString(),
        mockUserId,
      );

      expect(mockDonation.status).toBe("cancelled");
      expect(mockSave).toHaveBeenCalled();
    });

    it("should throw error for completed donation", async () => {
      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        status: "completed",
      };

      mockFindOne.mockResolvedValue(mockDonation);

      await expect(
        DonationService.cancelDonation(mockDonationId.toString(), mockUserId),
      ).rejects.toThrow("Cannot cancel completed donation");
    });

    it("should throw error for already cancelled donation", async () => {
      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        status: "cancelled",
      };

      mockFindOne.mockResolvedValue(mockDonation);

      await expect(
        DonationService.cancelDonation(mockDonationId.toString(), mockUserId),
      ).rejects.toThrow("Donation is already cancelled");
    });
  });

  describe("recordTransaction", () => {
    it("should record transaction and update one-time donation", async () => {
      const mockTransaction = {
        _id: new Types.ObjectId(),
        donationId: mockDonationId,
        userId: mockUserId,
        amount: 5000,
        type: "one-time",
        status: "completed",
        stripePaymentIntentId: "pi_test123",
      };

      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        type: "one-time",
        status: "pending",
        save: mockSave,
      };

      mockCreate.mockResolvedValue(mockTransaction);
      mockFindById.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationService.recordTransaction({
        donationId: mockDonationId.toString(),
        userId: mockUserId,
        amount: 5000,
        type: "one-time" as DonationType,
        stripePaymentIntentId: "pi_test123",
      });

      expect(mockCreate).toHaveBeenCalled();
      expect(mockDonation.status).toBe("completed");
      expect(mockSave).toHaveBeenCalled();
    });

    it("should record transaction and update recurring donation occurrence", async () => {
      const nextDate = new Date("2025-02-01");
      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        type: "recurring",
        frequency: "monthly",
        status: "active",
        currentOccurrence: 0,
        remainingOccurrences: 12,
        nextPaymentDate: new Date("2025-01-01"),
        save: mockSave,
      };

      mockCreate.mockResolvedValue({});
      mockFindById.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationService.recordTransaction({
        donationId: mockDonationId.toString(),
        userId: mockUserId,
        amount: 10000,
        type: "recurring" as DonationType,
        stripePaymentIntentId: "pi_test456",
      });

      expect(mockDonation.currentOccurrence).toBe(1);
      expect(mockDonation.remainingOccurrences).toBe(11);
      expect(mockSave).toHaveBeenCalled();
    });

    it("should mark recurring donation as completed when all occurrences done", async () => {
      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        type: "recurring",
        frequency: "monthly",
        status: "active",
        currentOccurrence: 11,
        endAfterOccurrences: 12,
        remainingOccurrences: 1,
        nextPaymentDate: new Date("2025-12-01"),
        save: mockSave,
      };

      mockCreate.mockResolvedValue({});
      mockFindById.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationService.recordTransaction({
        donationId: mockDonationId.toString(),
        userId: mockUserId,
        amount: 10000,
        type: "recurring" as DonationType,
        stripePaymentIntentId: "pi_test789",
      });

      expect(mockDonation.currentOccurrence).toBe(12);
      expect(mockDonation.status).toBe("completed");
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe("calculateTotalAmount", () => {
    it("should calculate total for occurrences-based recurring", () => {
      const result = DonationService.calculateTotalAmount(
        10000,
        "monthly" as DonationFrequency,
        new Date("2025-01-01"),
        { type: "occurrences", count: 12 },
      );

      expect(result.totalGifts).toBe(12);
      expect(result.totalAmount).toBe(120000);
      expect(result.endDate).toBeInstanceOf(Date);
    });

    it("should calculate total for date-based recurring", () => {
      const result = DonationService.calculateTotalAmount(
        5000,
        "weekly" as DonationFrequency,
        new Date("2025-01-01"),
        { type: "date", endDate: new Date("2025-03-01") },
      );

      expect(result.totalGifts).toBeGreaterThan(0);
      expect(result.totalAmount).toBe(result.totalGifts * 5000);
      expect(result.endDate).toEqual(new Date("2025-03-01"));
    });
  });

  describe("getAdminDonationStats", () => {
    it("should return complete donation stats with all metrics", async () => {
      // Mock aggregate results for all-time stats
      mockAggregate.mockResolvedValueOnce([
        {
          totalRevenue: 100000,
          totalDonations: 10,
        },
      ]);

      // Mock aggregate results for last 30 days stats
      mockAggregate.mockResolvedValueOnce([
        {
          revenue: 20000,
          donations: 2,
        },
      ]);

      // Mock distinct call for unique donors
      const mockDistinct = vi
        .fn()
        .mockResolvedValue(["user1", "user2", "user3"]);
      const DonationTransaction =
        await import("../../../src/models/DonationTransaction");
      (DonationTransaction.default as any).distinct = mockDistinct;

      // Mock Donation.find for active recurring donations
      mockFind.mockReturnValueOnce([
        {
          amount: 5000,
          frequency: "monthly",
          status: "active",
          type: "recurring",
        },
        {
          amount: 10000,
          frequency: "weekly",
          status: "active",
          type: "recurring",
        },
      ]);

      const result = await DonationService.getAdminDonationStats();

      expect(result.totalRevenue).toBe(100000);
      expect(result.totalDonations).toBe(10);
      expect(result.uniqueDonors).toBe(3);
      expect(result.last30Days.revenue).toBe(20000);
      expect(result.last30Days.donations).toBe(2);
      expect(typeof result.activeRecurringRevenue).toBe("number");
    });

    it("should return zeros when no donations exist", async () => {
      // Mock empty aggregate results
      mockAggregate.mockResolvedValueOnce([]);
      mockAggregate.mockResolvedValueOnce([]);

      // Mock distinct to return empty array
      const mockDistinct = vi.fn().mockResolvedValue([]);
      const DonationTransaction =
        await import("../../../src/models/DonationTransaction");
      (DonationTransaction.default as any).distinct = mockDistinct;

      // Mock empty active recurring donations
      mockFind.mockReturnValueOnce([]);

      const result = await DonationService.getAdminDonationStats();

      expect(result.totalRevenue).toBe(0);
      expect(result.totalDonations).toBe(0);
      expect(result.uniqueDonors).toBe(0);
      expect(result.last30Days.revenue).toBe(0);
      expect(result.last30Days.donations).toBe(0);
      expect(result.activeRecurringRevenue).toBe(0);
    });

    it("should calculate activeRecurringRevenue with different frequencies", async () => {
      mockAggregate.mockResolvedValueOnce([
        { totalRevenue: 0, totalDonations: 0 },
      ]);
      mockAggregate.mockResolvedValueOnce([{ revenue: 0, donations: 0 }]);

      const mockDistinct = vi.fn().mockResolvedValue([]);
      const DonationTransaction =
        await import("../../../src/models/DonationTransaction");
      (DonationTransaction.default as any).distinct = mockDistinct;

      // Mock active recurring donations with various frequencies
      mockFind.mockReturnValueOnce([
        {
          amount: 1200,
          frequency: "monthly",
          status: "active",
          type: "recurring",
        },
        {
          amount: 1200,
          frequency: "weekly",
          status: "active",
          type: "recurring",
        },
        {
          amount: 1200,
          frequency: "biweekly",
          status: "active",
          type: "recurring",
        },
        {
          amount: 1200,
          frequency: "quarterly",
          status: "active",
          type: "recurring",
        },
        {
          amount: 1200,
          frequency: "annually",
          status: "active",
          type: "recurring",
        },
        {
          amount: 1200,
          frequency: undefined,
          status: "active",
          type: "recurring",
        }, // defaults to monthly
      ]);

      const result = await DonationService.getAdminDonationStats();

      // Verify that activeRecurringRevenue is calculated (not 0)
      expect(result.activeRecurringRevenue).toBeGreaterThan(0);
    });

    it("should handle unknown frequency by defaulting to multiplier of 1", async () => {
      mockAggregate.mockResolvedValueOnce([
        { totalRevenue: 0, totalDonations: 0 },
      ]);
      mockAggregate.mockResolvedValueOnce([{ revenue: 0, donations: 0 }]);

      const mockDistinct = vi.fn().mockResolvedValue([]);
      const DonationTransaction =
        await import("../../../src/models/DonationTransaction");
      (DonationTransaction.default as any).distinct = mockDistinct;

      // Mock donation with unknown frequency
      mockFind.mockReturnValueOnce([
        {
          amount: 5000,
          frequency: "unknown-frequency",
          status: "active",
          type: "recurring",
        },
      ]);

      const result = await DonationService.getAdminDonationStats();

      // Should use multiplier of 1 for unknown frequency
      expect(result.activeRecurringRevenue).toBe(5000);
    });
  });

  describe("getAllDonations", () => {
    it("should return paginated donations with no filters", async () => {
      const mockTransactions = [
        {
          _id: new Types.ObjectId(),
          giftDate: new Date("2025-01-15"),
          userId: {
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
          type: "one-time",
          status: "completed",
          amount: 5000,
        },
        {
          _id: new Types.ObjectId(),
          giftDate: new Date("2025-01-10"),
          userId: {
            firstName: "Jane",
            lastName: "Smith",
            email: "jane@example.com",
          },
          type: "recurring",
          status: "completed",
          amount: 10000,
        },
      ];

      // Mock DonationTransaction.find with chained methods
      const DonationTransaction =
        await import("../../../src/models/DonationTransaction");
      (DonationTransaction.default as any).find = vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue(mockTransactions),
              }),
            }),
          }),
        }),
      });
      (DonationTransaction.default as any).countDocuments = vi
        .fn()
        .mockResolvedValue(2);

      const result = await DonationService.getAllDonations(1, 20, "", "all");

      expect(result.donations).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
    });

    it("should apply status filter when provided", async () => {
      const DonationTransaction =
        await import("../../../src/models/DonationTransaction");

      const mockFindFn = vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });
      (DonationTransaction.default as any).find = mockFindFn;
      (DonationTransaction.default as any).countDocuments = vi
        .fn()
        .mockResolvedValue(0);

      await DonationService.getAllDonations(1, 20, "", "completed");

      // Verify that status filter was applied
      expect(mockFindFn).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
        }),
      );
    });

    it("should apply search filter for user names and email", async () => {
      // Mock User.find for search
      const User = await import("../../../src/models/User");
      (User.default as any).find = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue([{ _id: new Types.ObjectId() }]),
      });

      const DonationTransaction =
        await import("../../../src/models/DonationTransaction");
      const mockFindFn = vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });
      (DonationTransaction.default as any).find = mockFindFn;
      (DonationTransaction.default as any).countDocuments = vi
        .fn()
        .mockResolvedValue(0);

      await DonationService.getAllDonations(1, 20, "john", "all");

      // Verify that User.find was called with search criteria
      expect((User.default as any).find).toHaveBeenCalledWith({
        $or: [
          { firstName: { $regex: "john", $options: "i" } },
          { lastName: { $regex: "john", $options: "i" } },
          { email: { $regex: "john", $options: "i" } },
        ],
      });
    });

    it("should handle partial user data gracefully", async () => {
      const mockTransactions = [
        {
          _id: new Types.ObjectId(),
          giftDate: new Date("2025-01-15"),
          userId: {
            firstName: undefined,
            lastName: undefined,
            email: undefined,
          },
          type: "one-time",
          status: "completed",
          amount: 5000,
        },
        {
          _id: new Types.ObjectId(),
          giftDate: new Date("2025-01-10"),
          userId: { firstName: "", lastName: "", email: "" }, // Empty strings
          type: "recurring",
          status: "completed",
          amount: 10000,
        },
      ];

      const DonationTransaction =
        await import("../../../src/models/DonationTransaction");
      (DonationTransaction.default as any).find = vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue(mockTransactions),
              }),
            }),
          }),
        }),
      });
      (DonationTransaction.default as any).countDocuments = vi
        .fn()
        .mockResolvedValue(2);

      const result = await DonationService.getAllDonations(1, 20, "", "all");

      // Should use default values for missing user data
      expect(result.donations[0].user.firstName).toBe("Unknown");
      expect(result.donations[0].user.lastName).toBe("User");
      expect(result.donations[0].user.email).toBe("N/A");
      expect(result.donations[1].user.firstName).toBe("Unknown");
    });

    it("should calculate pagination correctly", async () => {
      const DonationTransaction =
        await import("../../../src/models/DonationTransaction");
      (DonationTransaction.default as any).find = vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });
      (DonationTransaction.default as any).countDocuments = vi
        .fn()
        .mockResolvedValue(50);

      const result = await DonationService.getAllDonations(2, 10, "", "all");

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.totalPages).toBe(5);
    });
  });
});
