import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../../src/app";
import {
  createAdminToken,
  createAndLoginTestUser,
} from "../../test-utils/createTestUser";

describe("System scheduler manual trigger (admin)", () => {
  it("POST /api/system/scheduler/manual-trigger executes and returns success", async () => {
    const token = await createAdminToken();

    const res = await request(app)
      .post("/api/system/scheduler/manual-trigger")
      .set("Authorization", `Bearer ${token}`)
      .send()
      .expect(200);

    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("message");
    expect(typeof res.body.message).toBe("string");
  });

  it("POST /api/system/scheduler/manual-trigger returns 401 without token", async () => {
    await request(app)
      .post("/api/system/scheduler/manual-trigger")
      .send()
      .expect(401);
  });

  it("POST /api/system/scheduler/manual-trigger returns 403 for non-admin", async () => {
    const { token } = await createAndLoginTestUser({ role: "Participant" });

    await request(app)
      .post("/api/system/scheduler/manual-trigger")
      .set("Authorization", `Bearer ${token}`)
      .send()
      .expect(403);
  });
});
