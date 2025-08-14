import { describe, it, expect, beforeEach, vi } from "vitest";
import { UnifiedMessageController } from "../../../src/controllers/unifiedMessageController";
import { Message, User } from "../../../src/models";
import MessageModel from "../../../src/models/Message";
import { socketService } from "../../../src/services/infrastructure/SocketService";

// Mock the Message model using the same pattern as the main test file
vi.mock("../../../src/models", () => ({
  Message: Object.assign(
    vi.fn().mockImplementation(() => ({
      save: vi.fn().mockResolvedValue({}),
      toJSON: vi.fn().mockReturnValue({}),
    })),
    {
      find: vi.fn(),
      findById: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      countDocuments: vi.fn(),
      updateMany: vi.fn(),
      getUnreadCountsForUser: vi.fn().mockResolvedValue({ system: 0, bell: 0 }),
    }
  ),
  User: Object.assign(vi.fn(), {
    findById: vi.fn(),
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    }),
    findOne: vi.fn(),
  }),
}));

// Also mock the direct import path
vi.mock("../../../src/models/Message", () => ({
  default: Object.assign(
    vi.fn().mockImplementation(() => ({
      save: vi.fn().mockResolvedValue({}),
      toJSON: vi.fn().mockReturnValue({}),
    })),
    {
      find: vi.fn(),
      findById: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      countDocuments: vi.fn(),
      updateMany: vi.fn(),
      getUnreadCountsForUser: vi.fn().mockResolvedValue({ system: 0, bell: 0 }),
    }
  ),
}));

vi.mock("../../../src/services/infrastructure/SocketService");

describe("UnifiedMessageController - event_role_change targetUserId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should set targetUserId for single-recipient event_role_change messages", async () => {
    // Setup: Mock a saved message
    const mockMessage = {
      _id: "msg123",
      targetUserId: "user456",
      userStates: new Map(), // Add the missing userStates Map
      getBellDisplayTitle: vi.fn().mockReturnValue("Test Event Role Change"), // Add missing method
      save: vi.fn().mockResolvedValue({}),
      toJSON: vi
        .fn()
        .mockReturnValue({ _id: "msg123", targetUserId: "user456" }),
    };

    // Mock the Message constructor to return our mock message
    (MessageModel as any).mockImplementation(() => mockMessage);

    // Call the method with single recipient
    const result = await UnifiedMessageController.createTargetedSystemMessage(
      {
        title: "Test Event Role Change",
        content: "You have been assigned a new role",
        type: "event_role_change",
      },
      ["user456"] // Single recipient
    );

    // Verify targetUserId was set correctly
    expect(MessageModel).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUserId: "user456",
      })
    );
    expect(result).toBeTruthy();
  });

  it("should NOT set targetUserId for multi-recipient event_role_change messages", async () => {
    // Setup: Mock a saved message
    const mockMessage = {
      _id: "msg123",
      userStates: new Map(), // Add the missing userStates Map
      getBellDisplayTitle: vi.fn().mockReturnValue("Test Event Role Change"), // Add missing method
      save: vi.fn().mockResolvedValue({}),
      toJSON: vi.fn().mockReturnValue({ _id: "msg123" }),
    };

    // Mock the Message constructor to return our mock message
    (MessageModel as any).mockImplementation(() => mockMessage);

    // Call the method with multiple recipients
    const result = await UnifiedMessageController.createTargetedSystemMessage(
      {
        title: "Test Event Role Change",
        content: "Multiple users have been updated",
        type: "event_role_change",
      },
      ["user456", "user789"] // Multiple recipients
    );

    // Verify targetUserId was NOT set for multi-recipient messages
    expect(MessageModel).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUserId: undefined,
      })
    );
    expect(result).toBeTruthy();
  });

  it("should still set targetUserId for auth_level_change messages", async () => {
    // Setup: Mock a saved message
    const mockMessage = {
      _id: "msg123",
      targetUserId: "user456",
      userStates: new Map(), // Add the missing userStates Map
      getBellDisplayTitle: vi.fn().mockReturnValue("Test Auth Level Change"), // Add missing method
      save: vi.fn().mockResolvedValue({}),
      toJSON: vi
        .fn()
        .mockReturnValue({ _id: "msg123", targetUserId: "user456" }),
    };

    // Mock the Message constructor to return our mock message
    (MessageModel as any).mockImplementation(() => mockMessage);

    // Call the method with auth_level_change type (existing functionality)
    const result = await UnifiedMessageController.createTargetedSystemMessage(
      {
        title: "Test Auth Level Change",
        content: "Your authorization level has been updated",
        type: "auth_level_change",
      },
      ["user456"] // Single recipient
    );

    // Verify targetUserId was set correctly for auth_level_change too
    expect(MessageModel).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUserId: "user456",
      })
    );
    expect(result).toBeTruthy();
  });
});
