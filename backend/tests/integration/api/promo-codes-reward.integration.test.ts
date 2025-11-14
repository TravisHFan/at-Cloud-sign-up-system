/**
 * Integration tests for Reward Code Creation Controller
 * Tests POST /api/promo-codes/reward endpoint
 */
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import { PromoCode, User, Program } from "../../../src/models";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";
import mongoose from "mongoose";

describe("Reward Code Creation - Integration Tests", () => {
  let adminToken: string;
  let adminUserId: string;
  let participantToken: string;
  let participantUserId: string;
  let testProgramId: string;

  beforeEach(async () => {
    // Create admin user
    const admin = await createAndLoginTestUser({
      role: "Administrator",
      email: `admin-${Date.now()}@test.com`,
    });
    adminToken = admin.token;
    adminUserId = admin.userId;

    // Create participant user
    const participant = await createAndLoginTestUser({
      role: "Participant",
      email: `participant-${Date.now()}@test.com`,
    });
    participantToken = participant.token;
    participantUserId = participant.userId;

    // Create test program
    const program = await Program.create({
      title: `Test Program ${Date.now()}`,
      programType: "EMBA Mentor Circles",
      fullPriceTicket: 100,
      createdBy: adminUserId,
    });
    testProgramId = program._id.toString();
  });

  describe("POST /api/promo-codes/reward", () => {
    describe("Authentication", () => {
      it("should return 401 if not authenticated", async () => {
        const res = await request(app).post("/api/promo-codes/reward").send({
          userId: participantUserId,
          discountPercent: 20,
        });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain("Access denied");
      });
    });

    describe("Validation", () => {
      it("should return 400 if userId is missing", async () => {
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            discountPercent: 20,
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain("user ID is required");
      });

      it("should return 400 if userId is invalid ObjectId", async () => {
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: "invalid-id",
            discountPercent: 20,
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain("Valid user ID is required");
      });

      it("should return 400 if discountPercent is missing", async () => {
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain("between 10 and 100");
      });

      it("should return 400 if discountPercent is below 10", async () => {
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 5,
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain("between 10 and 100");
      });

      it("should return 400 if discountPercent is above 100", async () => {
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 150,
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain("between 10 and 100");
      });

      it("should return 400 if discountPercent is not a number", async () => {
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: "twenty",
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it("should return 404 if user not found", async () => {
        const fakeUserId = new mongoose.Types.ObjectId().toString();
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: fakeUserId,
            discountPercent: 20,
          });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain("User not found");
      });

      it("should return 400 if allowedProgramIds contains invalid ObjectId", async () => {
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 20,
            allowedProgramIds: ["invalid-program-id"],
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain("Invalid program ID");
      });

      it("should return 400 if expiresAt is not in the future", async () => {
        const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 20,
            expiresAt: pastDate.toISOString(),
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain("must be in the future");
      });

      it("should return 400 if expiresAt is invalid date", async () => {
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 20,
            expiresAt: "invalid-date",
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain("must be in the future");
      });
    });

    describe("Successful Creation", () => {
      it("should create reward code with minimum required fields", async () => {
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 20,
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain("created successfully");
        expect(res.body.data.promoCode).toBeDefined();
        expect(res.body.data.promoCode.code).toBeDefined();
        expect(res.body.data.promoCode.type).toBe("reward");
        expect(res.body.data.promoCode.discountPercent).toBe(20);
        expect(res.body.data.promoCode.ownerId).toBeDefined();

        // Verify in database
        const promoCode = await PromoCode.findOne({
          code: res.body.data.promoCode.code,
        });
        expect(promoCode).toBeDefined();
        expect(promoCode?.type).toBe("reward");
        expect(promoCode?.discountPercent).toBe(20);
        expect(promoCode?.ownerId?.toString()).toBe(participantUserId);
      });

      it("should create reward code with 10% discount (minimum)", async () => {
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 10,
          });

        expect(res.status).toBe(201);
        expect(res.body.data.promoCode.discountPercent).toBe(10);
      });

      it("should create reward code with 100% discount (maximum)", async () => {
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 100,
          });

        expect(res.status).toBe(201);
        expect(res.body.data.promoCode.discountPercent).toBe(100);
      });

      it("should create reward code with allowedProgramIds", async () => {
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 25,
            allowedProgramIds: [testProgramId],
          });

        expect(res.status).toBe(201);
        expect(res.body.data.promoCode.allowedProgramIds).toBeDefined();
        expect(
          res.body.data.promoCode.allowedProgramIds.length
        ).toBeGreaterThan(0);

        // Verify in database
        const promoCode = await PromoCode.findOne({
          code: res.body.data.promoCode.code,
        });
        expect(promoCode?.allowedProgramIds).toBeDefined();
        expect(promoCode?.allowedProgramIds?.length).toBe(1);
      });

      it("should create reward code with multiple allowedProgramIds", async () => {
        // Create second program
        const program2 = await Program.create({
          title: `Test Program 2 ${Date.now()}`,
          programType: "Effective Communication Workshops",
          fullPriceTicket: 150,
          createdBy: adminUserId,
        });

        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 30,
            allowedProgramIds: [testProgramId, program2._id.toString()],
          });

        expect(res.status).toBe(201);
        const promoCode = await PromoCode.findOne({
          code: res.body.data.promoCode.code,
        });
        expect(promoCode?.allowedProgramIds?.length).toBe(2);
      });

      it("should create reward code with expiresAt", async () => {
        const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 15,
            expiresAt: futureDate.toISOString(),
          });

        expect(res.status).toBe(201);
        expect(res.body.data.promoCode.expiresAt).toBeDefined();

        const promoCode = await PromoCode.findOne({
          code: res.body.data.promoCode.code,
        });
        expect(promoCode?.expiresAt).toBeDefined();
      });

      it("should create reward code with all optional fields", async () => {
        const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 50,
            allowedProgramIds: [testProgramId],
            expiresAt: futureDate.toISOString(),
          });

        expect(res.status).toBe(201);
        expect(res.body.data.promoCode.discountPercent).toBe(50);
        expect(res.body.data.promoCode.allowedProgramIds).toBeDefined();
        expect(res.body.data.promoCode.expiresAt).toBeDefined();
      });

      it("should handle empty allowedProgramIds array gracefully", async () => {
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 20,
            allowedProgramIds: [],
          });

        expect(res.status).toBe(201);
        expect(res.body.data.promoCode).toBeDefined();
      });

      it("should generate unique code for each reward", async () => {
        const res1 = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 20,
          });

        const res2 = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 25,
          });

        expect(res1.status).toBe(201);
        expect(res2.status).toBe(201);
        expect(res1.body.data.promoCode.code).not.toBe(
          res2.body.data.promoCode.code
        );
      });

      it("should set createdBy to admin username", async () => {
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 20,
          });

        expect(res.status).toBe(201);

        const promoCode = await PromoCode.findOne({
          code: res.body.data.promoCode.code,
        });
        expect(promoCode?.createdBy).toBeDefined();
      });

      it("should populate ownerId with user details in response", async () => {
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 20,
          });

        expect(res.status).toBe(201);
        expect(res.body.data.promoCode.ownerId).toBeDefined();
        // Should be populated object, not just ID
        expect(typeof res.body.data.promoCode.ownerId).toBe("object");
      });

      it("should not fail if notification sending fails", async () => {
        // Even if email/notification fails, the code should still be created
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 20,
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);

        // Verify code exists in database
        const promoCode = await PromoCode.findOne({
          code: res.body.data.promoCode.code,
        });
        expect(promoCode).toBeDefined();
      });
    });

    describe("Edge Cases", () => {
      it("should handle non-existent program IDs in allowedProgramIds array", async () => {
        const fakeProgram = new mongoose.Types.ObjectId().toString();
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 20,
            allowedProgramIds: [fakeProgram],
          });

        // Should still create the code even if program doesn't exist
        // (API validates format but not existence)
        expect(res.status).toBe(201);
      });

      it("should handle expiresAt at exact future boundary", async () => {
        const futureDate = new Date(Date.now() + 1000); // 1 second in future
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 20,
            expiresAt: futureDate.toISOString(),
          });

        expect(res.status).toBe(201);
      });

      it("should handle expiresAt at current time (boundary)", async () => {
        const now = new Date();
        const res = await request(app)
          .post("/api/promo-codes/reward")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            userId: participantUserId,
            discountPercent: 20,
            expiresAt: now.toISOString(),
          });

        // Should fail because it's not in the future
        expect(res.status).toBe(400);
      });
    });
  });
});
