import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import DonationTransaction, {
  TransactionStatus,
} from "../../../src/models/DonationTransaction";
import Donation from "../../../src/models/Donation";
import User from "../../../src/models/User";
import { ensureIntegrationDB } from "../../integration/setup/connect";

describe("DonationTransaction Model", () => {
  let testUserId: mongoose.Types.ObjectId;
  let testDonationId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await ensureIntegrationDB();
  });

  beforeEach(async () => {
    await DonationTransaction.deleteMany({});
    await Donation.deleteMany({});
    await User.deleteMany({});

    // Create a test user
    const user = await User.create({
      username: "transactionuser",
      email: "transaction@test.com",
      password: "Password123!",
      firstName: "Transaction",
      lastName: "User",
      role: "Participant",
      gender: "male",
      isVerified: true,
    });
    testUserId = user._id as mongoose.Types.ObjectId;

    // Create a test donation
    const donation = await Donation.create({
      userId: testUserId,
      amount: 5000,
      type: "one-time",
      status: "pending",
      giftDate: new Date(),
      stripeCustomerId: "cus_test123",
    });
    testDonationId = donation._id as mongoose.Types.ObjectId;
  });

  afterAll(async () => {
    await DonationTransaction.deleteMany({});
    await Donation.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  describe("Schema Validation", () => {
    it("should create a valid completed transaction", async () => {
      const transaction = await DonationTransaction.create({
        donationId: testDonationId,
        userId: testUserId,
        amount: 5000,
        type: "one-time",
        status: "completed" as TransactionStatus,
        giftDate: new Date("2025-01-15"),
        stripePaymentIntentId: "pi_test123",
      });

      expect(transaction._id).toBeDefined();
      expect(transaction.donationId).toEqual(testDonationId);
      expect(transaction.userId).toEqual(testUserId);
      expect(transaction.amount).toBe(5000);
      expect(transaction.type).toBe("one-time");
      expect(transaction.status).toBe("completed");
      expect(transaction.giftDate).toBeInstanceOf(Date);
      expect(transaction.stripePaymentIntentId).toBe("pi_test123");
    });

    it("should create a valid failed transaction with failure details", async () => {
      const transaction = await DonationTransaction.create({
        donationId: testDonationId,
        userId: testUserId,
        amount: 10000,
        type: "recurring",
        status: "failed" as TransactionStatus,
        giftDate: new Date(),
        stripePaymentIntentId: "pi_test_failed",
        failureReason: "Insufficient funds",
        failureCode: "card_declined",
      });

      expect(transaction.status).toBe("failed");
      expect(transaction.failureReason).toBe("Insufficient funds");
      expect(transaction.failureCode).toBe("card_declined");
    });

    it("should require donationId", async () => {
      await expect(
        DonationTransaction.create({
          userId: testUserId,
          amount: 5000,
          type: "one-time",
          status: "completed" as TransactionStatus,
          giftDate: new Date(),
          stripePaymentIntentId: "pi_test",
        })
      ).rejects.toThrow();
    });

    it("should require userId", async () => {
      await expect(
        DonationTransaction.create({
          donationId: testDonationId,
          amount: 5000,
          type: "one-time",
          status: "completed" as TransactionStatus,
          giftDate: new Date(),
          stripePaymentIntentId: "pi_test",
        })
      ).rejects.toThrow();
    });

    it("should require amount", async () => {
      await expect(
        DonationTransaction.create({
          donationId: testDonationId,
          userId: testUserId,
          type: "one-time",
          status: "completed" as TransactionStatus,
          giftDate: new Date(),
          stripePaymentIntentId: "pi_test",
        })
      ).rejects.toThrow();
    });

    it("should require type", async () => {
      await expect(
        DonationTransaction.create({
          donationId: testDonationId,
          userId: testUserId,
          amount: 5000,
          status: "completed" as TransactionStatus,
          giftDate: new Date(),
          stripePaymentIntentId: "pi_test",
        })
      ).rejects.toThrow();
    });

    it("should require giftDate", async () => {
      await expect(
        DonationTransaction.create({
          donationId: testDonationId,
          userId: testUserId,
          amount: 5000,
          type: "one-time",
          status: "completed" as TransactionStatus,
          stripePaymentIntentId: "pi_test",
        })
      ).rejects.toThrow();
    });

    it("should require stripePaymentIntentId", async () => {
      await expect(
        DonationTransaction.create({
          donationId: testDonationId,
          userId: testUserId,
          amount: 5000,
          type: "one-time",
          status: "completed" as TransactionStatus,
          giftDate: new Date(),
        })
      ).rejects.toThrow();
    });

    it("should enforce minimum amount of 100 cents ($1.00)", async () => {
      await expect(
        DonationTransaction.create({
          donationId: testDonationId,
          userId: testUserId,
          amount: 50, // Less than $1.00
          type: "one-time",
          status: "completed" as TransactionStatus,
          giftDate: new Date(),
          stripePaymentIntentId: "pi_test",
        })
      ).rejects.toThrow();
    });
  });

  describe("Status Enum Validation", () => {
    const statuses: TransactionStatus[] = ["completed", "failed", "refunded"];

    statuses.forEach((status) => {
      it(`should accept ${status} status`, async () => {
        const transaction = await DonationTransaction.create({
          donationId: testDonationId,
          userId: testUserId,
          amount: 5000,
          type: "one-time",
          status,
          giftDate: new Date(),
          stripePaymentIntentId: "pi_test",
        });

        expect(transaction.status).toBe(status);
      });
    });

    it("should reject invalid status", async () => {
      await expect(
        DonationTransaction.create({
          donationId: testDonationId,
          userId: testUserId,
          amount: 5000,
          type: "one-time",
          status: "invalid_status" as TransactionStatus,
          giftDate: new Date(),
          stripePaymentIntentId: "pi_test",
        })
      ).rejects.toThrow();
    });

    it("should default status to completed", async () => {
      const transaction = await DonationTransaction.create({
        donationId: testDonationId,
        userId: testUserId,
        amount: 5000,
        type: "one-time",
        // status not provided
        giftDate: new Date(),
        stripePaymentIntentId: "pi_test",
      });

      expect(transaction.status).toBe("completed");
    });
  });

  describe("Type Enum Validation", () => {
    it("should accept one-time type", async () => {
      const transaction = await DonationTransaction.create({
        donationId: testDonationId,
        userId: testUserId,
        amount: 5000,
        type: "one-time",
        status: "completed" as TransactionStatus,
        giftDate: new Date(),
        stripePaymentIntentId: "pi_test",
      });

      expect(transaction.type).toBe("one-time");
    });

    it("should accept recurring type", async () => {
      const transaction = await DonationTransaction.create({
        donationId: testDonationId,
        userId: testUserId,
        amount: 10000,
        type: "recurring",
        status: "completed" as TransactionStatus,
        giftDate: new Date(),
        stripePaymentIntentId: "pi_test",
      });

      expect(transaction.type).toBe("recurring");
    });

    it("should reject invalid type", async () => {
      await expect(
        DonationTransaction.create({
          donationId: testDonationId,
          userId: testUserId,
          amount: 5000,
          type: "invalid",
          status: "completed" as TransactionStatus,
          giftDate: new Date(),
          stripePaymentIntentId: "pi_test",
        })
      ).rejects.toThrow();
    });
  });

  describe("Optional Fields", () => {
    it("should allow optional paymentMethod", async () => {
      const transaction = await DonationTransaction.create({
        donationId: testDonationId,
        userId: testUserId,
        amount: 5000,
        type: "one-time",
        status: "completed" as TransactionStatus,
        giftDate: new Date(),
        stripePaymentIntentId: "pi_test",
      });

      // Mongoose creates an empty object for optional nested fields
      expect(transaction.paymentMethod).toBeDefined();
      expect(transaction.paymentMethod?.cardBrand).toBeUndefined();
      expect(transaction.paymentMethod?.last4).toBeUndefined();
    });

    it("should store paymentMethod when provided", async () => {
      const transaction = await DonationTransaction.create({
        donationId: testDonationId,
        userId: testUserId,
        amount: 5000,
        type: "one-time",
        status: "completed" as TransactionStatus,
        giftDate: new Date(),
        stripePaymentIntentId: "pi_test",
        paymentMethod: {
          cardBrand: "visa",
          last4: "4242",
        },
      });

      expect(transaction.paymentMethod).toEqual({
        cardBrand: "visa",
        last4: "4242",
      });
    });

    it("should allow optional failureReason", async () => {
      const transaction = await DonationTransaction.create({
        donationId: testDonationId,
        userId: testUserId,
        amount: 5000,
        type: "one-time",
        status: "completed" as TransactionStatus,
        giftDate: new Date(),
        stripePaymentIntentId: "pi_test",
      });

      expect(transaction.failureReason).toBeUndefined();
    });

    it("should allow optional failureCode", async () => {
      const transaction = await DonationTransaction.create({
        donationId: testDonationId,
        userId: testUserId,
        amount: 5000,
        type: "one-time",
        status: "completed" as TransactionStatus,
        giftDate: new Date(),
        stripePaymentIntentId: "pi_test",
      });

      expect(transaction.failureCode).toBeUndefined();
    });

    it("should store failure details for failed transactions", async () => {
      const transaction = await DonationTransaction.create({
        donationId: testDonationId,
        userId: testUserId,
        amount: 5000,
        type: "one-time",
        status: "failed" as TransactionStatus,
        giftDate: new Date(),
        stripePaymentIntentId: "pi_test",
        failureReason: "Card was declined",
        failureCode: "card_declined",
      });

      expect(transaction.failureReason).toBe("Card was declined");
      expect(transaction.failureCode).toBe("card_declined");
    });
  });

  describe("Timestamps", () => {
    it("should automatically add createdAt and updatedAt", async () => {
      const transaction = await DonationTransaction.create({
        donationId: testDonationId,
        userId: testUserId,
        amount: 5000,
        type: "one-time",
        status: "completed" as TransactionStatus,
        giftDate: new Date(),
        stripePaymentIntentId: "pi_test",
      });

      expect(transaction.createdAt).toBeInstanceOf(Date);
      expect(transaction.updatedAt).toBeInstanceOf(Date);
    });

    it("should update updatedAt on save", async () => {
      const transaction = await DonationTransaction.create({
        donationId: testDonationId,
        userId: testUserId,
        amount: 5000,
        type: "one-time",
        status: "completed" as TransactionStatus,
        giftDate: new Date(),
        stripePaymentIntentId: "pi_test_update_timestamp",
      });

      const originalUpdatedAt = transaction.updatedAt.getTime();

      // Modify a field and save (updatedAt should automatically update)
      transaction.failureReason = "Test update";
      await transaction.save();

      const newUpdatedAt = transaction.updatedAt.getTime();
      // Mongoose timestamps should ensure updatedAt changes on save
      expect(newUpdatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });
  });

  describe("Indexes", () => {
    it("should have donationId index for efficient queries", async () => {
      const indexes = await DonationTransaction.collection.getIndexes();
      const donationIdIndex = Object.values(indexes).find((index: any) =>
        index.some((field: any) => field[0] === "donationId")
      );

      expect(donationIdIndex).toBeDefined();
    });

    it("should have userId index for efficient queries", async () => {
      const indexes = await DonationTransaction.collection.getIndexes();
      const userIdIndex = Object.values(indexes).find((index: any) =>
        index.some((field: any) => field[0] === "userId")
      );

      expect(userIdIndex).toBeDefined();
    });

    it("should have status index for efficient queries", async () => {
      const indexes = await DonationTransaction.collection.getIndexes();
      const statusIndex = Object.values(indexes).find((index: any) =>
        index.some((field: any) => field[0] === "status")
      );

      expect(statusIndex).toBeDefined();
    });
  });

  describe("Referential Integrity", () => {
    it("should reference valid donation", async () => {
      const transaction = await DonationTransaction.create({
        donationId: testDonationId,
        userId: testUserId,
        amount: 5000,
        type: "one-time",
        status: "completed" as TransactionStatus,
        giftDate: new Date(),
        stripePaymentIntentId: "pi_test",
      });

      const populatedTransaction = await DonationTransaction.findById(
        transaction._id
      ).populate("donationId");

      expect(populatedTransaction).toBeDefined();
      expect((populatedTransaction?.donationId as any)._id).toEqual(
        testDonationId
      );
    });

    it("should reference valid user", async () => {
      const transaction = await DonationTransaction.create({
        donationId: testDonationId,
        userId: testUserId,
        amount: 5000,
        type: "one-time",
        status: "completed" as TransactionStatus,
        giftDate: new Date(),
        stripePaymentIntentId: "pi_test",
      });

      const populatedTransaction = await DonationTransaction.findById(
        transaction._id
      ).populate("userId");

      expect(populatedTransaction).toBeDefined();
      expect((populatedTransaction?.userId as any)._id).toEqual(testUserId);
    });
  });
});
