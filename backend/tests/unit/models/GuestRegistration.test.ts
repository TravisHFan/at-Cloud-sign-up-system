import { describe, it, expect, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";
import { GuestRegistration, IGuestRegistration } from "../../../src/models";

describe("GuestRegistration Model", () => {
  beforeEach(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect("mongodb://localhost:27017/atcloud-signup-test");
    }
  });

  afterEach(async () => {
    // Clean up test data
    await GuestRegistration.deleteMany({});
  });

  describe("Schema Validation", () => {
    it("should create a valid guest registration", async () => {
      const guestData = {
        eventId: new mongoose.Types.ObjectId(),
        roleId: "role123",
        fullName: "John Doe",
        gender: "male" as const,
        email: "john@example.com",
        phone: "555-123-4567",
        eventSnapshot: {
          title: "Test Event",
          date: new Date(),
          location: "Test Location",
          roleName: "Participant",
        },
      };

      const guest = new GuestRegistration(guestData);
      const savedGuest = await guest.save();

      expect(savedGuest._id).toBeDefined();
      expect(savedGuest.fullName).toBe("John Doe");
      expect(savedGuest.email).toBe("john@example.com");
      expect(savedGuest.status).toBe("active");
      expect(savedGuest.migrationStatus).toBe("pending");
      expect(savedGuest.createdAt).toBeDefined();
    });

    it("should require all mandatory fields", async () => {
      const guest = new GuestRegistration({});

      try {
        await guest.save();
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.name).toBe("ValidationError");
        expect(error.errors.eventId).toBeDefined();
        expect(error.errors.roleId).toBeDefined();
        expect(error.errors.fullName).toBeDefined();
        expect(error.errors.gender).toBeDefined();
        expect(error.errors.email).toBeDefined();
        expect(error.errors.phone).toBeDefined();
      }
    });

    it("should validate gender enum", async () => {
      const guestData = {
        eventId: new mongoose.Types.ObjectId(),
        roleId: "role123",
        fullName: "John Doe",
        gender: "invalid" as any,
        email: "john@example.com",
        phone: "555-123-4567",
        eventSnapshot: {
          title: "Test Event",
          date: new Date(),
          location: "Test Location",
          roleName: "Participant",
        },
      };

      const guest = new GuestRegistration(guestData);

      try {
        await guest.save();
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.name).toBe("ValidationError");
        expect(error.errors.gender).toBeDefined();
      }
    });

    it("should validate email format", async () => {
      const guestData = {
        eventId: new mongoose.Types.ObjectId(),
        roleId: "role123",
        fullName: "John Doe",
        gender: "male" as const,
        email: "invalid-email",
        phone: "555-123-4567",
        eventSnapshot: {
          title: "Test Event",
          date: new Date(),
          location: "Test Location",
          roleName: "Participant",
        },
      };

      const guest = new GuestRegistration(guestData);

      try {
        await guest.save();
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.name).toBe("ValidationError");
        expect(error.errors.email).toBeDefined();
      }
    });
  });

  describe("Instance Methods", () => {
    let testGuest: IGuestRegistration;

    beforeEach(async () => {
      const guestData = {
        eventId: new mongoose.Types.ObjectId(),
        roleId: "role123",
        fullName: "John Doe",
        gender: "male" as const,
        email: "john@example.com",
        phone: "555-123-4567",
        ipAddress: "192.168.1.1",
        userAgent: "Test Browser",
        eventSnapshot: {
          title: "Test Event",
          date: new Date(),
          location: "Test Location",
          roleName: "Participant",
        },
      };

      testGuest = await GuestRegistration.create(guestData);
    });

    it("should have toPublicJSON method that removes sensitive data", () => {
      const publicData = testGuest.toPublicJSON();

      expect(publicData.fullName).toBe("John Doe");
      expect(publicData.email).toBe("john@example.com");
      expect(publicData.ipAddress).toBeUndefined();
      expect(publicData.userAgent).toBeUndefined();
      expect(publicData.__v).toBeUndefined();
    });

    it("should have toAdminJSON method that keeps sensitive data", () => {
      const adminData = testGuest.toAdminJSON();

      expect(adminData.fullName).toBe("John Doe");
      expect(adminData.email).toBe("john@example.com");
      expect(adminData.ipAddress).toBe("192.168.1.1");
      expect(adminData.userAgent).toBe("Test Browser");
      expect(adminData.__v).toBeUndefined();
    });
  });

  describe("Static Methods", () => {
    let eventId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      eventId = new mongoose.Types.ObjectId();

      // Create test data
      await GuestRegistration.create([
        {
          eventId,
          roleId: "role1",
          fullName: "John Doe",
          gender: "male",
          email: "john@example.com",
          phone: "555-123-4567",
          status: "active",
          eventSnapshot: {
            title: "Test Event",
            date: new Date(),
            location: "Test Location",
            roleName: "Role 1",
          },
        },
        {
          eventId,
          roleId: "role2",
          fullName: "Jane Smith",
          gender: "female",
          email: "jane@example.com",
          phone: "555-987-6543",
          status: "cancelled",
          eventSnapshot: {
            title: "Test Event",
            date: new Date(),
            location: "Test Location",
            roleName: "Role 2",
          },
        },
      ]);
    });

    it("should find active registrations by event", async () => {
      const activeRegistrations = await GuestRegistration.findActiveByEvent(
        eventId.toString()
      );

      expect(activeRegistrations).toHaveLength(1);
      expect(activeRegistrations[0].fullName).toBe("John Doe");
      expect(activeRegistrations[0].status).toBe("active");
    });

    it("should find registrations by email", async () => {
      const registrations = await GuestRegistration.findByEmailAndStatus(
        "john@example.com"
      );

      expect(registrations).toHaveLength(1);
      expect(registrations[0].fullName).toBe("John Doe");
    });

    it("should count active registrations", async () => {
      const count = await GuestRegistration.countActiveRegistrations(
        eventId.toString()
      );

      expect(count).toBe(1);
    });

    it("should count active registrations by role", async () => {
      const count = await GuestRegistration.countActiveRegistrations(
        eventId.toString(),
        "role1"
      );

      expect(count).toBe(1);
    });

    it("should find eligible registrations for migration", async () => {
      const eligible = await GuestRegistration.findEligibleForMigration(
        "john@example.com"
      );

      expect(eligible).toHaveLength(1);
      expect(eligible[0].fullName).toBe("John Doe");
      expect(eligible[0].migrationStatus).toBe("pending");
    });
  });

  describe("Pre-save Middleware", () => {
    it("should lowercase email on save", async () => {
      const guestData = {
        eventId: new mongoose.Types.ObjectId(),
        roleId: "role123",
        fullName: "John Doe",
        gender: "male" as const,
        email: "JOHN@EXAMPLE.COM",
        phone: "555-123-4567",
        eventSnapshot: {
          title: "Test Event",
          date: new Date(),
          location: "Test Location",
          roleName: "Participant",
        },
      };

      const guest = await GuestRegistration.create(guestData);

      expect(guest.email).toBe("john@example.com");
    });

    it("should trim fullName on save", async () => {
      const guestData = {
        eventId: new mongoose.Types.ObjectId(),
        roleId: "role123",
        fullName: "  John Doe  ",
        gender: "male" as const,
        email: "john@example.com",
        phone: "555-123-4567",
        eventSnapshot: {
          title: "Test Event",
          date: new Date(),
          location: "Test Location",
          roleName: "Participant",
        },
      };

      const guest = await GuestRegistration.create(guestData);

      expect(guest.fullName).toBe("John Doe");
    });
  });
});
