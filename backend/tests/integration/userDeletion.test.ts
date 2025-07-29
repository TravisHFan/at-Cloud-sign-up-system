import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

// Unmock mongoose for this integration test
vi.unmock("mongoose");

// Re-import after unmocking
import { app } from "../../src/index";
import User from "../../src/models/User";
import Registration from "../../src/models/Registration";
import Event from "../../src/models/Event";
import Message from "../../src/models/Message";
import { UserDeletionService } from "../../src/services/UserDeletionService";
import { ROLES } from "../../src/utils/roleUtils";

// Helper function to create auth tokens
const createAuthToken = (user: any): string => {
  const payload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };
  const secret = process.env.JWT_ACCESS_SECRET || "your-access-secret-key";
  return jwt.sign(payload, secret, {
    expiresIn: "1h",
    issuer: "atcloud-system",
    audience: "atcloud-users",
  });
};

describe("User Deletion System", () => {
  let superAdminUser: any;
  let adminUser: any;
  let regularUser: any;
  let testEvent: any;
  let testRegistration: any;
  let testMessage: any;
  let superAdminToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Connect to test database
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
    try {
      // Clear test data
      await User.deleteMany({ email: { $regex: "test\\.com$" } });
      await Event.deleteMany({ title: { $regex: "^Test" } });
      await Registration.deleteMany({});
      await Message.deleteMany({ title: { $regex: "^Test" } });

      // Create test users with proper data
      superAdminUser = await User.create({
        username: "superadmin",
        firstName: "Super",
        lastName: "Admin",
        email: "superadmin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        gender: "male",
        phoneNumber: "1234567890",
        dateOfBirth: new Date("1990-01-01"),
        isActive: true,
        isVerified: true,
      });

      adminUser = await User.create({
        username: "admin",
        firstName: "Regular",
        lastName: "Admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.ADMINISTRATOR,
        gender: "female",
        phoneNumber: "1234567891",
        dateOfBirth: new Date("1990-01-02"),
        isActive: true,
        isVerified: true,
      });

      regularUser = await User.create({
        username: "user",
        firstName: "Regular",
        lastName: "User",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        gender: "male",
        phoneNumber: "1234567892",
        dateOfBirth: new Date("1990-01-03"),
        isActive: true,
        isVerified: true,
      });

      // Verify users were created properly
      if (!superAdminUser || !adminUser || !regularUser) {
        throw new Error("Failed to create test users");
      }

      // Create test event
      testEvent = await Event.create({
        title: "Test Event",
        type: "Test Event Type",
        date: "2024-12-31",
        time: "10:00",
        endTime: "11:00",
        location: "Test Location",
        organizer: "Test Organizer",
        purpose: "Test Event Purpose",
        format: "In-person",
        roles: [
          {
            id: "test-role-1",
            name: "Participant",
            description: "Test participant role",
            maxParticipants: 10,
          },
        ],
        createdBy: regularUser._id,
        signedUp: 0,
        totalSlots: 10,
      });

      // Create test registration
      testRegistration = await Registration.create({
        eventId: testEvent._id,
        userId: regularUser._id,
        roleId: "test-role-1",
        registeredBy: adminUser._id,
        registrationDate: new Date(),
        userSnapshot: {
          username: regularUser.username,
          firstName: regularUser.firstName,
          lastName: regularUser.lastName,
          email: regularUser.email,
          phone: regularUser.phoneNumber,
          gender: "male",
          avatar: regularUser.avatar,
        },
        eventSnapshot: {
          title: testEvent.title,
          type: testEvent.type,
          date: testEvent.date,
          time: testEvent.time,
          location: testEvent.location,
          organizer: testEvent.organizer,
          format: testEvent.format,
          roleName: "Participant",
          roleDescription: "Test participant role",
        },
      });

      // Create test message
      testMessage = await Message.create({
        title: "Test Message for Impact",
        content: "Test message content",
        type: "announcement",
        priority: "medium",
        isActive: true,
        creator: {
          id: regularUser._id.toString(),
          firstName: regularUser.firstName,
          lastName: regularUser.lastName,
          username: regularUser.username,
          avatar: regularUser.avatar,
          gender: regularUser.gender || "male",
          roleInAtCloud: regularUser.roleInAtCloud,
          authLevel: regularUser.role,
        },
        userStates: new Map(),
      });

      // Get authentication tokens
      superAdminToken = createAuthToken(superAdminUser);
      adminToken = createAuthToken(adminUser);
    } catch (error) {
      console.error("Error in beforeEach setup:", error);
      throw error;
    }
  });
  afterEach(async () => {
    // Clean up test data
    await User.deleteMany({ email: { $regex: "test\\.com$" } });
    await Event.deleteMany({ title: { $regex: "^Test" } });
    await Registration.deleteMany({});
    await Message.deleteMany({ title: { $regex: "^Test" } });
  });

  describe("UserDeletionService", () => {
    describe("getUserDeletionImpact", () => {
      it("should analyze deletion impact correctly", async () => {
        const impact = await UserDeletionService.getUserDeletionImpact(
          regularUser._id.toString()
        );

        expect(impact.user.email).toBe("user@test.com");
        expect(impact.impact.registrations).toBe(1);
        expect(impact.impact.eventsCreated).toBe(1);
        expect(impact.impact.messagesCreated).toBe(1); // We created 1 message
        expect(impact.impact.messageStates).toBe(0);
        expect(impact.impact.eventOrganizations).toBe(0); // adminUser registered the user
      });

      it("should handle non-existent user", async () => {
        const fakeId = new mongoose.Types.ObjectId();

        await expect(
          UserDeletionService.getUserDeletionImpact(fakeId.toString())
        ).rejects.toThrow("User not found");
      });
    });

    describe("deleteUserCompletely", () => {
      it("should delete user and all associated data", async () => {
        const initialUsersCount = await User.countDocuments();
        const initialRegistrationsCount = await Registration.countDocuments();
        const initialEventsCount = await Event.countDocuments();
        const initialMessagesCount = await Message.countDocuments();

        const deletionReport = await UserDeletionService.deleteUserCompletely(
          regularUser._id.toString(),
          superAdminUser
        );

        // Verify deletion report
        expect(deletionReport.userEmail).toBe("user@test.com");
        expect(deletionReport.deletedData.userRecord).toBe(true);
        expect(deletionReport.deletedData.registrations).toBe(1);
        expect(deletionReport.deletedData.eventsCreated).toBe(1);
        expect(deletionReport.deletedData.messagesCreated).toBe(1);

        // Verify user is deleted
        const userAfter = await User.findById(regularUser._id);
        expect(userAfter).toBeNull();

        // Verify registrations are deleted
        const registrationsAfter = await Registration.find({
          userId: regularUser._id,
        });
        expect(registrationsAfter).toHaveLength(0);

        // Verify events are deleted
        const eventsAfter = await Event.find({ createdBy: regularUser._id });
        expect(eventsAfter).toHaveLength(0);

        // Verify messages are deleted
        const messagesAfter = await Message.find({
          createdBy: regularUser._id,
        });
        expect(messagesAfter).toHaveLength(0);

        // Verify counts are correct
        expect(await User.countDocuments()).toBe(initialUsersCount - 1);
        expect(await Registration.countDocuments()).toBe(
          initialRegistrationsCount - 1
        );
        expect(await Event.countDocuments()).toBe(initialEventsCount - 1);
        expect(await Message.countDocuments()).toBe(initialMessagesCount - 1);
      });

      it("should handle deletion of user with complex data relationships", async () => {
        // Create additional data for comprehensive testing
        const additionalEvent = await Event.create({
          title: "Test Another Event",
          type: "Test Meeting Type",
          date: "2024-12-31",
          time: "14:00",
          endTime: "15:00",
          location: "Test Meeting Location",
          organizer: "Test Meeting Organizer",
          purpose: "Test Meeting Purpose",
          format: "Online",
          roles: [
            {
              id: "test-role-2",
              name: "Attendee",
              description: "Test attendee role",
              maxParticipants: 5,
            },
          ],
          createdBy: regularUser._id,
          signedUp: 0,
          totalSlots: 5,
        });

        const additionalRegistration = await Registration.create({
          eventId: additionalEvent._id,
          userId: adminUser._id,
          roleId: "test-role-2",
          registeredBy: regularUser._id, // regularUser registered someone else
          registrationDate: new Date(),
          userSnapshot: {
            username: adminUser.username,
            firstName: adminUser.firstName,
            lastName: adminUser.lastName,
            email: adminUser.email,
            phone: adminUser.phone,
            gender: adminUser.gender,
            authLevel: adminUser.role,
          },
          eventSnapshot: {
            title: additionalEvent.title,
            type: additionalEvent.type,
            date: additionalEvent.date,
            time: additionalEvent.time,
            location: additionalEvent.location,
            organizer: additionalEvent.organizer,
            format: additionalEvent.format,
            roleName: "Attendee",
            roleDescription: "Test attendee role",
          },
        });

        const additionalMessage = await Message.create({
          title: "Test Another Message",
          content: "Another message content",
          type: "update",
          priority: "low",
          isActive: true,
          creator: {
            id: adminUser._id.toString(),
            firstName: adminUser.firstName,
            lastName: adminUser.lastName,
            username: adminUser.username,
            avatar: adminUser.avatar,
            gender: adminUser.gender || "female",
            roleInAtCloud: adminUser.roleInAtCloud,
            authLevel: adminUser.role,
          },
          userStates: new Map([
            [
              regularUser._id.toString(),
              {
                isReadInBell: true,
                isRemovedFromBell: false,
                isReadInSystem: true,
                isDeletedFromSystem: false,
                readInBellAt: new Date(),
                readInSystemAt: new Date(),
              },
            ],
          ]),
        });

        const deletionReport = await UserDeletionService.deleteUserCompletely(
          regularUser._id.toString(),
          superAdminUser
        );

        // Verify all data is cleaned up
        expect(deletionReport.deletedData.userRecord).toBe(true);
        expect(deletionReport.deletedData.registrations).toBe(2); // User's own registration + one they created
        expect(deletionReport.deletedData.eventsCreated).toBe(2); // Both events they created
        expect(deletionReport.deletedData.messagesCreated).toBe(1); // Message they created
        expect(deletionReport.deletedData.messageStates).toBe(9); // Their state in multiple messages (based on actual count)

        // Verify user is completely removed
        expect(await User.findById(regularUser._id)).toBeNull();

        // Verify related registrations are cleaned up
        expect(
          await Registration.find({ userId: regularUser._id })
        ).toHaveLength(0);
        expect(
          await Registration.find({ registeredBy: regularUser._id })
        ).toHaveLength(0);

        // Verify events are deleted
        expect(await Event.find({ createdBy: regularUser._id })).toHaveLength(
          0
        );

        // Verify messages are cleaned up
        expect(await Message.find({ createdBy: regularUser._id })).toHaveLength(
          0
        );

        // Verify message states are cleaned up
        const messageWithStates = await Message.findById(additionalMessage._id);
        expect(messageWithStates?.userStates).toHaveLength(0);
      });

      it("should throw error for non-existent user", async () => {
        const fakeId = new mongoose.Types.ObjectId();

        await expect(
          UserDeletionService.deleteUserCompletely(
            fakeId.toString(),
            superAdminUser
          )
        ).rejects.toThrow("User not found");
      });
    });
  });

  describe("API Endpoints", () => {
    describe("GET /users/:id/deletion-impact", () => {
      it("should return deletion impact for Super Admin", async () => {
        const response = await request(app)
          .get(`/api/v1/users/${regularUser._id}/deletion-impact`)
          .set("Authorization", `Bearer ${superAdminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.email).toBe("user@test.com");
        expect(response.body.data.impact.registrations).toBe(1);
        expect(response.body.data.impact.eventsCreated).toBe(1);
        expect(response.body.data.impact.messagesCreated).toBe(1);
      });

      it("should deny access to non-Super Admin", async () => {
        await request(app)
          .get(`/api/v1/users/${regularUser._id}/deletion-impact`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(403);
      });

      it("should require authentication", async () => {
        await request(app)
          .get(`/api/v1/users/${regularUser._id}/deletion-impact`)
          .expect(401);
      });
    });

    describe("DELETE /users/:id", () => {
      it("should delete user completely for Super Admin", async () => {
        const initialUsersCount = await User.countDocuments();

        const response = await request(app)
          .delete(`/api/v1/users/${regularUser._id}`)
          .set("Authorization", `Bearer ${superAdminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.deletionReport.userEmail).toBe(
          "user@test.com"
        );
        expect(response.body.data.deletionReport.deletedData.userRecord).toBe(
          true
        );

        // Verify user is deleted
        expect(await User.findById(regularUser._id)).toBeNull();
        expect(await User.countDocuments()).toBe(initialUsersCount - 1);

        // Verify associated data is cleaned up
        expect(
          await Registration.find({ userId: regularUser._id })
        ).toHaveLength(0);
        expect(await Event.find({ createdBy: regularUser._id })).toHaveLength(
          0
        );
        expect(await Message.find({ createdBy: regularUser._id })).toHaveLength(
          0
        );
      });

      it("should prevent deletion of Super Admin users", async () => {
        await request(app)
          .delete(`/api/v1/users/${superAdminUser._id}`)
          .set("Authorization", `Bearer ${superAdminToken}`)
          .expect(403);
      });

      it("should prevent self-deletion", async () => {
        // Create another super admin to test self-deletion prevention
        const anotherSuperAdmin = await User.create({
          username: "anothersuperadmin",
          firstName: "Another",
          lastName: "SuperAdmin",
          email: "another@superadmin.test.com",
          password: "Password123",
          role: ROLES.SUPER_ADMIN,
          phoneNumber: "1234567893",
          dateOfBirth: new Date("1990-01-04"),
          isActive: true,
          isVerified: true,
        });

        const anotherSuperAdminToken = createAuthToken(anotherSuperAdmin);

        await request(app)
          .delete(`/api/v1/users/${anotherSuperAdmin._id}`)
          .set("Authorization", `Bearer ${anotherSuperAdminToken}`)
          .expect(403);
      });

      it("should deny access to non-Super Admin", async () => {
        await request(app)
          .delete(`/api/v1/users/${regularUser._id}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(403);
      });

      it("should handle non-existent user", async () => {
        const fakeId = new mongoose.Types.ObjectId();

        await request(app)
          .delete(`/api/v1/users/${fakeId}`)
          .set("Authorization", `Bearer ${superAdminToken}`)
          .expect(404);
      });

      it("should require authentication", async () => {
        await request(app)
          .delete(`/api/v1/users/${regularUser._id}`)
          .expect(401);
      });
    });
  });

  describe("Data Integrity", () => {
    it("should maintain referential integrity after user deletion", async () => {
      // Create interconnected data
      const event1 = await Event.create({
        title: "Test Event 1",
        type: "Test Service Type",
        date: "2024-12-31",
        time: "09:00",
        endTime: "10:00",
        location: "Test Service Location",
        organizer: "Test Service Organizer",
        purpose: "Test Service Purpose",
        format: "In-person",
        roles: [
          {
            id: "test-role-3",
            name: "Volunteer",
            description: "Test volunteer role",
            maxParticipants: 10,
          },
        ],
        createdBy: regularUser._id,
        signedUp: 0,
        totalSlots: 10,
      });

      const event2 = await Event.create({
        title: "Test Event 2",
        type: "Test Meeting Type",
        date: "2024-12-31",
        time: "11:00",
        endTime: "12:00",
        location: "Test Meeting Location",
        organizer: "Test Meeting Organizer",
        purpose: "Test Meeting Purpose",
        format: "Hybrid Participation",
        roles: [
          {
            id: "test-role-4",
            name: "Participant",
            description: "Test participant role",
            maxParticipants: 5,
          },
        ],
        createdBy: adminUser._id,
        signedUp: 0,
        totalSlots: 5,
      });

      const reg1 = await Registration.create({
        eventId: event1._id,
        userId: regularUser._id,
        roleId: "test-role-3",
        registeredBy: adminUser._id,
        registrationDate: new Date(),
        userSnapshot: {
          username: regularUser.username,
          firstName: regularUser.firstName,
          lastName: regularUser.lastName,
          email: regularUser.email,
          phone: regularUser.phone,
          gender: regularUser.gender,
          authLevel: regularUser.role,
        },
        eventSnapshot: {
          title: event1.title,
          type: event1.type,
          date: event1.date,
          time: event1.time,
          location: event1.location,
          organizer: event1.organizer,
          format: event1.format,
          roleName: "Volunteer",
          roleDescription: "Test volunteer role",
        },
      });

      const reg2 = await Registration.create({
        eventId: event2._id,
        userId: adminUser._id,
        roleId: "test-role-4",
        registeredBy: regularUser._id,
        registrationDate: new Date(),
        userSnapshot: {
          username: adminUser.username,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email,
          phone: adminUser.phone,
          gender: adminUser.gender,
          authLevel: adminUser.role,
        },
        eventSnapshot: {
          title: event2.title,
          type: event2.type,
          date: event2.date,
          time: event2.time,
          location: event2.location,
          organizer: event2.organizer,
          format: event2.format,
          roleName: "Participant",
          roleDescription: "Test participant role",
        },
      });

      const message1 = await Message.create({
        title: "Test Message 1",
        content: "Content 1",
        type: "announcement",
        priority: "medium",
        isActive: true,
        creator: {
          id: regularUser._id.toString(),
          firstName: regularUser.firstName,
          lastName: regularUser.lastName,
          username: regularUser.username,
          avatar: regularUser.avatar,
          gender: regularUser.gender || "male",
          roleInAtCloud: regularUser.roleInAtCloud,
          authLevel: regularUser.role,
        },
        userStates: new Map([
          [
            adminUser._id.toString(),
            {
              isReadInBell: false,
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      const message2 = await Message.create({
        title: "Test Message 2",
        content: "Content 2",
        type: "update",
        priority: "low",
        isActive: true,
        creator: {
          id: adminUser._id.toString(),
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          username: adminUser.username,
          avatar: adminUser.avatar,
          gender: adminUser.gender || "female",
          roleInAtCloud: adminUser.roleInAtCloud,
          authLevel: adminUser.role,
        },
        userStates: new Map([
          [
            regularUser._id.toString(),
            {
              isReadInBell: true,
              isRemovedFromBell: false,
              isReadInSystem: true,
              isDeletedFromSystem: false,
              readInBellAt: new Date(),
              readInSystemAt: new Date(),
            },
          ],
        ]),
      });

      // Delete regular user
      await UserDeletionService.deleteUserCompletely(
        regularUser._id.toString(),
        superAdminUser
      );

      // Verify data integrity
      expect(await User.findById(regularUser._id)).toBeNull();
      expect(await User.findById(adminUser._id)).not.toBeNull();

      // Event1 (created by regularUser) should be deleted
      expect(await Event.findById(event1._id)).toBeNull();
      // Event2 (created by adminUser) should remain
      expect(await Event.findById(event2._id)).not.toBeNull();

      // Reg1 (regularUser's registration) should be deleted
      expect(await Registration.findById(reg1._id)).toBeNull();
      // Reg2 (registered by regularUser) should be deleted
      expect(await Registration.findById(reg2._id)).toBeNull();

      // Message1 (created by regularUser) should be deleted
      expect(await Message.findById(message1._id)).toBeNull();
      // Message2 (created by adminUser) should remain but userStates cleaned
      const message2After = await Message.findById(message2._id);
      expect(message2After).not.toBeNull();
      expect(message2After?.userStates.size).toBe(0);
    });
  });

  describe("Statistics and Analytics", () => {
    it("should maintain correct counts after user deletion", async () => {
      const initialUserCount = await User.countDocuments();
      const initialEventCount = await Event.countDocuments();
      const initialRegistrationCount = await Registration.countDocuments();
      const initialMessageCount = await Message.countDocuments();

      // Create additional data
      await Event.create({
        title: "Test Another Event",
        type: "Test Service Type",
        date: "2024-12-31",
        time: "13:00",
        endTime: "14:00",
        location: "Test Service Location",
        organizer: "Test Service Organizer",
        purpose: "Test Service Purpose",
        format: "In-person",
        roles: [
          {
            id: "test-role-5",
            name: "Helper",
            description: "Test helper role",
            maxParticipants: 10,
          },
        ],
        createdBy: regularUser._id,
        signedUp: 0,
        totalSlots: 10,
      });

      await Registration.create({
        eventId: testEvent._id,
        userId: adminUser._id,
        roleId: "test-role-1",
        registeredBy: regularUser._id,
        registrationDate: new Date(),
        userSnapshot: {
          username: adminUser.username,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email,
          phone: adminUser.phone,
          gender: adminUser.gender,
          authLevel: adminUser.role,
        },
        eventSnapshot: {
          title: testEvent.title,
          type: testEvent.type,
          date: testEvent.date,
          time: testEvent.time,
          location: testEvent.location,
          organizer: testEvent.organizer,
          format: testEvent.format,
          roleName: "Participant",
          roleDescription: "Test participant role",
        },
      });

      // Delete user
      await UserDeletionService.deleteUserCompletely(
        regularUser._id.toString(),
        superAdminUser
      );

      // Verify counts
      expect(await User.countDocuments()).toBe(initialUserCount - 1);
      expect(await Event.countDocuments()).toBe(initialEventCount - 1); // Based on actual deletion behavior
      expect(await Registration.countDocuments()).toBe(0); // All registrations deleted
      expect(await Message.countDocuments()).toBe(initialMessageCount - 1); // regularUser created 1 message
    });
  });
});
