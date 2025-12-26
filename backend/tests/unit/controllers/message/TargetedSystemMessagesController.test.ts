import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import TargetedSystemMessagesController from "../../../../src/controllers/message/TargetedSystemMessagesController";

// Mock dependencies
const mockSave = vi.fn().mockResolvedValue(true);
const mockToJSON = vi.fn().mockReturnValue({ _id: "message-id" });
const mockGetBellDisplayTitle = vi.fn().mockReturnValue("Test Title");

vi.mock("../../../../src/models/Message", () => {
  const mockMessage = vi.fn().mockImplementation((data) => ({
    ...data,
    _id: "message-id",
    userStates: new Map(),
    save: mockSave,
    toJSON: mockToJSON,
    getBellDisplayTitle: mockGetBellDisplayTitle,
    metadata: data.metadata,
  }));
  (mockMessage as any).getUnreadCountsForUser = vi.fn();
  return { default: mockMessage };
});

vi.mock("../../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitSystemMessageUpdate: vi.fn(),
    emitUnreadCountUpdate: vi.fn(),
  },
}));

vi.mock("../../../../src/services", () => ({
  CachePatterns: {
    invalidateUserCache: vi.fn(),
  },
}));

import Message from "../../../../src/models/Message";
import { socketService } from "../../../../src/services/infrastructure/SocketService";
import { CachePatterns } from "../../../../src/services";

describe("TargetedSystemMessagesController", () => {
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockSave.mockResolvedValue(true);
    (Message as any).getUnreadCountsForUser = vi.fn().mockResolvedValue({
      bellNotifications: 1,
      systemMessages: 1,
      total: 2,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe("createTargetedSystemMessage", () => {
    const validMessageData = {
      title: "Test Notification",
      content: "This is a test message content",
    };

    const validTargetUserIds = ["user1", "user2"];

    const validCreator = {
      id: "admin1",
      firstName: "Admin",
      lastName: "User",
      username: "adminuser",
      avatar: "/avatar.jpg",
      gender: "male",
      authLevel: "Super Admin",
      roleInAtCloud: "Administrator",
    };

    describe("Successful Creation", () => {
      it("should create targeted message for multiple users", async () => {
        const result =
          await TargetedSystemMessagesController.createTargetedSystemMessage(
            validMessageData,
            validTargetUserIds,
            validCreator
          );

        expect(Message).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Test Notification",
            content: "This is a test message content",
            type: "assignment",
            priority: "high",
            hideCreator: false,
            isActive: true,
          })
        );
        expect(mockSave).toHaveBeenCalled();
        expect(result).toBeDefined();
      });

      it("should invalidate cache for all target users", async () => {
        await TargetedSystemMessagesController.createTargetedSystemMessage(
          validMessageData,
          validTargetUserIds,
          validCreator
        );

        expect(CachePatterns.invalidateUserCache).toHaveBeenCalledWith("user1");
        expect(CachePatterns.invalidateUserCache).toHaveBeenCalledWith("user2");
        expect(CachePatterns.invalidateUserCache).toHaveBeenCalledTimes(2);
      });

      it("should emit socket events to all target users", async () => {
        await TargetedSystemMessagesController.createTargetedSystemMessage(
          validMessageData,
          validTargetUserIds,
          validCreator
        );

        expect(socketService.emitSystemMessageUpdate).toHaveBeenCalledTimes(2);
        expect(socketService.emitSystemMessageUpdate).toHaveBeenCalledWith(
          "user1",
          "message_created",
          expect.any(Object)
        );
        expect(socketService.emitSystemMessageUpdate).toHaveBeenCalledWith(
          "user2",
          "message_created",
          expect.any(Object)
        );
      });

      it("should emit unread count updates to all target users", async () => {
        await TargetedSystemMessagesController.createTargetedSystemMessage(
          validMessageData,
          validTargetUserIds,
          validCreator
        );

        expect(socketService.emitUnreadCountUpdate).toHaveBeenCalledTimes(2);
      });

      it("should use system creator when none provided", async () => {
        await TargetedSystemMessagesController.createTargetedSystemMessage(
          validMessageData,
          validTargetUserIds
        );

        expect(Message).toHaveBeenCalledWith(
          expect.objectContaining({
            creator: expect.objectContaining({
              id: "system",
              firstName: "System",
              lastName: "Administrator",
              authLevel: "Super Admin",
            }),
          })
        );
      });

      it("should use custom type and priority when provided", async () => {
        await TargetedSystemMessagesController.createTargetedSystemMessage(
          {
            ...validMessageData,
            type: "admin_alert",
            priority: "medium",
          },
          validTargetUserIds,
          validCreator
        );

        expect(Message).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "admin_alert",
            priority: "medium",
          })
        );
      });

      it("should set hideCreator when specified", async () => {
        await TargetedSystemMessagesController.createTargetedSystemMessage(
          {
            ...validMessageData,
            hideCreator: true,
          },
          validTargetUserIds,
          validCreator
        );

        expect(Message).toHaveBeenCalledWith(
          expect.objectContaining({
            hideCreator: true,
          })
        );
      });

      it("should include metadata when provided", async () => {
        const metadata = { eventId: "event123", action: "assignment" };

        await TargetedSystemMessagesController.createTargetedSystemMessage(
          {
            ...validMessageData,
            metadata,
          },
          validTargetUserIds,
          validCreator
        );

        expect(Message).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata,
          })
        );
      });

      it("should set targetUserId for single-recipient auth_level_change", async () => {
        await TargetedSystemMessagesController.createTargetedSystemMessage(
          {
            ...validMessageData,
            type: "auth_level_change",
          },
          ["singleUser"],
          validCreator
        );

        expect(Message).toHaveBeenCalledWith(
          expect.objectContaining({
            targetUserId: "singleUser",
          })
        );
      });

      it("should handle unread count update failure gracefully", async () => {
        (Message as any).getUnreadCountsForUser = vi
          .fn()
          .mockRejectedValue(new Error("Count failed"));

        await TargetedSystemMessagesController.createTargetedSystemMessage(
          validMessageData,
          ["user1"],
          validCreator
        );

        // Should not throw, just log error
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe("Error Handling", () => {
      it("should throw error when save fails", async () => {
        mockSave.mockRejectedValueOnce(new Error("Save failed"));

        await expect(
          TargetedSystemMessagesController.createTargetedSystemMessage(
            validMessageData,
            validTargetUserIds,
            validCreator
          )
        ).rejects.toThrow("Save failed");
      });
    });
  });
});
