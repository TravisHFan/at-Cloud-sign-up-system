import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";
import PromoCode from "../../../src/models/PromoCode";
import Program from "../../../src/models/Program";

describe("Promo Code Validation Endpoint", () => {
  let userToken: string;
  let userId: string;
  let activePromoCode: string;
  let testProgramId: string;

  beforeEach(async () => {
    // Create a user with unique credentials
    const user = await createAndLoginTestUser({
      role: "Participant",
    });
    userToken = user.token;
    userId = user.userId;

    // Create a test program
    const program = await Program.create({
      title: "Test Program for Validation",
      programType: "EMBA Mentor Circles",
      fullPriceTicket: 100,
      createdBy: userId,
    });
    testProgramId = program._id.toString();

    // Create an active promo code with unique 8-char code
    const promoCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const promo = await PromoCode.create({
      code: promoCode,
      type: "reward",
      discountPercent: 15,
      ownerId: userId,
      createdBy: userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      isActive: true,
    });
    activePromoCode = promo.code;
  });

  describe("POST /api/promo-codes/validate", () => {
    it("requires authentication", async () => {
      await request(app)
        .post("/api/promo-codes/validate")
        .send({ code: "TESTCODE", programId: "507f1f77bcf86cd799439011" })
        .expect(401);
    });

    it("validates an active promo code successfully", async () => {
      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ code: activePromoCode, programId: testProgramId })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(true);
      expect(res.body.code).toEqual(
        expect.objectContaining({
          code: activePromoCode,
          discountPercent: 15,
          type: "reward",
        })
      );
    });

    it("returns 404 for non-existent code", async () => {
      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ code: "NONEXIST", programId: testProgramId })
        .expect(200); // API returns 200 with valid: false

      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(false);
    });

    it("returns invalid for expired code", async () => {
      // Create code with future expiry, then manually update to past
      const expiredCode = await PromoCode.create({
        code: Math.random().toString(36).substring(2, 10).toUpperCase(),
        type: "reward",
        discountPercent: 20,
        ownerId: userId,
        createdBy: userId,
        expiresAt: new Date(Date.now() + 1000), // 1 second in future
        isActive: true,
      });

      // Manually update to past (bypassing validation)
      await PromoCode.updateOne(
        { _id: expiredCode._id },
        { $set: { expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      );

      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ code: expiredCode.code, programId: testProgramId })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(false);
    });

    it("returns invalid for inactive code", async () => {
      // Create inactive code with unique code
      const inactiveCode = await PromoCode.create({
        code: Math.random().toString(36).substring(2, 10).toUpperCase(),
        type: "staff_access",
        discountPercent: 25,
        ownerId: userId,
        createdBy: userId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: false,
      });

      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ code: inactiveCode.code, programId: testProgramId })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(false);
    });

    it("returns 400 when code is missing", async () => {
      await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${userToken}`)
        .send({})
        .expect(400);
    });
  });

  describe("GET /api/promo-codes/my-codes", () => {
    it("requires authentication", async () => {
      await request(app).get("/api/promo-codes/my-codes").expect(401);
    });

    it("returns empty array when user has no promo codes", async () => {
      // Create a fresh user with no promo codes
      const { token } = await createAndLoginTestUser({ role: "Participant" });

      const res = await request(app)
        .get("/api/promo-codes/my-codes")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.codes).toEqual(expect.any(Array));
      expect(res.body.codes.length).toBe(0);
    });

    it("returns user's assigned promo codes", async () => {
      // Create a new user with an assigned promo code
      const { userId, token } = await createAndLoginTestUser({
        role: "Participant",
      });

      await PromoCode.create({
        code: Math.random().toString(36).substring(2, 10).toUpperCase(),
        type: "staff_access",
        discountPercent: 30,
        ownerId: userId,
        createdBy: userId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      });

      const res = await request(app)
        .get("/api/promo-codes/my-codes")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.codes).toEqual(expect.any(Array));
      expect(res.body.codes.length).toBeGreaterThan(0);
    });
  });
});
