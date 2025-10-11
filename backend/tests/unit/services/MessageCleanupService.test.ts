import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from "vitest";
import mongoose from "mongoose";
import { Message } from "../../../src/models";
import { MessageCleanupService } from "../../../src/services/MessageCleanupService";

describe("MessageCleanupService", () => {
  // Connect to test database before all tests
  beforeAll(async () => {
    const uri =
      process.env.MONGODB_TEST_URI ||
      "mongodb://localhost:27017/atcloud-signup-test";
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
    }
  });

  // Disconnect after all tests
  afterAll(async () => {
    await Message.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear messages collection before each test
    await Message.deleteMany({});
  });

  afterEach(async () => {
    // Clean up after each test
    await Message.deleteMany({});
  });

  describe("executeCleanup", () => {
    it("should delete messages deleted by all receivers", async () => {
      // Create message where all users have deleted it
      const message = await Message.create({
        title: "Test Message",
        content: "This should be deleted",
        type: "announcement",
        priority: "medium",
        creator: {
          id: "user1",
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        userStates: new Map([
          [
            "user1",
            {
              isReadInBell: false,
              isRemovedFromBell: true,
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
          [
            "user2",
            {
              isReadInBell: false,
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: true,
            },
          ],
        ]),
      });

      const stats = await MessageCleanupService.executeCleanup();

      expect(stats.deletedCount).toBe(1);
      expect(stats.deletionsByReason.deletedByAllReceivers).toBe(1);

      // Verify message was actually deleted
      const deletedMessage = await Message.findById(message._id);
      expect(deletedMessage).toBeNull();
    });

    it("should delete low priority messages past 90 days", async () => {
      // Create message 91 days old with low priority
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 91);

      const message = await Message.create({
        title: "Old Low Priority",
        content: "Should be deleted",
        type: "announcement",
        priority: "low",
        creator: {
          id: "user1",
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        createdAt: oldDate,
        userStates: new Map([
          [
            "user1",
            {
              isReadInBell: false,
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      const stats = await MessageCleanupService.executeCleanup();

      expect(stats.deletedCount).toBe(1);
      expect(stats.deletionsByReason.lowPriorityExpired).toBe(1);

      const deletedMessage = await Message.findById(message._id);
      expect(deletedMessage).toBeNull();
    });

    it("should NOT delete low priority messages less than 90 days old", async () => {
      // Create message 89 days old with low priority
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 89);

      await Message.create({
        title: "Recent Low Priority",
        content: "Should NOT be deleted",
        type: "announcement",
        priority: "low",
        creator: {
          id: "user1",
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        createdAt: recentDate,
        userStates: new Map([
          [
            "user1",
            {
              isReadInBell: false,
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      const stats = await MessageCleanupService.executeCleanup();

      expect(stats.deletedCount).toBe(0);
      expect(stats.deletionsByReason.lowPriorityExpired).toBe(0);
    });

    it("should delete medium priority messages past 160 days", async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 161);

      const message = await Message.create({
        title: "Old Medium Priority",
        content: "Should be deleted",
        type: "announcement",
        priority: "medium",
        creator: {
          id: "user1",
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        createdAt: oldDate,
        userStates: new Map([
          [
            "user1",
            {
              isReadInBell: false,
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      const stats = await MessageCleanupService.executeCleanup();

      expect(stats.deletedCount).toBe(1);
      expect(stats.deletionsByReason.mediumPriorityExpired).toBe(1);

      const deletedMessage = await Message.findById(message._id);
      expect(deletedMessage).toBeNull();
    });

    it("should delete high priority messages past 240 days", async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 241);

      const message = await Message.create({
        title: "Old High Priority",
        content: "Should be deleted",
        type: "announcement",
        priority: "high",
        creator: {
          id: "user1",
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        createdAt: oldDate,
        userStates: new Map([
          [
            "user1",
            {
              isReadInBell: false,
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      const stats = await MessageCleanupService.executeCleanup();

      expect(stats.deletedCount).toBe(1);
      expect(stats.deletionsByReason.highPriorityExpired).toBe(1);

      const deletedMessage = await Message.findById(message._id);
      expect(deletedMessage).toBeNull();
    });

    it("should delete messages seen by all and past 60 days", async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 61);

      const message = await Message.create({
        title: "Seen by All",
        content: "Should be deleted",
        type: "announcement",
        priority: "high", // Even high priority if seen by all
        creator: {
          id: "user1",
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        createdAt: oldDate,
        userStates: new Map([
          [
            "user1",
            {
              isReadInBell: true,
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
          [
            "user2",
            {
              isReadInBell: false,
              isRemovedFromBell: false,
              isReadInSystem: true,
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      const stats = await MessageCleanupService.executeCleanup();

      expect(stats.deletedCount).toBe(1);
      expect(stats.deletionsByReason.seenAndExpired).toBe(1);

      const deletedMessage = await Message.findById(message._id);
      expect(deletedMessage).toBeNull();
    });

    it("should NOT delete messages seen by all but less than 60 days old", async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 59);

      await Message.create({
        title: "Recently Seen",
        content: "Should NOT be deleted",
        type: "announcement",
        priority: "medium",
        creator: {
          id: "user1",
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        createdAt: recentDate,
        userStates: new Map([
          [
            "user1",
            {
              isReadInBell: true,
              isRemovedFromBell: false,
              isReadInSystem: true,
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      const stats = await MessageCleanupService.executeCleanup();

      expect(stats.deletedCount).toBe(0);
    });

    it("should handle multiple messages with different deletion reasons", async () => {
      // Create messages for each deletion reason
      const oldDate90 = new Date();
      oldDate90.setDate(oldDate90.getDate() - 91);

      const oldDate160 = new Date();
      oldDate160.setDate(oldDate160.getDate() - 161);

      const oldDate60 = new Date();
      oldDate60.setDate(oldDate60.getDate() - 61);

      // Low priority expired
      await Message.create({
        title: "Low Priority Old",
        content: "Test",
        type: "announcement",
        priority: "low",
        creator: {
          id: "user1",
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        createdAt: oldDate90,
        userStates: new Map([
          ["user1", { isReadInBell: false, isRemovedFromBell: false }],
        ]),
      });

      // Medium priority expired
      await Message.create({
        title: "Medium Priority Old",
        content: "Test",
        type: "announcement",
        priority: "medium",
        creator: {
          id: "user1",
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        createdAt: oldDate160,
        userStates: new Map([
          ["user1", { isReadInBell: false, isRemovedFromBell: false }],
        ]),
      });

      // Deleted by all
      await Message.create({
        title: "Deleted by All",
        content: "Test",
        type: "announcement",
        priority: "high",
        creator: {
          id: "user1",
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        userStates: new Map([
          ["user1", { isDeletedFromSystem: true }],
          ["user2", { isRemovedFromBell: true }],
        ]),
      });

      // Seen and expired
      await Message.create({
        title: "Seen and Old",
        content: "Test",
        type: "announcement",
        priority: "medium",
        creator: {
          id: "user1",
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        createdAt: oldDate60,
        userStates: new Map([
          ["user1", { isReadInSystem: true }],
          ["user2", { isReadInBell: true }],
        ]),
      });

      // Should NOT be deleted (recent)
      await Message.create({
        title: "Recent Message",
        content: "Test",
        type: "announcement",
        priority: "low",
        creator: {
          id: "user1",
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        userStates: new Map([
          ["user1", { isReadInBell: false, isRemovedFromBell: false }],
        ]),
      });

      const stats = await MessageCleanupService.executeCleanup();

      expect(stats.scannedCount).toBe(5);
      expect(stats.deletedCount).toBe(4);
      expect(stats.deletionsByReason.lowPriorityExpired).toBe(1);
      expect(stats.deletionsByReason.mediumPriorityExpired).toBe(1);
      expect(stats.deletionsByReason.deletedByAllReceivers).toBe(1);
      expect(stats.deletionsByReason.seenAndExpired).toBe(1);

      // Verify only 1 message remains
      const remainingMessages = await Message.find({});
      expect(remainingMessages).toHaveLength(1);
      expect(remainingMessages[0].title).toBe("Recent Message");
    });

    it("should skip messages with no user states", async () => {
      await Message.create({
        title: "No User States",
        content: "Test",
        type: "announcement",
        priority: "low",
        creator: {
          id: "user1",
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        userStates: new Map(), // Empty user states
      });

      const stats = await MessageCleanupService.executeCleanup();

      expect(stats.scannedCount).toBe(1);
      expect(stats.deletedCount).toBe(0);

      // Message should still exist
      const messages = await Message.find({});
      expect(messages).toHaveLength(1);
    });

    it("should NOT delete if not all users have deleted/seen (partial interaction)", async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 61);

      await Message.create({
        title: "Partial Interaction",
        content: "Test",
        type: "announcement",
        priority: "medium",
        creator: {
          id: "user1",
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        createdAt: oldDate,
        userStates: new Map([
          [
            "user1",
            {
              isReadInBell: true,
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
          [
            "user2",
            {
              isReadInBell: false, // This user hasn't seen it
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      const stats = await MessageCleanupService.executeCleanup();

      expect(stats.deletedCount).toBe(0);

      const messages = await Message.find({});
      expect(messages).toHaveLength(1);
    });

    it("should return correct statistics", async () => {
      const stats = await MessageCleanupService.executeCleanup();

      expect(stats).toHaveProperty("deletedCount");
      expect(stats).toHaveProperty("scannedCount");
      expect(stats).toHaveProperty("deletionsByReason");
      expect(stats).toHaveProperty("executionTimeMs");

      expect(stats.deletionsByReason).toHaveProperty("deletedByAllReceivers");
      expect(stats.deletionsByReason).toHaveProperty("lowPriorityExpired");
      expect(stats.deletionsByReason).toHaveProperty("mediumPriorityExpired");
      expect(stats.deletionsByReason).toHaveProperty("highPriorityExpired");
      expect(stats.deletionsByReason).toHaveProperty("seenAndExpired");

      expect(typeof stats.executionTimeMs).toBe("number");
      expect(stats.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty database gracefully", async () => {
      const stats = await MessageCleanupService.executeCleanup();

      expect(stats.scannedCount).toBe(0);
      expect(stats.deletedCount).toBe(0);
      expect(stats.deletionsByReason.deletedByAllReceivers).toBe(0);
      expect(stats.deletionsByReason.lowPriorityExpired).toBe(0);
      expect(stats.deletionsByReason.mediumPriorityExpired).toBe(0);
      expect(stats.deletionsByReason.highPriorityExpired).toBe(0);
      expect(stats.deletionsByReason.seenAndExpired).toBe(0);
    });

    it("should handle database errors gracefully", async () => {
      // Spy on Message.find and make lean() throw an error
      const findSpy = vi.spyOn(Message, "find").mockReturnValue({
        lean: vi
          .fn()
          .mockRejectedValue(new Error("Database connection failed")),
      } as any);

      await expect(MessageCleanupService.executeCleanup()).rejects.toThrow(
        "Database connection failed"
      );

      findSpy.mockRestore();
    });

    it("should apply first matching rule only (priority order)", async () => {
      // Create a message that matches multiple rules
      // It's deleted by all AND it's old low priority
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 91);

      await Message.create({
        title: "Multiple Rules Match",
        content: "Test",
        type: "announcement",
        priority: "low",
        creator: {
          id: "user1",
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        createdAt: oldDate,
        userStates: new Map([
          [
            "user1",
            {
              isDeletedFromSystem: true, // Deleted by all (Rule 1)
            },
          ],
        ]),
      });

      const stats = await MessageCleanupService.executeCleanup();

      expect(stats.deletedCount).toBe(1);
      // Should count under "deleted by all" since it's checked first
      expect(stats.deletionsByReason.deletedByAllReceivers).toBe(1);
      expect(stats.deletionsByReason.lowPriorityExpired).toBe(0);
    });

    it("should handle large batch of messages efficiently", async () => {
      // Create 100 old low priority messages
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 91);

      const messages = [];
      for (let i = 0; i < 100; i++) {
        messages.push({
          title: `Message ${i}`,
          content: "Test",
          type: "announcement",
          priority: "low",
          creator: {
            id: "user1",
            firstName: "Test",
            lastName: "User",
            username: "testuser",
            gender: "male",
            authLevel: "Administrator",
          },
          isActive: true,
          createdAt: oldDate,
          userStates: new Map([
            ["user1", { isReadInBell: false, isRemovedFromBell: false }],
          ]),
        });
      }

      await Message.insertMany(messages);

      const startTime = Date.now();
      const stats = await MessageCleanupService.executeCleanup();
      const executionTime = Date.now() - startTime;

      expect(stats.scannedCount).toBe(100);
      expect(stats.deletedCount).toBe(100);
      expect(stats.deletionsByReason.lowPriorityExpired).toBe(100);

      // Should complete in reasonable time (< 5 seconds for 100 messages)
      expect(executionTime).toBeLessThan(5000);

      // Verify all were deleted
      const remainingMessages = await Message.find({});
      expect(remainingMessages).toHaveLength(0);
    });
  });
});
