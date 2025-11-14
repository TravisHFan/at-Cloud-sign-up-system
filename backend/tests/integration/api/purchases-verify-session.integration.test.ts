import { describe, it, expect, beforeAll } from "vitest";
import supertest from "supertest";
import app from "../../../src/app";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";
import Program from "../../../src/models/Program";
import Purchase from "../../../src/models/Purchase";

const request = supertest(app);

describe("Purchase Verify Session API Integration Tests", () => {
  describe("GET /api/purchases/verify-session/:sessionId", () => {
    let participantToken: string;
    let participantUserId: string;
    let programId: string;

    beforeAll(async () => {
      // Create test user
      const participant = await createAndLoginTestUser({
        role: "Participant",
      });
      participantToken = participant.token;
      participantUserId = participant.userId;

      // Create a test program
      const program = await Program.create({
        title: "Test Program for Session Verify",
        description: "Test description",
        price: 100,
        fullPriceTicket: 100,
        programType: "EMBA Mentor Circles",
        isPublished: true,
        church: "Test Church",
        createdBy: participantUserId,
      });
      programId = program._id.toString();
    });

    describe("Authentication", () => {
      it("should return 401 if not authenticated", async () => {
        const response = await request.get(
          "/api/purchases/verify-session/cs_test_fake123"
        );
        expect(response.status).toBe(401);
      });
    });

    describe("Session Validation", () => {
      it("should return 404 for invalid session ID format", async () => {
        const response = await request
          .get("/api/purchases/verify-session/invalid")
          .set("Authorization", `Bearer ${participantToken}`);

        expect(response.status).toBe(404);
      });

      it("should return 404 for non-existent session", async () => {
        const response = await request
          .get("/api/purchases/verify-session/cs_test_nonexistent123456789")
          .set("Authorization", `Bearer ${participantToken}`);

        expect(response.status).toBe(404);
      });
    });

    describe("Successful Verification", () => {
      it("should verify session and return purchase details for completed purchase", async () => {
        // Create a completed purchase with a mock session
        const purchase = await Purchase.create({
          userId: participantUserId,
          programId,
          status: "completed",
          stripeSessionId: "cs_test_verify123",
          stripePaymentIntentId: "pi_test_123",
          paymentMethod: { type: "card", cardBrand: "visa", last4: "4242" },
          finalPrice: 100,
          fullPrice: 100,
          orderNumber: `TEST-${Date.now()}-001`,
          billingInfo: {
            fullName: "Test User",
            email: "test@example.com",
          },
        });

        const response = await request
          .get("/api/purchases/verify-session/cs_test_verify123")
          .set("Authorization", `Bearer ${participantToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(
          expect.objectContaining({
            id: purchase._id.toString(),
            status: "completed",
          })
        );
      });

      it("should handle pending purchases", async () => {
        // Create a pending purchase
        const purchase = await Purchase.create({
          userId: participantUserId,
          programId,
          status: "pending",
          stripeSessionId: "cs_test_pending123",
          paymentMethod: { type: "card", cardBrand: "visa", last4: "4242" },
          finalPrice: 100,
          fullPrice: 100,
          orderNumber: `TEST-${Date.now()}-002`,
          billingInfo: {
            fullName: "Test User",
            email: "test@example.com",
          },
        });

        const response = await request
          .get("/api/purchases/verify-session/cs_test_pending123")
          .set("Authorization", `Bearer ${participantToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe("pending");
      });
    });

    describe("Authorization", () => {
      it("should only allow purchase owner to verify their session", async () => {
        // Create purchase for first user
        const purchase = await Purchase.create({
          userId: participantUserId,
          programId,
          status: "completed",
          stripeSessionId: "cs_test_owner123",
          paymentMethod: { type: "card", cardBrand: "visa", last4: "4242" },
          finalPrice: 100,
          fullPrice: 100,
          orderNumber: `TEST-${Date.now()}-003`,
          billingInfo: {
            fullName: "Test User",
            email: "test@example.com",
          },
        });

        // Try to access with different user
        const otherUser = await createAndLoginTestUser({
          role: "Participant",
        });

        const response = await request
          .get("/api/purchases/verify-session/cs_test_owner123")
          .set("Authorization", `Bearer ${otherUser.token}`);

        // API returns 404 because query filters by userId
        // Non-owners simply don't find the purchase
        expect(response.status).toBe(404);
      });
    });
  });
});
