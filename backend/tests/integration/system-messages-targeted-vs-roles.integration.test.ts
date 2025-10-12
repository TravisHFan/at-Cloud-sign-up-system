import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../src/app";
import User from "../../src/models/User";
import Message from "../../src/models/Message";
import { UnifiedMessageController } from "../../src/controllers/unifiedMessageController";

/**
 * Integration tests to verify that targetRoles filtering doesn't break
 * existing targeted message functionality (auth_level_change, event_role_change, etc.)
 *
 * These are the auto-generated messages that should only be visible to specific users
 * or admins, NOT based on roles but based on being the target user.
 */
describe(
  "System Messages - Targeted vs Role-based filtering",
  () => {
    let admin: any;
    let adminToken: string;
    let participant1: any;
    let participant1Token: string;
    let participant2: any;
    let participant2Token: string;

    beforeEach(async () => {
      // Clean up test users and messages
      await User.deleteMany({
        email: {
          $in: [
            "tvr_admin@test.com",
            "tvr_participant1@test.com",
            "tvr_participant2@test.com",
          ],
        },
      });
      await Message.deleteMany({
        title: { $regex: /^TVR_/ },
      });

      // Create admin
      admin = await User.create({
        email: "tvr_admin@test.com",
        username: "tvr_admin",
        firstName: "Test",
        lastName: "Admin",
        password: "Password123!",
        role: "Administrator",
        isActive: true,
        isVerified: true,
        gender: "male",
      } as any);

      // Create two participants
      participant1 = await User.create({
        email: "tvr_participant1@test.com",
        username: "tvr_participant1",
        firstName: "Participant",
        lastName: "One",
        password: "Password123!",
        role: "Participant",
        isActive: true,
        isVerified: true,
        gender: "female",
      } as any);

      participant2 = await User.create({
        email: "tvr_participant2@test.com",
        username: "tvr_participant2",
        firstName: "Participant",
        lastName: "Two",
        password: "Password123!",
        role: "Participant",
        isActive: true,
        isVerified: true,
        gender: "male",
      } as any);

      // Login all users
      const adminLogin = await request(app)
        .post("/api/auth/login")
        .send({ emailOrUsername: admin.email, password: "Password123!" });
      adminToken = adminLogin.body?.data?.accessToken as string;

      const p1Login = await request(app).post("/api/auth/login").send({
        emailOrUsername: participant1.email,
        password: "Password123!",
      });
      participant1Token = p1Login.body?.data?.accessToken as string;

      const p2Login = await request(app).post("/api/auth/login").send({
        emailOrUsername: participant2.email,
        password: "Password123!",
      });
      participant2Token = p2Login.body?.data?.accessToken as string;
    }, 30000);

    it("should show targeted message (auth_level_change) only to the specific target user, not all users with same role", async () => {
      // Create a targeted auth_level_change message for participant1 only
      // This simulates what happens when a user's role is changed
      const participant1Id = (participant1 as any)._id.toString();

      await UnifiedMessageController.createTargetedSystemMessage(
        {
          title: "TVR_Your Authorization Level Changed",
          content: "Your role has been updated to Participant",
          type: "auth_level_change",
          priority: "high",
        },
        [participant1Id], // Only target participant1
        {
          id: (admin as any)._id.toString(),
          firstName: admin.firstName,
          lastName: admin.lastName,
          username: admin.username,
          avatar: admin.avatar,
          gender: admin.gender,
          authLevel: admin.role,
        }
      );

      // Participant1 should see the message
      const p1Res = await request(app)
        .get("/api/notifications/system")
        .set("Authorization", `Bearer ${participant1Token}`);

      expect(p1Res.status).toBe(200);
      const p1Messages = p1Res.body?.data?.messages || [];
      const p1HasMessage = p1Messages.some(
        (m: any) => m.title === "TVR_Your Authorization Level Changed"
      );
      expect(p1HasMessage).toBe(true);

      // Participant2 should NOT see the message (even though they have the same role)
      const p2Res = await request(app)
        .get("/api/notifications/system")
        .set("Authorization", `Bearer ${participant2Token}`);

      expect(p2Res.status).toBe(200);
      const p2Messages = p2Res.body?.data?.messages || [];
      const p2HasMessage = p2Messages.some(
        (m: any) => m.title === "TVR_Your Authorization Level Changed"
      );
      expect(p2HasMessage).toBe(false);
    });

    it("should show role-based message (with targetRoles) to all users with matching role", async () => {
      // Create a role-based message targeting all Participants
      const createRes = await request(app)
        .post("/api/notifications/system")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "TVR_All Participants Announcement",
          content: "This message is for all Participants",
          type: "announcement",
          priority: "medium",
          targetRoles: ["Participant"],
        });

      expect(createRes.status).toBe(201);

      // Both participant1 and participant2 should see it
      const p1Res = await request(app)
        .get("/api/notifications/system")
        .set("Authorization", `Bearer ${participant1Token}`);

      expect(p1Res.status).toBe(200);
      const p1Messages = p1Res.body?.data?.messages || [];
      const p1HasMessage = p1Messages.some(
        (m: any) => m.title === "TVR_All Participants Announcement"
      );
      expect(p1HasMessage).toBe(true);

      const p2Res = await request(app)
        .get("/api/notifications/system")
        .set("Authorization", `Bearer ${participant2Token}`);

      expect(p2Res.status).toBe(200);
      const p2Messages = p2Res.body?.data?.messages || [];
      const p2HasMessage = p2Messages.some(
        (m: any) => m.title === "TVR_All Participants Announcement"
      );
      expect(p2HasMessage).toBe(true);

      // Admin should NOT see it
      const adminRes = await request(app)
        .get("/api/notifications/system")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(adminRes.status).toBe(200);
      const adminMessages = adminRes.body?.data?.messages || [];
      const adminHasMessage = adminMessages.some(
        (m: any) => m.title === "TVR_All Participants Announcement"
      );
      expect(adminHasMessage).toBe(false);
    });

    it("should show event_role_change targeted message only to specific user", async () => {
      // Create a targeted event_role_change message for participant1
      // This simulates what happens when a user is assigned to an event role
      const participant1Id = (participant1 as any)._id.toString();

      await UnifiedMessageController.createTargetedSystemMessage(
        {
          title: "TVR_New Event Role Assignment",
          content: "You have been assigned as a Workshop Leader",
          type: "event_role_change",
          priority: "high",
          metadata: {
            eventId: "test-event-123",
            roleTitle: "Workshop Leader",
          },
        },
        [participant1Id],
        {
          id: (admin as any)._id.toString(),
          firstName: admin.firstName,
          lastName: admin.lastName,
          username: admin.username,
          avatar: admin.avatar,
          gender: admin.gender,
          authLevel: admin.role,
        }
      );

      // Participant1 should see it
      const p1Res = await request(app)
        .get("/api/notifications/system")
        .set("Authorization", `Bearer ${participant1Token}`);

      expect(p1Res.status).toBe(200);
      const p1Messages = p1Res.body?.data?.messages || [];
      const p1HasMessage = p1Messages.some(
        (m: any) => m.title === "TVR_New Event Role Assignment"
      );
      expect(p1HasMessage).toBe(true);

      // Participant2 should NOT see it
      const p2Res = await request(app)
        .get("/api/notifications/system")
        .set("Authorization", `Bearer ${participant2Token}`);

      expect(p2Res.status).toBe(200);
      const p2Messages = p2Res.body?.data?.messages || [];
      const p2HasMessage = p2Messages.some(
        (m: any) => m.title === "TVR_New Event Role Assignment"
      );
      expect(p2HasMessage).toBe(false);
    });

    it("should correctly handle mix of targeted and role-based messages", async () => {
      const participant1Id = (participant1 as any)._id.toString();

      // Create 3 types of messages:

      // 1. Targeted message for participant1 only
      await UnifiedMessageController.createTargetedSystemMessage(
        {
          title: "TVR_Personal Message for P1",
          content: "This is only for participant 1",
          type: "auth_level_change",
          priority: "high",
        },
        [participant1Id],
        {
          id: (admin as any)._id.toString(),
          firstName: admin.firstName,
          lastName: admin.lastName,
          username: admin.username,
          avatar: admin.avatar,
          gender: admin.gender,
          authLevel: admin.role,
        }
      );

      // 2. Role-based message for all Participants
      await request(app)
        .post("/api/notifications/system")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "TVR_All Participants Message",
          content: "For all Participants",
          type: "announcement",
          priority: "medium",
          targetRoles: ["Participant"],
        });

      // 3. Broadcast message for everyone
      await request(app)
        .post("/api/notifications/system")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "TVR_Everyone Message",
          content: "For everyone",
          type: "announcement",
          priority: "low",
        });

      // Participant1 should see all 3 messages
      const p1Res = await request(app)
        .get("/api/notifications/system")
        .set("Authorization", `Bearer ${participant1Token}`);

      expect(p1Res.status).toBe(200);
      const p1Messages = p1Res.body?.data?.messages || [];
      expect(
        p1Messages.some((m: any) => m.title === "TVR_Personal Message for P1")
      ).toBe(true);
      expect(
        p1Messages.some((m: any) => m.title === "TVR_All Participants Message")
      ).toBe(true);
      expect(
        p1Messages.some((m: any) => m.title === "TVR_Everyone Message")
      ).toBe(true);

      // Participant2 should see 2 messages (role-based + broadcast)
      const p2Res = await request(app)
        .get("/api/notifications/system")
        .set("Authorization", `Bearer ${participant2Token}`);

      expect(p2Res.status).toBe(200);
      const p2Messages = p2Res.body?.data?.messages || [];
      expect(
        p2Messages.some((m: any) => m.title === "TVR_Personal Message for P1")
      ).toBe(false); // Should NOT see targeted message
      expect(
        p2Messages.some((m: any) => m.title === "TVR_All Participants Message")
      ).toBe(true);
      expect(
        p2Messages.some((m: any) => m.title === "TVR_Everyone Message")
      ).toBe(true);

      // Admin should see 1 message (broadcast only)
      const adminRes = await request(app)
        .get("/api/notifications/system")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(adminRes.status).toBe(200);
      const adminMessages = adminRes.body?.data?.messages || [];
      expect(
        adminMessages.some(
          (m: any) => m.title === "TVR_Personal Message for P1"
        )
      ).toBe(false);
      expect(
        adminMessages.some(
          (m: any) => m.title === "TVR_All Participants Message"
        )
      ).toBe(false);
      expect(
        adminMessages.some((m: any) => m.title === "TVR_Everyone Message")
      ).toBe(true);
    });
  },
  { timeout: 120000 }
);
