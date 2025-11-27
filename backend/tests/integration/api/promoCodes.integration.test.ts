/**
 * Integration tests for Promo Code System
 * Tests all 7 API endpoints, SystemConfig methods, authorization, and edge cases
 */
import request from "supertest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import PromoCode from "../../../src/models/PromoCode";
import { SystemConfig } from "../../../src/models/SystemConfig";
import Program from "../../../src/models/Program";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";
import { describe, test, expect, afterEach, beforeAll } from "vitest";
import { ensureIntegrationDB } from "../setup/connect";
import mongoose from "mongoose";

beforeAll(async () => {
  await ensureIntegrationDB();
});

// Helper function to create test program with required fields
async function createTestProgram(
  createdBy: mongoose.Types.ObjectId | string,
  overrides: Partial<any> = {}
) {
  return await Program.create({
    title: overrides.title || "Test Program",
    programType: "EMBA Mentor Circles",
    fullPriceTicket: 10000, // $100 in cents
    createdBy,
    ...overrides,
  });
}

describe("Promo Code System - Integration Tests", () => {
  afterEach(async () => {
    // Clean up test data
    await PromoCode.deleteMany({});
    await SystemConfig.deleteMany({});
    await Program.deleteMany({});
    await User.deleteMany({});
  });

  // ============================================================================
  // USER ROUTES - GET /api/promo-codes/my-codes
  // ============================================================================

  describe("GET /api/promo-codes/my-codes", () => {
    test("returns user's promo codes with default 'all' filter", async () => {
      const { token, userId } = await createAndLoginTestUser();

      // Create codes for this user
      const code1 = await PromoCode.create({
        code: "ABCD1234",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: userId,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      const code2 = await PromoCode.create({
        code: "EFGH5678",
        type: "staff_access",
        discountPercent: 100,
        ownerId: userId,
        isActive: true,
        isUsed: false,
        createdBy: "admin",
      });

      const res = await request(app)
        .get("/api/promo-codes/my-codes")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.codes).toHaveLength(2);
      expect(res.body.codes.map((c: any) => c.code)).toEqual(
        expect.arrayContaining(["ABCD1234", "EFGH5678"])
      );
    });

    test("filters by status=active (excludes expired and used codes)", async () => {
      const { token, userId } = await createAndLoginTestUser();

      // Active code
      await PromoCode.create({
        code: "ACTIVE01",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: userId,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      // Expired code
      const expiredCode = new PromoCode({
        code: "EXPIRED1",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: userId,
        isActive: true,
        isUsed: false,
        expiresAt: new Date("2020-01-01"), // Past date
        createdBy: "system",
      });
      await expiredCode.save({ validateBeforeSave: false });

      // Used code
      await PromoCode.create({
        code: "USED0001",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: userId,
        isActive: true,
        isUsed: true,
        createdBy: "system",
      });

      const res = await request(app)
        .get("/api/promo-codes/my-codes?status=active")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.codes).toHaveLength(1);
      expect(res.body.codes[0].code).toBe("ACTIVE01");
    });

    test("returns empty array when user has no codes", async () => {
      const { token } = await createAndLoginTestUser();

      const res = await request(app)
        .get("/api/promo-codes/my-codes")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.codes).toEqual([]);
    });

    test("requires authentication", async () => {
      await request(app).get("/api/promo-codes/my-codes").expect(401);
    });
  });

  // ============================================================================
  // ADMIN ROUTES - GET /api/promo-codes (search + pagination)
  // ============================================================================

  describe("GET /api/promo-codes (admin listing with search & pagination)", () => {
    test("supports search and pagination parameters", async () => {
      const { token: adminToken, userId: adminId } =
        await createAndLoginTestUser({ role: "Administrator" });

      const { userId: ownerA } = await createAndLoginTestUser();
      const { userId: ownerB } = await createAndLoginTestUser();

      // Create multiple codes for two different owners so search and pagination have work to do
      await PromoCode.insertMany([
        {
          code: "SEARCHC1", // valid 8-char code
          type: "bundle_discount",
          discountAmount: 50,
          ownerId: ownerA,
          isActive: true,
          isUsed: false,
          createdBy: adminId,
        },
        {
          code: "SEARCHC2", // valid 8-char code
          type: "bundle_discount",
          discountAmount: 75,
          ownerId: ownerA,
          isActive: true,
          isUsed: false,
          createdBy: adminId,
        },
        {
          code: "OTHERC01", // valid 8-char code
          type: "staff_access",
          discountPercent: 100,
          ownerId: ownerB,
          isActive: true,
          isUsed: false,
          createdBy: adminId,
        },
      ]);

      // Page 1, limit 1, search by partial code
      const res = await request(app)
        .get("/api/promo-codes")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ search: "SEARCHC", page: 1, limit: 1 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.codes).toHaveLength(1);
      expect(res.body.codes[0].code).toMatch(/SEARCHC/);

      // Pagination metadata should reflect total matches and page information
      expect(res.body.pagination).toEqual(
        expect.objectContaining({
          page: 1,
          limit: 1,
          total: 2,
          totalPages: 2,
        })
      );
    });
  });

  // ============================================================================
  // USER ROUTES - POST /api/promo-codes/validate
  // ============================================================================

  describe("POST /api/promo-codes/validate", () => {
    test("validates active bundle_discount code successfully", async () => {
      const { token, userId } = await createAndLoginTestUser();

      const program = await createTestProgram(userId);

      await PromoCode.create({
        code: "VALID100",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: userId,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "VALID100",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(true);
      expect(res.body.code).toBeDefined();
      expect(res.body.code.code).toBe("VALID100");
      expect(res.body.code.discountAmount).toBe(50);
    });

    test("validates staff_access code for allowed program", async () => {
      const { token, userId } = await createAndLoginTestUser();

      const program = await createTestProgram(userId);

      await PromoCode.create({
        code: "STAFF100",
        type: "staff_access",
        discountPercent: 100,
        ownerId: userId,
        allowedProgramIds: [program._id],
        applicableToType: "program",
        isActive: true,
        isUsed: false,
        createdBy: "admin",
      });

      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "STAFF100",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(true);
      expect(res.body.code.discountPercent).toBe(100);
    });

    test("rejects expired code", async () => {
      const { token, userId } = await createAndLoginTestUser();

      const program = await createTestProgram(userId);

      const expiredCode = new PromoCode({
        code: "EXPIRED2",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: userId,
        isActive: true,
        isUsed: false,
        expiresAt: new Date("2020-01-01"), // Past date
        createdBy: "system",
      });
      await expiredCode.save({ validateBeforeSave: false });

      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "EXPIRED2",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(false);
      expect(res.body.message).toContain("expired");
    });

    test("rejects already used code", async () => {
      const { token, userId } = await createAndLoginTestUser();

      const program = await createTestProgram(userId);

      await PromoCode.create({
        code: "USED1234",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: userId,
        isActive: true,
        isUsed: true,
        usedAt: new Date(),
        createdBy: "system",
      });

      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "USED1234",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(false);
      expect(res.body.message).toContain("already been used");
    });

    test("rejects inactive code", async () => {
      const { token, userId } = await createAndLoginTestUser();

      const program = await createTestProgram(userId);

      await PromoCode.create({
        code: "INACTIV1",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: userId,
        isActive: false,
        isUsed: false,
        createdBy: "system",
      });

      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "INACTIV1",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(false);
      expect(res.body.message).toContain("deactivated");
    });

    test("rejects code owned by different user", async () => {
      const { token } = await createAndLoginTestUser();
      const otherUser = await User.create({
        username: "otheruser",
        firstName: "Other",
        lastName: "User",
        email: "other@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const program = await createTestProgram(otherUser._id);

      await PromoCode.create({
        code: "OTHER123",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: otherUser._id,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "OTHER123",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(false);
      expect(res.body.message).toContain("belongs to another user");
    });

    test("rejects staff code for non-allowed program", async () => {
      const { token, userId } = await createAndLoginTestUser();

      const allowedProgram = await createTestProgram(userId);

      const notAllowedProgram = await createTestProgram(userId);

      await PromoCode.create({
        code: "RESTRIC1",
        type: "staff_access",
        discountPercent: 100,
        ownerId: userId,
        allowedProgramIds: [allowedProgram._id],
        applicableToType: "program",
        isActive: true,
        isUsed: false,
        createdBy: "admin",
      });

      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "RESTRIC1",
          programId: notAllowedProgram._id.toString(),
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(false);
      expect(res.body.message).toContain("not valid for this program");
    });

    test("rejects non-existent code", async () => {
      const { token, userId } = await createAndLoginTestUser();

      const program = await createTestProgram(userId);

      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "NOTEXIST",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(false);
      expect(res.body.message).toContain("Invalid promo code");
    });

    test("requires authentication", async () => {
      await request(app)
        .post("/api/promo-codes/validate")
        .send({ code: "TEST1234", programId: "123" })
        .expect(401);
    });

    test("validates required fields", async () => {
      const { token } = await createAndLoginTestUser();

      // Missing code
      await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({ programId: "123" })
        .expect(400);

      // Missing programId
      await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({ code: "TEST1234" })
        .expect(400);
    });
  });

  // ============================================================================
  // ADMIN ROUTES - GET /api/promo-codes (View All Codes)
  // ============================================================================

  describe("GET /api/promo-codes (Admin)", () => {
    test("returns all promo codes for admin", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const user1 = await User.create({
        username: "user1",
        firstName: "User",
        lastName: "One",
        email: "user1@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      await PromoCode.create({
        code: "CODE0001",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: user1._id,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      await PromoCode.create({
        code: "CODE0002",
        type: "staff_access",
        discountPercent: 100,
        ownerId: user1._id,
        isActive: true,
        isUsed: false,
        createdBy: "admin",
      });

      const res = await request(app)
        .get("/api/promo-codes")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.codes).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(2);
    });

    test("filters by type", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const user1 = await User.create({
        username: "user1",
        firstName: "User",
        lastName: "One",
        email: "user1@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      await PromoCode.create({
        code: "BUNDLE01",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: user1._id,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      await PromoCode.create({
        code: "STAFF001",
        type: "staff_access",
        discountPercent: 100,
        ownerId: user1._id,
        isActive: true,
        isUsed: false,
        createdBy: "admin",
      });

      const res = await request(app)
        .get("/api/promo-codes?type=bundle_discount")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.codes).toHaveLength(1);
      expect(res.body.codes[0].type).toBe("bundle_discount");
    });

    test("filters by status", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const user1 = await User.create({
        username: "user1",
        firstName: "User",
        lastName: "One",
        email: "user1@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      // Active code
      await PromoCode.create({
        code: "ACTIVE02",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: user1._id,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      // Used code
      await PromoCode.create({
        code: "USED0002",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: user1._id,
        isActive: true,
        isUsed: true,
        createdBy: "system",
      });

      const res = await request(app)
        .get("/api/promo-codes?status=used")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.codes).toHaveLength(1);
      expect(res.body.codes[0].isUsed).toBe(true);
    });

    test("searches by code and owner", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const user1 = await User.create({
        username: "johndoe",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      await PromoCode.create({
        code: "SEARCH01",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: user1._id,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      // Search by code
      const res1 = await request(app)
        .get("/api/promo-codes?search=SEARCH")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res1.body.codes).toHaveLength(1);

      // Search by owner name
      const res2 = await request(app)
        .get("/api/promo-codes?search=John")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res2.body.codes).toHaveLength(1);
    });

    test("paginates results correctly", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const user1 = await User.create({
        username: "user1",
        firstName: "User",
        lastName: "One",
        email: "user1@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      // Create 25 codes
      for (let i = 0; i < 25; i++) {
        await PromoCode.create({
          code: `CODE${String(i).padStart(4, "0")}`,
          type: "bundle_discount",
          discountAmount: 50,
          ownerId: user1._id,
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });
      }

      // First page (default limit 20)
      const res1 = await request(app)
        .get("/api/promo-codes")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res1.body.codes).toHaveLength(20);
      expect(res1.body.pagination.total).toBe(25);
      expect(res1.body.pagination.page).toBe(1);
      expect(res1.body.pagination.totalPages).toBe(2);

      // Second page
      const res2 = await request(app)
        .get("/api/promo-codes?page=2")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res2.body.codes).toHaveLength(5);
      expect(res2.body.pagination.page).toBe(2);
    });

    test("requires admin role", async () => {
      const { token } = await createAndLoginTestUser({ role: "Participant" });

      await request(app)
        .get("/api/promo-codes")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });

    test("requires authentication", async () => {
      await request(app).get("/api/promo-codes").expect(401);
    });
  });

  // ============================================================================
  // ADMIN ROUTES - POST /api/promo-codes/staff (Create Staff Code)
  // ============================================================================

  describe("POST /api/promo-codes/staff (Admin)", () => {
    test("creates staff code for all programs", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const targetUser = await User.create({
        username: "staffuser",
        firstName: "Staff",
        lastName: "User",
        email: "staff@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const res = await request(app)
        .post("/api/promo-codes/staff")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: targetUser._id.toString(),
          discountPercent: 100,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBeDefined();
      expect(res.body.data.code.type).toBe("staff_access");
      expect(res.body.data.code.discountPercent).toBe(100);
      expect(res.body.data.code.ownerId).toBe(targetUser._id.toString());
      expect(res.body.data.code.allowedProgramIds).toBeUndefined(); // All programs

      // Verify in database
      const savedCode = await PromoCode.findOne({
        code: res.body.data.code.code,
      });
      expect(savedCode).toBeDefined();
      expect(savedCode!.ownerId).toBeDefined(); // Personal codes always have ownerId
      expect(savedCode!.ownerId!.toString()).toBe(targetUser._id.toString());
    });

    test("creates staff code for specific programs", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const targetUser = await User.create({
        username: "staffuser",
        firstName: "Staff",
        lastName: "User",
        email: "staff@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const program1 = await createTestProgram(targetUser._id);

      const program2 = await createTestProgram(targetUser._id);

      const res = await request(app)
        .post("/api/promo-codes/staff")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: targetUser._id.toString(),
          discountPercent: 50,
          allowedProgramIds: [program1._id.toString(), program2._id.toString()],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.code.allowedProgramIds).toHaveLength(2);
    });

    test("creates staff code with expiration date", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const targetUser = await User.create({
        username: "staffuser",
        firstName: "Staff",
        lastName: "User",
        email: "staff@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const expiryDate = new Date("2030-12-31");

      const res = await request(app)
        .post("/api/promo-codes/staff")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: targetUser._id.toString(),
          discountPercent: 100,
          expiresAt: expiryDate.toISOString(),
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.code.expiresAt).toBeDefined();
      expect(new Date(res.body.data.code.expiresAt).toISOString()).toBe(
        expiryDate.toISOString()
      );
    });

    test("rejects invalid userId", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      await request(app)
        .post("/api/promo-codes/staff")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: "invalid-user-id",
        })
        .expect(400);
    });

    test("rejects non-existent userId", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      const fakeUserId = new mongoose.Types.ObjectId();

      await request(app)
        .post("/api/promo-codes/staff")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: fakeUserId.toString(),
          discountPercent: 100,
        })
        .expect(404);
    });

    test("requires admin role", async () => {
      const { token } = await createAndLoginTestUser({ role: "Participant" });
      const targetUser = await User.create({
        username: "staffuser",
        firstName: "Staff",
        lastName: "User",
        email: "staff@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      await request(app)
        .post("/api/promo-codes/staff")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: targetUser._id.toString(),
        })
        .expect(403);
    });

    test("requires authentication", async () => {
      await request(app)
        .post("/api/promo-codes/staff")
        .send({ userId: "123" })
        .expect(401);
    });
  });

  // ============================================================================
  // ADMIN ROUTES - GET /api/promo-codes/config (Get Bundle Config)
  // ============================================================================

  describe("GET /api/promo-codes/config (Admin)", () => {
    test("returns default config when none exists in database", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      const res = await request(app)
        .get("/api/promo-codes/config")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.config).toMatchObject({
        enabled: true,
        discountAmount: 5000, // $50 in cents
        expiryDays: 30,
      });
    });

    test("returns saved config from database", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      // Save custom config
      await SystemConfig.updateBundleDiscountConfig(
        {
          enabled: false,
          discountAmount: 10000, // $100
          expiryDays: 60,
        },
        "admin"
      );

      const res = await request(app)
        .get("/api/promo-codes/config")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.config).toMatchObject({
        enabled: false,
        discountAmount: 10000,
        expiryDays: 60,
      });
    });

    test("requires admin role", async () => {
      const { token } = await createAndLoginTestUser({ role: "Participant" });

      await request(app)
        .get("/api/promo-codes/config")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });

    test("requires authentication", async () => {
      await request(app).get("/api/promo-codes/config").expect(401);
    });
  });

  // ============================================================================
  // ADMIN ROUTES - PUT /api/promo-codes/config (Update Bundle Config)
  // ============================================================================

  describe("PUT /api/promo-codes/config (Admin)", () => {
    test("updates bundle discount configuration", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      const res = await request(app)
        .put("/api/promo-codes/config")
        .set("Authorization", `Bearer ${token}`)
        .send({
          enabled: true,
          discountAmount: 7500, // $75
          expiryDays: 45,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.config).toMatchObject({
        enabled: true,
        discountAmount: 7500,
        expiryDays: 45,
      });

      // Verify persisted in database
      const savedConfig = await SystemConfig.getBundleDiscountConfig();
      expect(savedConfig).toMatchObject({
        enabled: true,
        discountAmount: 7500,
        expiryDays: 45,
      });
    });

    test("validates enabled field is boolean", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      await request(app)
        .put("/api/promo-codes/config")
        .set("Authorization", `Bearer ${token}`)
        .send({
          enabled: "true", // Should be boolean
          discountAmount: 5000,
          expiryDays: 30,
        })
        .expect(400);
    });

    test("validates discountAmount range ($10-$200)", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      // Too low
      await request(app)
        .put("/api/promo-codes/config")
        .set("Authorization", `Bearer ${token}`)
        .send({
          enabled: true,
          discountAmount: 500, // $5 - below minimum
          expiryDays: 30,
        })
        .expect(400);

      // Too high
      await request(app)
        .put("/api/promo-codes/config")
        .set("Authorization", `Bearer ${token}`)
        .send({
          enabled: true,
          discountAmount: 25000, // $250 - above maximum
          expiryDays: 30,
        })
        .expect(400);
    });

    test("validates expiryDays range (7-365)", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      // Too low
      await request(app)
        .put("/api/promo-codes/config")
        .set("Authorization", `Bearer ${token}`)
        .send({
          enabled: true,
          discountAmount: 5000,
          expiryDays: 5, // Below minimum
        })
        .expect(400);

      // Too high
      await request(app)
        .put("/api/promo-codes/config")
        .set("Authorization", `Bearer ${token}`)
        .send({
          enabled: true,
          discountAmount: 5000,
          expiryDays: 400, // Above maximum
        })
        .expect(400);
    });

    test("accepts valid edge values", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      // Minimum values
      const res1 = await request(app)
        .put("/api/promo-codes/config")
        .set("Authorization", `Bearer ${token}`)
        .send({
          enabled: false,
          discountAmount: 1000, // $10 minimum
          expiryDays: 7, // 7 days minimum
        })
        .expect(200);

      expect(res1.body.success).toBe(true);

      // Maximum values
      const res2 = await request(app)
        .put("/api/promo-codes/config")
        .set("Authorization", `Bearer ${token}`)
        .send({
          enabled: true,
          discountAmount: 20000, // $200 maximum
          expiryDays: 365, // 365 days maximum
        })
        .expect(200);

      expect(res2.body.success).toBe(true);
    });

    test("requires admin role", async () => {
      const { token } = await createAndLoginTestUser({ role: "Participant" });

      await request(app)
        .put("/api/promo-codes/config")
        .set("Authorization", `Bearer ${token}`)
        .send({
          enabled: true,
          discountAmount: 5000,
          expiryDays: 30,
        })
        .expect(403);
    });

    test("requires authentication", async () => {
      await request(app)
        .put("/api/promo-codes/config")
        .send({
          enabled: true,
          discountAmount: 5000,
          expiryDays: 30,
        })
        .expect(401);
    });
  });

  // ============================================================================
  // ADMIN ROUTES - PUT /api/promo-codes/:id/deactivate (Deactivate Code)
  // ============================================================================

  describe("PUT /api/promo-codes/:id/deactivate (Admin)", () => {
    test("deactivates an active promo code", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const user1 = await User.create({
        username: "user1",
        firstName: "User",
        lastName: "One",
        email: "user1@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const code = await PromoCode.create({
        code: "DEACT001",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: user1._id,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      const res = await request(app)
        .put(`/api/promo-codes/${code._id}/deactivate`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.code.isActive).toBe(false);

      // Verify in database
      const updatedCode = await PromoCode.findById(code._id);
      expect(updatedCode!.isActive).toBe(false);
    });

    test("returns 404 for non-existent code", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const fakeId = new mongoose.Types.ObjectId();

      await request(app)
        .put(`/api/promo-codes/${fakeId}/deactivate`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });

    test("requires valid ObjectId", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      await request(app)
        .put("/api/promo-codes/invalid-id/deactivate")
        .set("Authorization", `Bearer ${token}`)
        .expect(400);
    });

    test("requires admin role", async () => {
      const { token } = await createAndLoginTestUser({ role: "Participant" });
      const user1 = await User.create({
        username: "user1",
        firstName: "User",
        lastName: "One",
        email: "user1@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const code = await PromoCode.create({
        code: "DEACT002",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: user1._id,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      await request(app)
        .put(`/api/promo-codes/${code._id}/deactivate`)
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });

    test("requires authentication", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await request(app)
        .put(`/api/promo-codes/${fakeId}/deactivate`)
        .expect(401);
    });
  });

  // ============================================================================
  // SYSTEMCONFIG MODEL - Static Methods
  // ============================================================================

  describe("SystemConfig Model - getBundleDiscountConfig()", () => {
    test("returns defaults when no config exists", async () => {
      const config = await SystemConfig.getBundleDiscountConfig();

      expect(config).toMatchObject({
        enabled: true,
        discountAmount: 5000,
        expiryDays: 30,
      });
    });

    test("returns saved config from database", async () => {
      await SystemConfig.updateBundleDiscountConfig(
        {
          enabled: false,
          discountAmount: 8000,
          expiryDays: 90,
        },
        "test"
      );

      const config = await SystemConfig.getBundleDiscountConfig();

      expect(config).toMatchObject({
        enabled: false,
        discountAmount: 8000,
        expiryDays: 90,
      });
    });
  });

  describe("SystemConfig Model - updateBundleDiscountConfig()", () => {
    test("creates new config document if none exists", async () => {
      const config = await SystemConfig.updateBundleDiscountConfig(
        {
          enabled: true,
          discountAmount: 6000,
          expiryDays: 45,
        },
        "admin"
      );

      expect(config.key).toBe("bundle_discount_config");
      expect(config.value).toMatchObject({
        enabled: true,
        discountAmount: 6000,
        expiryDays: 45,
      });
      expect(config.updatedBy).toBe("admin");
    });

    test("updates existing config document", async () => {
      // Create initial config
      await SystemConfig.updateBundleDiscountConfig(
        {
          enabled: true,
          discountAmount: 5000,
          expiryDays: 30,
        },
        "admin1"
      );

      // Update it
      const updated = await SystemConfig.updateBundleDiscountConfig(
        {
          enabled: false,
          discountAmount: 10000,
          expiryDays: 60,
        },
        "admin2"
      );

      expect(updated.value).toMatchObject({
        enabled: false,
        discountAmount: 10000,
        expiryDays: 60,
      });
      expect(updated.updatedBy).toBe("admin2");

      // Verify only one document exists
      const count = await SystemConfig.countDocuments({
        key: "bundle_discount_config",
      });
      expect(count).toBe(1);
    });

    test("tracks updatedBy field", async () => {
      const config = await SystemConfig.updateBundleDiscountConfig(
        {
          enabled: true,
          discountAmount: 5000,
          expiryDays: 30,
        },
        "specific-admin"
      );

      expect(config.updatedBy).toBe("specific-admin");
    });
  });

  // ============================================================================
  // PROMOCODE MODEL - Instance Methods
  // ============================================================================

  describe("PromoCode Model - canBeUsedForProgram()", () => {
    test("returns valid for bundle_discount code with no restrictions", async () => {
      const user = await User.create({
        username: "user1",
        firstName: "User",
        lastName: "One",
        email: "user1@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const program = await createTestProgram(user._id);

      const code = await PromoCode.create({
        code: "VALID001",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: user._id,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      const result = code.canBeUsedForProgram(program._id);
      expect(result.valid).toBe(true);
    });

    test("returns invalid for expired code", async () => {
      const user = await User.create({
        username: "user1",
        firstName: "User",
        lastName: "One",
        email: "user1@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const program = await createTestProgram(user._id);

      const code = new PromoCode({
        code: "EXPIRED3",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: user._id,
        isActive: true,
        isUsed: false,
        expiresAt: new Date("2020-01-01"),
        createdBy: "system",
      });
      await code.save({ validateBeforeSave: false });

      const result = code.canBeUsedForProgram(program._id);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("expired");
    });

    test("returns invalid for staff_access code with wrong program", async () => {
      const user = await User.create({
        username: "user1",
        firstName: "User",
        lastName: "One",
        email: "user1@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const allowedProgram = await createTestProgram(user._id);

      const notAllowedProgram = await createTestProgram(user._id);

      const code = await PromoCode.create({
        code: "STAFF002",
        type: "staff_access",
        discountPercent: 100,
        ownerId: user._id,
        allowedProgramIds: [allowedProgram._id],
        applicableToType: "program",
        isActive: true,
        isUsed: false,
        createdBy: "admin",
      });

      const result = code.canBeUsedForProgram(notAllowedProgram._id);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("not valid for this program");
    });
  });

  describe("PromoCode Model - markAsUsed()", () => {
    test("marks code as used and records usage details", async () => {
      const user = await User.create({
        username: "user1",
        firstName: "User",
        lastName: "One",
        email: "user1@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const program = await createTestProgram(user._id);

      const code = await PromoCode.create({
        code: "MARK0001",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: user._id,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      const updated = await code.markAsUsed(program._id);

      expect(updated.isUsed).toBe(true);
      expect(updated.usedAt).toBeDefined();
      expect(updated.usedForProgramId?.toString()).toBe(program._id.toString());

      // Verify persisted
      const reloaded = await PromoCode.findById(code._id);
      expect(reloaded!.isUsed).toBe(true);
    });
  });

  describe("PromoCode Model - deactivate()", () => {
    test("deactivates code", async () => {
      const user = await User.create({
        username: "user1",
        firstName: "User",
        lastName: "One",
        email: "user1@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const code = await PromoCode.create({
        code: "DEACT003",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: user._id,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      const updated = await code.deactivate();

      expect(updated.isActive).toBe(false);

      // Verify persisted
      const reloaded = await PromoCode.findById(code._id);
      expect(reloaded!.isActive).toBe(false);
    });
  });

  describe("PromoCode Model - generateUniqueCode()", () => {
    test("generates 8-character uppercase alphanumeric code", async () => {
      const code = await PromoCode.generateUniqueCode();

      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
    });

    test("generates unique codes", async () => {
      const code1 = await PromoCode.generateUniqueCode();
      const code2 = await PromoCode.generateUniqueCode();

      // While theoretically possible to collide, it's extremely unlikely
      // with 8 characters from 36-character set
      expect(code1).not.toBe(code2);
    });
  });

  describe("PromoCode Model - findValidCodesForUser()", () => {
    test("returns only valid codes for user", async () => {
      const user = await User.create({
        username: "user1",
        firstName: "User",
        lastName: "One",
        email: "user1@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      // Valid code
      await PromoCode.create({
        code: "VALID002",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: user._id,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      // Expired code
      const expiredCode4 = new PromoCode({
        code: "EXPIRED4",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: user._id,
        isActive: true,
        isUsed: false,
        expiresAt: new Date("2020-01-01"),
        createdBy: "system",
      });
      await expiredCode4.save({ validateBeforeSave: false });

      // Used code
      await PromoCode.create({
        code: "USED0003",
        type: "bundle_discount",
        discountAmount: 50,
        ownerId: user._id,
        isActive: true,
        isUsed: true,
        createdBy: "system",
      });

      const validCodes = await PromoCode.findValidCodesForUser(user._id);

      expect(validCodes).toHaveLength(1);
      expect(validCodes[0].code).toBe("VALID002");
    });

    test("filters by programId for staff_access codes", async () => {
      const user = await User.create({
        username: "user1",
        firstName: "User",
        lastName: "One",
        email: "user1@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const program1 = await createTestProgram(user._id);

      const program2 = await createTestProgram(user._id);

      // Code for program1 only
      await PromoCode.create({
        code: "PROG0001",
        type: "staff_access",
        discountPercent: 100,
        ownerId: user._id,
        allowedProgramIds: [program1._id],
        applicableToType: "program",
        isActive: true,
        isUsed: false,
        createdBy: "admin",
      });

      // Code for all programs
      await PromoCode.create({
        code: "ALLPROGS",
        type: "staff_access",
        discountPercent: 100,
        ownerId: user._id,
        isActive: true,
        isUsed: false,
        createdBy: "admin",
      });

      // Query for program1 - should return both
      const codes1 = await PromoCode.findValidCodesForUser(
        user._id,
        program1._id
      );
      expect(codes1).toHaveLength(2);

      // Query for program2 - should return only the "all programs" code
      const codes2 = await PromoCode.findValidCodesForUser(
        user._id,
        program2._id
      );
      expect(codes2).toHaveLength(1);
      expect(codes2[0].code).toBe("ALLPROGS");
    });
  });

  // ============================================================================
  // GENERAL STAFF CODE FEATURES - New Feature Tests
  // ============================================================================

  describe("POST /api/promo-codes/general (Admin) - Create General Code", () => {
    test("creates general staff code successfully", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      const res = await request(app)
        .post("/api/promo-codes/general")
        .set("Authorization", `Bearer ${token}`)
        .send({
          description: "General Staff Access 2025",
          discountPercent: 100,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBeDefined();
      expect(res.body.data.code.type).toBe("staff_access");
      expect(res.body.data.code.discountPercent).toBe(100);
      expect(res.body.data.code.isGeneral).toBe(true);
      expect(res.body.data.code.description).toBe("General Staff Access 2025");
      expect(res.body.data.code.ownerId).toBeUndefined(); // No owner for general codes

      // Verify in database
      const savedCode = await PromoCode.findOne({
        code: res.body.data.code.code,
      });
      expect(savedCode).toBeDefined();
      expect(savedCode!.isGeneral).toBe(true);
      expect(savedCode!.ownerId).toBeUndefined();
    });

    test("creates general code with expiration date", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const expiryDate = new Date("2030-12-31");

      const res = await request(app)
        .post("/api/promo-codes/general")
        .set("Authorization", `Bearer ${token}`)
        .send({
          description: "Temporary General Code",
          discountPercent: 50,
          expiresAt: expiryDate.toISOString(),
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.code.expiresAt).toBeDefined();
      expect(new Date(res.body.data.code.expiresAt).toISOString()).toBe(
        expiryDate.toISOString()
      );
    });

    test("validates required description field", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      await request(app)
        .post("/api/promo-codes/general")
        .set("Authorization", `Bearer ${token}`)
        .send({
          discountPercent: 100,
        })
        .expect(400);
    });

    test("validates discount percent range", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      // Below minimum
      await request(app)
        .post("/api/promo-codes/general")
        .set("Authorization", `Bearer ${token}`)
        .send({
          description: "Test",
          discountPercent: -10,
        })
        .expect(400);

      // Above maximum
      await request(app)
        .post("/api/promo-codes/general")
        .set("Authorization", `Bearer ${token}`)
        .send({
          description: "Test",
          discountPercent: 150,
        })
        .expect(400);
    });

    test("requires admin role", async () => {
      const { token } = await createAndLoginTestUser({ role: "Participant" });

      await request(app)
        .post("/api/promo-codes/general")
        .set("Authorization", `Bearer ${token}`)
        .send({
          description: "Test",
          discountPercent: 100,
        })
        .expect(403);
    });

    test("requires authentication", async () => {
      await request(app)
        .post("/api/promo-codes/general")
        .send({
          description: "Test",
          discountPercent: 100,
        })
        .expect(401);
    });
  });

  describe("General Code Reusability", () => {
    test("allows general code to be used multiple times by different users", async () => {
      const admin = await createAndLoginTestUser({ role: "Administrator" });

      // Create general code
      const generalCode = await PromoCode.create({
        code: "GENERAL1",
        type: "staff_access",
        discountPercent: 100,
        isGeneral: true,
        description: "General Staff Code",
        isActive: true,
        createdBy: "admin",
      });

      // Create two users
      const user1 = await User.create({
        username: "user1",
        firstName: "User",
        lastName: "One",
        email: "user1@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const user2 = await User.create({
        username: "user2",
        firstName: "User",
        lastName: "Two",
        email: "user2@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "female",
        isAtCloudLeader: false,
      });

      const program = await createTestProgram(admin.userId);

      // User 1 uses the code
      await generalCode.markAsUsed(
        program._id,
        user1._id,
        `${user1.firstName} ${user1.lastName}`,
        user1.email,
        "Test Program"
      );

      // Verify code is still usable (not marked as used)
      let reloaded = await PromoCode.findById(generalCode._id);
      expect(reloaded!.isUsed).toBe(false);
      expect(reloaded!.usageHistory).toHaveLength(1);

      // User 2 uses the same code
      await generalCode.markAsUsed(
        program._id,
        user2._id,
        `${user2.firstName} ${user2.lastName}`,
        user2.email,
        "Test Program"
      );

      // Verify both usages are tracked
      reloaded = await PromoCode.findById(generalCode._id);
      expect(reloaded!.isUsed).toBe(false);
      expect(reloaded!.usageHistory).toHaveLength(2);
      expect(reloaded!.usageHistory?.[0]?.userId.toString()).toBe(
        user1._id.toString()
      );
      expect(reloaded!.usageHistory?.[1]?.userId.toString()).toBe(
        user2._id.toString()
      );
    });

    test("allows same user to use general code for different programs", async () => {
      const { userId } = await createAndLoginTestUser();

      const generalCode = await PromoCode.create({
        code: "GENERAL2",
        type: "staff_access",
        discountPercent: 100,
        isGeneral: true,
        description: "General Staff Code",
        isActive: true,
        createdBy: "admin",
      });

      const program1 = await createTestProgram(userId, { title: "Program 1" });
      const program2 = await createTestProgram(userId, { title: "Program 2" });

      const user = await User.findById(userId);

      // Use for program 1
      await generalCode.markAsUsed(
        program1._id,
        userId,
        `${user!.firstName} ${user!.lastName}`,
        user!.email,
        "Program 1"
      );

      // Use for program 2
      await generalCode.markAsUsed(
        program2._id,
        userId,
        `${user!.firstName} ${user!.lastName}`,
        user!.email,
        "Program 2"
      );

      // Verify both usages are tracked
      const reloaded = await PromoCode.findById(generalCode._id);
      expect(reloaded!.usageHistory).toHaveLength(2);
      expect(reloaded!.usageHistory?.[0]?.programId?.toString()).toBe(
        program1._id.toString()
      );
      expect(reloaded!.usageHistory?.[1]?.programId?.toString()).toBe(
        program2._id.toString()
      );
    });

    test("personal codes still become used after first use", async () => {
      const { userId } = await createAndLoginTestUser();
      const program = await createTestProgram(userId);

      const personalCode = await PromoCode.create({
        code: "PERSON01",
        type: "staff_access",
        discountPercent: 100,
        ownerId: userId,
        isGeneral: false, // Personal code
        isActive: true,
        createdBy: "admin",
      });

      const user = await User.findById(userId);

      await personalCode.markAsUsed(
        program._id,
        userId,
        `${user!.firstName} ${user!.lastName}`,
        user!.email,
        "Test Program"
      );

      // Verify personal code is marked as used
      const reloaded = await PromoCode.findById(personalCode._id);
      expect(reloaded!.isUsed).toBe(true);
      expect(reloaded!.usedAt).toBeDefined();
      expect(reloaded!.usageHistory).toHaveLength(0); // Personal codes don't track history
    });
  });

  describe("GET /api/promo-codes/:id/usage-history (Admin)", () => {
    test("returns usage history for general code", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      // Create general code with usage history
      const user1 = await User.create({
        username: "user1",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const user2 = await User.create({
        username: "user2",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "female",
        isAtCloudLeader: false,
      });

      const program = await createTestProgram(user1._id);

      const generalCode = await PromoCode.create({
        code: "GENERAL3",
        type: "staff_access",
        discountPercent: 100,
        isGeneral: true,
        description: "Test General Code",
        isActive: true,
        createdBy: "admin",
      });

      // Add usage history
      await generalCode.markAsUsed(
        program._id,
        user1._id,
        "John Doe",
        "john@example.com",
        "Test Program"
      );

      await generalCode.markAsUsed(
        program._id,
        user2._id,
        "Jane Smith",
        "jane@example.com",
        "Test Program"
      );

      const res = await request(app)
        .get(`/api/promo-codes/${generalCode._id}/usage-history`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.usageHistory).toHaveLength(2);
      expect(res.body.data.usageHistory[0].userName).toBe("John Doe");
      expect(res.body.data.usageHistory[0].userEmail).toBe("john@example.com");
      expect(res.body.data.usageHistory[1].userName).toBe("Jane Smith");
      expect(res.body.data.usageHistory[1].userEmail).toBe("jane@example.com");
    });

    test("returns empty array for code with no usage history", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      const generalCode = await PromoCode.create({
        code: "GENERAL4",
        type: "staff_access",
        discountPercent: 100,
        isGeneral: true,
        description: "Unused Code",
        isActive: true,
        createdBy: "admin",
      });

      const res = await request(app)
        .get(`/api/promo-codes/${generalCode._id}/usage-history`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.usageHistory).toEqual([]);
    });

    test("returns 404 for non-existent code", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const fakeId = new mongoose.Types.ObjectId();

      await request(app)
        .get(`/api/promo-codes/${fakeId}/usage-history`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });

    test("requires admin role", async () => {
      const { token } = await createAndLoginTestUser({ role: "Participant" });

      const generalCode = await PromoCode.create({
        code: "GENERAL5",
        type: "staff_access",
        discountPercent: 100,
        isGeneral: true,
        description: "Test",
        isActive: true,
        createdBy: "admin",
      });

      await request(app)
        .get(`/api/promo-codes/${generalCode._id}/usage-history`)
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });

    test("requires authentication", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await request(app)
        .get(`/api/promo-codes/${fakeId}/usage-history`)
        .expect(401);
    });
  });

  describe("Admin Notifications for General Code Usage", () => {
    test("validates general code can be used by any user", async () => {
      const user1 = await createAndLoginTestUser();
      const user2Token = (
        await createAndLoginTestUser({
          username: "user2",
          email: "user2@test.com",
        })
      ).token;

      const program = await createTestProgram(user1.userId);

      // Create general code
      const generalCode = await PromoCode.create({
        code: "GENERAL6",
        type: "staff_access",
        discountPercent: 100,
        isGeneral: true,
        description: "Test General Code",
        isActive: true,
        createdBy: "admin",
      });

      // User 1 validates the code
      const res1 = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${user1.token}`)
        .send({
          code: "GENERAL6",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res1.body.success).toBe(true);
      expect(res1.body.valid).toBe(true);

      // User 2 validates the same code (should also be valid)
      const res2 = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${user2Token}`)
        .send({
          code: "GENERAL6",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res2.body.success).toBe(true);
      expect(res2.body.valid).toBe(true);
    });

    test("general code remains valid after being used", async () => {
      const { token, userId } = await createAndLoginTestUser();
      const program = await createTestProgram(userId);

      const generalCode = await PromoCode.create({
        code: "GENERAL7",
        type: "staff_access",
        discountPercent: 100,
        isGeneral: true,
        description: "Reusable Code",
        isActive: true,
        createdBy: "admin",
      });

      const user = await User.findById(userId);

      // Mark as used
      await generalCode.markAsUsed(
        program._id,
        userId,
        `${user!.firstName} ${user!.lastName}`,
        user!.email,
        "Test Program"
      );

      // Validate again - should still be valid
      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "GENERAL7",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(true);
    });

    test("tracks usage metadata correctly", async () => {
      const { userId } = await createAndLoginTestUser();

      const generalCode = await PromoCode.create({
        code: "GENERAL8",
        type: "staff_access",
        discountPercent: 100,
        isGeneral: true,
        description: "Metadata Test",
        isActive: true,
        createdBy: "admin",
      });

      const program = await createTestProgram(userId, {
        title: "Specific Program Title",
      });

      const user = await User.findById(userId);

      await generalCode.markAsUsed(
        program._id,
        userId,
        `${user!.firstName} ${user!.lastName}`,
        user!.email,
        "Specific Program Title"
      );

      const reloaded = await PromoCode.findById(generalCode._id);
      expect(reloaded!.usageHistory).toHaveLength(1);
      const usage = reloaded!.usageHistory?.[0];
      expect(usage).toBeDefined();

      expect(usage?.userId.toString()).toBe(userId.toString());
      expect(usage?.userName).toBe(`${user!.firstName} ${user!.lastName}`);
      expect(usage?.userEmail).toBe(user!.email);
      expect(usage?.programTitle).toBe("Specific Program Title");
      expect(usage?.programId?.toString()).toBe(program._id.toString());
      expect(usage?.usedAt).toBeDefined();
    });
  });
});
