/**
 * Pre-Migration Baseline Tests
 *
 * These tests establish a baseline of current functionality before migration.
 * They test the existing dual-collection system to ensure we understand
 * current behavior and can compare post-migration results.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import mongoose from "mongoose";
import { Event, Registration, User } from "../../src/models";
import { EventController } from "../../src/controllers/eventController";
import { ThreadSafeEventService } from "../../src/services";

describe("🔄 Pre-Migration Baseline Tests", () => {
  let testEvent: any;
  let testUser: any;
  let roleId: string;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(
      process.env.MONGODB_TEST_URI ||
        "mongodb://localhost:27017/test-event-system"
    );
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear test data
    await Event.deleteMany({});
    await Registration.deleteMany({});
    await User.deleteMany({});

    // Create test user
    testUser = await User.create({
      email: "test@example.com",
      username: "testuser",
      firstName: "Test",
      lastName: "User",
      password: "hashedpassword",
      role: "Participant",
      isVerified: true,
    });

    // Create test event with roles
    const eventData = {
      title: "Test Event",
      type: "Meeting",
      date: "2025-02-01",
      time: "10:00",
      endTime: "12:00",
      location: "Test Location",
      organizer: "Test Organizer",
      purpose: "Testing",
      format: "In-person",
      roles: [
        {
          name: "Common Participant (on-site)",
          description: "Regular participant",
          maxParticipants: 5,
        },
        {
          name: "Prepared Speaker (on-site)",
          description: "Speaker role",
          maxParticipants: 2,
        },
      ],
      createdBy: testUser._id,
      status: "upcoming",
    };

    testEvent = await Event.create(eventData);
    roleId = testEvent.roles[0].id;
  });

  afterEach(async () => {
    // Clean up test data
    await Event.deleteMany({});
    await Registration.deleteMany({});
    await User.deleteMany({});
  });

  describe("Current Dual-Collection Behavior", () => {
    it("should maintain sync between Event.currentSignups and Registration collection", async () => {
      // Sign up user using current system
      const signupResult = await ThreadSafeEventService.signupForEvent(
        testEvent._id,
        {
          userId: testUser._id,
          roleId,
          userData: {
            userId: testUser._id,
            username: testUser.username,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            systemAuthorizationLevel: testUser.role,
            roleInAtCloud: testUser.roleInAtCloud,
            avatar: testUser.avatar,
            gender: testUser.gender,
          },
          registrationData: {
            notes: "Test signup",
            registeredBy: testUser._id,
            userSnapshot: {
              username: testUser.username,
              firstName: testUser.firstName,
              lastName: testUser.lastName,
              email: testUser.email,
              systemAuthorizationLevel: testUser.role,
              roleInAtCloud: testUser.roleInAtCloud,
              avatar: testUser.avatar,
              gender: testUser.gender,
            },
            eventSnapshot: {
              title: testEvent.title,
              date: testEvent.date,
              time: testEvent.time,
              location: testEvent.location,
              type: testEvent.type,
              roleName: testEvent.roles[0].name,
              roleDescription: testEvent.roles[0].description,
            },
          },
        }
      );

      expect(signupResult.success).toBe(true);

      // Check Event collection currentSignups
      const updatedEvent = await Event.findById(testEvent._id);
      const targetRole = updatedEvent.roles.find((r: any) => r.id === roleId);
      expect(targetRole.currentSignups).toHaveLength(1);
      expect(targetRole.currentSignups[0].userId.toString()).toBe(
        testUser._id.toString()
      );

      // Check Registration collection
      const registration = await Registration.findOne({
        eventId: testEvent._id,
        userId: testUser._id,
        roleId,
        status: "active",
      });
      expect(registration).toBeTruthy();
      expect(registration.roleId).toBe(roleId);

      // Verify counts match
      const eventSignupCount = targetRole.currentSignups.length;
      const registrationCount = await Registration.countDocuments({
        eventId: testEvent._id,
        roleId,
        status: "active",
      });
      expect(eventSignupCount).toBe(registrationCount);
    });

    it("should handle role capacity limits correctly", async () => {
      // Fill up the role to capacity (5 participants)
      const users = [];
      for (let i = 0; i < 5; i++) {
        const user = await User.create({
          email: `test${i}@example.com`,
          username: `testuser${i}`,
          firstName: `Test${i}`,
          lastName: `User${i}`,
          password: "hashedpassword",
          role: "Participant",
          isVerified: true,
        });
        users.push(user);

        const result = await ThreadSafeEventService.signupForEvent(
          testEvent._id,
          {
            userId: user._id,
            roleId,
            userData: {
              userId: user._id,
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              systemAuthorizationLevel: user.role,
              roleInAtCloud: user.roleInAtCloud,
              avatar: user.avatar,
              gender: user.gender,
            },
            registrationData: {
              registeredBy: user._id,
              userSnapshot: {
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                systemAuthorizationLevel: user.role,
                roleInAtCloud: user.roleInAtCloud,
                avatar: user.avatar,
                gender: user.gender,
              },
              eventSnapshot: {
                title: testEvent.title,
                date: testEvent.date,
                time: testEvent.time,
                location: testEvent.location,
                type: testEvent.type,
                roleName: testEvent.roles[0].name,
                roleDescription: testEvent.roles[0].description,
              },
            },
          }
        );

        expect(result.success).toBe(true);
      }

      // Try to add one more (should fail)
      const extraUser = await User.create({
        email: "extra@example.com",
        username: "extrauser",
        firstName: "Extra",
        lastName: "User",
        password: "hashedpassword",
        role: "Participant",
        isVerified: true,
      });

      await expect(
        ThreadSafeEventService.signupForEvent(testEvent._id, {
          userId: extraUser._id,
          roleId,
          userData: {
            userId: extraUser._id,
            username: extraUser.username,
            firstName: extraUser.firstName,
            lastName: extraUser.lastName,
            systemAuthorizationLevel: extraUser.role,
            roleInAtCloud: extraUser.roleInAtCloud,
            avatar: extraUser.avatar,
            gender: extraUser.gender,
          },
          registrationData: {
            registeredBy: extraUser._id,
            userSnapshot: {
              username: extraUser.username,
              firstName: extraUser.firstName,
              lastName: extraUser.lastName,
              email: extraUser.email,
              systemAuthorizationLevel: extraUser.role,
              roleInAtCloud: extraUser.roleInAtCloud,
              avatar: extraUser.avatar,
              gender: extraUser.gender,
            },
            eventSnapshot: {
              title: testEvent.title,
              date: testEvent.date,
              time: testEvent.time,
              location: testEvent.location,
              type: testEvent.type,
              roleName: testEvent.roles[0].name,
              roleDescription: testEvent.roles[0].description,
            },
          },
        })
      ).rejects.toThrow();

      // Verify final counts
      const finalEvent = await Event.findById(testEvent._id);
      const finalRole = finalEvent.roles.find((r: any) => r.id === roleId);
      expect(finalRole.currentSignups).toHaveLength(5);

      const finalRegistrationCount = await Registration.countDocuments({
        eventId: testEvent._id,
        roleId,
        status: "active",
      });
      expect(finalRegistrationCount).toBe(5);
    });

    it("should handle user role movement correctly", async () => {
      // Sign up user to first role
      await ThreadSafeEventService.signupForEvent(testEvent._id, {
        userId: testUser._id,
        roleId,
        userData: {
          userId: testUser._id,
          username: testUser.username,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          systemAuthorizationLevel: testUser.role,
          roleInAtCloud: testUser.roleInAtCloud,
          avatar: testUser.avatar,
          gender: testUser.gender,
        },
        registrationData: {
          registeredBy: testUser._id,
          userSnapshot: {
            username: testUser.username,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            email: testUser.email,
            systemAuthorizationLevel: testUser.role,
            roleInAtCloud: testUser.roleInAtCloud,
            avatar: testUser.avatar,
            gender: testUser.gender,
          },
          eventSnapshot: {
            title: testEvent.title,
            date: testEvent.date,
            time: testEvent.time,
            location: testEvent.location,
            type: testEvent.type,
            roleName: testEvent.roles[0].name,
            roleDescription: testEvent.roles[0].description,
          },
        },
      });

      const secondRoleId = testEvent.roles[1].id;

      // Move user to second role (simulate admin action)
      const event = await Event.findById(testEvent._id);
      const sourceRole = event.roles.find((r: any) => r.id === roleId);
      const targetRole = event.roles.find((r: any) => r.id === secondRoleId);

      const userIndex = sourceRole.currentSignups.findIndex(
        (user: any) => user.userId.toString() === testUser._id.toString()
      );
      expect(userIndex).toBeGreaterThanOrEqual(0);

      const user = sourceRole.currentSignups[userIndex];
      sourceRole.currentSignups.splice(userIndex, 1);
      targetRole.currentSignups.push(user);
      await event.save();

      // Update registration record
      const registration = await Registration.findOne({
        userId: testUser._id,
        eventId: testEvent._id,
        roleId,
        status: "active",
      });
      expect(registration).toBeTruthy();

      registration.roleId = secondRoleId;
      registration.eventSnapshot.roleName = targetRole.name;
      registration.eventSnapshot.roleDescription = targetRole.description;
      await registration.save();

      // Verify movement
      const finalEvent = await Event.findById(testEvent._id);
      const finalSourceRole = finalEvent.roles.find(
        (r: any) => r.id === roleId
      );
      const finalTargetRole = finalEvent.roles.find(
        (r: any) => r.id === secondRoleId
      );

      expect(finalSourceRole.currentSignups).toHaveLength(0);
      expect(finalTargetRole.currentSignups).toHaveLength(1);
      expect(finalTargetRole.currentSignups[0].userId.toString()).toBe(
        testUser._id.toString()
      );

      // Verify registration record
      const finalRegistration = await Registration.findOne({
        userId: testUser._id,
        eventId: testEvent._id,
        status: "active",
      });
      expect(finalRegistration.roleId).toBe(secondRoleId);
    });

    it("should handle cancellation correctly", async () => {
      // Sign up user
      await ThreadSafeEventService.signupForEvent(testEvent._id, {
        userId: testUser._id,
        roleId,
        userData: {
          userId: testUser._id,
          username: testUser.username,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          systemAuthorizationLevel: testUser.role,
          roleInAtCloud: testUser.roleInAtCloud,
          avatar: testUser.avatar,
          gender: testUser.gender,
        },
        registrationData: {
          registeredBy: testUser._id,
          userSnapshot: {
            username: testUser.username,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            email: testUser.email,
            systemAuthorizationLevel: testUser.role,
            roleInAtCloud: testUser.roleInAtCloud,
            avatar: testUser.avatar,
            gender: testUser.gender,
          },
          eventSnapshot: {
            title: testEvent.title,
            date: testEvent.date,
            time: testEvent.time,
            location: testEvent.location,
            type: testEvent.type,
            roleName: testEvent.roles[0].name,
            roleDescription: testEvent.roles[0].description,
          },
        },
      });

      // Cancel signup
      const cancelResult = await ThreadSafeEventService.cancelSignup(
        testEvent._id,
        {
          userId: testUser._id,
          roleId,
        }
      );

      expect(cancelResult.success).toBe(true);

      // Verify removal from Event collection
      const updatedEvent = await Event.findById(testEvent._id);
      const updatedRole = updatedEvent.roles.find((r: any) => r.id === roleId);
      expect(updatedRole.currentSignups).toHaveLength(0);

      // Verify registration record is updated
      const registration = await Registration.findOne({
        userId: testUser._id,
        eventId: testEvent._id,
        roleId,
      });
      expect(registration.status).toBe("cancelled");
    });
  });

  describe("Race Condition Scenarios", () => {
    it("should handle concurrent signups for same role correctly", async () => {
      // Create multiple users
      const users = [];
      for (let i = 0; i < 3; i++) {
        const user = await User.create({
          email: `concurrent${i}@example.com`,
          username: `concurrent${i}`,
          firstName: `Concurrent${i}`,
          lastName: `User${i}`,
          password: "hashedpassword",
          role: "Participant",
          isVerified: true,
        });
        users.push(user);
      }

      // Try concurrent signups
      const signupPromises = users.map((user) =>
        ThreadSafeEventService.signupForEvent(testEvent._id, {
          userId: user._id,
          roleId,
          userData: {
            userId: user._id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            systemAuthorizationLevel: user.role,
            roleInAtCloud: user.roleInAtCloud,
            avatar: user.avatar,
            gender: user.gender,
          },
          registrationData: {
            registeredBy: user._id,
            userSnapshot: {
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              systemAuthorizationLevel: user.role,
              roleInAtCloud: user.roleInAtCloud,
              avatar: user.avatar,
              gender: user.gender,
            },
            eventSnapshot: {
              title: testEvent.title,
              date: testEvent.date,
              time: testEvent.time,
              location: testEvent.location,
              type: testEvent.type,
              roleName: testEvent.roles[0].name,
              roleDescription: testEvent.roles[0].description,
            },
          },
        })
      );

      const results = await Promise.all(signupPromises);
      const successfulSignups = results.filter((r) => r.success);
      expect(successfulSignups).toHaveLength(3);

      // Verify final state consistency
      const finalEvent = await Event.findById(testEvent._id);
      const finalRole = finalEvent.roles.find((r: any) => r.id === roleId);
      expect(finalRole.currentSignups).toHaveLength(3);

      const registrationCount = await Registration.countDocuments({
        eventId: testEvent._id,
        roleId,
        status: "active",
      });
      expect(registrationCount).toBe(3);
    });
  });

  describe("Data Integrity Checks", () => {
    it("should maintain data consistency between collections", async () => {
      // Sign up multiple users
      const users = [];
      for (let i = 0; i < 3; i++) {
        const user = await User.create({
          email: `integrity${i}@example.com`,
          username: `integrity${i}`,
          firstName: `Integrity${i}`,
          lastName: `User${i}`,
          password: "hashedpassword",
          role: "Participant",
          isVerified: true,
        });
        users.push(user);

        await ThreadSafeEventService.signupForEvent(testEvent._id, {
          userId: user._id,
          roleId,
          userData: {
            userId: user._id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            systemAuthorizationLevel: user.role,
            roleInAtCloud: user.roleInAtCloud,
            avatar: user.avatar,
            gender: user.gender,
          },
          registrationData: {
            registeredBy: user._id,
            userSnapshot: {
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              systemAuthorizationLevel: user.role,
              roleInAtCloud: user.roleInAtCloud,
              avatar: user.avatar,
              gender: user.gender,
            },
            eventSnapshot: {
              title: testEvent.title,
              date: testEvent.date,
              time: testEvent.time,
              location: testEvent.location,
              type: testEvent.type,
              roleName: testEvent.roles[0].name,
              roleDescription: testEvent.roles[0].description,
            },
          },
        });
      }

      // Comprehensive consistency check
      const event = await Event.findById(testEvent._id);
      const role = event.roles.find((r: any) => r.id === roleId);
      const eventSignupCount = role.currentSignups.length;

      const registrationCount = await Registration.countDocuments({
        eventId: testEvent._id,
        roleId,
        status: "active",
      });

      const registrations = await Registration.find({
        eventId: testEvent._id,
        roleId,
        status: "active",
      });

      // Verify counts match
      expect(eventSignupCount).toBe(registrationCount);
      expect(eventSignupCount).toBe(3);

      // Verify all users in Event are in Registration
      const eventUserIds = role.currentSignups.map((s: any) =>
        s.userId.toString()
      );
      const registrationUserIds = registrations.map((r: any) =>
        r.userId.toString()
      );

      expect(eventUserIds.sort()).toEqual(registrationUserIds.sort());

      // Verify all registration records have correct data
      registrations.forEach((reg: any) => {
        expect(reg.eventId.toString()).toBe(testEvent._id.toString());
        expect(reg.roleId).toBe(roleId);
        expect(reg.status).toBe("active");
        expect(reg.eventSnapshot.title).toBe(testEvent.title);
      });
    });
  });
});
