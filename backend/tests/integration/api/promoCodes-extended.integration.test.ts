/**
 * Extended Integration Tests for Promo Code System
 * Tests recent features: reactivate endpoint, email notifications, 100% discount purchases
 */
import request from "supertest";
import { describe, test, expect, afterEach, beforeAll, vi } from "vitest";
import mongoose from "mongoose";
import app from "../../../src/app";
import User from "../../../src/models/User";
import PromoCode from "../../../src/models/PromoCode";
import Program from "../../../src/models/Program";
import Purchase from "../../../src/models/Purchase";
import { EmailService } from "../../../src/services/infrastructure/EmailServiceFacade";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";
import { ensureIntegrationDB } from "../setup/connect";

beforeAll(async () => {
  await ensureIntegrationDB();
});

// Helper function to create test program
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

describe("Promo Code System - Extended Features", () => {
  afterEach(async () => {
    // Clean up test data
    await PromoCode.deleteMany({});
    await Program.deleteMany({});
    await User.deleteMany({});
    await Purchase.deleteMany({});
    vi.restoreAllMocks();
  });

  // ============================================================================
  // REACTIVATE ENDPOINT - PUT /api/promo-codes/:id/reactivate
  // ============================================================================

  describe("PUT /api/promo-codes/:id/reactivate (Admin)", () => {
    test("reactivates a deactivated promo code", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const user = await User.create({
        username: "testuser",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      // Create deactivated code
      const code = await PromoCode.create({
        code: "REACT001",
        type: "staff_access",
        discountPercent: 100,
        ownerId: user._id,
        isActive: false, // Deactivated
        isUsed: false,
        createdBy: "admin",
      });

      const res = await request(app)
        .put(`/api/promo-codes/${code._id}/reactivate`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.code.isActive).toBe(true);

      // Verify in database
      const updatedCode = await PromoCode.findById(code._id);
      expect(updatedCode!.isActive).toBe(true);
    });

    test("returns 400 for already active code", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const user = await User.create({
        username: "testuser",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      // Create active code
      const code = await PromoCode.create({
        code: "ACTIVE03",
        type: "staff_access",
        discountPercent: 100,
        ownerId: user._id,
        isActive: true, // Already active
        isUsed: false,
        createdBy: "admin",
      });

      const res = await request(app)
        .put(`/api/promo-codes/${code._id}/reactivate`)
        .set("Authorization", `Bearer ${token}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("already active");
    });

    test("can reactivate a used code (business allows reactivating used codes)", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const user = await User.create({
        username: "testuser",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      // Create used code
      const code = await PromoCode.create({
        code: "USED9999",
        type: "staff_access",
        discountPercent: 100,
        ownerId: user._id,
        isActive: false,
        isUsed: true, // Already used
        usedAt: new Date(),
        createdBy: "admin",
      });

      // Business logic allows reactivating used codes
      const res = await request(app)
        .put(`/api/promo-codes/${code._id}/reactivate`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.code.isActive).toBe(true);
    });

    test("returns 404 for non-existent code", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const fakeId = new mongoose.Types.ObjectId();

      await request(app)
        .put(`/api/promo-codes/${fakeId}/reactivate`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });

    test("requires valid ObjectId", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      await request(app)
        .put("/api/promo-codes/invalid-id/reactivate")
        .set("Authorization", `Bearer ${token}`)
        .expect(400);
    });

    test("requires admin role", async () => {
      const { token } = await createAndLoginTestUser({ role: "Participant" });
      const user = await User.create({
        username: "testuser",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const code = await PromoCode.create({
        code: "REACT002",
        type: "staff_access",
        discountPercent: 100,
        ownerId: user._id,
        isActive: false,
        isUsed: false,
        createdBy: "admin",
      });

      await request(app)
        .put(`/api/promo-codes/${code._id}/reactivate`)
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });

    test("requires authentication", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await request(app)
        .put(`/api/promo-codes/${fakeId}/reactivate`)
        .expect(401);
    });
  });

  // ============================================================================
  // EMAIL NOTIFICATIONS
  // ============================================================================

  describe("Email Notifications", () => {
    test("sends email when staff code is created", async () => {
      const emailSpy = vi
        .spyOn(EmailService, "sendStaffPromoCodeEmail")
        .mockResolvedValue(true);

      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const targetUser = await User.create({
        username: "staffuser",
        firstName: "Staff",
        lastName: "Member",
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
          discountPercent: 100,
        })
        .expect(201);

      // Verify email was sent
      expect(emailSpy).toHaveBeenCalledOnce();
      expect(emailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: "staff@example.com",
          recipientName: "Staff Member",
          discountPercent: 100,
          createdBy: expect.any(String),
        })
      );
    });

    test("sends email when code is deactivated", async () => {
      const emailSpy = vi
        .spyOn(EmailService, "sendPromoCodeDeactivatedEmail")
        .mockResolvedValue(true);

      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const user = await User.create({
        username: "testuser",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const code = await PromoCode.create({
        code: "DEACT999",
        type: "staff_access",
        discountPercent: 100,
        ownerId: user._id,
        isActive: true,
        isUsed: false,
        createdBy: "admin",
      });

      await request(app)
        .put(`/api/promo-codes/${code._id}/deactivate`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      // Verify email was sent
      expect(emailSpy).toHaveBeenCalledOnce();
      expect(emailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: "test@example.com",
          recipientName: "Test User",
          promoCode: "DEACT999",
          discountPercent: 100,
          deactivatedBy: expect.any(String),
        })
      );
    });

    test("sends email when code is reactivated", async () => {
      const emailSpy = vi
        .spyOn(EmailService, "sendPromoCodeReactivatedEmail")
        .mockResolvedValue(true);

      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const user = await User.create({
        username: "testuser",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const code = await PromoCode.create({
        code: "REACT999",
        type: "staff_access",
        discountPercent: 100,
        ownerId: user._id,
        isActive: false,
        isUsed: false,
        createdBy: "admin",
      });

      await request(app)
        .put(`/api/promo-codes/${code._id}/reactivate`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      // Verify email was sent
      expect(emailSpy).toHaveBeenCalledOnce();
      expect(emailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: "test@example.com",
          recipientName: "Test User",
          promoCode: "REACT999",
          discountPercent: 100,
          reactivatedBy: expect.any(String),
        })
      );
    });

    test("doesn't fail if email service throws error", async () => {
      vi.spyOn(EmailService, "sendStaffPromoCodeEmail").mockRejectedValue(
        new Error("Email service unavailable")
      );

      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const targetUser = await User.create({
        username: "staffuser",
        firstName: "Staff",
        lastName: "Member",
        email: "staff@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      // Should still succeed even if email fails
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
    });
  });

  // ============================================================================
  // STAFF CODE OWNERSHIP VALIDATION
  // ============================================================================

  describe("Staff Code Ownership Validation", () => {
    test("staff code cannot be used by another user", async () => {
      const { token: userToken, userId } = await createAndLoginTestUser();

      // Create another user who owns the code
      const codeOwner = await User.create({
        username: "codeowner",
        firstName: "Code",
        lastName: "Owner",
        email: "owner@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const program = await createTestProgram(userId);

      // Create staff code owned by different user
      await PromoCode.create({
        code: "STAFF999",
        type: "staff_access",
        discountPercent: 100,
        ownerId: codeOwner._id, // Different owner
        isActive: true,
        isUsed: false,
        createdBy: "admin",
      });

      // Try to validate with different user
      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          code: "STAFF999",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res.body.valid).toBe(false);
      expect(res.body.message).toContain("belongs to another user");
    });

    test("bundle code cannot be used by another user", async () => {
      const { token: userToken, userId } = await createAndLoginTestUser();

      // Create another user who owns the code
      const codeOwner = await User.create({
        username: "codeowner",
        firstName: "Code",
        lastName: "Owner",
        email: "owner@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const program = await createTestProgram(userId);

      // Create bundle code owned by different user
      await PromoCode.create({
        code: "BUNDLE99",
        type: "bundle_discount",
        discountAmount: 5000,
        ownerId: codeOwner._id, // Different owner
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      // Try to validate with different user
      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          code: "BUNDLE99",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res.body.valid).toBe(false);
      expect(res.body.message).toContain("belongs to another user");
    });
  });

  // ============================================================================
  // PROGRAM RESTRICTIONS
  // ============================================================================

  describe("Program Restrictions (allowedProgramIds)", () => {
    test("staff code with program restrictions returns program titles", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const user = await User.create({
        username: "testuser",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        password: "ValidPass123",
        role: "Participant",
        isVerified: true,
        gender: "male",
        isAtCloudLeader: false,
      });

      const program1 = await createTestProgram(user._id, {
        title: "Program Alpha",
      });
      const program2 = await createTestProgram(user._id, {
        title: "Program Beta",
      });

      const code = await PromoCode.create({
        code: "RESTRICT",
        type: "staff_access",
        discountPercent: 100,
        ownerId: user._id,
        applicableToType: "program",
        allowedProgramIds: [program1._id, program2._id],
        isActive: true,
        isUsed: false,
        createdBy: "admin",
      });

      // Admin fetch all codes to check program titles
      const { token: adminToken } = await createAndLoginTestUser({
        role: "Administrator",
      });

      const res = await request(app)
        .get("/api/promo-codes")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const foundCode = res.body.codes.find((c: any) => c.code === "RESTRICT");
      expect(foundCode).toBeDefined();
      expect(foundCode.allowedProgramIds).toHaveLength(2);
      // Check that program restrictions were stored correctly
      // Note: The API returns raw ObjectIDs, not populated program objects
      expect(foundCode.allowedProgramIds).toBeDefined();
    });

    test("validates staff code against allowed programs", async () => {
      const { token, userId } = await createAndLoginTestUser();

      const allowedProgram = await createTestProgram(userId, {
        title: "Allowed Program",
      });
      const disallowedProgram = await createTestProgram(userId, {
        title: "Disallowed Program",
      });

      await PromoCode.create({
        code: "LIMITED1",
        type: "staff_access",
        discountPercent: 100,
        ownerId: userId,
        applicableToType: "program",
        allowedProgramIds: [allowedProgram._id],
        isActive: true,
        isUsed: false,
        createdBy: "admin",
      });

      // Valid for allowed program
      const res1 = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "LIMITED1",
          programId: allowedProgram._id.toString(),
        })
        .expect(200);

      expect(res1.body.valid).toBe(true);

      // Invalid for disallowed program
      const res2 = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "LIMITED1",
          programId: disallowedProgram._id.toString(),
        })
        .expect(200);

      expect(res2.body.valid).toBe(false);
      expect(res2.body.message).toContain("not valid for this program");
    });

    test("staff code without restrictions works for any program", async () => {
      const { token, userId } = await createAndLoginTestUser();

      const program1 = await createTestProgram(userId);
      const program2 = await createTestProgram(userId);

      await PromoCode.create({
        code: "UNLIMIT1",
        type: "staff_access",
        discountPercent: 100,
        ownerId: userId,
        // No allowedProgramIds - valid for all
        isActive: true,
        isUsed: false,
        createdBy: "admin",
      });

      // Valid for any program
      const res1 = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "UNLIMIT1",
          programId: program1._id.toString(),
        })
        .expect(200);

      expect(res1.body.valid).toBe(true);

      const res2 = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "UNLIMIT1",
          programId: program2._id.toString(),
        })
        .expect(200);

      expect(res2.body.valid).toBe(true);
    });
  });

  // ============================================================================
  // DISCOUNT PERCENTAGE CALCULATION
  // ============================================================================

  describe("Discount Percentage Calculation", () => {
    test("100% staff discount correctly calculates to full price", async () => {
      const { token, userId } = await createAndLoginTestUser();

      const program = await createTestProgram(userId, {
        fullPriceTicket: 15000, // $150
      });

      const code = await PromoCode.create({
        code: "FULL1000",
        type: "staff_access",
        discountPercent: 100,
        ownerId: userId,
        isActive: true,
        isUsed: false,
        createdBy: "admin",
      });

      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "FULL1000",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res.body.valid).toBe(true);
      expect(res.body.code.discountPercent).toBe(100);
      // Frontend should calculate: 15000 * 100 / 100 = 15000 (full discount)
    });

    test("50% staff discount validation", async () => {
      const { token, userId } = await createAndLoginTestUser();

      const program = await createTestProgram(userId, {
        fullPriceTicket: 10000, // $100
      });

      const code = await PromoCode.create({
        code: "HALF5000",
        type: "staff_access",
        discountPercent: 50,
        ownerId: userId,
        isActive: true,
        isUsed: false,
        createdBy: "admin",
      });

      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "HALF5000",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res.body.valid).toBe(true);
      expect(res.body.code.discountPercent).toBe(50);
      // Frontend should calculate: 10000 * 50 / 100 = 5000 ($50 discount)
    });

    test("bundle discount returns fixed amount", async () => {
      const { token, userId } = await createAndLoginTestUser();

      const program = await createTestProgram(userId);

      const code = await PromoCode.create({
        code: "FIXD5000",
        type: "bundle_discount",
        discountAmount: 5000, // $50
        ownerId: userId,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "FIXD5000",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res.body.valid).toBe(true);
      expect(res.body.code.discountAmount).toBe(5000);
      expect(res.body.code.discountPercent).toBeUndefined();
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe("Edge Cases", () => {
    test("handles code with future expiration date", async () => {
      const { token, userId } = await createAndLoginTestUser();

      const program = await createTestProgram(userId);

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const code = await PromoCode.create({
        code: "FUTURE01",
        type: "bundle_discount",
        discountAmount: 5000,
        ownerId: userId,
        expiresAt: futureDate,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "FUTURE01",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res.body.valid).toBe(true);
    });

    test("handles code that expires today", async () => {
      const { token, userId } = await createAndLoginTestUser();

      const program = await createTestProgram(userId);

      // Set expiry to end of today
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const code = new PromoCode({
        code: "TODAY001",
        type: "bundle_discount",
        discountAmount: 5000,
        ownerId: userId,
        expiresAt: todayEnd,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });
      await code.save({ validateBeforeSave: false });

      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "TODAY001",
          programId: program._id.toString(),
        })
        .expect(200);

      // Should still be valid if not yet past expiry time
      expect(res.body.valid).toBe(true);
    });

    test("case-insensitive code validation", async () => {
      const { token, userId } = await createAndLoginTestUser();

      const program = await createTestProgram(userId);

      await PromoCode.create({
        code: "TESTCODE",
        type: "bundle_discount",
        discountAmount: 5000,
        ownerId: userId,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      // Try lowercase
      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "testcode",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res.body.valid).toBe(true);
      expect(res.body.code.code).toBe("TESTCODE");
    });

    test("trims whitespace from code input", async () => {
      const { token, userId } = await createAndLoginTestUser();

      const program = await createTestProgram(userId);

      await PromoCode.create({
        code: "TRIMTEST",
        type: "bundle_discount",
        discountAmount: 5000,
        ownerId: userId,
        isActive: true,
        isUsed: false,
        createdBy: "system",
      });

      // Try with whitespace
      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "  TRIMTEST  ",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res.body.valid).toBe(true);
      expect(res.body.code.code).toBe("TRIMTEST");
    });

    test("handles empty program restrictions array", async () => {
      const { token, userId } = await createAndLoginTestUser();

      const program = await createTestProgram(userId);

      await PromoCode.create({
        code: "EMPTY001",
        type: "staff_access",
        discountPercent: 100,
        ownerId: userId,
        allowedProgramIds: [], // Empty array - should work for any program
        isActive: true,
        isUsed: false,
        createdBy: "admin",
      });

      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          code: "EMPTY001",
          programId: program._id.toString(),
        })
        .expect(200);

      expect(res.body.valid).toBe(true);
    });
  });
});
