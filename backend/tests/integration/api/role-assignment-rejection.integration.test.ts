/// <reference types="vitest" />
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import mongoose from "mongoose";
import { createRoleAssignmentRejectionToken } from "../../../src/utils/roleAssignmentRejectionToken";
import { createRegistration } from "../../../tests/test-utils/registrationFactory";
import Registration from "../../../src/models/Registration";

// Provide secret for tests
process.env.ROLE_ASSIGNMENT_REJECTION_SECRET =
  process.env.ROLE_ASSIGNMENT_REJECTION_SECRET || "test-secret";

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

  it("performs happy path rejection and prevents replay", async () => {
    const { registration, user } = await createRegistration();
    const token = createRoleAssignmentRejectionToken({
      assignmentId: registration._id.toString(),
      assigneeId: user._id.toString(),
      expiresInDays: 1,
    });

    // Validate
    const validateRes = await request(app)
      .get("/api/role-assignments/reject/validate")
      .query({ token });
    expect(validateRes.status).toBe(200);
    expect(validateRes.body.event).toBeDefined();
    expect(validateRes.body.role).toBeDefined();

    // Reject
    const rejectRes = await request(app)
      .post("/api/role-assignments/reject/reject")
      .send({ token, note: "Cannot take this role now" });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.status).toBe("rejected");

    // Registration gone
    const stillExists = await Registration.findById(registration._id);
    expect(stillExists).toBeFalsy();

    // Replay validate -> 410
    const replayValidate = await request(app)
      .get("/api/role-assignments/reject/validate")
      .query({ token });
    expect(replayValidate.status).toBe(410);

    // Replay reject -> 410
    const replayReject = await request(app)
      .post("/api/role-assignments/reject/reject")
      .send({ token, note: "Another try" });
    expect(replayReject.status).toBe(410);
  });

  it("returns 410 for tampered token (signature invalid)", async () => {
    const { registration, user } = await createRegistration();
    const token = createRoleAssignmentRejectionToken({
      assignmentId: registration._id.toString(),
      assigneeId: user._id.toString(),
      expiresInDays: 1,
    });
    // Tamper token by flipping a hex char in middle segment (payload) without changing length
    const parts = token.split(".");
    expect(parts.length).toBe(3);
    const payload = parts[1];
    const tamperedPayload =
      payload.slice(0, 5) + (payload[5] === "a" ? "b" : "a") + payload.slice(6);
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const res = await request(app)
      .get("/api/role-assignments/reject/validate")
      .query({ token: tampered });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe("ASSIGNMENT_REJECTION_TOKEN_INVALID");
  });
});
