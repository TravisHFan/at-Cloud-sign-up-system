import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../src/app";
import User from "../../src/models/User";
import Message from "../../src/models/Message";

/**
 * Integration tests for targetRoles filtering in system messages
 *
 * These tests verify that role-based message targeting works correctly:
 * - Messages with targetRoles are only visible to users with matching roles
 * - Messages without targetRoles are visible to everyone
 * - Both system messages page and bell notifications respect targetRoles
 */
describe(
  "System Messages - targetRoles filtering",
  () => {
    let superAdmin: any;
    let superAdminToken: string;
    let admin: any;
    let adminToken: string;
    let leader: any;
    let leaderToken: string;
    let guestExpert: any;
    let guestExpertToken: string;
    let participant: any;
    let participantToken: string;

    beforeEach(async () => {
      // Clean up existing test users and messages
      await User.deleteMany({
        email: {
          $in: [
            "tr_super_admin@test.com",
            "tr_admin@test.com",
            "tr_leader@test.com",
            "tr_guest_expert@test.com",
            "tr_participant@test.com",
          ],
        },
      });
      await Message.deleteMany({
        title: { $regex: /^TR_/ },
      });

      // Create test users for each role
      superAdmin = await User.create({
        email: "tr_super_admin@test.com",
        username: "tr_super_admin",
        firstName: "Super",
        lastName: "Admin",
        password: "Password123!",
        role: "Super Admin",
        isActive: true,
        isVerified: true,
        gender: "male",
      } as any);

      admin = await User.create({
        email: "tr_admin@test.com",
        username: "tr_admin",
        firstName: "Regular",
        lastName: "Admin",
        password: "Password123!",
        role: "Administrator",
        isActive: true,
        isVerified: true,
        gender: "female",
      } as any);

      leader = await User.create({
        email: "tr_leader@test.com",
        username: "tr_leader",
        firstName: "Team",
        lastName: "Leader",
        password: "Password123!",
        role: "Leader",
        isActive: true,
        isVerified: true,
        gender: "male",
      } as any);

      guestExpert = await User.create({
        email: "tr_guest_expert@test.com",
        username: "tr_guest_expert",
        firstName: "Guest",
        lastName: "Expert",
        password: "Password123!",
        role: "Guest Expert",
        isActive: true,
        isVerified: true,
        gender: "female",
      } as any);

      participant = await User.create({
        email: "tr_participant@test.com",
        username: "tr_participant",
        firstName: "Regular",
        lastName: "Participant",
        password: "Password123!",
        role: "Participant",
        isActive: true,
        isVerified: true,
        gender: "male",
      } as any);

      // Login all users
      const superAdminLogin = await request(app).post("/api/auth/login").send({
        emailOrUsername: superAdmin.email,
        password: "Password123!",
      });
      superAdminToken = superAdminLogin.body?.data?.accessToken as string;

      const adminLogin = await request(app)
        .post("/api/auth/login")
        .send({ emailOrUsername: admin.email, password: "Password123!" });
      adminToken = adminLogin.body?.data?.accessToken as string;

      const leaderLogin = await request(app)
        .post("/api/auth/login")
        .send({ emailOrUsername: leader.email, password: "Password123!" });
      leaderToken = leaderLogin.body?.data?.accessToken as string;

      const guestExpertLogin = await request(app).post("/api/auth/login").send({
        emailOrUsername: guestExpert.email,
        password: "Password123!",
      });
      guestExpertToken = guestExpertLogin.body?.data?.accessToken as string;

      const participantLogin = await request(app).post("/api/auth/login").send({
        emailOrUsername: participant.email,
        password: "Password123!",
      });
      participantToken = participantLogin.body?.data?.accessToken as string;
    }, 30000); // 30 second timeout for setup

    describe("System Messages Page (/api/notifications/system)", () => {
      it("should show Participant-only message only to Participants", async () => {
        // Create a message targeted to Participants only
        const createRes = await request(app)
          .post("/api/notifications/system")
          .set("Authorization", `Bearer ${superAdminToken}`)
          .send({
            title: "TR_Participant Only Message",
            content: "This message is only for Participants",
            type: "announcement",
            priority: "medium",
            targetRoles: ["Participant"],
          });

        expect(createRes.status).toBe(201);

        // Participant should see it
        const participantRes = await request(app)
          .get("/api/notifications/system")
          .set("Authorization", `Bearer ${participantToken}`);

        expect(participantRes.status).toBe(200);
        const participantMessages = participantRes.body?.data?.messages || [];
        expect(
          participantMessages.some(
            (m: any) => m.title === "TR_Participant Only Message"
          )
        ).toBe(true);

        // Admin should NOT see it
        const adminRes = await request(app)
          .get("/api/notifications/system")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(adminRes.status).toBe(200);
        const adminMessages = adminRes.body?.data?.messages || [];
        expect(
          adminMessages.some(
            (m: any) => m.title === "TR_Participant Only Message"
          )
        ).toBe(false);

        // Super Admin should NOT see it
        const superAdminRes = await request(app)
          .get("/api/notifications/system")
          .set("Authorization", `Bearer ${superAdminToken}`);

        expect(superAdminRes.status).toBe(200);
        const superAdminMessages = superAdminRes.body?.data?.messages || [];
        expect(
          superAdminMessages.some(
            (m: any) => m.title === "TR_Participant Only Message"
          )
        ).toBe(false);

        // Guest Expert should NOT see it
        const guestExpertRes = await request(app)
          .get("/api/notifications/system")
          .set("Authorization", `Bearer ${guestExpertToken}`);

        expect(guestExpertRes.status).toBe(200);
        const guestExpertMessages = guestExpertRes.body?.data?.messages || [];
        expect(
          guestExpertMessages.some(
            (m: any) => m.title === "TR_Participant Only Message"
          )
        ).toBe(false);
      });

      it("should show Admin-only message only to Super Admin and Administrator", async () => {
        // Create a message targeted to Admins only
        const createRes = await request(app)
          .post("/api/notifications/system")
          .set("Authorization", `Bearer ${superAdminToken}`)
          .send({
            title: "TR_Admin Only Message",
            content: "This message is only for Admins",
            type: "announcement",
            priority: "high",
            targetRoles: ["Super Admin", "Administrator"],
          });

        expect(createRes.status).toBe(201);

        // Super Admin should see it
        const superAdminRes = await request(app)
          .get("/api/notifications/system")
          .set("Authorization", `Bearer ${superAdminToken}`);

        expect(superAdminRes.status).toBe(200);
        const superAdminMessages = superAdminRes.body?.data?.messages || [];
        expect(
          superAdminMessages.some(
            (m: any) => m.title === "TR_Admin Only Message"
          )
        ).toBe(true);

        // Administrator should see it
        const adminRes = await request(app)
          .get("/api/notifications/system")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(adminRes.status).toBe(200);
        const adminMessages = adminRes.body?.data?.messages || [];
        expect(
          adminMessages.some((m: any) => m.title === "TR_Admin Only Message")
        ).toBe(true);

        // Leader should NOT see it
        const leaderRes = await request(app)
          .get("/api/notifications/system")
          .set("Authorization", `Bearer ${leaderToken}`);

        expect(leaderRes.status).toBe(200);
        const leaderMessages = leaderRes.body?.data?.messages || [];
        expect(
          leaderMessages.some((m: any) => m.title === "TR_Admin Only Message")
        ).toBe(false);

        // Participant should NOT see it
        const participantRes = await request(app)
          .get("/api/notifications/system")
          .set("Authorization", `Bearer ${participantToken}`);

        expect(participantRes.status).toBe(200);
        const participantMessages = participantRes.body?.data?.messages || [];
        expect(
          participantMessages.some(
            (m: any) => m.title === "TR_Admin Only Message"
          )
        ).toBe(false);
      });

      it("should show @Cloud co-workers message to Super Admin, Administrator, and Leader", async () => {
        // Create a message targeted to @Cloud co-workers
        const createRes = await request(app)
          .post("/api/notifications/system")
          .set("Authorization", `Bearer ${superAdminToken}`)
          .send({
            title: "TR_@Cloud Co-workers Message",
            content: "This message is for @Cloud staff",
            type: "announcement",
            priority: "medium",
            targetRoles: ["Super Admin", "Administrator", "Leader"],
          });

        expect(createRes.status).toBe(201);

        // Super Admin should see it
        const superAdminRes = await request(app)
          .get("/api/notifications/system")
          .set("Authorization", `Bearer ${superAdminToken}`);

        expect(superAdminRes.status).toBe(200);
        const superAdminMessages = superAdminRes.body?.data?.messages || [];
        expect(
          superAdminMessages.some(
            (m: any) => m.title === "TR_@Cloud Co-workers Message"
          )
        ).toBe(true);

        // Administrator should see it
        const adminRes = await request(app)
          .get("/api/notifications/system")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(adminRes.status).toBe(200);
        const adminMessages = adminRes.body?.data?.messages || [];
        expect(
          adminMessages.some(
            (m: any) => m.title === "TR_@Cloud Co-workers Message"
          )
        ).toBe(true);

        // Leader should see it
        const leaderRes = await request(app)
          .get("/api/notifications/system")
          .set("Authorization", `Bearer ${leaderToken}`);

        expect(leaderRes.status).toBe(200);
        const leaderMessages = leaderRes.body?.data?.messages || [];
        expect(
          leaderMessages.some(
            (m: any) => m.title === "TR_@Cloud Co-workers Message"
          )
        ).toBe(true);

        // Guest Expert should NOT see it
        const guestExpertRes = await request(app)
          .get("/api/notifications/system")
          .set("Authorization", `Bearer ${guestExpertToken}`);

        expect(guestExpertRes.status).toBe(200);
        const guestExpertMessages = guestExpertRes.body?.data?.messages || [];
        expect(
          guestExpertMessages.some(
            (m: any) => m.title === "TR_@Cloud Co-workers Message"
          )
        ).toBe(false);

        // Participant should NOT see it
        const participantRes = await request(app)
          .get("/api/notifications/system")
          .set("Authorization", `Bearer ${participantToken}`);

        expect(participantRes.status).toBe(200);
        const participantMessages = participantRes.body?.data?.messages || [];
        expect(
          participantMessages.some(
            (m: any) => m.title === "TR_@Cloud Co-workers Message"
          )
        ).toBe(false);
      });

      it("should show Guest Expert message only to Guest Experts", async () => {
        // Create a message targeted to Guest Experts
        const createRes = await request(app)
          .post("/api/notifications/system")
          .set("Authorization", `Bearer ${superAdminToken}`)
          .send({
            title: "TR_Guest Expert Message",
            content: "This message is for Guest Experts",
            type: "announcement",
            priority: "medium",
            targetRoles: ["Guest Expert"],
          });

        expect(createRes.status).toBe(201);

        // Guest Expert should see it
        const guestExpertRes = await request(app)
          .get("/api/notifications/system")
          .set("Authorization", `Bearer ${guestExpertToken}`);

        expect(guestExpertRes.status).toBe(200);
        const guestExpertMessages = guestExpertRes.body?.data?.messages || [];
        expect(
          guestExpertMessages.some(
            (m: any) => m.title === "TR_Guest Expert Message"
          )
        ).toBe(true);

        // Admin should NOT see it
        const adminRes = await request(app)
          .get("/api/notifications/system")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(adminRes.status).toBe(200);
        const adminMessages = adminRes.body?.data?.messages || [];
        expect(
          adminMessages.some((m: any) => m.title === "TR_Guest Expert Message")
        ).toBe(false);

        // Participant should NOT see it
        const participantRes = await request(app)
          .get("/api/notifications/system")
          .set("Authorization", `Bearer ${participantToken}`);

        expect(participantRes.status).toBe(200);
        const participantMessages = participantRes.body?.data?.messages || [];
        expect(
          participantMessages.some(
            (m: any) => m.title === "TR_Guest Expert Message"
          )
        ).toBe(false);
      });

      it("should show message without targetRoles to everyone", async () => {
        // Create a message without targetRoles (broadcast to all)
        const createRes = await request(app)
          .post("/api/notifications/system")
          .set("Authorization", `Bearer ${superAdminToken}`)
          .send({
            title: "TR_Broadcast Message",
            content: "This message is for everyone",
            type: "announcement",
            priority: "medium",
          });

        expect(createRes.status).toBe(201);

        // All roles should see it
        const roles = [
          { token: superAdminToken, name: "Super Admin" },
          { token: adminToken, name: "Administrator" },
          { token: leaderToken, name: "Leader" },
          { token: guestExpertToken, name: "Guest Expert" },
          { token: participantToken, name: "Participant" },
        ];

        for (const role of roles) {
          const res = await request(app)
            .get("/api/notifications/system")
            .set("Authorization", `Bearer ${role.token}`);

          expect(res.status).toBe(200);
          const messages = res.body?.data?.messages || [];
          expect(
            messages.some((m: any) => m.title === "TR_Broadcast Message")
          ).toBe(true);
        }
      });
    });

    describe("Bell Notifications (/api/notifications/bell)", () => {
      it("should show Participant-only message in bell only to Participants", async () => {
        // Create a message targeted to Participants only
        const createRes = await request(app)
          .post("/api/notifications/system")
          .set("Authorization", `Bearer ${superAdminToken}`)
          .send({
            title: "TR_Bell Participant Only",
            content: "Bell notification for Participants",
            type: "announcement",
            priority: "medium",
            targetRoles: ["Participant"],
          });

        expect(createRes.status).toBe(201);

        // Participant should see it in bell
        const participantBellRes = await request(app)
          .get("/api/notifications/bell")
          .set("Authorization", `Bearer ${participantToken}`);

        expect(participantBellRes.status).toBe(200);
        const participantBellNotifications =
          participantBellRes.body?.data?.notifications || [];
        expect(
          participantBellNotifications.some(
            (n: any) => n.title === "TR_Bell Participant Only"
          )
        ).toBe(true);

        // Admin should NOT see it in bell
        const adminBellRes = await request(app)
          .get("/api/notifications/bell")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(adminBellRes.status).toBe(200);
        const adminBellNotifications =
          adminBellRes.body?.data?.notifications || [];
        expect(
          adminBellNotifications.some(
            (n: any) => n.title === "TR_Bell Participant Only"
          )
        ).toBe(false);
      });

      it("should show Admin-only message in bell only to Admins", async () => {
        // Create a message targeted to Admins only
        const createRes = await request(app)
          .post("/api/notifications/system")
          .set("Authorization", `Bearer ${superAdminToken}`)
          .send({
            title: "TR_Bell Admin Only",
            content: "Bell notification for Admins",
            type: "announcement",
            priority: "high",
            targetRoles: ["Super Admin", "Administrator"],
          });

        expect(createRes.status).toBe(201);

        // Super Admin should see it in bell
        const superAdminBellRes = await request(app)
          .get("/api/notifications/bell")
          .set("Authorization", `Bearer ${superAdminToken}`);

        expect(superAdminBellRes.status).toBe(200);
        const superAdminBellNotifications =
          superAdminBellRes.body?.data?.notifications || [];
        expect(
          superAdminBellNotifications.some(
            (n: any) => n.title === "TR_Bell Admin Only"
          )
        ).toBe(true);

        // Administrator should see it in bell
        const adminBellRes = await request(app)
          .get("/api/notifications/bell")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(adminBellRes.status).toBe(200);
        const adminBellNotifications =
          adminBellRes.body?.data?.notifications || [];
        expect(
          adminBellNotifications.some(
            (n: any) => n.title === "TR_Bell Admin Only"
          )
        ).toBe(true);

        // Participant should NOT see it in bell
        const participantBellRes = await request(app)
          .get("/api/notifications/bell")
          .set("Authorization", `Bearer ${participantToken}`);

        expect(participantBellRes.status).toBe(200);
        const participantBellNotifications =
          participantBellRes.body?.data?.notifications || [];
        expect(
          participantBellNotifications.some(
            (n: any) => n.title === "TR_Bell Admin Only"
          )
        ).toBe(false);
      });

      it("should show message without targetRoles in bell to everyone", async () => {
        // Create a message without targetRoles
        const createRes = await request(app)
          .post("/api/notifications/system")
          .set("Authorization", `Bearer ${superAdminToken}`)
          .send({
            title: "TR_Bell Broadcast",
            content: "Bell notification for everyone",
            type: "announcement",
            priority: "medium",
          });

        expect(createRes.status).toBe(201);

        // All roles should see it in bell
        const roles = [
          { token: superAdminToken, name: "Super Admin" },
          { token: adminToken, name: "Administrator" },
          { token: leaderToken, name: "Leader" },
          { token: guestExpertToken, name: "Guest Expert" },
          { token: participantToken, name: "Participant" },
        ];

        for (const role of roles) {
          const bellRes = await request(app)
            .get("/api/notifications/bell")
            .set("Authorization", `Bearer ${role.token}`);

          expect(bellRes.status).toBe(200);
          const notifications = bellRes.body?.data?.notifications || [];
          expect(
            notifications.some((n: any) => n.title === "TR_Bell Broadcast")
          ).toBe(true);
        }
      });
    });
  },
  { timeout: 120000 } // 2 minute timeout for the entire test suite
);
