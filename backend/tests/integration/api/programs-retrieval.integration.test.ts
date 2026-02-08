/**
 * Integration Tests for Programs Retrieval Controller
 * Tests GET /api/programs/:id endpoint
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../../src/app";
import { Program, Purchase, User } from "../../../src/models";
import { ensureIntegrationDB } from "../setup/connect";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";

describe("Programs Retrieval API Integration Tests", () => {
  let testProgramId: string;

  beforeAll(async () => {
    await ensureIntegrationDB();
  });

  afterEach(async () => {
    await Program.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("GET /api/programs/:id", () => {
    describe("Successful Retrieval", () => {
      it("should successfully retrieve a program by valid ID", async () => {
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Test Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 10000, // $100
          isFree: false,
          createdBy,
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.id).toBe(program._id.toString());
        expect(response.body.data.title).toBe("Test Program");
      });

      it("should return all program fields including optional ones", async () => {
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Complete Program",
          programType: "Marketplace Church Incubator Program (MCIP)",
          hostedBy: "Test Host",
          period: {
            startYear: "2024",
            startMonth: "01",
            endYear: "2024",
            endMonth: "12",
          },
          introduction: "Test introduction",
          flyerUrl: "https://example.com/flyer.jpg",
          earlyBirdDeadline: new Date("2024-12-31"),
          isFree: false,
          fullPriceTicket: 50000, // $500
          classRepDiscount: 5000, // $50
          earlyBirdDiscount: 10000, // $100
          classRepLimit: 3, // Max allowed is 5
          classRepCount: 2,
          createdBy,
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .expect(200);

        const { data } = response.body;
        expect(data.title).toBe("Complete Program");
        expect(data.hostedBy).toBe("Test Host");
        expect(data.period).toBeDefined();
        expect(data.introduction).toBe("Test introduction");
        expect(data.flyerUrl).toBe("https://example.com/flyer.jpg");
        expect(data.fullPriceTicket).toBe(50000);
        expect(data.classRepLimit).toBe(3);
      });

      it("should retrieve free program", async () => {
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Free Program",
          programType: "Effective Communication Workshops",
          fullPriceTicket: 0,
          isFree: true,
          createdBy,
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .expect(200);

        expect(response.body.data.isFree).toBe(true);
        expect(response.body.data.fullPriceTicket).toBe(0);
      });

      it("should retrieve program with mentors", async () => {
        const createdBy = new mongoose.Types.ObjectId();
        const mentorUserId = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Mentored Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 20000,
          createdBy,
          mentors: [
            {
              userId: mentorUserId,
              firstName: "John",
              lastName: "Mentor",
              email: "mentor@test.com",
              gender: "male",
              roleInAtCloud: "Senior Mentor",
            },
          ],
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .expect(200);

        expect(response.body.data.mentors).toBeDefined();
        expect(response.body.data.mentors).toHaveLength(1);
        expect(response.body.data.mentors[0].firstName).toBe("John");
      });

      it("should retrieve program with admin enrollments", async () => {
        const createdBy = new mongoose.Types.ObjectId();
        const adminId = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Program with Admin Enrollments",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 15000,
          createdBy,
          adminEnrollments: {
            mentees: [adminId],
            classReps: [],
          },
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .expect(200);

        expect(response.body.data.adminEnrollments).toBeDefined();
        expect(response.body.data.adminEnrollments.mentees).toHaveLength(1);
      });
    });

    describe("Error Handling", () => {
      it("should return 400 for invalid ObjectId format", async () => {
        const response = await request(app)
          .get("/api/programs/invalid-id")
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/invalid program id/i);
      });

      it("should return 400 for malformed ObjectId", async () => {
        const response = await request(app)
          .get("/api/programs/12345")
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/invalid program id/i);
      });

      it("should return 404 for non-existent program", async () => {
        const nonExistentId = new mongoose.Types.ObjectId();
        const response = await request(app)
          .get(`/api/programs/${nonExistentId}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/program not found/i);
      });

      it("should return 404 for valid but deleted program", async () => {
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "To Be Deleted",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 10000,
          createdBy,
        });

        await Program.findByIdAndDelete(program._id);

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/program not found/i);
      });
    });

    describe("Different Program Types", () => {
      it("should retrieve EMBA Mentor Circles program", async () => {
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "EMBA Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 30000,
          createdBy,
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .expect(200);

        expect(response.body.data.programType).toBe("EMBA Mentor Circles");
      });

      it("should retrieve Effective Communication Workshops program", async () => {
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Communication Workshop",
          programType: "Effective Communication Workshops",
          fullPriceTicket: 5000,
          createdBy,
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .expect(200);

        expect(response.body.data.programType).toBe(
          "Effective Communication Workshops",
        );
      });

      it("should retrieve MCIP program", async () => {
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "MCIP Program",
          programType: "Marketplace Church Incubator Program (MCIP)",
          fullPriceTicket: 25000,
          createdBy,
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .expect(200);

        expect(response.body.data.programType).toBe(
          "Marketplace Church Incubator Program (MCIP)",
        );
      });
    });

    describe("Response Time and Performance", () => {
      it("should respond quickly (< 100ms)", async () => {
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Performance Test",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 10000,
          createdBy,
        });

        const start = Date.now();
        await request(app).get(`/api/programs/${program._id}`).expect(200);
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(100);
      });
    });

    describe("Concurrent Requests", () => {
      it("should handle multiple concurrent requests for same program", async () => {
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Concurrent Test",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 10000,
          createdBy,
        });

        const requests = Array(5)
          .fill(null)
          .map(() => request(app).get(`/api/programs/${program._id}`));

        const responses = await Promise.all(requests);

        responses.forEach((response) => {
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
          expect(response.body.data.id).toBe(program._id.toString());
        });
      });

      it("should handle concurrent requests for different programs", async () => {
        const createdBy = new mongoose.Types.ObjectId();
        const programs = await Promise.all([
          Program.create({
            title: "Program 1",
            programType: "EMBA Mentor Circles",
            fullPriceTicket: 10000,
            createdBy,
          }),
          Program.create({
            title: "Program 2",
            programType: "Effective Communication Workshops",
            fullPriceTicket: 5000,
            createdBy,
          }),
          Program.create({
            title: "Program 3",
            programType: "Marketplace Church Incubator Program (MCIP)",
            fullPriceTicket: 15000,
            createdBy,
          }),
        ]);

        const requests = programs.map((program) =>
          request(app).get(`/api/programs/${program._id}`),
        );

        const responses = await Promise.all(requests);

        responses.forEach((response, index) => {
          expect(response.status).toBe(200);
          expect(response.body.data.title).toBe(programs[index].title);
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle program with minimal required fields", async () => {
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Minimal Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 0,
          isFree: true, // Must be free if price is 0
          createdBy,
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .expect(200);

        expect(response.body.data.title).toBe("Minimal Program");
        expect(response.body.data.fullPriceTicket).toBe(0);
      });

      it("should handle program with maximum pricing values", async () => {
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Max Price Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 100000, // $1000 (max)
          classRepDiscount: 100000,
          earlyBirdDiscount: 100000,
          earlyBirdDeadline: new Date("2024-12-31"), // Required when earlyBirdDiscount > 0
          createdBy,
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .expect(200);

        expect(response.body.data.fullPriceTicket).toBe(100000);
        expect(response.body.data.classRepDiscount).toBe(100000);
        expect(response.body.data.earlyBirdDiscount).toBe(100000);
      });

      it("should handle program with empty mentors array", async () => {
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "No Mentors Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 10000,
          mentors: [],
          createdBy,
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .expect(200);

        expect(response.body.data.mentors).toBeDefined();
        expect(response.body.data.mentors).toHaveLength(0);
      });

      it("should handle program with zero class rep limit (unlimited)", async () => {
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Unlimited Class Reps",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 20000,
          classRepLimit: 0, // Unlimited
          classRepCount: 100, // Can exceed limit when unlimited
          createdBy,
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .expect(200);

        expect(response.body.data.classRepLimit).toBe(0);
        expect(response.body.data.classRepCount).toBe(100);
      });
    });

    describe("Mentor Contact Info Privacy (Server-Side Filtering)", () => {
      let mentorUserId: mongoose.Types.ObjectId;

      beforeAll(() => {
        mentorUserId = new mongoose.Types.ObjectId();
      });

      afterEach(async () => {
        // Clean up purchases and users besides programs
        await Purchase.deleteMany({});
      });

      it("should include mentor email for Administrator users", async () => {
        const admin = await createAndLoginTestUser({ role: "Administrator" });
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Privacy Test Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 10000,
          createdBy,
          mentors: [
            {
              userId: mentorUserId,
              firstName: "John",
              lastName: "Mentor",
              email: "mentor@test.com",
              gender: "male",
            },
          ],
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .set("Authorization", `Bearer ${admin.token}`)
          .expect(200);

        expect(response.body.data.mentors[0].email).toBe("mentor@test.com");
      });

      it("should include mentor email for Super Admin users", async () => {
        const superAdmin = await createAndLoginTestUser({
          role: "Super Admin",
        });
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Privacy Test Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 10000,
          createdBy,
          mentors: [
            {
              userId: mentorUserId,
              firstName: "John",
              lastName: "Mentor",
              email: "mentor@test.com",
              gender: "male",
            },
          ],
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .set("Authorization", `Bearer ${superAdmin.token}`)
          .expect(200);

        expect(response.body.data.mentors[0].email).toBe("mentor@test.com");
      });

      it("should include mentor email for enrolled users (purchased)", async () => {
        const participant = await createAndLoginTestUser({
          role: "Participant",
        });
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Privacy Test Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 10000,
          createdBy,
          mentors: [
            {
              userId: mentorUserId,
              firstName: "John",
              lastName: "Mentor",
              email: "mentor@test.com",
              gender: "male",
            },
          ],
        });

        // Create a completed purchase for the participant
        await Purchase.create({
          userId: participant.userId,
          programId: program._id,
          stripeSessionId: `cs_test_${Date.now()}`,
          stripePaymentIntentId: `pi_test_${Date.now()}`,
          status: "completed",
          fullPrice: 10000,
          finalPrice: 10000,
          purchaseDate: new Date(),
          isClassRep: false,
          isEarlyBird: false,
          orderNumber: `ORD-TEST-${Date.now()}`,
          paymentMethod: {
            type: "card",
            cardBrand: "visa",
            last4: "4242",
            cardholderName: "Test User",
          },
          billingInfo: {
            fullName: "Test User",
            email: "test@test.com",
            address: "123 Test St",
            city: "Test City",
            state: "TS",
            zipCode: "12345",
            country: "US",
          },
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .set("Authorization", `Bearer ${participant.token}`)
          .expect(200);

        expect(response.body.data.mentors[0].email).toBe("mentor@test.com");
      });

      it("should include mentor email for free program users", async () => {
        const participant = await createAndLoginTestUser({
          role: "Participant",
        });
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Free Privacy Test Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 0,
          isFree: true,
          createdBy,
          mentors: [
            {
              userId: mentorUserId,
              firstName: "John",
              lastName: "Mentor",
              email: "mentor@test.com",
              gender: "male",
            },
          ],
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .set("Authorization", `Bearer ${participant.token}`)
          .expect(200);

        expect(response.body.data.mentors[0].email).toBe("mentor@test.com");
      });

      it("should include mentor email for program mentors", async () => {
        const leader = await createAndLoginTestUser({ role: "Leader" });
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Privacy Test Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 10000,
          createdBy,
          mentors: [
            {
              userId: new mongoose.Types.ObjectId(leader.userId),
              firstName: "Leader",
              lastName: "Mentor",
              email: "leader@test.com",
              gender: "male",
            },
            {
              userId: mentorUserId,
              firstName: "John",
              lastName: "Mentor",
              email: "mentor@test.com",
              gender: "male",
            },
          ],
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .set("Authorization", `Bearer ${leader.token}`)
          .expect(200);

        expect(response.body.data.mentors[0].email).toBe("leader@test.com");
        expect(response.body.data.mentors[1].email).toBe("mentor@test.com");
      });

      it("should NOT include mentor email for unauthenticated requests", async () => {
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Privacy Test Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 10000,
          createdBy,
          mentors: [
            {
              userId: mentorUserId,
              firstName: "John",
              lastName: "Mentor",
              email: "mentor@test.com",
              gender: "male",
            },
          ],
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .expect(200);

        expect(response.body.data.mentors[0]).not.toHaveProperty("email");
        expect(response.body.data.mentors[0].firstName).toBe("John");
      });

      it("should NOT include mentor email for non-enrolled Participant", async () => {
        const participant = await createAndLoginTestUser({
          role: "Participant",
        });
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Privacy Test Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 10000,
          createdBy,
          mentors: [
            {
              userId: mentorUserId,
              firstName: "John",
              lastName: "Mentor",
              email: "mentor@test.com",
              gender: "male",
            },
          ],
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .set("Authorization", `Bearer ${participant.token}`)
          .expect(200);

        expect(response.body.data.mentors[0]).not.toHaveProperty("email");
        expect(response.body.data.mentors[0].firstName).toBe("John");
      });

      it("should NOT include mentor email for Leader who is not a mentor of this program", async () => {
        const leader = await createAndLoginTestUser({ role: "Leader" });
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Privacy Test Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 10000,
          createdBy,
          mentors: [
            {
              userId: mentorUserId, // Different from leader's userId
              firstName: "John",
              lastName: "Mentor",
              email: "mentor@test.com",
              gender: "male",
            },
          ],
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .set("Authorization", `Bearer ${leader.token}`)
          .expect(200);

        expect(response.body.data.mentors[0]).not.toHaveProperty("email");
        expect(response.body.data.mentors[0].firstName).toBe("John");
      });

      it("should include mentor email for admin-enrolled user", async () => {
        const admin = await createAndLoginTestUser({ role: "Administrator" });
        const participant = await createAndLoginTestUser({
          role: "Participant",
        });
        const createdBy = new mongoose.Types.ObjectId();
        const program = await Program.create({
          title: "Privacy Test Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 10000,
          createdBy,
          adminEnrollments: {
            mentees: [new mongoose.Types.ObjectId(participant.userId)],
            classReps: [],
          },
          mentors: [
            {
              userId: mentorUserId,
              firstName: "John",
              lastName: "Mentor",
              email: "mentor@test.com",
              gender: "male",
            },
          ],
        });

        const response = await request(app)
          .get(`/api/programs/${program._id}`)
          .set("Authorization", `Bearer ${participant.token}`)
          .expect(200);

        expect(response.body.data.mentors[0].email).toBe("mentor@test.com");
      });
    });
  });
});
