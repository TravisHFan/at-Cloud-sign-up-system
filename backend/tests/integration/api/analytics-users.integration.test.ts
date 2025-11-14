import { describe, it, expect } from "vitest";
import supertest from "supertest";
import app from "../../../src/app";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";

const request = supertest(app);

describe("Analytics Users API Integration Tests", () => {
  describe("GET /api/analytics/users", () => {
    describe("Authentication & Authorization", () => {
      it("should return 401 if not authenticated", async () => {
        const response = await request.get("/api/analytics/users");
        expect(response.status).toBe(401);
      });

      it("should return 403 for Participant role", async () => {
        const { token } = await createAndLoginTestUser({ role: "Participant" });
        const response = await request
          .get("/api/analytics/users")
          .set("Authorization", `Bearer ${token}`);
        expect(response.status).toBe(403);
      });

      it("should return user analytics for Administrator role", async () => {
        const { token } = await createAndLoginTestUser({
          role: "Administrator",
        });
        const response = await request
          .get("/api/analytics/users")
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(
          expect.objectContaining({
            registrationTrends: expect.any(Array),
            usersByRole: expect.any(Array),
            usersByChurch: expect.any(Array),
            usersByAtCloudStatus: expect.any(Array),
          })
        );
      });

      it("should allow Super Admin to access user analytics", async () => {
        const { token } = await createAndLoginTestUser({ role: "Super Admin" });
        const response = await request
          .get("/api/analytics/users")
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty("registrationTrends");
      });
    });
  });
});
