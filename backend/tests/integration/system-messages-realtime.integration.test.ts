import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../../src/app";
import { socketService } from "../../src/services/infrastructure/SocketService";
import User from "../../src/models/User";

describe("System Messages realtime emission", () => {
  const emitSpy = vi.spyOn(socketService, "emitSystemMessageUpdate");

  beforeEach(() => {
    emitSpy.mockClear();
  });

  afterEach(() => {
    emitSpy.mockClear();
  });

  it("emits system_message_update when admin creates a broadcast system message", async () => {
    const admin = await User.create({
      email: "rt_admin@example.com",
      username: "rt_admin",
      firstName: "Admin",
      lastName: "User",
      password: "Password123!",
      role: "Administrator",
      isActive: true,
      isVerified: true,
      gender: "male",
    } as any);

    await User.create({
      email: "rt_user@example.com",
      username: "rt_user",
      firstName: "Real",
      lastName: "Time",
      password: "Password123!",
      role: "Participant",
      isActive: true,
      isVerified: true,
      gender: "male",
    } as any);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ emailOrUsername: admin.email, password: "Password123!" });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body?.data?.accessToken as string;

    const res = await request(app)
      .post("/api/notifications/system")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "RT Test",
        content: "Realtime check",
        type: "announcement",
        priority: "medium",
      });

    expect(res.status).toBe(201);
    expect(emitSpy).toHaveBeenCalled();
  });
});
