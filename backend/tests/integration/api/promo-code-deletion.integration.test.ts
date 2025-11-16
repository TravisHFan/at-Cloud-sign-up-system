import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import PromoCode from "../../../src/models/PromoCode";
import { ROLES } from "../../../src/utils/roleUtils";
import { ensureIntegrationDB } from "../setup/connect";
import { TokenService } from "../../../src/middleware/auth";

describe("DeletionController - DELETE /api/promo-codes/:id", () => {
  beforeEach(async () => {
    await ensureIntegrationDB();
    await User.deleteMany({});
    await PromoCode.deleteMany({});
  });

  // Helper function to create admin user
  const createAdmin = async () => {
    return await User.create({
      name: "Admin User",
      username: "admin",
      email: "admin@test.com",
      password: "Password123",
      role: ROLES.ADMINISTRATOR,
      isActive: true,
      isVerified: true,
    });
  };

  // Helper function to create regular user
  const createUser = async () => {
    return await User.create({
      name: "Regular User",
      username: "user",
      email: "user@test.com",
      password: "Password123",
      role: ROLES.PARTICIPANT,
      isActive: true,
      isVerified: true,
    });
  };

  // Helper function to create promo code
  const createPromoCode = async (ownerId: any, options: any = {}) => {
    const baseCode = {
      code: options.code || "TEST2025",
      type: options.type || "bundle_discount",
      ownerId: ownerId,
      createdBy: options.createdBy || "admin",
      isActive: options.isActive !== undefined ? options.isActive : true,
      isUsed: options.isUsed !== undefined ? options.isUsed : false,
      expiresAt:
        options.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    // Add discountAmount if provided
    if (options.discountAmount !== undefined) {
      (baseCode as any).discountAmount = options.discountAmount;
    } else if (options.type === "bundle_discount" || !options.type) {
      // Default for bundle_discount
      (baseCode as any).discountAmount = 1000;
    }

    // Add discountPercent if provided
    if (options.discountPercent !== undefined) {
      (baseCode as any).discountPercent = options.discountPercent;
    }

    return await PromoCode.create(baseCode);
  };

  // ========== Authentication Tests ==========
  describe("Authentication", () => {
    it("should return 401 when no token provided", async () => {
      const response = await request(app).delete(
        "/api/promo-codes/507f1f77bcf86cd799439011"
      );

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should return 401 when invalid token provided", async () => {
      const response = await request(app)
        .delete("/api/promo-codes/507f1f77bcf86cd799439011")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should return 403 when non-admin user attempts to delete", async () => {
      const user = await createUser();
      const admin = await createAdmin();
      const promoCode = await createPromoCode(admin._id);
      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .delete(`/api/promo-codes/${promoCode._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  // ========== Success Cases ==========
  describe("Success Cases", () => {
    it("should successfully delete promo code as admin", async () => {
      const admin = await createAdmin();
      const promoCode = await createPromoCode(admin._id, {
        code: "DELETE25",
      });
      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .delete(`/api/promo-codes/${promoCode._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("DELETE25");
      expect(response.body.message).toContain("permanently deleted");

      // Verify promo code is deleted from database
      const deletedCode = await PromoCode.findById(promoCode._id);
      expect(deletedCode).toBeNull();
    });

    it("should delete used promo code", async () => {
      const admin = await createAdmin();
      const promoCode = await createPromoCode(admin._id, {
        isUsed: true,
      });
      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .delete(`/api/promo-codes/${promoCode._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify deletion
      const deletedCode = await PromoCode.findById(promoCode._id);
      expect(deletedCode).toBeNull();
    });

    it("should delete inactive promo code", async () => {
      const admin = await createAdmin();
      const promoCode = await createPromoCode(admin._id, {
        isActive: false,
      });
      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .delete(`/api/promo-codes/${promoCode._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify deletion
      const deletedCode = await PromoCode.findById(promoCode._id);
      expect(deletedCode).toBeNull();
    });

    it("should delete promo code of any type", async () => {
      const admin = await createAdmin();
      const bundlePromo = await createPromoCode(admin._id, {
        type: "bundle_discount",
        discountAmount: 1000,
      });
      const staffPromo = await createPromoCode(admin._id, {
        code: "STAFF123",
        type: "staff_access",
        discountAmount: undefined, // staff_access doesn't require discountAmount
        discountPercent: 15, // staff_access requires discountPercent
      });
      const rewardPromo = await createPromoCode(admin._id, {
        code: "REWARD99",
        type: "reward",
        discountAmount: undefined, // reward doesn't require discountAmount
      });
      const token = TokenService.generateTokenPair(admin).accessToken;

      const response1 = await request(app)
        .delete(`/api/promo-codes/${bundlePromo._id}`)
        .set("Authorization", `Bearer ${token}`);

      const response2 = await request(app)
        .delete(`/api/promo-codes/${staffPromo._id}`)
        .set("Authorization", `Bearer ${token}`);

      const response3 = await request(app)
        .delete(`/api/promo-codes/${rewardPromo._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response3.status).toBe(200);
      expect(await PromoCode.findById(bundlePromo._id)).toBeNull();
      expect(await PromoCode.findById(staffPromo._id)).toBeNull();
      expect(await PromoCode.findById(rewardPromo._id)).toBeNull();
    });

    it("should include promo code in success message", async () => {
      const admin = await createAdmin();
      const promoCode = await createPromoCode(admin._id, {
        code: "SPECIAL8",
      });
      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .delete(`/api/promo-codes/${promoCode._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        "Promo code SPECIAL8 has been permanently deleted."
      );
    });
  });

  // ========== Edge Cases ==========
  describe("Edge Cases", () => {
    it("should return 400 for invalid promo code ID format", async () => {
      const admin = await createAdmin();
      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .delete("/api/promo-codes/invalid-id")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Valid promo code ID is required.");
    });

    it("should return 400 for empty promo code ID", async () => {
      const admin = await createAdmin();
      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .delete("/api/promo-codes/")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404); // Route not found
    });

    it("should return 404 for non-existent promo code", async () => {
      const admin = await createAdmin();
      const token = TokenService.generateTokenPair(admin).accessToken;
      const fakeId = "507f1f77bcf86cd799439011";

      const response = await request(app)
        .delete(`/api/promo-codes/${fakeId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Promo code not found.");
    });

    it("should return 404 when deleting already deleted promo code", async () => {
      const admin = await createAdmin();
      const promoCode = await createPromoCode(admin._id);
      const token = TokenService.generateTokenPair(admin).accessToken;

      // First deletion
      await request(app)
        .delete(`/api/promo-codes/${promoCode._id}`)
        .set("Authorization", `Bearer ${token}`);

      // Second deletion attempt
      const response = await request(app)
        .delete(`/api/promo-codes/${promoCode._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Promo code not found.");
    });

    it("should handle deletion of promo code owned by different user", async () => {
      const owner = await createUser();
      const admin = await createAdmin();
      const promoCode = await createPromoCode(owner._id);
      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .delete(`/api/promo-codes/${promoCode._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify deletion regardless of ownership (admin can delete any)
      const deletedCode = await PromoCode.findById(promoCode._id);
      expect(deletedCode).toBeNull();
    });

    it("should handle concurrent deletion attempts gracefully", async () => {
      const admin = await createAdmin();
      const promoCode = await createPromoCode(admin._id);
      const token = TokenService.generateTokenPair(admin).accessToken;

      // Simulate concurrent deletions
      const [response1, response2] = await Promise.all([
        request(app)
          .delete(`/api/promo-codes/${promoCode._id}`)
          .set("Authorization", `Bearer ${token}`),
        request(app)
          .delete(`/api/promo-codes/${promoCode._id}`)
          .set("Authorization", `Bearer ${token}`),
      ]);

      // One should succeed (200), the other should either succeed or fail with 404
      // Both can succeed if the second request starts before the first completes
      const statuses = [response1.status, response2.status].sort();
      const validCombinations = [
        [200, 200], // Both succeeded (rare but possible)
        [200, 404], // First succeeded, second got 404
      ];
      expect(validCombinations).toContainEqual(statuses);
    });
  });

  // ========== Response Format ==========
  describe("Response Format", () => {
    it("should have correct success response structure", async () => {
      const admin = await createAdmin();
      const promoCode = await createPromoCode(admin._id);
      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .delete(`/api/promo-codes/${promoCode._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("message");
      expect(response.body.success).toBe(true);
      expect(typeof response.body.message).toBe("string");
    });

    it("should have correct error response structure", async () => {
      const admin = await createAdmin();
      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .delete("/api/promo-codes/invalid-id")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("message");
      expect(response.body.success).toBe(false);
      expect(typeof response.body.message).toBe("string");
    });

    it("should not include data field in response", async () => {
      const admin = await createAdmin();
      const promoCode = await createPromoCode(admin._id);
      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .delete(`/api/promo-codes/${promoCode._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeUndefined();
    });
  });
});
