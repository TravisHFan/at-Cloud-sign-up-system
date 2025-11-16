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

describe("PurchaseRetrievalController - GET /api/purchases/:id", () => {
  beforeEach(async () => {
    await ensureIntegrationDB();
    await User.deleteMany({});
    await Purchase.deleteMany({});
    await Program.deleteMany({});
  });

  const createProgram = async (creatorId: any, options: any = {}) => {
    return await Program.create({
      title: options.title || "Test Program",
      programType: "Effective Communication Workshops",
      fullPriceTicket: 9999,
      slug: options.slug || "test-program",
      createdBy: creatorId,
      isPublished: true,
      mentors: options.mentors || [],
    });
  };

  const createPurchase = async (
    userId: any,
    programId: any,
    options: any = {}
  ) => {
    return await Purchase.create({
      userId,
      programId,
      orderNumber: options.orderNumber || "ORD-20250114-12345",
      fullPrice: 9999,
      finalPrice: 9999,
      isClassRep: false,
      isEarlyBird: false,
      classRepDiscount: 0,
      earlyBirdDiscount: 0,
      status: options.status || "completed",
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
  };

  // ========== Authentication Tests ==========
  describe("Authentication", () => {
    it("should return 401 when no token provided", async () => {
      const response = await request(app).get("/api/purchases/123");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should return 401 when invalid token provided", async () => {
      const response = await request(app)
        .get("/api/purchases/123")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  // ========== Success Cases ==========
  describe("Success Cases", () => {
    it("should return purchase details for owner", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const program = await createProgram(user._id);
      const purchase = await createPurchase(user._id, program._id);

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get(`/api/purchases/${purchase._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(purchase._id.toString());
      expect(response.body.data.orderNumber).toBe("ORD-20250114-12345");
    });

    it("should return purchase details for admin", async () => {
      const purchaser = await User.create({
        name: "Purchaser",
        username: "purchaser",
        email: "purchaser@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.ADMINISTRATOR,
        isActive: true,
        isVerified: true,
      });

      const program = await createProgram(purchaser._id);
      const purchase = await createPurchase(purchaser._id, program._id);

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/purchases/${purchase._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(purchase._id.toString());
    });

    it("should return purchase details for super admin", async () => {
      const purchaser = await User.create({
        name: "Purchaser",
        username: "purchaser",
        email: "purchaser@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const superAdmin = await User.create({
        name: "Super Admin",
        username: "superadmin",
        email: "superadmin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const program = await createProgram(purchaser._id);
      const purchase = await createPurchase(purchaser._id, program._id);

      const token = TokenService.generateTokenPair(superAdmin).accessToken;

      const response = await request(app)
        .get(`/api/purchases/${purchase._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(purchase._id.toString());
    });

    it("should return purchase details for program mentor", async () => {
      const purchaser = await User.create({
        name: "Purchaser",
        username: "purchaser",
        email: "purchaser@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const mentor = await User.create({
        name: "Mentor",
        username: "mentor",
        email: "mentor@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const program = await createProgram(purchaser._id, {
        mentors: [
          {
            userId: mentor._id,
            firstName: "Mentor",
            lastName: "User",
            email: "mentor@test.com",
          },
        ],
      });
      const purchase = await createPurchase(purchaser._id, program._id);

      const token = TokenService.generateTokenPair(mentor).accessToken;

      const response = await request(app)
        .get(`/api/purchases/${purchase._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(purchase._id.toString());
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

      const program = await createProgram(user._id, {
        title: "Advanced Workshop",
        slug: "advanced-workshop",
      });
      const purchase = await createPurchase(user._id, program._id);

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get(`/api/purchases/${purchase._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.programId).toBeDefined();
      expect(response.body.data.programId.title).toBe("Advanced Workshop");
      expect(response.body.data.programId.programType).toBe(
        "Effective Communication Workshops"
      );
    });

    it("should return purchases of any status", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const program = await createProgram(user._id);
      const purchase = await createPurchase(user._id, program._id, {
        status: "pending",
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get(`/api/purchases/${purchase._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("pending");
    });
  });

  // ========== Edge Cases ==========
  describe("Edge Cases", () => {
    it("should return 400 for invalid purchase ID format", async () => {
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
        .get("/api/purchases/invalid-id")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid purchase ID.");
    });

    it("should return 404 for non-existent purchase", async () => {
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
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/purchases/${fakeId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Purchase not found.");
    });

    it("should return 403 when user is not owner, admin, or mentor", async () => {
      const purchaser = await User.create({
        name: "Purchaser",
        username: "purchaser",
        email: "purchaser@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const otherUser = await User.create({
        name: "Other User",
        username: "otheruser",
        email: "other@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const program = await createProgram(purchaser._id);
      const purchase = await createPurchase(purchaser._id, program._id);

      const token = TokenService.generateTokenPair(otherUser).accessToken;

      const response = await request(app)
        .get(`/api/purchases/${purchase._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Access denied.");
    });

    it("should deny access to program host who is not a mentor", async () => {
      const purchaser = await User.create({
        name: "Purchaser",
        username: "purchaser",
        email: "purchaser@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const host = await User.create({
        name: "Host",
        username: "host",
        email: "host@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const program = await createProgram(purchaser._id, {
        hostedBy: "Host Organization",
      });
      const purchase = await createPurchase(purchaser._id, program._id);

      const token = TokenService.generateTokenPair(host).accessToken;

      const response = await request(app)
        .get(`/api/purchases/${purchase._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("should allow mentor access even if not owner", async () => {
      const purchaser = await User.create({
        name: "Purchaser",
        username: "purchaser",
        email: "purchaser@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const mentor1 = await User.create({
        name: "Mentor 1",
        username: "mentor1",
        email: "mentor1@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const mentor2 = await User.create({
        name: "Mentor 2",
        username: "mentor2",
        email: "mentor2@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const program = await createProgram(purchaser._id, {
        mentors: [
          {
            userId: mentor1._id,
            firstName: "Mentor",
            lastName: "One",
          },
          {
            userId: mentor2._id,
            firstName: "Mentor",
            lastName: "Two",
          },
        ],
      });
      const purchase = await createPurchase(purchaser._id, program._id);

      const token = TokenService.generateTokenPair(mentor2).accessToken;

      const response = await request(app)
        .get(`/api/purchases/${purchase._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(purchase._id.toString());
    });

    it("should handle program without mentors array", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      // Create program without mentors field
      const program = await Program.create({
        title: "No Mentors Program",
        programType: "Effective Communication Workshops",
        fullPriceTicket: 9999,
        slug: "no-mentors",
        createdBy: user._id,
        isPublished: true,
        // No mentors field
      });

      const purchase = await createPurchase(user._id, program._id);
      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get(`/api/purchases/${purchase._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ========== Response Format ==========
  describe("Response Format", () => {
    it("should have correct success response structure", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const program = await createProgram(user._id);
      const purchase = await createPurchase(user._id, program._id);
      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get(`/api/purchases/${purchase._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("data");
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it("should have correct error response structure", async () => {
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
        .get("/api/purchases/invalid-id")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("message");
      expect(response.body.success).toBe(false);
      expect(typeof response.body.message).toBe("string");
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

      const program = await createProgram(user._id);
      const purchase = await createPurchase(user._id, program._id);
      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get(`/api/purchases/${purchase._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty("message");
    });
  });
});
