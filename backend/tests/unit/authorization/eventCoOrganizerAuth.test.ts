import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";
import { ROLES } from "../../../src/utils/roleUtils";

describe("Event Co-Organizer Authorization Unit Test", () => {
  let creatorUser: any;
  let coOrganizerUser: any;
  let nonOrganizerUser: any;
  let testEvent: any;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-test"
      );
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up
    await User.deleteMany({});
    await Event.deleteMany({});

    // Create test users
    creatorUser = await User.create({
      username: "creator",
      firstName: "Event",
      lastName: "Creator",
      email: "creator@test.com",
      password: "Password123",
      role: ROLES.LEADER,
      phoneNumber: "1234567890",
      dateOfBirth: new Date("1990-01-01"),
      isActive: true,
      isVerified: true,
    });

    coOrganizerUser = await User.create({
      username: "coorganizer",
      firstName: "Co",
      lastName: "Organizer",
      email: "coorganizer@test.com",
      password: "Password123",
      role: ROLES.LEADER,
      phoneNumber: "1234567891",
      dateOfBirth: new Date("1990-01-02"),
      isActive: true,
      isVerified: true,
    });

    nonOrganizerUser = await User.create({
      username: "nonorganizer",
      firstName: "Non",
      lastName: "Organizer",
      email: "nonorganizer@test.com",
      password: "Password123",
      role: ROLES.LEADER,
      phoneNumber: "1234567892",
      dateOfBirth: new Date("1990-01-03"),
      isActive: true,
      isVerified: true,
    });

    // Create test event with co-organizer
    testEvent = await Event.create({
      title: "Test Event",
      description: "Test Description",
      date: new Date("2025-12-25"),
      time: "10:00",
      endTime: "12:00",
      location: "Test Location",
      type: "Workshop",
      organizer: `${creatorUser.firstName} ${creatorUser.lastName} (${creatorUser.role})`,
      organizerDetails: [
        {
          userId: creatorUser._id,
          name: `${creatorUser.firstName} ${creatorUser.lastName}`,
          role: creatorUser.role,
          email: creatorUser.email,
          phone: creatorUser.phoneNumber,
        },
        {
          userId: coOrganizerUser._id,
          name: `${coOrganizerUser.firstName} ${coOrganizerUser.lastName}`,
          role: coOrganizerUser.role,
          email: coOrganizerUser.email,
          phone: coOrganizerUser.phoneNumber,
        },
      ],
      format: "In-person",
      purpose: "Test Purpose",
      agenda: "Test Agenda",
      roles: [
        {
          id: "test-role",
          name: "Participant",
          description: "Test participant role",
          maxParticipants: 10,
          currentSignups: [],
        },
      ],
      createdBy: creatorUser._id,
      hostedBy: "@Cloud Marketplace Ministry",
    });
  });

  describe("Authorization Logic Tests", () => {
    it("should identify event creator correctly", async () => {
      const event = await Event.findById(testEvent._id);
      expect(event?.createdBy.toString()).toBe(creatorUser._id.toString());
    });

    it("should identify co-organizers correctly", async () => {
      const event = await Event.findById(testEvent._id);
      const isCoOrganizer = event?.organizerDetails?.some(
        (organizer) => organizer.email === coOrganizerUser.email
      );
      expect(isCoOrganizer).toBe(true);
    });

    it("should not identify non-organizers as organizers", async () => {
      const event = await Event.findById(testEvent._id);
      const isOrganizer = event?.organizerDetails?.some(
        (organizer) => organizer.email === nonOrganizerUser.email
      );
      expect(isOrganizer).toBe(false);
    });

    it("should validate authorization middleware logic", async () => {
      const event = await Event.findById(testEvent._id);

      // Simulate the authorizeEventManagement middleware logic
      const checkAuthorization = (userEmail: string, userId: string) => {
        // Check if user created the event
        if (event?.createdBy.toString() === userId) {
          return { authorized: true, reason: "Event creator" };
        }

        // Check if user is listed as an organizer
        const isOrganizer = event?.organizerDetails?.some(
          (organizer) => organizer.email === userEmail
        );

        if (isOrganizer) {
          return { authorized: true, reason: "Listed organizer" };
        }

        return { authorized: false, reason: "Not authorized" };
      };

      // Test creator authorization
      const creatorAuth = checkAuthorization(
        creatorUser.email,
        creatorUser._id.toString()
      );
      expect(creatorAuth.authorized).toBe(true);
      expect(creatorAuth.reason).toBe("Event creator");

      // Test co-organizer authorization
      const coOrganizerAuth = checkAuthorization(
        coOrganizerUser.email,
        coOrganizerUser._id.toString()
      );
      expect(coOrganizerAuth.authorized).toBe(true);
      expect(coOrganizerAuth.reason).toBe("Listed organizer");

      // Test non-organizer authorization
      const nonOrganizerAuth = checkAuthorization(
        nonOrganizerUser.email,
        nonOrganizerUser._id.toString()
      );
      expect(nonOrganizerAuth.authorized).toBe(false);
      expect(nonOrganizerAuth.reason).toBe("Not authorized");
    });
  });
});
