/// <reference types="vitest" />
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import mongoose from "mongoose";
import { createRoleAssignmentRejectionToken } from "../../../src/utils/roleAssignmentRejectionToken";

describe("Role Assignment Rejection Flow (scaffold)", () => {
  it("returns 410 for missing token on validate", async () => {
    const res = await request(app).get("/api/role-assignments/reject/validate");
    expect(res.status).toBe(410);
    expect(res.body.code).toBe("ASSIGNMENT_REJECTION_TOKEN_INVALID");
  });

  it("enforces NOTE_REQUIRED when note missing on reject", async () => {
    const fakeAssignmentId = new mongoose.Types.ObjectId().toString();
    const fakeAssigneeId = new mongoose.Types.ObjectId().toString();
    const token = createRoleAssignmentRejectionToken({
      assignmentId: fakeAssignmentId,
      assigneeId: fakeAssigneeId,
      expiresInDays: 1,
    });
    const res = await request(app)
      .post("/api/role-assignments/reject/reject")
      .send({ token });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("NOTE_REQUIRED");
  });
});
