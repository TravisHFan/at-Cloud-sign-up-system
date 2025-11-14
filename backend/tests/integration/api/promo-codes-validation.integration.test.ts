import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";
import PromoCode from "../../../src/models/PromoCode";

describe("Promo Code Validation Endpoint", () => {
  let userToken: string;
  let activePromoCode: string;

  beforeEach(async () => {
    // Create a user with unique credentials
    const uniqueId = Math.random().toString(36).substring(7);
    const user = await createAndLoginTestUser({
      role: "Participant",
    });
    userToken = user.token;

    // Create an active promo code with unique code
    const promoCode = `TEST${uniqueId.toUpperCase()}`;
    const promo = await PromoCode.create({
      code: promoCode,
      type: "Early Bird",
      discountPercent: 15,
      maxUses: 100,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      active: true,
    });
    activePromoCode = promo.code;
  });

  describe("POST /api/promo-codes/validate", () => {
    it("requires authentication", async () => {
      await request(app)
        .post("/api/promo-codes/validate")
        .send({ code: "TESTCODE" })
        .expect(401);
    });

    it("validates an active promo code successfully", async () => {
      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ code: activePromoCode })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(
        expect.objectContaining({
          code: activePromoCode,
          discountPercent: 15,
          type: "Early Bird",
          valid: true,
        })
      );
    });

    it("returns 404 for non-existent code", async () => {
      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ code: "NONEXISTENT" })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it("returns invalid for expired code", async () => {
      // Create expired code
      await PromoCode.create({
        code: "EXPIRED2024",
        type: "Early Bird",
        discountPercent: 20,
        maxUses: 100,
        expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        active: true,
      });

      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ code: "EXPIRED2024" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(false);
    });

    it("returns invalid for inactive code", async () => {
      // Create inactive code
      await PromoCode.create({
        code: "INACTIVE2025",
        type: "Staff Discount",
        discountPercent: 25,
        maxUses: 50,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        active: false,
      });

      const res = await request(app)
        .post("/api/promo-codes/validate")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ code: "INACTIVE2025" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(false);
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
      const res = await request(app)
        .get("/api/promo-codes/my-codes")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(expect.any(Array));
      expect(res.body.data.length).toBe(0);
    });

    it("returns user's assigned promo codes", async () => {
      // Create a new user with an assigned promo code
      const { userId, token } = await createAndLoginTestUser({
        role: "Participant",
      });

      await PromoCode.create({
        code: `USER${Math.random().toString(36).substring(7).toUpperCase()}`,
        type: "Staff Discount",
        discountPercent: 30,
        maxUses: 10,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        active: true,
        assignedTo: userId,
      });

      const res = await request(app)
        .get("/api/promo-codes/my-codes")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(expect.any(Array));
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});
