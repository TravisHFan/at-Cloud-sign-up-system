import request from "supertest";
import mongoose from "mongoose";
import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import app from "../../../src/app";
import ProgramModel from "../../../src/models/Program";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";

/**
 * Integration tests for PUT /api/programs/:id authorization
 *
 * Tests verify that only Super Admin and Administrator can update programs.
 * Leader, Guest Expert, and Participant should be denied access.
 */

describe("PUT /api/programs/:id - Authorization Tests", () => {
  let programId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI ||
          "mongodb://127.0.0.1:27017/atcloud-signup-test"
      );
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up programs before each test
    await ProgramModel.deleteMany({});

    // Create a test program
    const createdProgram = await ProgramModel.create({
      title: "Test Program",
      programType: "EMBA Mentor Circles",
      fullPriceTicket: 1000,
      isFree: false,
      createdBy: new mongoose.Types.ObjectId(),
    });
    programId = createdProgram._id.toString();
  });

  describe("Authorized Roles", () => {
    it("should allow Super Admin to update a program", async () => {
      const { token } = await createAndLoginTestUser({ role: "Super Admin" });

      const updatedData = {
        title: "Updated by Super Admin",
        programType: "EMBA Mentor Circles",
        fullPriceTicket: 1200,
      };

      const response = await request(app)
        .put(`/api/programs/${programId}`)
        .set("Authorization", `Bearer ${token}`)
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe("Updated by Super Admin");
      expect(response.body.data.fullPriceTicket).toBe(1200);
    });

    it("should allow Administrator to update a program", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      const updatedData = {
        title: "Updated by Administrator",
        programType: "Effective Communication Workshops",
        fullPriceTicket: 1500,
      };

      const response = await request(app)
        .put(`/api/programs/${programId}`)
        .set("Authorization", `Bearer ${token}`)
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe("Updated by Administrator");
      expect(response.body.data.fullPriceTicket).toBe(1500);
    });
  });

  describe("Unauthorized Roles", () => {
    it("should deny Leader from updating a program", async () => {
      const { token } = await createAndLoginTestUser({ role: "Leader" });

      const updatedData = {
        title: "Attempted Update by Leader",
        programType: "EMBA Mentor Circles",
        fullPriceTicket: 2000,
      };

      const response = await request(app)
        .put(`/api/programs/${programId}`)
        .set("Authorization", `Bearer ${token}`)
        .send(updatedData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "Only Administrators can update programs."
      );

      // Verify program was not updated
      const program = await ProgramModel.findById(programId);
      expect(program?.title).toBe("Test Program");
      expect(program?.fullPriceTicket).toBe(1000);
    });

    it("should deny Guest Expert from updating a program", async () => {
      const { token } = await createAndLoginTestUser({ role: "Guest Expert" });

      const updatedData = {
        title: "Attempted Update by Guest Expert",
        programType: "EMBA Mentor Circles",
        fullPriceTicket: 2000,
      };

      const response = await request(app)
        .put(`/api/programs/${programId}`)
        .set("Authorization", `Bearer ${token}`)
        .send(updatedData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "Only Administrators can update programs."
      );

      // Verify program was not updated
      const program = await ProgramModel.findById(programId);
      expect(program?.title).toBe("Test Program");
      expect(program?.fullPriceTicket).toBe(1000);
    });

    it("should deny Participant from updating a program", async () => {
      const { token } = await createAndLoginTestUser({ role: "Participant" });

      const updatedData = {
        title: "Attempted Update by Participant",
        programType: "EMBA Mentor Circles",
        fullPriceTicket: 2000,
      };

      const response = await request(app)
        .put(`/api/programs/${programId}`)
        .set("Authorization", `Bearer ${token}`)
        .send(updatedData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "Only Administrators can update programs."
      );

      // Verify program was not updated
      const program = await ProgramModel.findById(programId);
      expect(program?.title).toBe("Test Program");
      expect(program?.fullPriceTicket).toBe(1000);
    });

    it("should deny unauthenticated users from updating a program", async () => {
      const updatedData = {
        title: "Attempted Update Without Auth",
        programType: "EMBA Mentor Circles",
        fullPriceTicket: 2000,
      };

      const response = await request(app)
        .put(`/api/programs/${programId}`)
        .send(updatedData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);

      // Verify program was not updated
      const program = await ProgramModel.findById(programId);
      expect(program?.title).toBe("Test Program");
      expect(program?.fullPriceTicket).toBe(1000);
    });
  });

  describe("Edge Cases", () => {
    it("should return 400 for invalid program ID", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      const response = await request(app)
        .put("/api/programs/invalid-id")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Test" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid program ID.");
    });

    it("should return 404 for non-existent program", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .put(`/api/programs/${fakeId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Test" });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Program not found.");
    });

    it("should validate program data during update", async () => {
      const { token } = await createAndLoginTestUser({ role: "Administrator" });

      // Try to update with invalid classRepLimit (max is 5)
      const invalidData = {
        title: "Test Program",
        programType: "EMBA Mentor Circles",
        classRepLimit: 10, // Exceeds max of 5
      };

      const response = await request(app)
        .put(`/api/programs/${programId}`)
        .set("Authorization", `Bearer ${token}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Class Rep limit must be <= 5");
    });
  });
});
