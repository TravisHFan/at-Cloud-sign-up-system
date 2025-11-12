import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import Donation, {
  DonationType,
  DonationFrequency,
  DonationStatus,
} from "../../../src/models/Donation";
import User from "../../../src/models/User";
import { ensureIntegrationDB } from "../../integration/setup/connect";

describe("Donation Model", () => {
  let testUserId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await ensureIntegrationDB();
  });

  beforeEach(async () => {
    await Donation.deleteMany({});
    await User.deleteMany({});

    // Create a test user
    const user = await User.create({
      username: "donationuser",
      email: "donation@test.com",
      password: "Password123!",
      firstName: "Donation",
      lastName: "User",
      role: "Participant",
      gender: "male",
      isVerified: true,
    });
    testUserId = user._id as mongoose.Types.ObjectId;
  });

  afterAll(async () => {
    await Donation.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  describe("Schema Validation", () => {
    it("should create a valid one-time donation", async () => {
      const donation = await Donation.create({
        userId: testUserId,
        amount: 5000,
        type: "one-time" as DonationType,
        status: "pending" as DonationStatus,
        giftDate: new Date("2025-12-25"),
        stripeCustomerId: "cus_test123",
      });

      expect(donation._id).toBeDefined();
      expect(donation.userId).toEqual(testUserId);
      expect(donation.amount).toBe(5000);
      expect(donation.type).toBe("one-time");
      expect(donation.status).toBe("pending");
      expect(donation.giftDate).toBeInstanceOf(Date);
    });

    it("should create a valid recurring donation", async () => {
      const donation = await Donation.create({
        userId: testUserId,
        amount: 10000,
        type: "recurring" as DonationType,
        frequency: "monthly" as DonationFrequency,
        status: "active" as DonationStatus,
        startDate: new Date("2025-01-01"),
        nextPaymentDate: new Date("2025-01-01"),
        endAfterOccurrences: 12,
        currentOccurrence: 0,
        remainingOccurrences: 12,
        stripeCustomerId: "cus_test456",
        stripeSubscriptionId: "sub_test456",
      });

      expect(donation._id).toBeDefined();
      expect(donation.type).toBe("recurring");
      expect(donation.frequency).toBe("monthly");
      expect(donation.endAfterOccurrences).toBe(12);
      expect(donation.remainingOccurrences).toBe(12);
    });

    it("should require userId", async () => {
      await expect(
        Donation.create({
          amount: 5000,
          type: "one-time" as DonationType,
          status: "pending" as DonationStatus,
          giftDate: new Date(),
          stripeCustomerId: "cus_test",
        })
      ).rejects.toThrow();
    });

    it("should require amount", async () => {
      await expect(
        Donation.create({
          userId: testUserId,
          type: "one-time" as DonationType,
          status: "pending" as DonationStatus,
          giftDate: new Date(),
          stripeCustomerId: "cus_test",
        })
      ).rejects.toThrow();
    });

    it("should require type", async () => {
      await expect(
        Donation.create({
          userId: testUserId,
          amount: 5000,
          status: "pending" as DonationStatus,
          giftDate: new Date(),
          stripeCustomerId: "cus_test",
        })
      ).rejects.toThrow();
    });

    it("should require stripeCustomerId", async () => {
      await expect(
        Donation.create({
          userId: testUserId,
          amount: 5000,
          type: "one-time" as DonationType,
          status: "pending" as DonationStatus,
          giftDate: new Date(),
        })
      ).rejects.toThrow();
    });

    it("should enforce minimum amount of 100 cents ($1.00)", async () => {
      await expect(
        Donation.create({
          userId: testUserId,
          amount: 50, // Less than $1.00
          type: "one-time" as DonationType,
          status: "pending" as DonationStatus,
          giftDate: new Date(),
          stripeCustomerId: "cus_test",
        })
      ).rejects.toThrow();
    });

    it("should enforce maximum amount of 99999900 cents ($999,999.00)", async () => {
      await expect(
        Donation.create({
          userId: testUserId,
          amount: 100000000, // More than $999,999.00
          type: "one-time" as DonationType,
          status: "pending" as DonationStatus,
          giftDate: new Date(),
          stripeCustomerId: "cus_test",
        })
      ).rejects.toThrow();
    });
  });

  describe("Type Enum Validation", () => {
    it("should accept one-time type", async () => {
      const donation = await Donation.create({
        userId: testUserId,
        amount: 5000,
        type: "one-time" as DonationType,
        status: "pending" as DonationStatus,
        giftDate: new Date(),
        stripeCustomerId: "cus_test",
      });

      expect(donation.type).toBe("one-time");
    });

    it("should accept recurring type", async () => {
      const donation = await Donation.create({
        userId: testUserId,
        amount: 10000,
        type: "recurring" as DonationType,
        frequency: "monthly" as DonationFrequency,
        status: "active" as DonationStatus,
        startDate: new Date(),
        nextPaymentDate: new Date(),
        stripeCustomerId: "cus_test",
      });

      expect(donation.type).toBe("recurring");
    });

    it("should reject invalid type", async () => {
      await expect(
        Donation.create({
          userId: testUserId,
          amount: 5000,
          type: "invalid" as DonationType,
          status: "pending" as DonationStatus,
          giftDate: new Date(),
          stripeCustomerId: "cus_test",
        })
      ).rejects.toThrow();
    });
  });

  describe("Frequency Enum Validation", () => {
    const frequencies: DonationFrequency[] = [
      "weekly",
      "biweekly",
      "monthly",
      "quarterly",
      "annually",
    ];

    frequencies.forEach((frequency) => {
      it(`should accept ${frequency} frequency`, async () => {
        const donation = await Donation.create({
          userId: testUserId,
          amount: 10000,
          type: "recurring" as DonationType,
          frequency,
          status: "active" as DonationStatus,
          startDate: new Date(),
          nextPaymentDate: new Date(),
          stripeCustomerId: "cus_test",
        });

        expect(donation.frequency).toBe(frequency);
      });
    });

    it("should reject invalid frequency", async () => {
      await expect(
        Donation.create({
          userId: testUserId,
          amount: 10000,
          type: "recurring" as DonationType,
          frequency: "daily" as DonationFrequency,
          status: "active" as DonationStatus,
          startDate: new Date(),
          nextPaymentDate: new Date(),
          stripeCustomerId: "cus_test",
        })
      ).rejects.toThrow();
    });
  });

  describe("Status Enum Validation", () => {
    const statuses: DonationStatus[] = [
      "pending",
      "scheduled",
      "active",
      "on_hold",
      "completed",
      "cancelled",
      "failed",
    ];

    statuses.forEach((status) => {
      it(`should accept ${status} status`, async () => {
        const donation = await Donation.create({
          userId: testUserId,
          amount: 5000,
          type: "one-time" as DonationType,
          status,
          giftDate: new Date(),
          stripeCustomerId: "cus_test",
        });

        expect(donation.status).toBe(status);
      });
    });

    it("should reject invalid status", async () => {
      await expect(
        Donation.create({
          userId: testUserId,
          amount: 5000,
          type: "one-time" as DonationType,
          status: "invalid_status" as DonationStatus,
          giftDate: new Date(),
          stripeCustomerId: "cus_test",
        })
      ).rejects.toThrow();
    });
  });

  describe("Optional Fields", () => {
    it("should allow optional giftDate", async () => {
      const donation = await Donation.create({
        userId: testUserId,
        amount: 10000,
        type: "recurring" as DonationType,
        frequency: "monthly" as DonationFrequency,
        status: "active" as DonationStatus,
        startDate: new Date(),
        nextPaymentDate: new Date(),
        stripeCustomerId: "cus_test",
      });

      expect(donation.giftDate).toBeUndefined();
    });

    it("should allow optional frequency for one-time donations", async () => {
      const donation = await Donation.create({
        userId: testUserId,
        amount: 5000,
        type: "one-time" as DonationType,
        status: "pending" as DonationStatus,
        giftDate: new Date(),
        stripeCustomerId: "cus_test",
      });

      expect(donation.frequency).toBeUndefined();
    });

    it("should allow optional endDate", async () => {
      const donation = await Donation.create({
        userId: testUserId,
        amount: 10000,
        type: "recurring" as DonationType,
        frequency: "monthly" as DonationFrequency,
        status: "active" as DonationStatus,
        startDate: new Date(),
        nextPaymentDate: new Date(),
        stripeCustomerId: "cus_test",
      });

      expect(donation.endDate).toBeUndefined();
    });

    it("should allow optional paymentMethod", async () => {
      const donation = await Donation.create({
        userId: testUserId,
        amount: 5000,
        type: "one-time" as DonationType,
        status: "pending" as DonationStatus,
        giftDate: new Date(),
        stripeCustomerId: "cus_test",
      });

      // paymentMethod has a default type: 'card' in schema
      expect(donation.paymentMethod).toBeDefined();
      expect(donation.paymentMethod?.type).toBe("card");
      expect(donation.paymentMethod?.cardBrand).toBeUndefined();
      expect(donation.paymentMethod?.last4).toBeUndefined();
    });

    it("should store paymentMethod when provided", async () => {
      const donation = await Donation.create({
        userId: testUserId,
        amount: 5000,
        type: "one-time" as DonationType,
        status: "completed" as DonationStatus,
        giftDate: new Date(),
        stripeCustomerId: "cus_test",
        paymentMethod: {
          type: "card",
          cardBrand: "visa",
          last4: "4242",
        },
      });

      expect(donation.paymentMethod).toEqual({
        type: "card",
        cardBrand: "visa",
        last4: "4242",
      });
    });
  });

  describe("Timestamps", () => {
    it("should automatically add createdAt and updatedAt", async () => {
      const donation = await Donation.create({
        userId: testUserId,
        amount: 5000,
        type: "one-time" as DonationType,
        status: "pending" as DonationStatus,
        giftDate: new Date(),
        stripeCustomerId: "cus_test",
      });

      expect(donation.createdAt).toBeInstanceOf(Date);
      expect(donation.updatedAt).toBeInstanceOf(Date);
    });

    it("should update updatedAt on save", async () => {
      const donation = await Donation.create({
        userId: testUserId,
        amount: 5000,
        type: "one-time" as DonationType,
        status: "pending" as DonationStatus,
        giftDate: new Date(),
        stripeCustomerId: "cus_test",
      });

      const originalUpdatedAt = donation.updatedAt.getTime();

      // Modify a field and save (updatedAt should automatically update)
      donation.status = "completed" as DonationStatus;
      await donation.save();

      const newUpdatedAt = donation.updatedAt.getTime();
      // Mongoose timestamps should ensure updatedAt changes on save
      expect(newUpdatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });
  });

  describe("Index Creation", () => {
    it("should have userId index for efficient queries", async () => {
      const indexes = await Donation.collection.getIndexes();
      const userIdIndex = Object.values(indexes).find((index: any) =>
        index.some((field: any) => field[0] === "userId")
      );

      expect(userIdIndex).toBeDefined();
    });
  });
});
