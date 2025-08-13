import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import Registration, {
  IRegistration,
  RegistrationAction,
  RegistrationStatus,
} from "../../../src/models/Registration";

describe("Registration Model", () => {
  console.log("🔧 Setting up Registration model test environment...");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log("✅ Registration model test environment cleaned up");
  });

  // Helper function to create valid registration data
  const createValidRegistrationData = () => ({
    userId: new mongoose.Types.ObjectId(),
    eventId: new mongoose.Types.ObjectId(),
    roleId: "role123",
    userSnapshot: {
      username: "testuser",
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      systemAuthorizationLevel: "Participant",
      roleInAtCloud: "Member",
      avatar: "avatar.jpg",
      gender: "male" as const,
    },
    eventSnapshot: {
      title: "Test Event",
      date: "2024-12-25",
      time: "14:30",
      location: "Test Location",
      type: "Effective Communication Workshop",
      roleName: "Participant",
      roleDescription: "Regular participant",
    },
    registeredBy: new mongoose.Types.ObjectId(),
  });

  describe("Schema Validation", () => {
    describe("Required Fields", () => {
      it("should require userId field", () => {
        const registration = new Registration({
          ...createValidRegistrationData(),
          userId: undefined,
        });
        const error = registration.validateSync();
        expect(error?.errors?.userId?.message).toBe("User ID is required");
      });

      it("should require eventId field", () => {
        const registration = new Registration({
          ...createValidRegistrationData(),
          eventId: undefined,
        });
        const error = registration.validateSync();
        expect(error?.errors?.eventId?.message).toBe("Event ID is required");
      });

      it("should require roleId field", () => {
        const registration = new Registration({
          ...createValidRegistrationData(),
          roleId: undefined,
        });
        const error = registration.validateSync();
        expect(error?.errors?.roleId?.message).toBe("Role ID is required");
      });

      it("should require userSnapshot field", () => {
        const registration = new Registration({
          ...createValidRegistrationData(),
          userSnapshot: undefined,
        });
        const error = registration.validateSync();
        expect(error?.errors?.userSnapshot?.message).toBe(
          "Path `userSnapshot` is required."
        );
      });

      it("should require eventSnapshot field", () => {
        const registration = new Registration({
          ...createValidRegistrationData(),
          eventSnapshot: undefined,
        });
        const error = registration.validateSync();
        expect(error?.errors?.eventSnapshot?.message).toBe(
          "Path `eventSnapshot` is required."
        );
      });

      it("should require registeredBy field", () => {
        const registration = new Registration({
          ...createValidRegistrationData(),
          registeredBy: undefined,
        });
        const error = registration.validateSync();
        expect(error?.errors?.registeredBy?.message).toBe(
          "Registered by user ID is required"
        );
      });
    });

    describe("Status Enum Validation", () => {
      it("should accept valid status values", () => {
        const validStatuses: RegistrationStatus[] = [
          "active",
          "waitlisted",
          "no_show",
          "attended",
        ];

        validStatuses.forEach((status) => {
          const registration = new Registration({
            ...createValidRegistrationData(),
            status,
          });
          const error = registration.validateSync();
          expect(error?.errors?.status).toBeUndefined();
        });
      });

      it("should reject invalid status values", () => {
        const registration = new Registration({
          ...createValidRegistrationData(),
          status: "invalid_status" as any,
        });
        const error = registration.validateSync();
        expect(error?.errors?.status?.message).toContain(
          "is not a valid enum value"
        );
      });

      it("should default status to active", () => {
        const registration = new Registration(createValidRegistrationData());
        expect(registration.status).toBe("active");
      });
    });

    describe("UserSnapshot Validation", () => {
      it("should require username in userSnapshot", () => {
        const data = createValidRegistrationData();
        data.userSnapshot.username = undefined as any;
        const registration = new Registration(data);
        const error = registration.validateSync();
        expect(error?.errors?.["userSnapshot.username"]?.message).toBe(
          "Path `username` is required."
        );
      });

      it("should require email in userSnapshot", () => {
        const data = createValidRegistrationData();
        data.userSnapshot.email = undefined as any;
        const registration = new Registration(data);
        const error = registration.validateSync();
        expect(error?.errors?.["userSnapshot.email"]?.message).toBe(
          "Path `email` is required."
        );
      });

      it("should validate gender enum in userSnapshot", () => {
        const data = createValidRegistrationData();
        data.userSnapshot.gender = "invalid" as any;
        const registration = new Registration(data);
        const error = registration.validateSync();
        expect(error?.errors?.["userSnapshot.gender"]?.message).toContain(
          "is not a valid enum value"
        );
      });

      it("should validate systemAuthorizationLevel enum", () => {
        const data = createValidRegistrationData();
        data.userSnapshot.systemAuthorizationLevel = "InvalidLevel" as any;
        const registration = new Registration(data);
        const error = registration.validateSync();
        expect(
          error?.errors?.["userSnapshot.systemAuthorizationLevel"]?.message
        ).toContain("is not a valid enum value");
      });
    });

    describe("EventSnapshot Validation", () => {
      it("should require title in eventSnapshot", () => {
        const data = createValidRegistrationData();
        data.eventSnapshot.title = undefined as any;
        const registration = new Registration(data);
        const error = registration.validateSync();
        expect(error?.errors?.["eventSnapshot.title"]?.message).toBe(
          "Path `title` is required."
        );
      });

      it("should validate date format in eventSnapshot", () => {
        const data = createValidRegistrationData();
        data.eventSnapshot.date = "invalid-date";
        const registration = new Registration(data);
        const error = registration.validateSync();
        expect(error?.errors?.["eventSnapshot.date"]?.message).toBe(
          "Date must be in YYYY-MM-DD format"
        );
      });

      it("should accept valid date format in eventSnapshot", () => {
        const data = createValidRegistrationData();
        data.eventSnapshot.date = "2024-12-25";
        const registration = new Registration(data);
        const error = registration.validateSync();
        expect(error?.errors?.["eventSnapshot.date"]).toBeUndefined();
      });

      it("should validate time format in eventSnapshot", () => {
        const data = createValidRegistrationData();
        data.eventSnapshot.time = "invalid-time";
        const registration = new Registration(data);
        const error = registration.validateSync();
        expect(error?.errors?.["eventSnapshot.time"]?.message).toBe(
          "Time must be in HH:MM format"
        );
      });

      it("should accept valid time format in eventSnapshot", () => {
        const data = createValidRegistrationData();
        data.eventSnapshot.time = "14:30";
        const registration = new Registration(data);
        const error = registration.validateSync();
        expect(error?.errors?.["eventSnapshot.time"]).toBeUndefined();
      });
    });

    describe("Field Length Validations", () => {
      it("should validate notes length", () => {
        const registration = new Registration({
          ...createValidRegistrationData(),
          notes: "a".repeat(501),
        });
        const error = registration.validateSync();
        expect(error?.errors?.notes?.message).toBe(
          "Notes cannot exceed 500 characters"
        );
      });

      it("should validate specialRequirements length", () => {
        const registration = new Registration({
          ...createValidRegistrationData(),
          specialRequirements: "a".repeat(501),
        });
        const error = registration.validateSync();
        expect(error?.errors?.specialRequirements?.message).toBe(
          "Special requirements cannot exceed 500 characters"
        );
      });

      it("should validate userAgent length", () => {
        const registration = new Registration({
          ...createValidRegistrationData(),
          userAgent: "a".repeat(501),
        });
        const error = registration.validateSync();
        expect(error?.errors?.userAgent?.message).toBe(
          "User agent cannot exceed 500 characters"
        );
      });
    });

    describe("IP Address Validation", () => {
      it("should accept valid IPv4 addresses", () => {
        const registration = new Registration({
          ...createValidRegistrationData(),
          ipAddress: "192.168.1.1",
        });
        const error = registration.validateSync();
        expect(error?.errors?.ipAddress).toBeUndefined();
      });

      it("should accept valid IPv6 addresses", () => {
        const registration = new Registration({
          ...createValidRegistrationData(),
          ipAddress: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        });
        const error = registration.validateSync();
        expect(error?.errors?.ipAddress).toBeUndefined();
      });

      it("should reject invalid IP addresses", () => {
        const registration = new Registration({
          ...createValidRegistrationData(),
          ipAddress: "invalid.ip.address",
        });
        const error = registration.validateSync();
        expect(error?.errors?.ipAddress?.message).toBe(
          "Invalid IP address format"
        );
      });

      it("should allow empty IP address", () => {
        const registration = new Registration({
          ...createValidRegistrationData(),
          ipAddress: "",
        });
        const error = registration.validateSync();
        expect(error?.errors?.ipAddress).toBeUndefined();
      });
    });
  });

  describe("Instance Methods", () => {
    let registration: IRegistration;
    let updatedBy: mongoose.Types.ObjectId;

    beforeEach(() => {
      registration = new Registration(createValidRegistrationData());
      updatedBy = new mongoose.Types.ObjectId();

      // Mock the save method
      registration.save = vi.fn().mockResolvedValue(registration);
    });

    describe("addAuditEntry", () => {
      it("should add audit entry to actionHistory", () => {
        registration.addAuditEntry(
          "updated_notes",
          updatedBy,
          "Test audit entry"
        );

        expect(registration.actionHistory).toHaveLength(1);
        expect(registration.actionHistory[0].action).toBe("updated_notes");
        expect(registration.actionHistory[0].performedBy).toEqual(updatedBy);
        expect(registration.actionHistory[0].details).toBe("Test audit entry");
      });

      it("should add audit entry with previous and new values", () => {
        const previousValue = { notes: "old notes" };
        const newValue = { notes: "new notes" };

        registration.addAuditEntry(
          "updated_notes",
          updatedBy,
          "Notes updated",
          previousValue,
          newValue
        );

        expect(registration.actionHistory[0].previousValue).toEqual(
          previousValue
        );
        expect(registration.actionHistory[0].newValue).toEqual(newValue);
      });
    });

    describe("updateNotes", () => {
      it("should update notes and add audit entry", async () => {
        const oldNotes = "old notes";
        const newNotes = "new notes";
        registration.notes = oldNotes;

        await registration.updateNotes(newNotes, updatedBy);

        expect(registration.notes).toBe(newNotes);
        expect(registration.actionHistory).toHaveLength(1);
        expect(registration.actionHistory[0].action).toBe("updated_notes");
        expect(registration.actionHistory[0].previousValue).toEqual({
          notes: oldNotes,
        });
        expect(registration.actionHistory[0].newValue).toEqual({
          notes: newNotes,
        });
        expect(registration.save).toHaveBeenCalled();
      });
    });

    describe("changeRole", () => {
      it("should change role and add audit entry", async () => {
        const oldRoleId = registration.roleId;
        const oldRoleName = registration.eventSnapshot.roleName;
        const newRoleId = "newRole123";
        const newRoleName = "New Role";

        await registration.changeRole(newRoleId, newRoleName, updatedBy);

        expect(registration.roleId).toBe(newRoleId);
        expect(registration.eventSnapshot.roleName).toBe(newRoleName);
        expect(registration.actionHistory).toHaveLength(1);
        expect(registration.actionHistory[0].action).toBe("role_changed");
        expect(registration.actionHistory[0].details).toBe(
          `Role changed from ${oldRoleName} to ${newRoleName}`
        );
        expect(registration.save).toHaveBeenCalled();
      });
    });

    describe("confirmAttendance", () => {
      it("should confirm attendance for active registration", async () => {
        registration.status = "active";
        registration.attendanceConfirmed = false;

        await registration.confirmAttendance(updatedBy);

        expect(registration.attendanceConfirmed).toBe(true);
        expect(registration.status).toBe("attended");
        expect(registration.actionHistory).toHaveLength(1);
        expect(registration.actionHistory[0].action).toBe("updated_notes");
        expect(registration.save).toHaveBeenCalled();
      });

      it("should throw error for non-active registration", async () => {
        registration.status = "waitlisted";

        await expect(registration.confirmAttendance(updatedBy)).rejects.toThrow(
          "Can only confirm attendance for active registrations"
        );
      });
    });
  });

  describe("Pre-save Middleware", () => {
    it("should add initial audit entry for new registration", () => {
      const registration = new Registration(createValidRegistrationData());

      // Simulate the pre-save middleware
      registration.addAuditEntry(
        "registered",
        registration.registeredBy,
        `Registered for role: ${registration.eventSnapshot.roleName}`
      );

      expect(registration.actionHistory).toHaveLength(1);
      expect(registration.actionHistory[0].action).toBe("registered");
      expect(registration.actionHistory[0].performedBy).toEqual(
        registration.registeredBy
      );
    });
  });

  describe("Default Values", () => {
    it("should set default values correctly", () => {
      const registration = new Registration(createValidRegistrationData());

      expect(registration.status).toBe("active");
      expect(registration.attendanceConfirmed).toBe(false);
      expect(registration.actionHistory).toEqual([]);
      expect(registration.registrationDate).toBeInstanceOf(Date);
    });
  });

  describe("JSON Transformation", () => {
    it("should transform _id to id in JSON output", () => {
      const registration = new Registration(createValidRegistrationData());
      const json = registration.toJSON();

      expect(json.id).toBeDefined();
      expect(json._id).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });
  });

  describe("Action History Validation", () => {
    it("should validate action enum values", () => {
      const registration = new Registration(createValidRegistrationData());

      registration.actionHistory.push({
        action: "invalid_action" as any,
        performedBy: new mongoose.Types.ObjectId(),
        performedAt: new Date(),
      });

      const error = registration.validateSync();
      expect(error?.errors?.["actionHistory.0.action"]?.message).toContain(
        "is not a valid enum value"
      );
    });

    it("should require performedBy in action history", () => {
      const registration = new Registration(createValidRegistrationData());

      registration.actionHistory.push({
        action: "updated_notes",
        performedBy: undefined as any,
        performedAt: new Date(),
      });

      const error = registration.validateSync();
      expect(error?.errors?.["actionHistory.0.performedBy"]?.message).toBe(
        "Path `performedBy` is required."
      );
    });

    it("should validate details length in action history", () => {
      const registration = new Registration(createValidRegistrationData());

      registration.actionHistory.push({
        action: "updated_notes",
        performedBy: new mongoose.Types.ObjectId(),
        performedAt: new Date(),
        details: "a".repeat(501),
      });

      const error = registration.validateSync();
      expect(error?.errors?.["actionHistory.0.details"]?.message).toBe(
        "Action details cannot exceed 500 characters"
      );
    });
  });

  describe("Method Existence Tests", () => {
    it("should have addAuditEntry method", () => {
      const registration = new Registration(createValidRegistrationData());
      expect(typeof registration.addAuditEntry).toBe("function");
    });

    it("should have updateNotes method", () => {
      const registration = new Registration(createValidRegistrationData());
      expect(typeof registration.updateNotes).toBe("function");
    });

    it("should have changeRole method", () => {
      const registration = new Registration(createValidRegistrationData());
      expect(typeof registration.changeRole).toBe("function");
    });

    it("should have confirmAttendance method", () => {
      const registration = new Registration(createValidRegistrationData());
      expect(typeof registration.confirmAttendance).toBe("function");
    });

    it("should have toJSON method", () => {
      const registration = new Registration(createValidRegistrationData());
      expect(typeof registration.toJSON).toBe("function");
    });

    it("should have validateSync method", () => {
      const registration = new Registration(createValidRegistrationData());
      expect(typeof registration.validateSync).toBe("function");
    });
  });

  describe("Static Methods", () => {
    describe("getEventStats", () => {
      it("should have getEventStats static method", () => {
        expect(typeof (Registration as any).getEventStats).toBe("function");
      });

      // Note: Testing the actual implementation would require database connection
      // which is beyond the scope of unit testing. The implementation involves
      // complex aggregation pipelines that would be better tested in integration tests.
    });
  });
});
