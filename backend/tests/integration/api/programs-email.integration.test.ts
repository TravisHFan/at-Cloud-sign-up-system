/**
 * Programs Email Endpoint Integration Tests
 *
 * Tests the POST /api/programs/:id/email endpoint for sending emails
 * to program participants (mentors, class reps, mentees)
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { ensureIntegrationDB } from "../setup/connect";
import app from "../../../src/app";
import { User, Program, Purchase } from "../../../src/models";
import { TokenService } from "../../../src/middleware/auth";

describe("Programs Email Endpoint Integration", () => {
  let adminUser: any;
  let leaderUser: any;
  let regularUser: any;
  let adminToken: string;
  let leaderToken: string;
  let regularUserToken: string;
  let testProgram: any;

  beforeAll(async () => {
    await ensureIntegrationDB();

    // Clean up existing test users
    await User.deleteMany({
      email: { $regex: /prgemail-.*@test\.com/ },
    });

    // Create admin user directly
    adminUser = await User.create({
      username: "prgemail_admin",
      firstName: "Admin",
      lastName: "User",
      email: "prgemail-admin@test.com",
      phone: "1234567890",
      role: "Administrator",
      password: "AdminPass123!",
      isVerified: true,
      isActive: true,
    } as any);
    adminToken = TokenService.generateAccessToken({
      userId: adminUser._id.toString(),
      email: adminUser.email,
      role: adminUser.role,
    });

    // Create leader user
    leaderUser = await User.create({
      username: "prgemail_leader",
      firstName: "Leader",
      lastName: "User",
      email: "prgemail-leader@test.com",
      phone: "1234567891",
      role: "Leader",
      password: "LeaderPass123!",
      isVerified: true,
      isActive: true,
    } as any);
    leaderToken = TokenService.generateAccessToken({
      userId: leaderUser._id.toString(),
      email: leaderUser.email,
      role: leaderUser.role,
    });

    // Create regular user
    regularUser = await User.create({
      username: "prgemail_user",
      firstName: "Regular",
      lastName: "User",
      email: "prgemail-user@test.com",
      phone: "1234567892",
      role: "Participant",
      password: "UserPass123!",
      isVerified: true,
      isActive: true,
    } as any);
    regularUserToken = TokenService.generateAccessToken({
      userId: regularUser._id.toString(),
      email: regularUser.email,
      role: regularUser.role,
    });
  });

  beforeEach(async () => {
    // Clean up test programs and purchases between tests
    await Program.deleteMany({ name: { $regex: /Test Email Program/ } });
    await Purchase.deleteMany({});

    // Create test program with leader as mentor
    testProgram = await Program.create({
      title: `Test Email Program ${Date.now()}`,
      name: `Test Email Program ${Date.now()}`,
      programType: "EMBA Mentor Circles",
      fullPriceTicket: 0,
      description: "Test program for email integration tests",
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      createdBy: adminUser._id,
      isFree: true,
      mentors: [
        {
          userId: leaderUser._id,
          firstName: "Leader",
          lastName: "User",
        },
      ],
    });
  });

  afterAll(async () => {
    await User.deleteMany({
      email: { $regex: /prgemail-.*@test\.com/ },
    });
    await Program.deleteMany({ name: { $regex: /Test Email Program/ } });
    await Purchase.deleteMany({});
  });

  describe("POST /api/programs/:id/email", () => {
    it("should return 401 for unauthenticated requests", async () => {
      const response = await request(app)
        .post(`/api/programs/${testProgram._id}/email`)
        .send({
          subject: "Test Subject",
          bodyHtml: "<p>Test body</p>",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should return 400 for invalid program ID", async () => {
      const response = await request(app)
        .post("/api/programs/invalid-id/email")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          subject: "Test Subject",
          bodyHtml: "<p>Test body</p>",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid program ID");
    });

    it("should return 400 when subject is missing", async () => {
      const response = await request(app)
        .post(`/api/programs/${testProgram._id}/email`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          bodyHtml: "<p>Test body</p>",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Subject and bodyHtml are required");
    });

    it("should return 400 when bodyHtml is missing", async () => {
      const response = await request(app)
        .post(`/api/programs/${testProgram._id}/email`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          subject: "Test Subject",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Subject and bodyHtml are required");
    });

    it("should return 404 for non-existent program", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/programs/${fakeId}/email`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          subject: "Test Subject",
          bodyHtml: "<p>Test body</p>",
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Program not found");
    });

    it("should return 403 for regular participant user", async () => {
      const response = await request(app)
        .post(`/api/programs/${testProgram._id}/email`)
        .set("Authorization", `Bearer ${regularUserToken}`)
        .send({
          subject: "Test Subject",
          bodyHtml: "<p>Test body</p>",
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("must be an admin");
    });

    it("should succeed for admin with no recipients message when no participants", async () => {
      // When no purchase enrollments exist, sending to mentors only should work
      // The program has 1 mentor (leaderUser), so we should get 1 recipient
      const response = await request(app)
        .post(`/api/programs/${testProgram._id}/email`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          subject: "Test Email Subject",
          bodyHtml: "<p>This is a test email body</p>",
          bodyText: "This is a test email body",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Program has 1 mentor (leaderUser) who receives the email
      expect(response.body.message).toMatch(
        /Email sent to \d+\/\d+ recipients/
      );
    });

    it("should allow mentor (leader) to send emails", async () => {
      // leaderUser is already a mentor in testProgram via the mentors array
      const response = await request(app)
        .post(`/api/programs/${testProgram._id}/email`)
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({
          subject: "Test Email from Mentor",
          bodyHtml: "<p>Test email body from mentor</p>",
          includeMentors: true,
          includeClassReps: false,
          includeMentees: false,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it("should send emails when recipients exist", async () => {
      // Create a purchase/enrollment so there's a recipient
      await Purchase.create({
        userId: regularUser._id,
        programId: testProgram._id,
        isClassRep: false,
        isEarlyBird: false,
        status: "completed",
        orderNumber: `TEST-${Date.now()}`,
        purchaseType: "program",
        fullPrice: 0,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        finalPrice: 0,
        billingInfo: {
          fullName: "Regular User",
          email: "prgemail-user@test.com",
        },
        paymentMethod: { type: "card" },
        purchaseDate: new Date(),
      });

      const response = await request(app)
        .post(`/api/programs/${testProgram._id}/email`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          subject: "Test Broadcast Email",
          bodyHtml: "<p>This is a broadcast email to all participants</p>",
          includeMentors: true,
          includeClassReps: true,
          includeMentees: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.recipientCount).toBeGreaterThanOrEqual(1);
      expect(response.body).toHaveProperty("sent");
    });

    it("should filter recipients based on include flags", async () => {
      // Create a mentee (regular user purchase)
      await Purchase.create({
        userId: regularUser._id,
        programId: testProgram._id,
        isClassRep: false,
        isEarlyBird: false,
        status: "completed",
        orderNumber: `TEST-MENTEE-${Date.now()}`,
        purchaseType: "program",
        fullPrice: 0,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        finalPrice: 0,
        billingInfo: {
          fullName: "Regular User",
          email: "prgemail-user@test.com",
        },
        paymentMethod: { type: "card" },
        purchaseDate: new Date(),
      });

      // Send only to mentees, exclude mentors and class reps
      const response = await request(app)
        .post(`/api/programs/${testProgram._id}/email`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          subject: "Mentees Only Email",
          bodyHtml: "<p>This email is for mentees only</p>",
          includeMentors: false,
          includeClassReps: false,
          includeMentees: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it("should allow class rep (leader) to send emails via purchase", async () => {
      // Create a second leader who is a class rep
      const classRepUser = await User.create({
        username: "prgemail_classrep",
        firstName: "ClassRep",
        lastName: "User",
        email: "prgemail-classrep@test.com",
        phone: "1234567893",
        role: "Leader",
        password: "ClassRepPass123!",
        isVerified: true,
        isActive: true,
      } as any);
      const classRepToken = TokenService.generateAccessToken({
        userId: classRepUser._id.toString(),
        email: classRepUser.email,
        role: classRepUser.role,
      });

      // Create a completed class rep purchase for this user
      await Purchase.create({
        userId: classRepUser._id,
        programId: testProgram._id,
        isClassRep: true,
        isEarlyBird: false,
        status: "completed",
        orderNumber: `TEST-CR-${Date.now()}`,
        purchaseType: "program",
        fullPrice: 0,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        finalPrice: 0,
        billingInfo: {
          fullName: "ClassRep User",
          email: "prgemail-classrep@test.com",
        },
        paymentMethod: { type: "card" },
        purchaseDate: new Date(),
      });

      const response = await request(app)
        .post(`/api/programs/${testProgram._id}/email`)
        .set("Authorization", `Bearer ${classRepToken}`)
        .send({
          subject: "Test Email from Class Rep",
          bodyHtml: "<p>Test email body from class rep</p>",
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Cleanup
      await User.deleteOne({ _id: classRepUser._id });
    });

    it("should allow class rep (leader) to send emails via admin enrollment", async () => {
      // Create a second leader who is admin-enrolled as a class rep
      const adminEnrolledCR = await User.create({
        username: "prgemail_admin_cr",
        firstName: "AdminEnrolled",
        lastName: "ClassRep",
        email: "prgemail-admin-cr@test.com",
        phone: "1234567894",
        role: "Leader",
        password: "AdminCRPass123!",
        isVerified: true,
        isActive: true,
      } as any);
      const adminCRToken = TokenService.generateAccessToken({
        userId: adminEnrolledCR._id.toString(),
        email: adminEnrolledCR.email,
        role: adminEnrolledCR.role,
      });

      // Add user to adminEnrollments.classReps
      await Program.findByIdAndUpdate(testProgram._id, {
        $push: { "adminEnrollments.classReps": adminEnrolledCR._id },
      });

      const response = await request(app)
        .post(`/api/programs/${testProgram._id}/email`)
        .set("Authorization", `Bearer ${adminCRToken}`)
        .send({
          subject: "Test Email from Admin-Enrolled Class Rep",
          bodyHtml: "<p>Test email body</p>",
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Cleanup
      await User.deleteOne({ _id: adminEnrolledCR._id });
    });
  });
});
