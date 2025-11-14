import { describe, it, expect } from "vitest";
import supertest from "supertest";
import app from "../../../src/app";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";

const request = supertest(app);

describe("Donations Admin API Integration Tests", () => {
  describe("GET /api/donations/admin/all", () => {
    describe("Authentication & Authorization", () => {
      it("should return 401 if not authenticated", async () => {
        const response = await request.get("/api/donations/admin/all");
        expect(response.status).toBe(401);
      });

      it("should return 403 for Participant role", async () => {
        const { token } = await createAndLoginTestUser({ role: "Participant" });
        const response = await request
          .get("/api/donations/admin/all")
          .set("Authorization", `Bearer ${token}`);
        expect(response.status).toBe(403);
      });

      it("should return all donations for Administrator role", async () => {
        const { token } = await createAndLoginTestUser({
          role: "Administrator",
        });
        const response = await request
          .get("/api/donations/admin/all")
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(
          expect.objectContaining({
            donations: expect.any(Array),
            pagination: expect.objectContaining({
              page: expect.any(Number),
              totalPages: expect.any(Number),
              total: expect.any(Number),
              limit: expect.any(Number),
            }),
          })
        );
      });

      it("should allow Super Admin to access all donations", async () => {
        const { token } = await createAndLoginTestUser({ role: "Super Admin" });
        const response = await request
          .get("/api/donations/admin/all")
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.donations).toBeInstanceOf(Array);
      });
    });

    describe("Pagination", () => {
      it("should support page parameter", async () => {
        const { token } = await createAndLoginTestUser({
          role: "Administrator",
        });
        const response = await request
          .get("/api/donations/admin/all")
          .query({ page: 1 })
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.data.pagination.page).toBe(1);
      });

      it("should support limit parameter", async () => {
        const { token } = await createAndLoginTestUser({
          role: "Administrator",
        });
        const response = await request
          .get("/api/donations/admin/all")
          .query({ limit: 5 })
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.data.pagination.limit).toBe(5);
      });
    });
  });

  describe("GET /api/donations/admin/stats", () => {
    describe("Authentication & Authorization", () => {
      it("should return 401 if not authenticated", async () => {
        const response = await request.get("/api/donations/admin/stats");
        expect(response.status).toBe(401);
      });

      it("should return 403 for Participant role", async () => {
        const { token } = await createAndLoginTestUser({ role: "Participant" });
        const response = await request
          .get("/api/donations/admin/stats")
          .set("Authorization", `Bearer ${token}`);
        expect(response.status).toBe(403);
      });

      it("should return donation stats for Administrator role", async () => {
        const { token } = await createAndLoginTestUser({
          role: "Administrator",
        });
        const response = await request
          .get("/api/donations/admin/stats")
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });

      it("should allow Super Admin to access donation stats", async () => {
        const { token } = await createAndLoginTestUser({ role: "Super Admin" });
        const response = await request
          .get("/api/donations/admin/stats")
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});
