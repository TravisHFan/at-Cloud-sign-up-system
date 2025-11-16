import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../../src/app";
import { Program } from "../../../src/models";
import { ensureIntegrationDB } from "../setup/connect";

describe("Programs List API Integration Tests", () => {
  describe("GET /api/programs", () => {
    let program1: any;
    let program2: any;
    let program3: any;
    const createdBy = new mongoose.Types.ObjectId();

    beforeAll(async () => {
      await ensureIntegrationDB();
    });

    afterEach(async () => {
      await Program.deleteMany({});
    });

    afterAll(async () => {
      await mongoose.disconnect();
    });

    describe("Basic Listing", () => {
      it("should return empty array when no programs exist", async () => {
        const response = await request(app).get("/api/programs").expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual([]);
      });

      it("should return all programs without filters", async () => {
        // Create 3 programs
        await Program.create([
          {
            title: "Program 1",
            programType: "EMBA Mentor Circles",
            fullPriceTicket: 5000,
            createdBy,
          },
          {
            title: "Program 2",
            programType: "Effective Communication Workshops",
            fullPriceTicket: 3000,
            createdBy,
          },
          {
            title: "Program 3",
            programType: "Marketplace Church Incubator Program (MCIP)",
            fullPriceTicket: 7000,
            createdBy,
          },
        ]);

        const response = await request(app).get("/api/programs").expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(3);
        expect(response.body.data[0].title).toBeDefined();
      });

      it("should return programs sorted by createdAt descending", async () => {
        // Create programs with slight delay to ensure ordering
        program1 = await Program.create({
          title: "First Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 5000,
          createdBy,
        });

        await new Promise((resolve) => setTimeout(resolve, 10));

        program2 = await Program.create({
          title: "Second Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 5000,
          createdBy,
        });

        await new Promise((resolve) => setTimeout(resolve, 10));

        program3 = await Program.create({
          title: "Third Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 5000,
          createdBy,
        });

        const response = await request(app).get("/api/programs").expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(3);
        // Most recent first
        expect(response.body.data[0].title).toBe("Third Program");
        expect(response.body.data[1].title).toBe("Second Program");
        expect(response.body.data[2].title).toBe("First Program");
      });

      it("should transform _id to id for frontend compatibility", async () => {
        const program = await Program.create({
          title: "Test Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 5000,
          createdBy,
        });

        const response = await request(app).get("/api/programs").expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data[0].id).toBe(program._id.toString());
        expect(response.body.data[0]._id).toBeUndefined();
      });
    });

    describe("Filtering by Program Type", () => {
      beforeEach(async () => {
        await Program.create([
          {
            title: "EMBA Program 1",
            programType: "EMBA Mentor Circles",
            fullPriceTicket: 5000,
            createdBy,
          },
          {
            title: "EMBA Program 2",
            programType: "EMBA Mentor Circles",
            fullPriceTicket: 6000,
            createdBy,
          },
          {
            title: "Workshop 1",
            programType: "Effective Communication Workshops",
            fullPriceTicket: 3000,
            createdBy,
          },
          {
            title: "MCIP Program 1",
            programType: "Marketplace Church Incubator Program (MCIP)",
            fullPriceTicket: 7000,
            createdBy,
          },
        ]);
      });

      it("should filter by EMBA Mentor Circles type", async () => {
        const response = await request(app)
          .get("/api/programs")
          .query({ type: "EMBA Mentor Circles" })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0].programType).toBe("EMBA Mentor Circles");
        expect(response.body.data[1].programType).toBe("EMBA Mentor Circles");
      });

      it("should filter by Effective Communication Workshops type", async () => {
        const response = await request(app)
          .get("/api/programs")
          .query({ type: "Effective Communication Workshops" })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].programType).toBe(
          "Effective Communication Workshops"
        );
        expect(response.body.data[0].title).toBe("Workshop 1");
      });

      it("should filter by MCIP type", async () => {
        const response = await request(app)
          .get("/api/programs")
          .query({ type: "Marketplace Church Incubator Program (MCIP)" })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].programType).toBe(
          "Marketplace Church Incubator Program (MCIP)"
        );
      });

      it("should return empty array for non-existent type", async () => {
        const response = await request(app)
          .get("/api/programs")
          .query({ type: "Non-existent Type" })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual([]);
      });
    });

    describe("Search by Title (q parameter)", () => {
      beforeEach(async () => {
        await Program.create([
          {
            title: "Leadership Development Program",
            programType: "EMBA Mentor Circles",
            fullPriceTicket: 5000,
            createdBy,
          },
          {
            title: "Communication Skills Workshop",
            programType: "Effective Communication Workshops",
            fullPriceTicket: 3000,
            createdBy,
          },
          {
            title: "Advanced Leadership Training",
            programType: "EMBA Mentor Circles",
            fullPriceTicket: 6000,
            createdBy,
          },
          {
            title: "Church Growth Strategies",
            programType: "Marketplace Church Incubator Program (MCIP)",
            fullPriceTicket: 7000,
            createdBy,
          },
        ]);
      });

      it("should search programs by title (case insensitive)", async () => {
        const response = await request(app)
          .get("/api/programs")
          .query({ q: "leadership" })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0].title).toContain("Leadership");
        expect(response.body.data[1].title).toContain("Leadership");
      });

      it("should search programs case insensitively", async () => {
        const response = await request(app)
          .get("/api/programs")
          .query({ q: "LEADERSHIP" })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
      });

      it("should search programs with partial match", async () => {
        const response = await request(app)
          .get("/api/programs")
          .query({ q: "comm" })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].title).toBe(
          "Communication Skills Workshop"
        );
      });

      it("should return empty array when no matches found", async () => {
        const response = await request(app)
          .get("/api/programs")
          .query({ q: "nonexistent" })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual([]);
      });

      it("should handle empty search query", async () => {
        const response = await request(app)
          .get("/api/programs")
          .query({ q: "" })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(4);
      });
    });

    describe("Combined Filtering", () => {
      beforeEach(async () => {
        await Program.create([
          {
            title: "Leadership EMBA Program",
            programType: "EMBA Mentor Circles",
            fullPriceTicket: 5000,
            createdBy,
          },
          {
            title: "Communication EMBA Program",
            programType: "EMBA Mentor Circles",
            fullPriceTicket: 6000,
            createdBy,
          },
          {
            title: "Leadership Workshop",
            programType: "Effective Communication Workshops",
            fullPriceTicket: 3000,
            createdBy,
          },
          {
            title: "Church Leadership Program",
            programType: "Marketplace Church Incubator Program (MCIP)",
            fullPriceTicket: 7000,
            createdBy,
          },
        ]);
      });

      it("should filter by both type and search query", async () => {
        const response = await request(app)
          .get("/api/programs")
          .query({ type: "EMBA Mentor Circles", q: "leadership" })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].title).toBe("Leadership EMBA Program");
        expect(response.body.data[0].programType).toBe("EMBA Mentor Circles");
      });

      it("should return empty when filters match nothing", async () => {
        const response = await request(app)
          .get("/api/programs")
          .query({ type: "EMBA Mentor Circles", q: "church" })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual([]);
      });
    });

    describe("Edge Cases", () => {
      it("should handle special characters in search query", async () => {
        await Program.create({
          title: "Program with (Special) Characters!",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 5000,
          createdBy,
        });

        const response = await request(app)
          .get("/api/programs")
          .query({ q: "(Special)" })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
      });

      it("should handle programs with all optional fields", async () => {
        await Program.create({
          title: "Complete Program",
          programType: "EMBA Mentor Circles",
          hostedBy: "Test Host",
          period: {
            startYear: "2024",
            startMonth: "01",
            endYear: "2024",
            endMonth: "12",
          },
          introduction: "Test introduction",
          flyerUrl: "https://example.com/flyer.jpg",
          fullPriceTicket: 50000,
          earlyBirdDiscount: 5000,
          earlyBirdDeadline: new Date("2024-12-31"),
          classRepLimit: 5,
          createdBy,
        });

        const response = await request(app).get("/api/programs").expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].hostedBy).toBe("Test Host");
        expect(response.body.data[0].introduction).toBe("Test introduction");
      });

      it("should handle large number of programs", async () => {
        const programs = Array(50)
          .fill(null)
          .map((_, index) => ({
            title: `Program ${index + 1}`,
            programType: "EMBA Mentor Circles",
            fullPriceTicket: 5000,
            createdBy,
          }));

        await Program.create(programs);

        const response = await request(app).get("/api/programs").expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(50);
      });

      it("should handle undefined query parameters gracefully", async () => {
        await Program.create({
          title: "Test Program",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 5000,
          createdBy,
        });

        const response = await request(app)
          .get("/api/programs")
          .query({ type: undefined, q: undefined })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
      });
    });

    describe("Response Time", () => {
      it("should respond quickly (< 100ms) with moderate data", async () => {
        const programs = Array(20)
          .fill(null)
          .map((_, index) => ({
            title: `Program ${index + 1}`,
            programType: "EMBA Mentor Circles",
            fullPriceTicket: 5000,
            createdBy,
          }));

        await Program.create(programs);

        const start = Date.now();
        await request(app).get("/api/programs").expect(200);
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(100);
      });
    });
  });
});
