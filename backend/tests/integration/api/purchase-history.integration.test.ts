import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Purchase from "../../../src/models/Purchase";
import Program from "../../../src/models/Program";
import { ROLES } from "../../../src/utils/roleUtils";
import { ensureIntegrationDB } from "../setup/connect";
import { TokenService } from "../../../src/middleware/auth";
import mongoose from "mongoose";

describe("PurchaseHistoryController - GET /api/purchases/my-purchases", () => {
  beforeEach(async () => {
    await ensureIntegrationDB();
    await User.deleteMany({});
    await Purchase.deleteMany({});
    await Program.deleteMany({});
  });

  // ========== Authentication Tests ==========
  describe("Authentication", () => {
    it("should return 401 when no token provided", async () => {
      const response = await request(app).get("/api/purchases/my-purchases");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should return 401 when invalid token provided", async () => {
      const response = await request(app)
        .get("/api/purchases/my-purchases")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  // ========== Success Cases ==========
  describe("Success Cases", () => {
    it("should return empty array when user has no purchases", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/purchases/my-purchases")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it("should return completed purchases for user", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const program = await Program.create({
        title: "Test Program",
        programType: "Effective Communication Workshops",
        fullPriceTicket: 9999,
        slug: "test-program",
        createdBy: user._id,
        isPublished: true,
      });

      await Purchase.create({
        userId: user._id,
        programId: program._id,
        orderNumber: "ORD-20250114-12345",
        fullPrice: 9999,
        finalPrice: 9999,
        isClassRep: false,
        isEarlyBird: false,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        status: "completed",
        purchaseDate: new Date(),
        billingInfo: {
          fullName: "Test User",
          email: "user@test.com",
        },
        paymentMethod: {
          type: "card",
          last4: "4242",
        },
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/purchases/my-purchases")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].orderNumber).toBe("ORD-20250114-12345");
      expect(response.body.data[0].status).toBe("completed");
    });

    it("should include refund_processing purchases", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const program = await Program.create({
        title: "Test Program",
        programType: "Effective Communication Workshops",
        fullPriceTicket: 9999,
        slug: "test-program",
        createdBy: user._id,
        isPublished: true,
      });

      await Purchase.create({
        userId: user._id,
        programId: program._id,
        orderNumber: "ORD-20250114-12345",
        fullPrice: 9999,
        finalPrice: 9999,
        isClassRep: false,
        isEarlyBird: false,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        status: "refund_processing",
        purchaseDate: new Date(),
        refundInitiatedAt: new Date(),
        billingInfo: {
          fullName: "Test User",
          email: "user@test.com",
        },
        paymentMethod: {
          type: "card",
          last4: "4242",
        },
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/purchases/my-purchases")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe("refund_processing");
    });

    it("should include refunded purchases", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const program = await Program.create({
        title: "Test Program",
        programType: "Effective Communication Workshops",
        fullPriceTicket: 9999,
        slug: "test-program",
        createdBy: user._id,
        isPublished: true,
      });

      await Purchase.create({
        userId: user._id,
        programId: program._id,
        orderNumber: "ORD-20250114-12345",
        fullPrice: 9999,
        finalPrice: 9999,
        isClassRep: false,
        isEarlyBird: false,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        status: "refunded",
        purchaseDate: new Date(),
        refundedAt: new Date(),
        billingInfo: {
          fullName: "Test User",
          email: "user@test.com",
        },
        paymentMethod: {
          type: "card",
          last4: "4242",
        },
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/purchases/my-purchases")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe("refunded");
    });

    it("should populate program details", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const program = await Program.create({
        title: "Advanced Workshop",
        programType: "Effective Communication Workshops",
        fullPriceTicket: 9999,
        slug: "advanced-workshop",
        createdBy: user._id,
        isPublished: true,
      });

      await Purchase.create({
        userId: user._id,
        programId: program._id,
        orderNumber: "ORD-20250114-12345",
        fullPrice: 9999,
        finalPrice: 9999,
        isClassRep: false,
        isEarlyBird: false,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        status: "completed",
        purchaseDate: new Date(),
        billingInfo: {
          fullName: "Test User",
          email: "user@test.com",
        },
        paymentMethod: {
          type: "card",
          last4: "4242",
        },
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/purchases/my-purchases")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].programId).toBeDefined();
      expect(response.body.data[0].programId.title).toBe("Advanced Workshop");
      expect(response.body.data[0].programId.programType).toBe(
        "Effective Communication Workshops"
      );
    });

    it("should sort purchases by purchaseDate descending (newest first)", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const program = await Program.create({
        title: "Test Program",
        programType: "Effective Communication Workshops",
        fullPriceTicket: 9999,
        slug: "test-program",
        createdBy: user._id,
        isPublished: true,
      });

      const oldDate = new Date("2024-01-01");
      const newDate = new Date("2025-01-14");

      await Purchase.create({
        userId: user._id,
        programId: program._id,
        orderNumber: "ORD-20240101-OLD",
        fullPrice: 9999,
        finalPrice: 9999,
        isClassRep: false,
        isEarlyBird: false,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        status: "completed",
        purchaseDate: oldDate,
        billingInfo: {
          fullName: "Test User",
          email: "user@test.com",
        },
        paymentMethod: {
          type: "card",
          last4: "4242",
        },
      });

      await Purchase.create({
        userId: user._id,
        programId: program._id,
        orderNumber: "ORD-20250114-NEW",
        fullPrice: 9999,
        finalPrice: 9999,
        isClassRep: false,
        isEarlyBird: false,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        status: "completed",
        purchaseDate: newDate,
        billingInfo: {
          fullName: "Test User",
          email: "user@test.com",
        },
        paymentMethod: {
          type: "card",
          last4: "4242",
        },
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/purchases/my-purchases")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].orderNumber).toBe("ORD-20250114-NEW");
      expect(response.body.data[1].orderNumber).toBe("ORD-20240101-OLD");
    });
  });

  // ========== Edge Cases ==========
  describe("Edge Cases", () => {
    it("should exclude pending purchases", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const program = await Program.create({
        title: "Test Program",
        programType: "Effective Communication Workshops",
        fullPriceTicket: 9999,
        slug: "test-program",
        createdBy: user._id,
        isPublished: true,
      });

      await Purchase.create({
        userId: user._id,
        programId: program._id,
        orderNumber: "ORD-20250114-PENDING",
        fullPrice: 9999,
        finalPrice: 9999,
        isClassRep: false,
        isEarlyBird: false,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        status: "pending",
        purchaseDate: new Date(),
        billingInfo: {
          fullName: "Test User",
          email: "user@test.com",
        },
        paymentMethod: {
          type: "card",
          last4: "4242",
        },
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/purchases/my-purchases")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it("should exclude failed purchases", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const program = await Program.create({
        title: "Test Program",
        programType: "Effective Communication Workshops",
        fullPriceTicket: 9999,
        slug: "test-program",
        createdBy: user._id,
        isPublished: true,
      });

      await Purchase.create({
        userId: user._id,
        programId: program._id,
        orderNumber: "ORD-20250114-FAILED",
        fullPrice: 9999,
        finalPrice: 9999,
        isClassRep: false,
        isEarlyBird: false,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        status: "failed",
        purchaseDate: new Date(),
        billingInfo: {
          fullName: "Test User",
          email: "user@test.com",
        },
        paymentMethod: {
          type: "card",
          last4: "4242",
        },
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/purchases/my-purchases")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it("should only return purchases for authenticated user", async () => {
      const user1 = await User.create({
        name: "User 1",
        username: "user1",
        email: "user1@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const user2 = await User.create({
        name: "User 2",
        username: "user2",
        email: "user2@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const program = await Program.create({
        title: "Test Program",
        programType: "Effective Communication Workshops",
        fullPriceTicket: 9999,
        slug: "test-program",
        createdBy: user1._id,
        isPublished: true,
      });

      await Purchase.create({
        userId: user1._id,
        programId: program._id,
        orderNumber: "ORD-20250114-USER1",
        fullPrice: 9999,
        finalPrice: 9999,
        isClassRep: false,
        isEarlyBird: false,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        status: "completed",
        purchaseDate: new Date(),
        billingInfo: {
          fullName: "User 1",
          email: "user1@test.com",
        },
        paymentMethod: {
          type: "card",
          last4: "4242",
        },
      });

      await Purchase.create({
        userId: user2._id,
        programId: program._id,
        orderNumber: "ORD-20250114-USER2",
        fullPrice: 9999,
        finalPrice: 9999,
        isClassRep: false,
        isEarlyBird: false,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        status: "completed",
        purchaseDate: new Date(),
        billingInfo: {
          fullName: "User 2",
          email: "user2@test.com",
        },
        paymentMethod: {
          type: "card",
          last4: "4242",
        },
      });

      const token = TokenService.generateTokenPair(user1).accessToken;

      const response = await request(app)
        .get("/api/purchases/my-purchases")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].orderNumber).toBe("ORD-20250114-USER1");
    });

    it("should handle multiple statuses correctly", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const program = await Program.create({
        title: "Test Program",
        programType: "Effective Communication Workshops",
        fullPriceTicket: 9999,
        slug: "test-program",
        createdBy: user._id,
        isPublished: true,
      });

      // Create purchases with all included statuses
      await Purchase.create({
        userId: user._id,
        programId: program._id,
        orderNumber: "ORD-COMPLETED",
        fullPrice: 9999,
        finalPrice: 9999,
        isClassRep: false,
        isEarlyBird: false,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        status: "completed",
        purchaseDate: new Date(),
        billingInfo: {
          fullName: "Test User",
          email: "user@test.com",
        },
        paymentMethod: {
          type: "card",
          last4: "4242",
        },
      });

      await Purchase.create({
        userId: user._id,
        programId: program._id,
        orderNumber: "ORD-REFUND-PROCESSING",
        fullPrice: 9999,
        finalPrice: 9999,
        isClassRep: false,
        isEarlyBird: false,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        status: "refund_processing",
        purchaseDate: new Date(),
        billingInfo: {
          fullName: "Test User",
          email: "user@test.com",
        },
        paymentMethod: {
          type: "card",
          last4: "4242",
        },
      });

      await Purchase.create({
        userId: user._id,
        programId: program._id,
        orderNumber: "ORD-REFUND-FAILED",
        fullPrice: 9999,
        finalPrice: 9999,
        isClassRep: false,
        isEarlyBird: false,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        status: "refund_failed",
        purchaseDate: new Date(),
        billingInfo: {
          fullName: "Test User",
          email: "user@test.com",
        },
        paymentMethod: {
          type: "card",
          last4: "4242",
        },
      });

      await Purchase.create({
        userId: user._id,
        programId: program._id,
        orderNumber: "ORD-REFUNDED",
        fullPrice: 9999,
        finalPrice: 9999,
        isClassRep: false,
        isEarlyBird: false,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        status: "refunded",
        purchaseDate: new Date(),
        billingInfo: {
          fullName: "Test User",
          email: "user@test.com",
        },
        paymentMethod: {
          type: "card",
          last4: "4242",
        },
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/purchases/my-purchases")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(4);
      const statuses = response.body.data.map((p: any) => p.status);
      expect(statuses).toContain("completed");
      expect(statuses).toContain("refund_processing");
      expect(statuses).toContain("refund_failed");
      expect(statuses).toContain("refunded");
    });

    it("should handle many purchases efficiently", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const program = await Program.create({
        title: "Test Program",
        programType: "Effective Communication Workshops",
        fullPriceTicket: 9999,
        slug: "test-program",
        createdBy: user._id,
        isPublished: true,
      });

      // Create 50 purchases
      const purchases = [];
      for (let i = 0; i < 50; i++) {
        purchases.push({
          userId: user._id,
          programId: program._id,
          orderNumber: `ORD-20250114-${String(i).padStart(5, "0")}`,
          fullPrice: 9999,
          finalPrice: 9999,
          isClassRep: false,
          isEarlyBird: false,
          classRepDiscount: 0,
          earlyBirdDiscount: 0,
          status: "completed",
          purchaseDate: new Date(Date.now() - i * 1000 * 60 * 60 * 24), // Different dates
          billingInfo: {
            fullName: "Test User",
            email: "user@test.com",
          },
          paymentMethod: {
            type: "card",
            last4: "4242",
          },
        });
      }
      await Purchase.insertMany(purchases);

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/purchases/my-purchases")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(50);
      // Verify sorted descending
      expect(response.body.data[0].orderNumber).toBe("ORD-20250114-00000");
      expect(response.body.data[49].orderNumber).toBe("ORD-20250114-00049");
    });
  });

  // ========== Response Format ==========
  describe("Response Format", () => {
    it("should have correct response structure", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/purchases/my-purchases")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("data");
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should not include message field on success", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/purchases/my-purchases")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty("message");
    });
  });
});
