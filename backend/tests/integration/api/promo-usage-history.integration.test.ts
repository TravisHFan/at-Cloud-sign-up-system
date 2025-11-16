import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import { PromoCode } from "../../../src/models";
import { ROLES } from "../../../src/utils/roleUtils";
import { ensureIntegrationDB } from "../setup/connect";
import { TokenService } from "../../../src/middleware/auth";
import mongoose from "mongoose";

describe("UsageHistoryController - GET /api/promo-codes/:id/usage-history", () => {
  beforeEach(async () => {
    await ensureIntegrationDB();
    await User.deleteMany({});
    await PromoCode.deleteMany({});
  });

  // ========== Authentication Tests ==========
  describe("Authentication", () => {
    it("should return 401 when no token provided", async () => {
      const promoId = new mongoose.Types.ObjectId();
      const response = await request(app).get(
        `/api/promo-codes/${promoId}/usage-history`
      );

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should return 401 when invalid token provided", async () => {
      const promoId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/promo-codes/${promoId}/usage-history`)
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  // ========== Authorization Tests ==========
  describe("Authorization", () => {
    it("should deny access for Participant role", async () => {
      const participant = await User.create({
        name: "Participant",
        username: "participant",
        email: "participant@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const promoId = new mongoose.Types.ObjectId();
      const token = TokenService.generateTokenPair(participant).accessToken;

      const response = await request(app)
        .get(`/api/promo-codes/${promoId}/usage-history`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("should deny access for Guest Expert role", async () => {
      const expert = await User.create({
        name: "Guest Expert",
        username: "expert",
        email: "expert@test.com",
        password: "Password123",
        role: ROLES.GUEST_EXPERT,
        isActive: true,
        isVerified: true,
      });

      const promoId = new mongoose.Types.ObjectId();
      const token = TokenService.generateTokenPair(expert).accessToken;

      const response = await request(app)
        .get(`/api/promo-codes/${promoId}/usage-history`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("should deny access for Leader role", async () => {
      const leader = await User.create({
        name: "Leader",
        username: "leader",
        email: "leader@test.com",
        password: "Password123",
        role: ROLES.LEADER,
        isActive: true,
        isVerified: true,
      });

      const promoId = new mongoose.Types.ObjectId();
      const token = TokenService.generateTokenPair(leader).accessToken;

      const response = await request(app)
        .get(`/api/promo-codes/${promoId}/usage-history`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  // ========== Success Cases ==========
  describe("Success Cases", () => {
    it("should return usage history for Super Admin", async () => {
      const admin = await User.create({
        name: "Super Admin",
        username: "superadmin",
        email: "superadmin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const user1Id = new mongoose.Types.ObjectId();
      const programId = new mongoose.Types.ObjectId();

      const promoCode = await PromoCode.create({
        code: "STAFF202",
        type: "staff_access",
        discountPercent: 20,
        isGeneral: true,
        description: "Staff discount code",
        createdBy: admin._id.toString(),
        usageHistory: [
          {
            userId: user1Id,
            userName: "Test User",
            userEmail: "user@test.com",
            usedAt: new Date(),
            programId: programId,
            programTitle: "Test Program",
          },
        ],
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/promo-codes/${promoCode._id}/usage-history`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.code).toBe("STAFF202");
      expect(response.body.data.type).toBe("staff_access");
      expect(response.body.data.isGeneral).toBe(true);
      expect(response.body.data.usageHistory).toHaveLength(1);
      expect(response.body.data.usageCount).toBe(1);
    });

    it("should return usage history for Administrator", async () => {
      const admin = await User.create({
        name: "Administrator",
        username: "administrator",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.ADMINISTRATOR,
        isActive: true,
        isVerified: true,
      });

      const promoCode = await PromoCode.create({
        code: "ADMIN202",
        type: "staff_access",
        discountPercent: 15,
        isGeneral: true,
        description: "Admin code",
        createdBy: admin._id.toString(),
        usageHistory: [],
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/promo-codes/${promoCode._id}/usage-history`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.code).toBe("ADMIN202");
    });

    it("should return empty usage history when no usage", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const promoCode = await PromoCode.create({
        code: "UNUSED20",
        type: "staff_access",
        discountPercent: 10,
        isGeneral: true,
        description: "Unused code",
        createdBy: admin._id.toString(),
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/promo-codes/${promoCode._id}/usage-history`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.usageHistory).toEqual([]);
      expect(response.body.data.usageCount).toBe(0);
    });

    it("should return multiple usage history entries", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const promoCode = await PromoCode.create({
        code: "POPULAR2",
        type: "staff_access",
        discountPercent: 25,
        isGeneral: true,
        description: "Popular code",
        createdBy: admin._id.toString(),
        usageHistory: [
          {
            userId: new mongoose.Types.ObjectId(),
            userName: "User 1",
            userEmail: "user1@test.com",
            usedAt: new Date("2024-01-01"),
            programId: new mongoose.Types.ObjectId(),
            programTitle: "Program 1",
          },
          {
            userId: new mongoose.Types.ObjectId(),
            userName: "User 2",
            userEmail: "user2@test.com",
            usedAt: new Date("2024-01-02"),
            programId: new mongoose.Types.ObjectId(),
            programTitle: "Program 2",
          },
          {
            userId: new mongoose.Types.ObjectId(),
            userName: "User 3",
            userEmail: "user3@test.com",
            usedAt: new Date("2024-01-03"),
            programId: new mongoose.Types.ObjectId(),
            programTitle: "Program 3",
          },
        ],
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/promo-codes/${promoCode._id}/usage-history`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.usageHistory).toHaveLength(3);
      expect(response.body.data.usageCount).toBe(3);
    });

    it("should include all promo code metadata", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const promoCode = await PromoCode.create({
        code: "META2024",
        type: "staff_access",
        discountPercent: 30,
        isGeneral: true,
        description: "Test metadata code",
        createdBy: admin._id.toString(),
        usageHistory: [],
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/promo-codes/${promoCode._id}/usage-history`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty("code");
      expect(response.body.data).toHaveProperty("type");
      expect(response.body.data).toHaveProperty("isGeneral");
      expect(response.body.data).toHaveProperty("description");
      expect(response.body.data).toHaveProperty("usageHistory");
      expect(response.body.data).toHaveProperty("usageCount");
      expect(response.body.data.code).toBe("META2024");
      expect(response.body.data.type).toBe("staff_access");
      expect(response.body.data.isGeneral).toBe(true);
      expect(response.body.data.description).toBe("Test metadata code");
    });
  });

  // ========== Edge Cases ==========
  describe("Edge Cases", () => {
    it("should return 400 for invalid promo code ID format", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get("/api/promo-codes/invalid-id/usage-history")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid promo code ID");
    });

    it("should return 404 for non-existent promo code", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const fakeId = new mongoose.Types.ObjectId();
      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/promo-codes/${fakeId}/usage-history`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Promo code not found");
    });

    it("should handle promo code with many usage entries", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const usageHistory = [];
      for (let i = 0; i < 50; i++) {
        usageHistory.push({
          userId: new mongoose.Types.ObjectId(),
          userName: `User ${i}`,
          userEmail: `user${i}@test.com`,
          usedAt: new Date(Date.now() - i * 1000 * 60 * 60),
          programId: new mongoose.Types.ObjectId(),
          programTitle: `Program ${i}`,
        });
      }

      const promoCode = await PromoCode.create({
        code: "HEAVY202",
        type: "staff_access",
        discountPercent: 20,
        isGeneral: true,
        description: "Heavy usage code",
        createdBy: admin._id.toString(),
        usageHistory,
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/promo-codes/${promoCode._id}/usage-history`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.usageHistory).toHaveLength(50);
      expect(response.body.data.usageCount).toBe(50);
    });

    it("should handle promo code with isGeneral defaulting to false", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const promoCode = await PromoCode.create({
        code: "NOFIELD2",
        type: "staff_access",
        discountPercent: 10,
        // isGeneral not explicitly set, should default to false
        // When false, ownerId is required
        ownerId: admin._id,
        description: "No isGeneral field",
        createdBy: admin._id.toString(),
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/promo-codes/${promoCode._id}/usage-history`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isGeneral).toBe(false); // Should default to false
    });
  });

  // ========== Response Format ==========
  describe("Response Format", () => {
    it("should have correct response structure", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const promoCode = await PromoCode.create({
        code: "FORMAT20",
        type: "staff_access",
        discountPercent: 15,
        isGeneral: true,
        description: "Format test",
        createdBy: admin._id.toString(),
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/promo-codes/${promoCode._id}/usage-history`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("data");
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data).toBe("object");
    });

    it("should not include message field on success", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const promoCode = await PromoCode.create({
        code: "NOMSG202",
        type: "staff_access",
        discountPercent: 10,
        isGeneral: true,
        description: "No message test",
        createdBy: admin._id.toString(),
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/promo-codes/${promoCode._id}/usage-history`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty("message");
    });
  });
});
