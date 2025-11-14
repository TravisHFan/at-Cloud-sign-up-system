import { describe, it, expect } from "vitest";
import supertest from "supertest";
import app from "../../../src/app";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";

const request = supertest(app);

describe("Donations Receipt API Integration Tests", () => {
  describe("GET /api/donations/receipt", () => {
    describe("Authentication", () => {
      it("should return 401 if not authenticated", async () => {
        const response = await request.get("/api/donations/receipt");
        expect(response.status).toBe(401);
      });

      it("should return receipt data for authenticated user", async () => {
        const { token } = await createAndLoginTestUser({ role: "Participant" });
        const response = await request
          .get("/api/donations/receipt")
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });
    });

    describe("Query Parameters", () => {
      it("should support year parameter", async () => {
        const { token } = await createAndLoginTestUser({ role: "Participant" });
        const response = await request
          .get("/api/donations/receipt")
          .query({ year: 2024 })
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it("should return 400 for invalid year parameter", async () => {
        const { token } = await createAndLoginTestUser({ role: "Participant" });
        const response = await request
          .get("/api/donations/receipt")
          .query({ year: "invalid" })
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(400);
      });
    });
  });

  describe("GET /api/donations/receipt/years", () => {
    describe("Authentication", () => {
      it("should return 401 if not authenticated", async () => {
        const response = await request.get("/api/donations/receipt/years");
        expect(response.status).toBe(401);
      });

      it("should return available years for authenticated user", async () => {
        const { token } = await createAndLoginTestUser({ role: "Participant" });
        const response = await request
          .get("/api/donations/receipt/years")
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(
          expect.objectContaining({
            years: expect.any(Array),
          })
        );
      });

      it("should allow all user roles to access", async () => {
        const { token } = await createAndLoginTestUser({
          role: "Administrator",
        });
        const response = await request
          .get("/api/donations/receipt/years")
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});
