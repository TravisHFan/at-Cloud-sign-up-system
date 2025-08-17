import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../../src/app";
import { socketService } from "../../src/services/infrastructure/SocketService";
import User from "../../src/models/User";

describe("System Messages demotion realtime emission", () => {
  const emitSpy = vi.spyOn(socketService, "emitSystemMessageUpdate");

  beforeEach(async () => {
    emitSpy.mockClear();
    await User.deleteMany({});
  });

  afterEach(async () => {
    emitSpy.mockClear();
    await User.deleteMany({});
  });

  it("emits system_message_update when admin demotes a user (targeted message + admin notices)", async () => {
    // Create a Super Admin performing the demotion
    const admin = await User.create({
      email: "rt_superadmin@example.com",
      username: "rt_superadmin",
      firstName: "Super",
      lastName: "Admin",
      password: "Password123!",
      role: "Super Admin",
      isActive: true,
      isVerified: true,
      gender: "male",
    } as any);

    // Create an Administrator who should receive admin notices
    const otherAdmin = await User.create({
      email: "rt_admin2@example.com",
      username: "rt_admin2",
      firstName: "Admin",
      lastName: "Two",
      password: "Password123!",
      role: "Administrator",
      isActive: true,
      isVerified: true,
      gender: "female",
    } as any);

    // Create a Leader who will be demoted to Participant
    const targetUser = await User.create({
      email: "rt_leader@example.com",
      username: "rt_leader",
      firstName: "Real",
      lastName: "Leader",
      password: "Password123!",
      role: "Leader",
      isActive: true,
      isVerified: true,
      gender: "male",
    } as any);

    // Login the Super Admin
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ emailOrUsername: admin.email, password: "Password123!" });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body?.data?.accessToken as string;

    // Perform demotion: Leader -> Participant
    const res = await request(app)
      .put(`/api/users/${(targetUser as any)._id.toString()}/role`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "Participant" });

    expect(res.status).toBe(200);

    // Expect at least one system_message_update for the target user
    const targetId = (targetUser as any)._id.toString();
    const calls = emitSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    const hasTargetedUpdate = calls.some(
      ([userId, event, payload]) =>
        userId === targetId &&
        event === "message_created" &&
        payload?.message?.title?.includes(
          "Your System Authorization Level Updated"
        )
    );
    expect(hasTargetedUpdate).toBe(true);

    // Optionally, ensure an admin received an admin notice
    const adminNoticeExists = calls.some(
      ([userId, event, payload]) =>
        userId === (otherAdmin as any)._id.toString() &&
        event === "message_created" &&
        payload?.message?.title?.startsWith(
          "User System Authorization Level Change:"
        )
    );
    expect(adminNoticeExists).toBe(true);
  });
});
