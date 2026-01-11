/**
 * RolesTemplate Model Unit Tests
 *
 * Tests for the RolesTemplate Mongoose model schema validation,
 * field constraints, and embedded template role definitions.
 */

import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import RolesTemplate from "../../../src/models/RolesTemplate";

describe("RolesTemplate Model", () => {
  const validObjectId = new mongoose.Types.ObjectId();

  // Helper to create a valid template for testing
  const createValidTemplate = (overrides = {}) => ({
    name: "Standard Conference Template",
    eventType: "Conference",
    roles: [
      {
        name: "Speaker",
        description: "Main presenter for the event",
        maxParticipants: 5,
        openToPublic: true,
      },
    ],
    createdBy: validObjectId,
    ...overrides,
  });

  describe("Schema Validation", () => {
    describe("name field", () => {
      it("should accept a valid name", () => {
        const doc = new RolesTemplate(createValidTemplate());
        const error = doc.validateSync();
        expect(error).toBeUndefined();
      });

      it("should require name field", () => {
        const doc = new RolesTemplate(createValidTemplate({ name: undefined }));
        const error = doc.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors.name).toBeDefined();
      });

      it("should trim whitespace from name", () => {
        const doc = new RolesTemplate(
          createValidTemplate({ name: "  Trimmed Name  " })
        );
        expect(doc.name).toBe("Trimmed Name");
      });

      it("should reject name shorter than 1 character", () => {
        const doc = new RolesTemplate(createValidTemplate({ name: "" }));
        const error = doc.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors.name).toBeDefined();
      });

      it("should reject name longer than 100 characters", () => {
        const longName = "a".repeat(101);
        const doc = new RolesTemplate(createValidTemplate({ name: longName }));
        const error = doc.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors.name).toBeDefined();
      });

      it("should accept name with exactly 100 characters", () => {
        const maxName = "a".repeat(100);
        const doc = new RolesTemplate(createValidTemplate({ name: maxName }));
        const error = doc.validateSync();
        expect(error).toBeUndefined();
      });
    });

    describe("eventType field", () => {
      it("should accept valid event type: Conference", () => {
        const doc = new RolesTemplate(
          createValidTemplate({ eventType: "Conference" })
        );
        const error = doc.validateSync();
        expect(error).toBeUndefined();
      });

      it("should accept valid event type: Webinar", () => {
        const doc = new RolesTemplate(
          createValidTemplate({ eventType: "Webinar" })
        );
        const error = doc.validateSync();
        expect(error).toBeUndefined();
      });

      it("should accept valid event type: Effective Communication Workshop", () => {
        const doc = new RolesTemplate(
          createValidTemplate({ eventType: "Effective Communication Workshop" })
        );
        const error = doc.validateSync();
        expect(error).toBeUndefined();
      });

      it("should accept valid event type: Mentor Circle", () => {
        const doc = new RolesTemplate(
          createValidTemplate({ eventType: "Mentor Circle" })
        );
        const error = doc.validateSync();
        expect(error).toBeUndefined();
      });

      it("should require eventType field", () => {
        const doc = new RolesTemplate(
          createValidTemplate({ eventType: undefined })
        );
        const error = doc.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors.eventType).toBeDefined();
      });

      it("should reject invalid event type", () => {
        const doc = new RolesTemplate(
          createValidTemplate({ eventType: "InvalidType" })
        );
        const error = doc.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors.eventType).toBeDefined();
      });
    });

    describe("createdBy field", () => {
      it("should accept a valid ObjectId", () => {
        const doc = new RolesTemplate(createValidTemplate());
        const error = doc.validateSync();
        expect(error).toBeUndefined();
      });

      it("should require createdBy field", () => {
        const doc = new RolesTemplate(
          createValidTemplate({ createdBy: undefined })
        );
        const error = doc.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors.createdBy).toBeDefined();
      });

      it("should cast string ObjectId to ObjectId type", () => {
        const stringId = validObjectId.toString();
        const doc = new RolesTemplate(
          createValidTemplate({ createdBy: stringId })
        );
        expect(doc.createdBy instanceof mongoose.Types.ObjectId).toBe(true);
      });
    });

    describe("roles array", () => {
      it("should require at least one role", () => {
        const doc = new RolesTemplate(createValidTemplate({ roles: [] }));
        const error = doc.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors.roles).toBeDefined();
        expect(error?.errors.roles?.message).toBe(
          "Template must have at least one role"
        );
      });

      it("should accept multiple roles", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [
              { name: "Speaker", maxParticipants: 5 },
              { name: "Panelist", maxParticipants: 3 },
              { name: "Moderator", maxParticipants: 1 },
            ],
          })
        );
        const error = doc.validateSync();
        expect(error).toBeUndefined();
        expect(doc.roles).toHaveLength(3);
      });
    });
  });

  describe("Template Role Schema", () => {
    describe("role.name field", () => {
      it("should require role name", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [{ maxParticipants: 5 }],
          })
        );
        const error = doc.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors["roles.0.name"]).toBeDefined();
      });

      it("should trim role name", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [{ name: "  Trimmed Role  ", maxParticipants: 5 }],
          })
        );
        expect(doc.roles[0].name).toBe("Trimmed Role");
      });
    });

    describe("role.description field", () => {
      it("should allow description to be optional", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [{ name: "Speaker", maxParticipants: 5 }],
          })
        );
        const error = doc.validateSync();
        expect(error).toBeUndefined();
      });

      it("should default description to empty string", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [{ name: "Speaker", maxParticipants: 5 }],
          })
        );
        expect(doc.roles[0].description).toBe("");
      });

      it("should trim description", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [
              {
                name: "Speaker",
                description: "  Speaker description  ",
                maxParticipants: 5,
              },
            ],
          })
        );
        expect(doc.roles[0].description).toBe("Speaker description");
      });
    });

    describe("role.maxParticipants field", () => {
      it("should require maxParticipants", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [{ name: "Speaker" }],
          })
        );
        const error = doc.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors["roles.0.maxParticipants"]).toBeDefined();
      });

      it("should enforce minimum value of 1", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [{ name: "Speaker", maxParticipants: 0 }],
          })
        );
        const error = doc.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors["roles.0.maxParticipants"]).toBeDefined();
      });

      it("should accept maxParticipants of 1", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [{ name: "Speaker", maxParticipants: 1 }],
          })
        );
        const error = doc.validateSync();
        expect(error).toBeUndefined();
      });

      it("should accept large maxParticipants value", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [{ name: "Attendee", maxParticipants: 10000 }],
          })
        );
        const error = doc.validateSync();
        expect(error).toBeUndefined();
      });
    });

    describe("role.openToPublic field", () => {
      it("should default to false", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [{ name: "Speaker", maxParticipants: 5 }],
          })
        );
        expect(doc.roles[0].openToPublic).toBe(false);
      });

      it("should accept true value", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [
              { name: "Speaker", maxParticipants: 5, openToPublic: true },
            ],
          })
        );
        expect(doc.roles[0].openToPublic).toBe(true);
      });
    });

    describe("role.agenda field", () => {
      it("should default to empty string", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [{ name: "Speaker", maxParticipants: 5 }],
          })
        );
        expect(doc.roles[0].agenda).toBe("");
      });

      it("should trim agenda text", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [
              {
                name: "Speaker",
                maxParticipants: 5,
                agenda: "  Session topics  ",
              },
            ],
          })
        );
        expect(doc.roles[0].agenda).toBe("Session topics");
      });
    });

    describe("role.startTime field", () => {
      it("should accept valid HH:mm format", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [
              { name: "Speaker", maxParticipants: 5, startTime: "09:30" },
            ],
          })
        );
        const error = doc.validateSync();
        expect(error).toBeUndefined();
        expect(doc.roles[0].startTime).toBe("09:30");
      });

      it("should accept midnight 00:00", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [
              { name: "Speaker", maxParticipants: 5, startTime: "00:00" },
            ],
          })
        );
        const error = doc.validateSync();
        expect(error).toBeUndefined();
      });

      it("should accept 23:59", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [
              { name: "Speaker", maxParticipants: 5, startTime: "23:59" },
            ],
          })
        );
        const error = doc.validateSync();
        expect(error).toBeUndefined();
      });

      it("should reject invalid hour 24:00", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [
              { name: "Speaker", maxParticipants: 5, startTime: "24:00" },
            ],
          })
        );
        const error = doc.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors["roles.0.startTime"]).toBeDefined();
      });

      it("should reject invalid minute 12:60", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [
              { name: "Speaker", maxParticipants: 5, startTime: "12:60" },
            ],
          })
        );
        const error = doc.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors["roles.0.startTime"]).toBeDefined();
      });

      it("should reject invalid format H:mm", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [{ name: "Speaker", maxParticipants: 5, startTime: "9:30" }],
          })
        );
        const error = doc.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors["roles.0.startTime"]).toBeDefined();
      });

      it("should reject invalid format HH:m", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [{ name: "Speaker", maxParticipants: 5, startTime: "09:5" }],
          })
        );
        const error = doc.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors["roles.0.startTime"]).toBeDefined();
      });

      it("should reject 12-hour format with AM/PM", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [
              { name: "Speaker", maxParticipants: 5, startTime: "09:30 AM" },
            ],
          })
        );
        const error = doc.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors["roles.0.startTime"]).toBeDefined();
      });
    });

    describe("role.endTime field", () => {
      it("should accept valid HH:mm format", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [{ name: "Speaker", maxParticipants: 5, endTime: "17:00" }],
          })
        );
        const error = doc.validateSync();
        expect(error).toBeUndefined();
        expect(doc.roles[0].endTime).toBe("17:00");
      });

      it("should reject invalid endTime format", () => {
        const doc = new RolesTemplate(
          createValidTemplate({
            roles: [
              { name: "Speaker", maxParticipants: 5, endTime: "5:00 PM" },
            ],
          })
        );
        const error = doc.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors["roles.0.endTime"]).toBeDefined();
      });
    });
  });

  describe("Document Creation", () => {
    it("should create a complete template document", () => {
      const templateData = {
        name: "Full Conference Template",
        eventType: "Conference",
        roles: [
          {
            name: "Speaker",
            description: "Main speaker role",
            maxParticipants: 5,
            openToPublic: true,
            agenda: "- Introduction\n- Main topic\n- Q&A",
            startTime: "09:00",
            endTime: "10:30",
          },
          {
            name: "Attendee",
            description: "General attendance",
            maxParticipants: 100,
            openToPublic: true,
          },
        ],
        createdBy: validObjectId,
      };

      const doc = new RolesTemplate(templateData);
      const error = doc.validateSync();
      expect(error).toBeUndefined();

      expect(doc.name).toBe("Full Conference Template");
      expect(doc.eventType).toBe("Conference");
      expect(doc.roles).toHaveLength(2);
      expect(doc.roles[0].name).toBe("Speaker");
      expect(doc.roles[0].startTime).toBe("09:00");
      expect(doc.roles[0].endTime).toBe("10:30");
      expect(doc.roles[1].name).toBe("Attendee");
    });

    it("should generate _id for the document", () => {
      const doc = new RolesTemplate(createValidTemplate());
      expect(doc._id).toBeDefined();
      expect(doc._id instanceof mongoose.Types.ObjectId).toBe(true);
    });

    it("should not generate _id for embedded roles", () => {
      const doc = new RolesTemplate(createValidTemplate());
      // Roles are embedded with _id: false, so they shouldn't have _id
      expect((doc.roles[0] as any)._id).toBeUndefined();
    });
  });

  describe("Schema Indexes", () => {
    it("should have index on eventType", () => {
      const indexes = RolesTemplate.schema.indexes();
      const hasEventTypeIndex = indexes.some(
        ([fields]) => "eventType" in fields
      );
      expect(hasEventTypeIndex).toBe(true);
    });

    it("should have index on createdBy", () => {
      const indexes = RolesTemplate.schema.indexes();
      const hasCreatedByIndex = indexes.some(
        ([fields]) => "createdBy" in fields
      );
      expect(hasCreatedByIndex).toBe(true);
    });

    it("should have compound index on eventType and createdBy", () => {
      const indexes = RolesTemplate.schema.indexes();
      const hasCompoundIndex = indexes.some(
        ([fields]) => "eventType" in fields && "createdBy" in fields
      );
      expect(hasCompoundIndex).toBe(true);
    });
  });
});
