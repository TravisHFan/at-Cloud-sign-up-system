import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from "vitest";
import mongoose from "mongoose";
import Event, {
  IEvent,
  IEventRole,
  IOrganizerDetail,
} from "../../../src/models/Event";

// Mock Registration model
const mockRegistrationModel = {
  countDocuments: vi.fn(),
};

describe("Event Model", () => {
  console.log("🔧 Setting up Event model test environment...");

  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistrationModel.countDocuments.mockResolvedValue(0);
  });

  describe("Schema Validation", () => {
    describe("Required Fields", () => {
      it("should require title field", () => {
        const event = new Event({});
        const error = event.validateSync();
        expect(error?.errors?.title?.message).toBe("Event title is required");
      });

      it("should require type field", () => {
        const event = new Event({});
        const error = event.validateSync();
        expect(error?.errors?.type?.message).toBe("Event type is required");
      });

      it("should require date field", () => {
        const event = new Event({});
        const error = event.validateSync();
        expect(error?.errors?.date?.message).toBe("Event date is required");
      });

      it("should require time field", () => {
        const event = new Event({});
        const error = event.validateSync();
        expect(error?.errors?.time?.message).toBe(
          "Event start time is required"
        );
      });

      it("should require endTime field", () => {
        const event = new Event({});
        const error = event.validateSync();
        expect(error?.errors?.endTime?.message).toBe(
          "Event end time is required"
        );
      });

      it("should require organizer field", () => {
        const event = new Event({});
        const error = event.validateSync();
        expect(error?.errors?.organizer?.message).toBe(
          "Organizer information is required"
        );
      });

      it("should require createdBy field", () => {
        const event = new Event({});
        const error = event.validateSync();
        expect(error?.errors?.createdBy?.message).toBe(
          "Event creator is required"
        );
      });

      it("should require purpose field", () => {
        const event = new Event({});
        const error = event.validateSync();
        expect(error?.errors?.purpose?.message).toBe(
          "Event purpose is required"
        );
      });

      it("should require format field", () => {
        const event = new Event({});
        const error = event.validateSync();
        expect(error?.errors?.format?.message).toBe("Event format is required");
      });

      it("should require roles array with at least one role", () => {
        const event = new Event({
          title: "Test Event",
          type: "Workshop",
          date: "2025-12-25",
          time: "10:00",
          endTime: "12:00",
          organizer: "Test Organizer",
          createdBy: new mongoose.Types.ObjectId(),
          purpose: "Test purpose",
          format: "In-person",
          roles: [],
        });
        const error = event.validateSync();
        expect(error?.errors?.roles?.message).toBe(
          "Event must have at least one role"
        );
      });
    });

    describe("Field Validation", () => {
      it("should validate title length", () => {
        const longTitle = "a".repeat(201);
        const event = new Event({ title: longTitle });
        const error = event.validateSync();
        expect(error?.errors?.title?.message).toBe(
          "Event title cannot exceed 200 characters"
        );
      });

      it("should validate type enum values", () => {
        const invalidType = "Some Legacy Type That Is Not Allowed";
        const event = new Event({ type: invalidType });
        const error = event.validateSync();
        expect(error?.errors?.type?.message).toBe(
          "Event type must be one of: Conference, Webinar, Workshop, Mentor Circle"
        );
      });

      it("should validate date format", () => {
        const event = new Event({ date: "invalid-date" });
        const error = event.validateSync();
        expect(error?.errors?.date?.message).toBe(
          "Date must be in YYYY-MM-DD format"
        );
      });

      it("should accept valid date format", () => {
        const event = new Event({ date: "2025-12-25" });
        const error = event.validateSync();
        expect(error?.errors?.date).toBeUndefined();
      });

      it("should validate time format", () => {
        const event = new Event({ time: "invalid-time" });
        const error = event.validateSync();
        expect(error?.errors?.time?.message).toBe(
          "Time must be in HH:MM format"
        );
      });

      it("should accept valid time format", () => {
        const event = new Event({ time: "14:30" });
        const error = event.validateSync();
        expect(error?.errors?.time).toBeUndefined();
      });

      it("should validate endTime format", () => {
        const event = new Event({ endTime: "invalid-time" });
        const error = event.validateSync();
        expect(error?.errors?.endTime?.message).toBe(
          "End time must be in HH:MM format"
        );
      });

      it("should accept valid endTime format", () => {
        const event = new Event({ endTime: "16:30" });
        const error = event.validateSync();
        expect(error?.errors?.endTime).toBeUndefined();
      });

      it("should validate location length", () => {
        const longLocation = "a".repeat(201);
        const event = new Event({
          location: longLocation,
          format: "In-person",
        });
        const error = event.validateSync();
        expect(error?.errors?.location?.message).toBe(
          "Location cannot exceed 200 characters"
        );
      });

      it("should validate organizer length", () => {
        const longOrganizer = "a".repeat(301);
        const event = new Event({ organizer: longOrganizer });
        const error = event.validateSync();
        expect(error?.errors?.organizer?.message).toBe(
          "Organizer information cannot exceed 300 characters"
        );
      });

      it("should validate purpose length", () => {
        const longPurpose = "a".repeat(1001);
        const event = new Event({ purpose: longPurpose });
        const error = event.validateSync();
        expect(error?.errors?.purpose?.message).toBe(
          "Purpose cannot exceed 1000 characters"
        );
      });

      it("should validate format enum values", () => {
        const event = new Event({ format: "Invalid Format" });
        const error = event.validateSync();
        expect(error?.errors?.format?.message).toBe(
          "Format must be one of: In-person, Online, or Hybrid Participation"
        );
      });

      it("should accept valid format values", () => {
        const formats = ["In-person", "Online", "Hybrid Participation"];
        formats.forEach((format) => {
          const event = new Event({ format });
          const error = event.validateSync();
          expect(error?.errors?.format).toBeUndefined();
        });
      });

      it("should validate status enum values", () => {
        const event = new Event({ status: "invalid-status" });
        const error = event.validateSync();
        expect(error?.errors?.status?.message).toContain(
          "is not a valid enum value"
        );
      });

      it("should accept valid status values", () => {
        const statuses = ["upcoming", "ongoing", "completed", "cancelled"];
        statuses.forEach((status) => {
          const event = new Event({ status });
          const error = event.validateSync();
          expect(error?.errors?.status).toBeUndefined();
        });
      });
    });

    describe("Conditional Location Validation", () => {
      it("should require location for In-person format", () => {
        const event = new Event({
          format: "In-person",
          location: "",
        });
        const error = event.validateSync();
        expect(error?.errors?.location?.message).toBe(
          "Event location is required for in-person and hybrid events"
        );
      });

      it("should require location for Hybrid Participation format", () => {
        const event = new Event({
          format: "Hybrid Participation",
          location: "",
        });
        const error = event.validateSync();
        expect(error?.errors?.location?.message).toBe(
          "Event location is required for in-person and hybrid events"
        );
      });

      it("should not require location for Online format", () => {
        const event = new Event({
          format: "Online",
          location: "",
        });
        const error = event.validateSync();
        expect(error?.errors?.location).toBeUndefined();
      });
    });

    describe("Zoom Link Validation", () => {
      it("should accept valid HTTP URL for zoomLink", () => {
        const event = new Event({ zoomLink: "http://zoom.us/j/123456789" });
        const error = event.validateSync();
        expect(error?.errors?.zoomLink).toBeUndefined();
      });

      it("should accept valid HTTPS URL for zoomLink", () => {
        const event = new Event({ zoomLink: "https://zoom.us/j/123456789" });
        const error = event.validateSync();
        expect(error?.errors?.zoomLink).toBeUndefined();
      });

      it("should reject invalid URL for zoomLink", () => {
        const event = new Event({ zoomLink: "invalid-url" });
        const error = event.validateSync();
        expect(error?.errors?.zoomLink?.message).toBe(
          "Zoom link must be a valid URL"
        );
      });

      it("should accept empty string for zoomLink", () => {
        const event = new Event({ zoomLink: "" });
        const error = event.validateSync();
        expect(error?.errors?.zoomLink).toBeUndefined();
      });

      it("should accept undefined for zoomLink", () => {
        const event = new Event({ zoomLink: undefined });
        const error = event.validateSync();
        expect(error?.errors?.zoomLink).toBeUndefined();
      });
    });
  });

  describe("Event Roles Validation", () => {
    it("should validate role name length", () => {
      const longRoleName = "a".repeat(101);
      const event = new Event({
        roles: [
          {
            id: "role-1",
            name: longRoleName,
            description: "Test description",
            maxParticipants: 10,
          },
        ],
      });
      const error = event.validateSync();
      expect(error?.errors["roles.0.name"]?.message).toBe(
        "Role name cannot exceed 100 characters"
      );
    });

    it("should validate role description length", () => {
      const longDescription = "a".repeat(301);
      const event = new Event({
        roles: [
          {
            id: "role-1",
            name: "Test Role",
            description: longDescription,
            maxParticipants: 10,
          },
        ],
      });
      const error = event.validateSync();
      expect(error?.errors["roles.0.description"]?.message).toBe(
        "Role description cannot exceed 300 characters"
      );
    });

    it("should validate maxParticipants minimum value", () => {
      const event = new Event({
        roles: [
          {
            id: "role-1",
            name: "Test Role",
            description: "Test description",
            maxParticipants: 0,
          },
        ],
      });
      const error = event.validateSync();
      expect(error?.errors["roles.0.maxParticipants"]?.message).toBe(
        "Maximum participants must be at least 1"
      );
    });

    it("should validate maxParticipants maximum value", () => {
      const event = new Event({
        roles: [
          {
            id: "role-1",
            name: "Test Role",
            description: "Test description",
            maxParticipants: 101,
          },
        ],
      });
      const error = event.validateSync();
      expect(error?.errors["roles.0.maxParticipants"]?.message).toBe(
        "Maximum participants cannot exceed 100"
      );
    });

    it("should accept valid role data", () => {
      const event = new Event({
        roles: [
          {
            id: "role-1",
            name: "Test Role",
            description: "Test description",
            maxParticipants: 10,
          },
        ],
      });
      const error = event.validateSync();
      expect(error?.errors?.roles).toBeUndefined();
    });
  });

  describe("Instance Methods", () => {
    describe("calculateSignedUp", () => {
      it("should calculate signed up count from Registration collection", async () => {
        const eventId = new mongoose.Types.ObjectId();
        mockRegistrationModel.countDocuments.mockResolvedValue(5);

        // Mock mongoose.model for this test only
        const originalModel = mongoose.model;
        mongoose.model = vi.fn((modelName: string) => {
          if (modelName === "Registration") {
            return mockRegistrationModel as any;
          }
          return originalModel.call(mongoose, modelName);
        }) as any;

        const event = new Event({
          _id: eventId,
          title: "Test Event",
          type: "Workshop",
          date: "2025-12-25",
          time: "10:00",
          endTime: "12:00",
          organizer: "Test Organizer",
          createdBy: new mongoose.Types.ObjectId(),
          purpose: "Test purpose",
          format: "In-person",
          location: "Test Location",
          roles: [
            {
              id: "role-1",
              name: "Participant",
              description: "Event participant",
              maxParticipants: 20,
            },
          ],
        });

        const count = await event.calculateSignedUp();

        expect(count).toBe(5);
        expect(mockRegistrationModel.countDocuments).toHaveBeenCalledWith({
          eventId: eventId,
          status: "active",
        });

        // Restore original mongoose.model
        mongoose.model = originalModel;
      });

      it("should return 0 when no registrations exist", async () => {
        mockRegistrationModel.countDocuments.mockResolvedValue(0);

        // Mock mongoose.model for this test only
        const originalModel = mongoose.model;
        mongoose.model = vi.fn((modelName: string) => {
          if (modelName === "Registration") {
            return mockRegistrationModel as any;
          }
          return originalModel.call(mongoose, modelName);
        }) as any;

        const event = new Event({
          _id: new mongoose.Types.ObjectId(),
          title: "Test Event",
          type: "Workshop",
          date: "2025-12-25",
          time: "10:00",
          endTime: "12:00",
          organizer: "Test Organizer",
          createdBy: new mongoose.Types.ObjectId(),
          purpose: "Test purpose",
          format: "In-person",
          location: "Test Location",
          roles: [
            {
              id: "role-1",
              name: "Participant",
              description: "Event participant",
              maxParticipants: 20,
            },
          ],
        });

        const count = await event.calculateSignedUp();
        expect(count).toBe(0);
        expect(mockRegistrationModel.countDocuments).toHaveBeenCalledWith({
          eventId: event._id,
          status: "active",
        });

        // Restore original mongoose.model
        mongoose.model = originalModel;
      });
    });

    describe("calculateTotalSlots", () => {
      it("should calculate total slots across all roles", () => {
        const event = new Event({
          roles: [
            {
              id: "role-1",
              name: "Participant",
              description: "Event participant",
              maxParticipants: 20,
            },
            {
              id: "role-2",
              name: "Volunteer",
              description: "Event volunteer",
              maxParticipants: 5,
            },
            {
              id: "role-3",
              name: "Leader",
              description: "Event leader",
              maxParticipants: 3,
            },
          ],
        });

        const totalSlots = event.calculateTotalSlots();
        expect(totalSlots).toBe(28); // 20 + 5 + 3
      });

      it("should return 0 for event with no roles", () => {
        const event = new Event({
          roles: [],
        });

        const totalSlots = event.calculateTotalSlots();
        expect(totalSlots).toBe(0);
      });

      it("should handle single role", () => {
        const event = new Event({
          roles: [
            {
              id: "role-1",
              name: "Participant",
              description: "Event participant",
              maxParticipants: 15,
            },
          ],
        });

        const totalSlots = event.calculateTotalSlots();
        expect(totalSlots).toBe(15);
      });
    });
  });

  describe("Default Values", () => {
    it("should set default values correctly", () => {
      const event = new Event({
        title: "Test Event",
        type: "Workshop",
        date: "2025-12-25",
        time: "10:00",
        endTime: "12:00",
        organizer: "Test Organizer",
        createdBy: new mongoose.Types.ObjectId(),
        purpose: "Test purpose",
        format: "Online",
        roles: [
          {
            id: "role-1",
            name: "Participant",
            description: "Event participant",
            maxParticipants: 20,
          },
        ],
      });

      expect(event.status).toBe("upcoming");
      expect(event.signedUp).toBe(0);
      expect(event.totalSlots).toBe(0);
      expect(event.isHybrid).toBe(false);
      expect(event["24hReminderSent"]).toBe(false);
      expect(event.hostedBy).toBe("@Cloud Marketplace Ministry");
    });
  });

  describe("JSON Transformation", () => {
    it("should transform _id to id in JSON output", () => {
      const event = new Event({
        title: "Test Event",
        type: "Workshop",
        date: "2025-12-25",
        time: "10:00",
        endTime: "12:00",
        organizer: "Test Organizer",
        createdBy: new mongoose.Types.ObjectId(),
        purpose: "Test purpose",
        format: "Online",
        roles: [
          {
            id: "role-1",
            name: "Participant",
            description: "Event participant",
            maxParticipants: 20,
          },
        ],
      });

      const json = event.toJSON();
      expect(json.id).toBeDefined();
      expect(json._id).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });
  });

  describe("Field Length Validations", () => {
    it("should validate agenda length", () => {
      const longAgenda = "a".repeat(2001);
      const event = new Event({ agenda: longAgenda });
      const error = event.validateSync();
      expect(error?.errors?.agenda?.message).toBe(
        "Agenda cannot exceed 2000 characters"
      );
    });

    it("should validate disclaimer length", () => {
      const longDisclaimer = "a".repeat(1001);
      const event = new Event({ disclaimer: longDisclaimer });
      const error = event.validateSync();
      expect(error?.errors?.disclaimer?.message).toBe(
        "Disclaimer cannot exceed 1000 characters"
      );
    });

    it("should validate description length", () => {
      const longDescription = "a".repeat(1001);
      const event = new Event({ description: longDescription });
      const error = event.validateSync();
      expect(error?.errors?.description?.message).toBe(
        "Description cannot exceed 1000 characters"
      );
    });

    it("should validate hostedBy length", () => {
      const longHostedBy = "a".repeat(201);
      const event = new Event({ hostedBy: longHostedBy });
      const error = event.validateSync();
      expect(error?.errors?.hostedBy?.message).toBe(
        "Hosted by information cannot exceed 200 characters"
      );
    });

    it("should validate requirements length", () => {
      const longRequirements = "a".repeat(501);
      const event = new Event({ requirements: longRequirements });
      const error = event.validateSync();
      expect(error?.errors?.requirements?.message).toBe(
        "Requirements cannot exceed 500 characters"
      );
    });

    it("should validate materials length", () => {
      const longMaterials = "a".repeat(501);
      const event = new Event({ materials: longMaterials });
      const error = event.validateSync();
      expect(error?.errors?.materials?.message).toBe(
        "Materials cannot exceed 500 characters"
      );
    });
  });

  describe("Organizer Details Validation", () => {
    it("should validate organizer details structure", () => {
      const organizerDetails: IOrganizerDetail[] = [
        {
          userId: new mongoose.Types.ObjectId(),
          name: "John Doe",
          role: "Lead Organizer",
          email: "john@example.com",
          phone: "123-456-7890",
          avatar: "avatar.jpg",
          gender: "male",
        },
      ];

      const event = new Event({
        organizerDetails,
      });

      const error = event.validateSync();
      expect(error?.errors?.organizerDetails).toBeUndefined();
    });

    it("should validate organizer gender enum", () => {
      const event = new Event({
        organizerDetails: [
          {
            name: "John Doe",
            role: "Lead Organizer",
            email: "john@example.com",
            phone: "123-456-7890",
            gender: "invalid-gender" as any,
          },
        ],
      });

      const error = event.validateSync();
      expect(error?.errors["organizerDetails.0.gender"]).toBeDefined();
    });
  });

  describe("Method Existence Tests", () => {
    it("should have calculateSignedUp method", () => {
      const event = new Event({});
      expect(typeof event.calculateSignedUp).toBe("function");
    });

    it("should have calculateTotalSlots method", () => {
      const event = new Event({});
      expect(typeof event.calculateTotalSlots).toBe("function");
    });

    it("should have toJSON method", () => {
      const event = new Event({});
      expect(typeof event.toJSON).toBe("function");
    });

    it("should have validateSync method", () => {
      const event = new Event({});
      expect(typeof event.validateSync).toBe("function");
    });
  });

  afterEach(() => {
    console.log("✅ Event model test environment cleaned up");
  });

  afterAll(() => {
    // Test cleanup complete
  });
});
