/**
 * Tests for event creation validation rules in validation.ts
 * Covers all event fields: title, description, date, time, endTime, location,
 * type, format, purpose, agenda, organizer, roles, zoomLink, meetingId, passcode, flyerUrl
 */
import { describe, it, expect, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";

// Import the actual validation rules
import { validateEventCreation } from "../../../src/middleware/validation";

// Helper to run validation chain against mock request
async function runValidation(
  validationChain: unknown[],
  body: Record<string, unknown>,
): Promise<{ errors: Array<{ msg: string; path: string }> }> {
  const req = {
    body,
    query: {},
    params: {},
    cookies: {},
    get: () => undefined,
    headers: {},
  } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn() as unknown as NextFunction;

  // Run each validator/middleware except the last (error handler)
  for (let i = 0; i < validationChain.length - 1; i++) {
    const middleware = validationChain[i] as (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => Promise<void>;
    await middleware(req, res, next);
  }

  const result = validationResult(req);
  return {
    errors: result.array() as Array<{ msg: string; path: string }>,
  };
}

describe("Event Creation Validation Rules", () => {
  // Valid base event data
  const validEventData = {
    title: "Test Event Title",
    description: "A valid event description",
    date: new Date(Date.now() + 86400000).toISOString(), // tomorrow
    time: "14:00",
    endTime: "16:00",
    location: "Conference Room A",
    type: "Conference",
    format: "In-person",
    organizer: "John Doe",
    roles: [{ name: "Attendee", maxParticipants: 50 }],
  };

  describe("title validation", () => {
    it("should accept valid title", async () => {
      const result = await runValidation(validateEventCreation, validEventData);
      const titleErrors = result.errors.filter((e) => e.path === "title");
      expect(titleErrors).toHaveLength(0);
    });

    it("should accept title at minimum length (3 chars)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        title: "ABC",
      });
      const titleErrors = result.errors.filter((e) => e.path === "title");
      expect(titleErrors).toHaveLength(0);
    });

    it("should accept title at maximum length (200 chars)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        title: "A".repeat(200),
      });
      const titleErrors = result.errors.filter((e) => e.path === "title");
      expect(titleErrors).toHaveLength(0);
    });

    it("should reject title shorter than 3 characters", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        title: "AB",
      });
      const titleErrors = result.errors.filter((e) => e.path === "title");
      expect(titleErrors.length).toBeGreaterThan(0);
      expect(titleErrors[0].msg).toContain("3");
      expect(titleErrors[0].msg).toContain("200");
    });

    it("should reject title longer than 200 characters", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        title: "A".repeat(201),
      });
      const titleErrors = result.errors.filter((e) => e.path === "title");
      expect(titleErrors.length).toBeGreaterThan(0);
    });

    it("should reject empty title", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        title: "",
      });
      const titleErrors = result.errors.filter((e) => e.path === "title");
      expect(titleErrors.length).toBeGreaterThan(0);
    });

    it("should trim whitespace from title", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        title: "  Valid Title  ",
      });
      const titleErrors = result.errors.filter((e) => e.path === "title");
      expect(titleErrors).toHaveLength(0);
    });
  });

  describe("description validation", () => {
    it("should accept valid description", async () => {
      const result = await runValidation(validateEventCreation, validEventData);
      const descErrors = result.errors.filter((e) => e.path === "description");
      expect(descErrors).toHaveLength(0);
    });

    it("should accept empty description (optional)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        description: "",
      });
      const descErrors = result.errors.filter((e) => e.path === "description");
      expect(descErrors).toHaveLength(0);
    });

    it("should accept undefined description (optional)", async () => {
      const { description, ...dataWithoutDesc } = validEventData;
      const result = await runValidation(
        validateEventCreation,
        dataWithoutDesc,
      );
      const descErrors = result.errors.filter((e) => e.path === "description");
      expect(descErrors).toHaveLength(0);
    });

    it("should accept description at max length (1000 chars)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        description: "D".repeat(1000),
      });
      const descErrors = result.errors.filter((e) => e.path === "description");
      expect(descErrors).toHaveLength(0);
    });

    it("should reject description exceeding 1000 characters", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        description: "D".repeat(1001),
      });
      const descErrors = result.errors.filter((e) => e.path === "description");
      expect(descErrors.length).toBeGreaterThan(0);
      expect(descErrors[0].msg).toContain("1000");
    });
  });

  describe("date validation", () => {
    it("should accept valid ISO8601 date", async () => {
      const result = await runValidation(validateEventCreation, validEventData);
      const dateErrors = result.errors.filter((e) => e.path === "date");
      expect(dateErrors).toHaveLength(0);
    });

    it("should accept date string in ISO format", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        date: "2030-12-31T10:00:00.000Z",
      });
      const dateErrors = result.errors.filter((e) => e.path === "date");
      expect(dateErrors).toHaveLength(0);
    });

    it("should accept date-only string", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        date: "2030-06-15",
      });
      const dateErrors = result.errors.filter((e) => e.path === "date");
      expect(dateErrors).toHaveLength(0);
    });

    it("should reject invalid date format", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        date: "not-a-date",
      });
      const dateErrors = result.errors.filter((e) => e.path === "date");
      expect(dateErrors.length).toBeGreaterThan(0);
      expect(dateErrors[0].msg).toContain("date");
    });

    it("should reject empty date", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        date: "",
      });
      const dateErrors = result.errors.filter((e) => e.path === "date");
      expect(dateErrors.length).toBeGreaterThan(0);
    });

    it("should reject invalid date string", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        date: "2025-13-45", // invalid month and day
      });
      const dateErrors = result.errors.filter((e) => e.path === "date");
      expect(dateErrors.length).toBeGreaterThan(0);
    });
  });

  describe("time validation", () => {
    it("should accept valid time in HH:MM format", async () => {
      const result = await runValidation(validateEventCreation, validEventData);
      const timeErrors = result.errors.filter((e) => e.path === "time");
      expect(timeErrors).toHaveLength(0);
    });

    it("should accept midnight (00:00)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        time: "00:00",
        endTime: "01:00",
      });
      const timeErrors = result.errors.filter((e) => e.path === "time");
      expect(timeErrors).toHaveLength(0);
    });

    it("should accept end of day (23:59)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        time: "22:00",
        endTime: "23:59",
      });
      const timeErrors = result.errors.filter((e) => e.path === "time");
      expect(timeErrors).toHaveLength(0);
    });

    it("should accept single digit hour (9:00)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        time: "9:00",
      });
      const timeErrors = result.errors.filter((e) => e.path === "time");
      expect(timeErrors).toHaveLength(0);
    });

    it("should reject invalid time format (HH:MM:SS)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        time: "14:00:00",
      });
      const timeErrors = result.errors.filter((e) => e.path === "time");
      expect(timeErrors.length).toBeGreaterThan(0);
      expect(timeErrors[0].msg).toContain("HH:MM");
    });

    it("should reject invalid hour (25:00)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        time: "25:00",
      });
      const timeErrors = result.errors.filter((e) => e.path === "time");
      expect(timeErrors.length).toBeGreaterThan(0);
    });

    it("should reject invalid minutes (14:60)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        time: "14:60",
      });
      const timeErrors = result.errors.filter((e) => e.path === "time");
      expect(timeErrors.length).toBeGreaterThan(0);
    });

    it("should reject empty time", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        time: "",
      });
      const timeErrors = result.errors.filter((e) => e.path === "time");
      expect(timeErrors.length).toBeGreaterThan(0);
    });

    it("should reject time with AM/PM", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        time: "2:00 PM",
      });
      const timeErrors = result.errors.filter((e) => e.path === "time");
      expect(timeErrors.length).toBeGreaterThan(0);
    });
  });

  describe("endTime validation", () => {
    it("should accept valid endTime", async () => {
      const result = await runValidation(validateEventCreation, validEventData);
      const endTimeErrors = result.errors.filter((e) => e.path === "endTime");
      expect(endTimeErrors).toHaveLength(0);
    });

    it("should accept single digit hour for endTime", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        time: "8:00",
        endTime: "9:30",
      });
      const endTimeErrors = result.errors.filter((e) => e.path === "endTime");
      expect(endTimeErrors).toHaveLength(0);
    });

    it("should reject invalid endTime format", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        endTime: "invalid",
      });
      const endTimeErrors = result.errors.filter((e) => e.path === "endTime");
      expect(endTimeErrors.length).toBeGreaterThan(0);
      expect(endTimeErrors[0].msg).toContain("HH:MM");
    });

    it("should reject endTime with invalid hour", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        endTime: "24:00",
      });
      const endTimeErrors = result.errors.filter((e) => e.path === "endTime");
      expect(endTimeErrors.length).toBeGreaterThan(0);
    });
  });

  describe("location validation", () => {
    it("should accept valid location", async () => {
      const result = await runValidation(validateEventCreation, validEventData);
      const locErrors = result.errors.filter((e) => e.path === "location");
      expect(locErrors).toHaveLength(0);
    });

    it("should accept undefined location (optional)", async () => {
      const { location, ...dataWithoutLocation } = validEventData;
      const result = await runValidation(
        validateEventCreation,
        dataWithoutLocation,
      );
      const locErrors = result.errors.filter((e) => e.path === "location");
      expect(locErrors).toHaveLength(0);
    });

    it("should accept location at minimum length (3 chars)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        location: "NYC",
      });
      const locErrors = result.errors.filter((e) => e.path === "location");
      expect(locErrors).toHaveLength(0);
    });

    it("should accept location at maximum length (200 chars)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        location: "L".repeat(200),
      });
      const locErrors = result.errors.filter((e) => e.path === "location");
      expect(locErrors).toHaveLength(0);
    });

    it("should reject location shorter than 3 characters when provided", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        location: "AB",
      });
      const locErrors = result.errors.filter((e) => e.path === "location");
      expect(locErrors.length).toBeGreaterThan(0);
      expect(locErrors[0].msg).toContain("3");
    });

    it("should reject location exceeding 200 characters", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        location: "L".repeat(201),
      });
      const locErrors = result.errors.filter((e) => e.path === "location");
      expect(locErrors.length).toBeGreaterThan(0);
    });
  });

  describe("type validation", () => {
    it("should accept Conference type", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        type: "Conference",
      });
      const typeErrors = result.errors.filter((e) => e.path === "type");
      expect(typeErrors).toHaveLength(0);
    });

    it("should accept Webinar type", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        type: "Webinar",
      });
      const typeErrors = result.errors.filter((e) => e.path === "type");
      expect(typeErrors).toHaveLength(0);
    });

    it("should accept Effective Communication Workshop type", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        type: "Effective Communication Workshop",
      });
      const typeErrors = result.errors.filter((e) => e.path === "type");
      expect(typeErrors).toHaveLength(0);
    });

    it("should accept Mentor Circle type", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        type: "Mentor Circle",
      });
      const typeErrors = result.errors.filter((e) => e.path === "type");
      expect(typeErrors).toHaveLength(0);
    });

    it("should reject invalid event type", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        type: "Invalid Type",
      });
      const typeErrors = result.errors.filter((e) => e.path === "type");
      expect(typeErrors.length).toBeGreaterThan(0);
      expect(typeErrors[0].msg).toContain("Conference");
      expect(typeErrors[0].msg).toContain("Webinar");
    });

    it("should reject empty type", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        type: "",
      });
      const typeErrors = result.errors.filter((e) => e.path === "type");
      expect(typeErrors.length).toBeGreaterThan(0);
    });

    it("should reject type with wrong case", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        type: "conference",
      });
      const typeErrors = result.errors.filter((e) => e.path === "type");
      expect(typeErrors.length).toBeGreaterThan(0);
    });
  });

  describe("format validation", () => {
    it("should accept In-person format", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        format: "In-person",
      });
      const formatErrors = result.errors.filter((e) => e.path === "format");
      expect(formatErrors).toHaveLength(0);
    });

    it("should accept Online format", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        format: "Online",
      });
      const formatErrors = result.errors.filter((e) => e.path === "format");
      expect(formatErrors).toHaveLength(0);
    });

    it("should accept Hybrid Participation format", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        format: "Hybrid Participation",
      });
      const formatErrors = result.errors.filter((e) => e.path === "format");
      expect(formatErrors).toHaveLength(0);
    });

    it("should reject invalid format", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        format: "Virtual",
      });
      const formatErrors = result.errors.filter((e) => e.path === "format");
      expect(formatErrors.length).toBeGreaterThan(0);
      expect(formatErrors[0].msg).toContain("In-person");
      expect(formatErrors[0].msg).toContain("Online");
      expect(formatErrors[0].msg).toContain("Hybrid");
    });

    it("should reject empty format", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        format: "",
      });
      const formatErrors = result.errors.filter((e) => e.path === "format");
      expect(formatErrors.length).toBeGreaterThan(0);
    });
  });

  describe("purpose validation", () => {
    it("should accept valid purpose", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        purpose: "This is a valid purpose that is at least 10 characters",
      });
      const purposeErrors = result.errors.filter((e) => e.path === "purpose");
      expect(purposeErrors).toHaveLength(0);
    });

    it("should accept empty purpose (optional)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        purpose: "",
      });
      const purposeErrors = result.errors.filter((e) => e.path === "purpose");
      expect(purposeErrors).toHaveLength(0);
    });

    it("should accept undefined purpose (optional)", async () => {
      const { purpose, ...dataWithoutPurpose } = {
        ...validEventData,
        purpose: undefined,
      };
      const result = await runValidation(
        validateEventCreation,
        dataWithoutPurpose,
      );
      const purposeErrors = result.errors.filter((e) => e.path === "purpose");
      expect(purposeErrors).toHaveLength(0);
    });

    it("should accept purpose at minimum length (10 chars)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        purpose: "0123456789",
      });
      const purposeErrors = result.errors.filter((e) => e.path === "purpose");
      expect(purposeErrors).toHaveLength(0);
    });

    it("should accept purpose at maximum length (1000 chars)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        purpose: "P".repeat(1000),
      });
      const purposeErrors = result.errors.filter((e) => e.path === "purpose");
      expect(purposeErrors).toHaveLength(0);
    });

    it("should reject purpose shorter than 10 characters when provided", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        purpose: "Too short",
      });
      const purposeErrors = result.errors.filter((e) => e.path === "purpose");
      expect(purposeErrors.length).toBeGreaterThan(0);
      expect(purposeErrors[0].msg).toContain("10");
    });

    it("should reject purpose exceeding 1000 characters", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        purpose: "P".repeat(1001),
      });
      const purposeErrors = result.errors.filter((e) => e.path === "purpose");
      expect(purposeErrors.length).toBeGreaterThan(0);
      expect(purposeErrors[0].msg).toContain("1000");
    });

    it("should accept whitespace-only purpose as optional empty value", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        purpose: "     ",
      });
      const purposeErrors = result.errors.filter((e) => e.path === "purpose");
      expect(purposeErrors).toHaveLength(0);
    });
  });

  describe("agenda validation", () => {
    it("should accept valid agenda", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        agenda:
          "This is a valid agenda that is at least 20 characters long for the event.",
      });
      const agendaErrors = result.errors.filter((e) => e.path === "agenda");
      expect(agendaErrors).toHaveLength(0);
    });

    it("should accept empty agenda (optional)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        agenda: "",
      });
      const agendaErrors = result.errors.filter((e) => e.path === "agenda");
      expect(agendaErrors).toHaveLength(0);
    });

    it("should accept undefined agenda (optional)", async () => {
      const result = await runValidation(validateEventCreation, validEventData);
      const agendaErrors = result.errors.filter((e) => e.path === "agenda");
      expect(agendaErrors).toHaveLength(0);
    });

    it("should accept agenda at minimum length (20 chars)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        agenda: "A".repeat(20),
      });
      const agendaErrors = result.errors.filter((e) => e.path === "agenda");
      expect(agendaErrors).toHaveLength(0);
    });

    it("should accept agenda at maximum length (2000 chars)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        agenda: "A".repeat(2000),
      });
      const agendaErrors = result.errors.filter((e) => e.path === "agenda");
      expect(agendaErrors).toHaveLength(0);
    });

    it("should reject agenda shorter than 20 characters when provided", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        agenda: "Too short agenda",
      });
      const agendaErrors = result.errors.filter((e) => e.path === "agenda");
      expect(agendaErrors.length).toBeGreaterThan(0);
      expect(agendaErrors[0].msg).toContain("20");
    });

    it("should reject agenda exceeding 2000 characters", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        agenda: "A".repeat(2001),
      });
      const agendaErrors = result.errors.filter((e) => e.path === "agenda");
      expect(agendaErrors.length).toBeGreaterThan(0);
      expect(agendaErrors[0].msg).toContain("2000");
    });

    it("should accept whitespace-only agenda as optional empty value", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        agenda: "     ",
      });
      const agendaErrors = result.errors.filter((e) => e.path === "agenda");
      expect(agendaErrors).toHaveLength(0);
    });

    it("should accept null agenda as optional", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        agenda: null,
      });
      const agendaErrors = result.errors.filter((e) => e.path === "agenda");
      expect(agendaErrors).toHaveLength(0);
    });
  });

  describe("organizer validation", () => {
    it("should accept valid organizer", async () => {
      const result = await runValidation(validateEventCreation, validEventData);
      const orgErrors = result.errors.filter((e) => e.path === "organizer");
      expect(orgErrors).toHaveLength(0);
    });

    it("should accept organizer at minimum length (3 chars)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        organizer: "ABC",
      });
      const orgErrors = result.errors.filter((e) => e.path === "organizer");
      expect(orgErrors).toHaveLength(0);
    });

    it("should accept organizer at maximum length (200 chars)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        organizer: "O".repeat(200),
      });
      const orgErrors = result.errors.filter((e) => e.path === "organizer");
      expect(orgErrors).toHaveLength(0);
    });

    it("should reject organizer shorter than 3 characters", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        organizer: "AB",
      });
      const orgErrors = result.errors.filter((e) => e.path === "organizer");
      expect(orgErrors.length).toBeGreaterThan(0);
      expect(orgErrors[0].msg).toContain("3");
    });

    it("should reject organizer exceeding 200 characters", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        organizer: "O".repeat(201),
      });
      const orgErrors = result.errors.filter((e) => e.path === "organizer");
      expect(orgErrors.length).toBeGreaterThan(0);
    });

    it("should reject empty organizer", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        organizer: "",
      });
      const orgErrors = result.errors.filter((e) => e.path === "organizer");
      expect(orgErrors.length).toBeGreaterThan(0);
    });
  });

  describe("roles validation", () => {
    it("should accept valid roles array", async () => {
      const result = await runValidation(validateEventCreation, validEventData);
      const rolesErrors = result.errors.filter((e) => e.path === "roles");
      expect(rolesErrors).toHaveLength(0);
    });

    it("should accept multiple roles", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        roles: [
          { name: "Speaker", maxParticipants: 5 },
          { name: "Attendee", maxParticipants: 100 },
          { name: "Moderator", maxParticipants: 2 },
        ],
      });
      const rolesErrors = result.errors.filter((e) => e.path === "roles");
      expect(rolesErrors).toHaveLength(0);
    });

    it("should reject empty roles array", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        roles: [],
      });
      const rolesErrors = result.errors.filter((e) => e.path === "roles");
      expect(rolesErrors.length).toBeGreaterThan(0);
      expect(rolesErrors[0].msg).toContain("at least one role");
    });

    it("should reject roles as non-array", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        roles: "not-an-array",
      });
      const rolesErrors = result.errors.filter((e) => e.path === "roles");
      expect(rolesErrors.length).toBeGreaterThan(0);
    });
  });

  describe("roles.*.name validation", () => {
    it("should accept valid role name", async () => {
      const result = await runValidation(validateEventCreation, validEventData);
      const nameErrors = result.errors.filter(
        (e) => e.path.includes("roles") && e.path.includes("name"),
      );
      expect(nameErrors).toHaveLength(0);
    });

    it("should accept role name at minimum length (2 chars)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        roles: [{ name: "MC", maxParticipants: 1 }],
      });
      const nameErrors = result.errors.filter(
        (e) => e.path.includes("roles") && e.path.includes("name"),
      );
      expect(nameErrors).toHaveLength(0);
    });

    it("should accept role name at maximum length (100 chars)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        roles: [{ name: "N".repeat(100), maxParticipants: 1 }],
      });
      const nameErrors = result.errors.filter(
        (e) => e.path.includes("roles") && e.path.includes("name"),
      );
      expect(nameErrors).toHaveLength(0);
    });

    it("should reject role name shorter than 2 characters", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        roles: [{ name: "X", maxParticipants: 1 }],
      });
      const nameErrors = result.errors.filter(
        (e) => e.path.includes("roles") && e.path.includes("name"),
      );
      expect(nameErrors.length).toBeGreaterThan(0);
      expect(nameErrors[0].msg).toContain("2");
    });

    it("should reject role name exceeding 100 characters", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        roles: [{ name: "N".repeat(101), maxParticipants: 1 }],
      });
      const nameErrors = result.errors.filter(
        (e) => e.path.includes("roles") && e.path.includes("name"),
      );
      expect(nameErrors.length).toBeGreaterThan(0);
    });
  });

  describe("roles.*.maxParticipants validation", () => {
    it("should accept valid maxParticipants", async () => {
      const result = await runValidation(validateEventCreation, validEventData);
      const maxErrors = result.errors.filter(
        (e) => e.path.includes("roles") && e.path.includes("maxParticipants"),
      );
      expect(maxErrors).toHaveLength(0);
    });

    it("should accept maxParticipants at minimum (1)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        roles: [{ name: "Solo", maxParticipants: 1 }],
      });
      const maxErrors = result.errors.filter(
        (e) => e.path.includes("roles") && e.path.includes("maxParticipants"),
      );
      expect(maxErrors).toHaveLength(0);
    });

    it("should accept maxParticipants at maximum (100)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        roles: [{ name: "Attendee", maxParticipants: 100 }],
      });
      const maxErrors = result.errors.filter(
        (e) => e.path.includes("roles") && e.path.includes("maxParticipants"),
      );
      expect(maxErrors).toHaveLength(0);
    });

    it("should reject maxParticipants less than 1", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        roles: [{ name: "Attendee", maxParticipants: 0 }],
      });
      const maxErrors = result.errors.filter(
        (e) => e.path.includes("roles") && e.path.includes("maxParticipants"),
      );
      expect(maxErrors.length).toBeGreaterThan(0);
      expect(maxErrors[0].msg).toContain("1");
    });

    it("should reject maxParticipants greater than 100", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        roles: [{ name: "Attendee", maxParticipants: 101 }],
      });
      const maxErrors = result.errors.filter(
        (e) => e.path.includes("roles") && e.path.includes("maxParticipants"),
      );
      expect(maxErrors.length).toBeGreaterThan(0);
      expect(maxErrors[0].msg).toContain("100");
    });

    it("should reject negative maxParticipants", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        roles: [{ name: "Attendee", maxParticipants: -5 }],
      });
      const maxErrors = result.errors.filter(
        (e) => e.path.includes("roles") && e.path.includes("maxParticipants"),
      );
      expect(maxErrors.length).toBeGreaterThan(0);
    });

    it("should reject non-integer maxParticipants", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        roles: [{ name: "Attendee", maxParticipants: 50.5 }],
      });
      const maxErrors = result.errors.filter(
        (e) => e.path.includes("roles") && e.path.includes("maxParticipants"),
      );
      expect(maxErrors.length).toBeGreaterThan(0);
    });
  });

  describe("zoomLink validation", () => {
    it("should accept valid https zoom link", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        zoomLink: "https://zoom.us/j/1234567890",
      });
      const zoomErrors = result.errors.filter((e) => e.path === "zoomLink");
      expect(zoomErrors).toHaveLength(0);
    });

    it("should accept valid http link", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        zoomLink: "http://example.com/meeting",
      });
      const zoomErrors = result.errors.filter((e) => e.path === "zoomLink");
      expect(zoomErrors).toHaveLength(0);
    });

    it("should accept empty zoomLink (optional)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        zoomLink: "",
      });
      const zoomErrors = result.errors.filter((e) => e.path === "zoomLink");
      expect(zoomErrors).toHaveLength(0);
    });

    it("should accept undefined zoomLink (optional)", async () => {
      const result = await runValidation(validateEventCreation, validEventData);
      const zoomErrors = result.errors.filter((e) => e.path === "zoomLink");
      expect(zoomErrors).toHaveLength(0);
    });

    it("should reject zoomLink without http/https", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        zoomLink: "zoom.us/j/1234567890",
      });
      const zoomErrors = result.errors.filter((e) => e.path === "zoomLink");
      expect(zoomErrors.length).toBeGreaterThan(0);
      expect(zoomErrors[0].msg).toContain("http");
    });

    it("should reject invalid zoomLink format", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        zoomLink: "not-a-valid-url",
      });
      const zoomErrors = result.errors.filter((e) => e.path === "zoomLink");
      expect(zoomErrors.length).toBeGreaterThan(0);
    });
  });

  describe("meetingId validation", () => {
    it("should accept valid meetingId", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        meetingId: "123-456-789",
      });
      const idErrors = result.errors.filter((e) => e.path === "meetingId");
      expect(idErrors).toHaveLength(0);
    });

    it("should accept empty meetingId (optional)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        meetingId: "",
      });
      const idErrors = result.errors.filter((e) => e.path === "meetingId");
      expect(idErrors).toHaveLength(0);
    });

    it("should accept meetingId at max length (50 chars)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        meetingId: "M".repeat(50),
      });
      const idErrors = result.errors.filter((e) => e.path === "meetingId");
      expect(idErrors).toHaveLength(0);
    });

    it("should reject meetingId exceeding 50 characters", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        meetingId: "M".repeat(51),
      });
      const idErrors = result.errors.filter((e) => e.path === "meetingId");
      expect(idErrors.length).toBeGreaterThan(0);
      expect(idErrors[0].msg).toContain("50");
    });
  });

  describe("passcode validation", () => {
    it("should accept valid passcode", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        passcode: "abc123",
      });
      const passErrors = result.errors.filter((e) => e.path === "passcode");
      expect(passErrors).toHaveLength(0);
    });

    it("should accept empty passcode (optional)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        passcode: "",
      });
      const passErrors = result.errors.filter((e) => e.path === "passcode");
      expect(passErrors).toHaveLength(0);
    });

    it("should accept passcode at max length (50 chars)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        passcode: "P".repeat(50),
      });
      const passErrors = result.errors.filter((e) => e.path === "passcode");
      expect(passErrors).toHaveLength(0);
    });

    it("should reject passcode exceeding 50 characters", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        passcode: "P".repeat(51),
      });
      const passErrors = result.errors.filter((e) => e.path === "passcode");
      expect(passErrors.length).toBeGreaterThan(0);
      expect(passErrors[0].msg).toContain("50");
    });
  });

  describe("flyerUrl validation", () => {
    it("should accept valid https flyer URL", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        flyerUrl: "https://example.com/flyer.jpg",
      });
      const flyerErrors = result.errors.filter((e) => e.path === "flyerUrl");
      expect(flyerErrors).toHaveLength(0);
    });

    it("should accept valid http flyer URL", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        flyerUrl: "http://example.com/flyer.png",
      });
      const flyerErrors = result.errors.filter((e) => e.path === "flyerUrl");
      expect(flyerErrors).toHaveLength(0);
    });

    it("should accept /uploads/ path", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        flyerUrl: "/uploads/images/flyer123.jpg",
      });
      const flyerErrors = result.errors.filter((e) => e.path === "flyerUrl");
      expect(flyerErrors).toHaveLength(0);
    });

    it("should accept empty flyerUrl (optional)", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        flyerUrl: "",
      });
      const flyerErrors = result.errors.filter((e) => e.path === "flyerUrl");
      expect(flyerErrors).toHaveLength(0);
    });

    it("should accept undefined flyerUrl (optional)", async () => {
      const result = await runValidation(validateEventCreation, validEventData);
      const flyerErrors = result.errors.filter((e) => e.path === "flyerUrl");
      expect(flyerErrors).toHaveLength(0);
    });

    it("should reject flyerUrl with invalid path", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        flyerUrl: "/images/flyer.jpg",
      });
      const flyerErrors = result.errors.filter((e) => e.path === "flyerUrl");
      expect(flyerErrors.length).toBeGreaterThan(0);
      expect(flyerErrors[0].msg).toContain("/uploads/");
    });

    it("should reject flyerUrl without proper protocol or path", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        flyerUrl: "example.com/flyer.jpg",
      });
      const flyerErrors = result.errors.filter((e) => e.path === "flyerUrl");
      expect(flyerErrors.length).toBeGreaterThan(0);
    });

    it("should accept null flyerUrl as optional", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        flyerUrl: null,
      });
      const flyerErrors = result.errors.filter((e) => e.path === "flyerUrl");
      expect(flyerErrors).toHaveLength(0);
    });

    it("should accept whitespace-only flyerUrl as empty value", async () => {
      const result = await runValidation(validateEventCreation, {
        ...validEventData,
        flyerUrl: "   ",
      });
      const flyerErrors = result.errors.filter((e) => e.path === "flyerUrl");
      expect(flyerErrors).toHaveLength(0);
    });
  });

  describe("combined validation", () => {
    it("should report multiple errors for multiple invalid fields", async () => {
      const result = await runValidation(validateEventCreation, {
        title: "AB",
        date: "invalid",
        time: "25:00",
        type: "Invalid",
        format: "Unknown",
        organizer: "A",
        roles: [],
      });

      expect(result.errors.length).toBeGreaterThanOrEqual(6);
      const errorPaths = result.errors.map((e) => e.path);
      expect(errorPaths).toContain("title");
      expect(errorPaths).toContain("date");
      expect(errorPaths).toContain("time");
      expect(errorPaths).toContain("type");
      expect(errorPaths).toContain("format");
      expect(errorPaths).toContain("organizer");
      expect(errorPaths).toContain("roles");
    });

    it("should pass validation with all valid required and optional fields", async () => {
      const result = await runValidation(validateEventCreation, {
        title: "Complete Event",
        description: "A full description of the event",
        date: "2030-06-15",
        time: "14:00",
        endTime: "16:00",
        location: "Main Conference Hall",
        type: "Conference",
        format: "Hybrid Participation",
        purpose: "This is a comprehensive purpose statement.",
        agenda: "Detailed agenda for the event covering all topics.",
        organizer: "Event Organizers Inc.",
        roles: [
          { name: "Speaker", maxParticipants: 5 },
          { name: "Attendee", maxParticipants: 50 },
        ],
        zoomLink: "https://zoom.us/j/123456789",
        meetingId: "123-456-789",
        passcode: "event123",
        flyerUrl: "/uploads/images/event-flyer.jpg",
      });

      expect(result.errors).toHaveLength(0);
    });
  });
});
