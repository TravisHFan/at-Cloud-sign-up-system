import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { app } from "../../src/index";
import { User } from "../../src/models";
import { Registration } from "../../src/models";
import { Event } from "../../src/models";
import { Message } from "../../src/models";
import { UserDeletionService } from "../../src/services/UserDeletionService";
import { ROLES } from "../../src/utils/roleUtils";

// Helper function to create auth tokens
const createAuthToken = (user: any): string => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
  };
  const secret = process.env.JWT_SECRET || "test-secret-key";
  return jwt.sign(payload, secret, { expiresIn: "1h" });
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
    // Clear test data
    await User.deleteMany({ email: { $regex: "test\\.com$" } });
    await Event.deleteMany({ title: { $regex: "^Test" } });
    await Registration.deleteMany({});
    await Message.deleteMany({ title: { $regex: "^Test" } });

    // Create test users
    superAdminUser = await User.create({
      firstName: "Super",
      lastName: "Admin",
      email: "superadmin@test.com",
      password: "password123",
      role: ROLES.SUPER_ADMIN,
      phoneNumber: "1234567890",
      dateOfBirth: new Date("1990-01-01"),
    });

    adminUser = await User.create({
      firstName: "Regular",
      lastName: "Admin",
      email: "admin@test.com",
      password: "password123",
      role: ROLES.ADMINISTRATOR,
      phoneNumber: "1234567891",
      dateOfBirth: new Date("1990-01-02"),
    });

    regularUser = await User.create({
      firstName: "Regular",
      lastName: "User",
      email: "user@test.com",
      password: "password123",
      role: ROLES.PARTICIPANT,
      phoneNumber: "1234567892",
      dateOfBirth: new Date("1990-01-03"),
    });

    // Create test event
    testEvent = await Event.create({
      title: "Test Event",
      description: "Test Event Description",
      eventType: "service",
      maxParticipants: 10,
      date: new Date(Date.now() + 86400000), // Tomorrow
      createdBy: regularUser._id,
      maxWaitingList: 5,
    });

    // Create test registration
    testRegistration = await Registration.create({
      eventId: testEvent._id,
      userId: regularUser._id,
      registeredBy: adminUser._id,
      registrationDate: new Date(),
      listType: "main",
    });

    // Create test message
    testMessage = await Message.create({
      title: "Test Message",
      content: "Test message content",
      messageType: "announcement",
      targetAudience: "all",
      isActive: true,
      createdBy: regularUser._id,
      userStates: [
        {
          userId: adminUser._id,
          hasRead: false,
          readTimestamp: null,
        },
      ],
    });

    // Get authentication tokens
    superAdminToken = createAuthToken(superAdminUser);
    adminToken = createAuthToken(adminUser);
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
        expect(impact.impact.messagesCreated).toBe(1);
        expect(impact.impact.messageStates).toBe(0); // regularUser is not in userStates
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
          description: "Another Event Description",
          eventType: "meeting",
          maxParticipants: 5,
          date: new Date(Date.now() + 172800000), // Day after tomorrow
          createdBy: regularUser._id,
          maxWaitingList: 2,
        });

        const additionalRegistration = await Registration.create({
          eventId: additionalEvent._id,
          userId: adminUser._id,
          registeredBy: regularUser._id, // regularUser registered someone else
          registrationDate: new Date(),
          listType: "main",
        });

        const additionalMessage = await Message.create({
          title: "Test Another Message",
          content: "Another message content",
          messageType: "reminder",
          targetAudience: "leaders",
          isActive: true,
          createdBy: adminUser._id,
          userStates: [
            {
              userId: regularUser._id, // regularUser has message state
              hasRead: true,
              readTimestamp: new Date(),
            },
          ],
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
        expect(deletionReport.deletedData.messageStates).toBe(1); // Their state in other messages

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
          .get(`/users/${regularUser._id}/deletion-impact`)
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
          .get(`/users/${regularUser._id}/deletion-impact`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(403);
      });

      it("should require authentication", async () => {
        await request(app)
          .get(`/users/${regularUser._id}/deletion-impact`)
          .expect(401);
      });
    });

    describe("DELETE /users/:id", () => {
      it("should delete user completely for Super Admin", async () => {
        const initialUsersCount = await User.countDocuments();

        const response = await request(app)
          .delete(`/users/${regularUser._id}`)
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
          .delete(`/users/${superAdminUser._id}`)
          .set("Authorization", `Bearer ${superAdminToken}`)
          .expect(403);
      });

      it("should prevent self-deletion", async () => {
        // Create another super admin to test self-deletion prevention
        const anotherSuperAdmin = await User.create({
          firstName: "Another",
          lastName: "SuperAdmin",
          email: "another@superadmin.test.com",
          password: "password123",
          role: ROLES.SUPER_ADMIN,
          phoneNumber: "1234567893",
          dateOfBirth: new Date("1990-01-04"),
        });

        const anotherSuperAdminToken = createAuthToken(anotherSuperAdmin);

        await request(app)
          .delete(`/users/${anotherSuperAdmin._id}`)
          .set("Authorization", `Bearer ${anotherSuperAdminToken}`)
          .expect(403);
      });

      it("should deny access to non-Super Admin", async () => {
        await request(app)
          .delete(`/users/${regularUser._id}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(403);
      });

      it("should handle non-existent user", async () => {
        const fakeId = new mongoose.Types.ObjectId();

        await request(app)
          .delete(`/users/${fakeId}`)
          .set("Authorization", `Bearer ${superAdminToken}`)
          .expect(404);
      });

      it("should require authentication", async () => {
        await request(app).delete(`/users/${regularUser._id}`).expect(401);
      });
    });
  });

  describe("Data Integrity", () => {
    it("should maintain referential integrity after user deletion", async () => {
      // Create interconnected data
      const event1 = await Event.create({
        title: "Test Event 1",
        description: "Description 1",
        eventType: "service",
        maxParticipants: 10,
        date: new Date(Date.now() + 86400000),
        createdBy: regularUser._id,
        maxWaitingList: 5,
      });

      const event2 = await Event.create({
        title: "Test Event 2",
        description: "Description 2",
        eventType: "meeting",
        maxParticipants: 5,
        date: new Date(Date.now() + 172800000),
        createdBy: adminUser._id,
        maxWaitingList: 2,
      });

      const reg1 = await Registration.create({
        eventId: event1._id,
        userId: regularUser._id,
        registeredBy: adminUser._id,
        registrationDate: new Date(),
        listType: "main",
      });

      const reg2 = await Registration.create({
        eventId: event2._id,
        userId: adminUser._id,
        registeredBy: regularUser._id,
        registrationDate: new Date(),
        listType: "main",
      });

      const message1 = await Message.create({
        title: "Test Message 1",
        content: "Content 1",
        messageType: "announcement",
        targetAudience: "all",
        isActive: true,
        createdBy: regularUser._id,
        userStates: [
          { userId: adminUser._id, hasRead: false, readTimestamp: null },
        ],
      });

      const message2 = await Message.create({
        title: "Test Message 2",
        content: "Content 2",
        messageType: "reminder",
        targetAudience: "leaders",
        isActive: true,
        createdBy: adminUser._id,
        userStates: [
          { userId: regularUser._id, hasRead: true, readTimestamp: new Date() },
        ],
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
      expect(message2After?.userStates).toHaveLength(0);
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
        description: "Another Description",
        eventType: "service",
        maxParticipants: 10,
        date: new Date(Date.now() + 86400000),
        createdBy: regularUser._id,
        maxWaitingList: 5,
      });

      await Registration.create({
        eventId: testEvent._id,
        userId: adminUser._id,
        registeredBy: regularUser._id,
        registrationDate: new Date(),
        listType: "waiting",
      });

      // Delete user
      await UserDeletionService.deleteUserCompletely(
        regularUser._id.toString(),
        superAdminUser
      );

      // Verify counts
      expect(await User.countDocuments()).toBe(initialUserCount - 1);
      expect(await Event.countDocuments()).toBe(initialEventCount - 1); // regularUser created 2 events total
      expect(await Registration.countDocuments()).toBe(
        initialRegistrationCount - 2
      ); // regularUser's registration + one they created
      expect(await Message.countDocuments()).toBe(initialMessageCount - 1); // regularUser created 1 message
    });
  });
});
