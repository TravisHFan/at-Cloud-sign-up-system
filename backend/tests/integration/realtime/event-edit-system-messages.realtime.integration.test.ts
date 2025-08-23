import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";
import { EmailRecipientUtils } from "../../../src/utils/emailRecipientUtils";
import { socketService } from "../../../src/services/infrastructure/SocketService";

describe("Event edit -> targeted system_message_update (email-to-ID fallback)", () => {
  const emitSpy = vi.spyOn(socketService, "emitSystemMessageUpdate");
  const unreadSpy = vi.spyOn(socketService, "emitUnreadCountUpdate");

  beforeEach(async () => {
    emitSpy.mockClear();
    unreadSpy.mockClear();
    await User.deleteMany({});
    await (Event as any).deleteMany({});
  });

  afterEach(async () => {
    emitSpy.mockClear();
    unreadSpy.mockClear();
    await User.deleteMany({});
    await (Event as any).deleteMany({});
  });

  it("emits system_message_update to participant resolved by email when editing an event", async () => {
    // Create admin performing the edit
    const admin = await User.create({
      email: "edit_admin@example.com",
      username: "edit_admin",
      firstName: "Edit",
      lastName: "Admin",
      password: "Password123!",
      role: "Administrator",
      isActive: true,
      isVerified: true,
      gender: "male",
    } as any);

    // Create participant who will be targeted via email resolution
    const participant = await User.create({
      email: "p1@example.com",
      username: "p01",
      firstName: "Part",
      lastName: "One",
      password: "Password123!",
      role: "Participant",
      isActive: true,
      isVerified: true,
      emailNotifications: true,
      gender: "female",
    } as any);

    // Login admin
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ emailOrUsername: admin.email, password: "Password123!" });
    expect(loginRes.status).toBe(200);
    const adminToken = loginRes.body?.data?.accessToken as string;

    // Create an event (organizer is admin)
    const event = await Event.create({
      title: "Editable Event",
      description: "Event to be edited",
      date: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10),
      time: "10:00",
      endTime: "12:00",
      location: "Main Hall",
      type: "Conference",
      format: "In-person",
      purpose: "Testing edit notifications",
      organizer: "QA",
      category: "general",
      roles: [
        {
          id: "role-a",
          name: "Role A",
          maxParticipants: 2,
          description: "Test role",
        },
      ],
      createdBy: (admin as any)._id.toString(),
    } as any);

    const eventId = (event as any)._id.toString();

    // Mock participant discovery to return recipient WITHOUT _id (forces email lookup fallback)
    const participantsMock = vi
      .spyOn(EmailRecipientUtils, "getEventParticipants")
      .mockResolvedValue([
        {
          email: "p1@example.com",
          firstName: "Part",
          lastName: "One",
          // no _id on purpose
        } as any,
      ]);

    // Perform an edit
    const res = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Editable Event (Updated)" });

    expect(res.status).toBe(200);
    expect(res.body?.message || res.body?.data?.message).toMatch(/updated/i);
    expect(participantsMock).toHaveBeenCalledWith(eventId);

    const targetId = (participant as any)._id.toString();

    // Helper to wait for a spy call matching a predicate (polling)
    const waitForSpyMatch = async (
      spy: typeof emitSpy | typeof unreadSpy,
      predicate: (args: any[]) => boolean,
      timeoutMs = 2000,
      intervalMs = 50
    ) => {
      const start = Date.now();
      for (;;) {
        if (spy.mock.calls.some((args) => predicate(args))) return;
        if (Date.now() - start > timeoutMs) {
          throw new Error("Timed out waiting for expected socket emission");
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    };

    // Wait for targeted system_message_update emitted to participant resolved by email
    await waitForSpyMatch(
      emitSpy,
      ([userId, eventName, payload]) =>
        userId === targetId &&
        eventName === "message_created" &&
        payload?.message?.title?.startsWith("Event Updated:") &&
        payload?.message?.metadata?.eventId === eventId
    );

    // Wait for unread count update emission for the same user
    await waitForSpyMatch(unreadSpy, ([userId]) => userId === targetId);
  });
});
