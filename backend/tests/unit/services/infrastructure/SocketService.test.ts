import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { socketService } from "../../../../src/services/infrastructure/SocketService";

// Mock dependencies
vi.mock("socket.io", () => ({
  Server: vi.fn(),
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: vi.fn().mockReturnValue({}),
  },
}));

vi.mock("../../../../src/models", () => ({
  User: {
    findById: vi.fn(),
  },
}));

describe("SocketService", () => {
  let mockIO: any;
  let mockSocket: any;
  let mockHttpServer: HTTPServer;
  let mockUser: any;

  beforeEach(() => {
    // Reset the singleton state
    (socketService as any).io = null;
    (socketService as any).authenticatedSockets = new Map();
    (socketService as any).userSockets = new Map();

    // Setup mocks
    mockSocket = {
      id: "socket123",
      handshake: {
        auth: {
          token: "valid-jwt-token",
        },
      },
      userId: "user123",
      user: {
        id: "user123",
        firstName: "John",
        lastName: "Doe",
        role: "member",
      },
      join: vi.fn(),
      leave: vi.fn(),
      emit: vi.fn(),
      on: vi.fn(),
      broadcast: {
        emit: vi.fn(),
      },
    };

    mockIO = {
      use: vi.fn(),
      on: vi.fn(),
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
      engine: {
        on: vi.fn(),
      },
    };

    mockHttpServer = {} as HTTPServer;
    mockUser = {
      _id: "user123",
      firstName: "John",
      lastName: "Doe",
      role: "member",
      isActive: true,
    };

    vi.mocked(SocketIOServer).mockReturnValue(mockIO);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("initialize", () => {
    it("should initialize SocketIO server with correct configuration", () => {
      socketService.initialize(mockHttpServer);

      expect(SocketIOServer).toHaveBeenCalledWith(
        mockHttpServer,
        expect.objectContaining({
          cors: expect.objectContaining({
            origin: expect.arrayContaining(["http://localhost:5173"]),
            methods: ["GET", "POST"],
            credentials: true,
          }),
          path: "/socket.io/",
          allowEIO3: true,
        })
      );
    });

    it("should use custom FRONTEND_URL from environment", () => {
      process.env.FRONTEND_URL = "https://custom-frontend.com";

      socketService.initialize(mockHttpServer);

      expect(SocketIOServer).toHaveBeenCalledWith(
        mockHttpServer,
        expect.objectContaining({
          cors: expect.objectContaining({
            origin: expect.arrayContaining(["https://custom-frontend.com"]),
            methods: ["GET", "POST"],
            credentials: true,
          }),
          path: "/socket.io/",
          allowEIO3: true,
        })
      );

      delete process.env.FRONTEND_URL;
    });

    it("should setup socket handlers and authentication middleware", () => {
      socketService.initialize(mockHttpServer);

      expect(mockIO.use).toHaveBeenCalled();
      expect(mockIO.engine.on).toHaveBeenCalledWith(
        "connection_error",
        expect.any(Function)
      );
      expect(mockIO.on).toHaveBeenCalledWith(
        "connection",
        expect.any(Function)
      );
    });
  });

  describe("authenticateSocket", () => {
    let authenticateSocketFn: any;
    let nextFn: any;

    beforeEach(async () => {
      socketService.initialize(mockHttpServer);
      // Get the authentication function that was passed to io.use
      authenticateSocketFn = vi.mocked(mockIO.use).mock.calls[0][0];
      nextFn = vi.fn();

      // Mock User model
      const { User } = await import("../../../../src/models");
      vi.mocked(User.findById).mockResolvedValue(mockUser);
    });

    it("should authenticate valid token successfully", async () => {
      (vi.mocked(jwt.verify) as any).mockReturnValue({ userId: "user123" });

      await authenticateSocketFn(mockSocket, nextFn);

      expect(jwt.verify).toHaveBeenCalledWith(
        "valid-jwt-token",
        process.env.JWT_ACCESS_SECRET || "your-access-secret-key"
      );
      expect(mockSocket.userId).toBe("user123");
      expect(mockSocket.user).toEqual({
        id: "user123",
        firstName: "John",
        lastName: "Doe",
        role: "member",
      });
      expect(nextFn).toHaveBeenCalledWith();
    });

    it("should reject connection when no token provided", async () => {
      mockSocket.handshake.auth.token = null;

      await authenticateSocketFn(mockSocket, nextFn);

      expect(nextFn).toHaveBeenCalledWith(
        new Error("Authentication token required")
      );
    });

    it("should reject connection when JWT verification fails", async () => {
      (vi.mocked(jwt.verify) as any).mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await authenticateSocketFn(mockSocket, nextFn);

      expect(nextFn).toHaveBeenCalledWith(new Error("Authentication failed"));
    });

    it("should reject connection when user not found", async () => {
      (vi.mocked(jwt.verify) as any).mockReturnValue({ userId: "user123" });
      const { User } = await import("../../../../src/models");
      vi.mocked(User.findById).mockResolvedValue(null);

      await authenticateSocketFn(mockSocket, nextFn);

      expect(nextFn).toHaveBeenCalledWith(
        new Error("Invalid or inactive user")
      );
    });

    it("should reject connection when user is inactive", async () => {
      (vi.mocked(jwt.verify) as any).mockReturnValue({ userId: "user123" });
      const { User } = await import("../../../../src/models");
      vi.mocked(User.findById).mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await authenticateSocketFn(mockSocket, nextFn);

      expect(nextFn).toHaveBeenCalledWith(
        new Error("Invalid or inactive user")
      );
    });

    it("should use default JWT secret when environment variable not set", async () => {
      const originalSecret = process.env.JWT_ACCESS_SECRET;
      delete process.env.JWT_ACCESS_SECRET;

      (vi.mocked(jwt.verify) as any).mockReturnValue({ userId: "user123" });

      await authenticateSocketFn(mockSocket, nextFn);

      expect(jwt.verify).toHaveBeenCalledWith(
        "valid-jwt-token",
        "your-access-secret-key"
      );

      if (originalSecret) {
        process.env.JWT_ACCESS_SECRET = originalSecret;
      }
    });

    it("should fallback to empty firstName/lastName when missing on user", async () => {
      (vi.mocked(jwt.verify) as any).mockReturnValue({ userId: "userNoName" });

      const { User } = await import("../../../../src/models");
      vi.mocked(User.findById).mockResolvedValue({
        _id: "userNoName",
        role: "member",
        isActive: true,
        // intentionally omit firstName/lastName to hit fallback branches
      } as any);

      await authenticateSocketFn(mockSocket, nextFn);

      expect(mockSocket.user).toEqual({
        id: "userNoName",
        firstName: "",
        lastName: "",
        role: "member",
      });
      expect(nextFn).toHaveBeenCalledWith();
    });
  });

  describe("socket connection handling", () => {
    let connectionHandler: any;

    beforeEach(() => {
      socketService.initialize(mockHttpServer);
      const connectionCall = vi
        .mocked(mockIO.on)
        .mock.calls.find((call) => call[0] === "connection");
      connectionHandler = connectionCall?.[1];
    });

    it("should handle socket connection and setup user tracking", () => {
      connectionHandler(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith("user:user123");
      expect(mockSocket.emit).toHaveBeenCalledWith("connected", {
        message: "Real-time notifications enabled",
        userId: "user123",
      });
      expect(mockSocket.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith(
        "disconnect",
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        "update_status",
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        "join_event_room",
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        "leave_event_room",
        expect.any(Function)
      );
    });

    it("should handle socket disconnection and cleanup", () => {
      connectionHandler(mockSocket);

      // Get the disconnect handler
      const disconnectCall = vi
        .mocked(mockSocket.on)
        .mock.calls.find((call) => call[0] === "disconnect");
      const disconnectHandler = disconnectCall?.[1];
      disconnectHandler();

      // Verify cleanup
      expect((socketService as any).authenticatedSockets.has("socket123")).toBe(
        false
      );
    });

    it("disconnect handler works when userSockets entry is missing (else branch)", () => {
      connectionHandler(mockSocket);

      // Extract disconnect handler
      const disconnectCall = vi
        .mocked(mockSocket.on)
        .mock.calls.find((call) => call[0] === "disconnect");
      const disconnectHandler = disconnectCall?.[1];

      // Simulate external cleanup that removed user entry before disconnect
      (socketService as any).userSockets = new Map();

      // Should not throw and should simply skip inner cleanup
      expect(() => disconnectHandler()).not.toThrow();
      expect((socketService as any).userSockets.size).toBe(0);
    });

    it("disconnect with multiple sockets keeps user entry (size !== 0 branch)", () => {
      // First connection for user123
      connectionHandler(mockSocket);

      // Second connection for the same user with a different socket id
      const mockSocket2: any = {
        id: "socket456",
        handshake: { auth: { token: "valid-jwt-token" } },
        userId: "user123",
        user: mockSocket.user,
        join: vi.fn(),
        leave: vi.fn(),
        emit: vi.fn(),
        on: vi.fn(),
        broadcast: { emit: vi.fn() },
      };

      connectionHandler(mockSocket2);

      // Verify both sockets are tracked for the user
      const setBefore = (socketService as any).userSockets.get("user123");
      expect(setBefore).toBeDefined();
      expect(setBefore.size).toBe(2);
      expect(setBefore.has("socket123")).toBe(true);
      expect(setBefore.has("socket456")).toBe(true);

      // Disconnect only the first socket
      const disconnectCall1 = vi
        .mocked(mockSocket.on)
        .mock.calls.find((call) => call[0] === "disconnect");
      const disconnectHandler1 = disconnectCall1?.[1];
      disconnectHandler1();

      // After removing one socket, the user entry should still exist with the other socket
      const setAfter = (socketService as any).userSockets.get("user123");
      expect(setAfter).toBeDefined();
      expect(setAfter.size).toBe(1);
      expect(setAfter.has("socket456")).toBe(true);
    });

    it("should handle status updates", () => {
      connectionHandler(mockSocket);

      // Get the status update handler
      const statusCall = vi
        .mocked(mockSocket.on)
        .mock.calls.find((call) => call[0] === "update_status");
      const statusHandler = statusCall?.[1];

      statusHandler("away");

      expect(mockSocket.broadcast.emit).toHaveBeenCalledWith(
        "user_status_update",
        {
          userId: "user123",
          status: "away",
          user: mockSocket.user,
        }
      );
    });

    it("should handle join_event_room", () => {
      connectionHandler(mockSocket);

      // Get the join event room handler
      const joinCall = vi
        .mocked(mockSocket.on)
        .mock.calls.find((call) => call[0] === "join_event_room");
      const joinHandler = joinCall?.[1];

      joinHandler("event456");

      expect(mockSocket.join).toHaveBeenCalledWith("event:event456");
    });

    it("should handle leave_event_room", () => {
      connectionHandler(mockSocket);

      // Get the leave event room handler
      const leaveCall = vi
        .mocked(mockSocket.on)
        .mock.calls.find((call) => call[0] === "leave_event_room");
      const leaveHandler = leaveCall?.[1];

      leaveHandler("event456");

      expect(mockSocket.leave).toHaveBeenCalledWith("event:event456");
    });
  });

  describe("emitSystemMessageUpdate", () => {
    beforeEach(() => {
      socketService.initialize(mockHttpServer);
    });

    it("should emit system message update to specific user", () => {
      const testData = { messageId: "msg123", action: "read" };

      socketService.emitSystemMessageUpdate(
        "user123",
        "message_read",
        testData
      );

      expect(mockIO.to).toHaveBeenCalledWith("user:user123");
      expect(mockIO.emit).toHaveBeenCalledWith("system_message_update", {
        event: "message_read",
        data: testData,
        timestamp: expect.any(String),
      });
    });

    it("should do nothing when io is not initialized", () => {
      (socketService as any).io = null;

      socketService.emitSystemMessageUpdate("user123", "test", {});

      expect(mockIO.to).not.toHaveBeenCalled();
    });
  });

  describe("emitBellNotificationUpdate", () => {
    beforeEach(() => {
      socketService.initialize(mockHttpServer);
    });

    it("should emit bell notification update to specific user", () => {
      const testData = { notificationId: "notif123", type: "new" };

      socketService.emitBellNotificationUpdate(
        "user123",
        "new_notification",
        testData
      );

      expect(mockIO.to).toHaveBeenCalledWith("user:user123");
      expect(mockIO.emit).toHaveBeenCalledWith("bell_notification_update", {
        event: "new_notification",
        data: testData,
        timestamp: expect.any(String),
      });
    });

    it("should do nothing when io is not initialized", () => {
      (socketService as any).io = null;

      socketService.emitBellNotificationUpdate("user123", "test", {});

      expect(mockIO.to).not.toHaveBeenCalled();
    });
  });

  describe("emitUnreadCountUpdate", () => {
    beforeEach(() => {
      socketService.initialize(mockHttpServer);
    });

    it("should emit unread count update to specific user", () => {
      const counts = {
        bellNotifications: 5,
        systemMessages: 3,
        total: 8,
      };

      socketService.emitUnreadCountUpdate("user123", counts);

      expect(mockIO.to).toHaveBeenCalledWith("user:user123");
      expect(mockIO.emit).toHaveBeenCalledWith("unread_count_update", {
        counts,
        timestamp: expect.any(String),
      });
    });

    it("should do nothing when io is not initialized", () => {
      (socketService as any).io = null;

      socketService.emitUnreadCountUpdate("user123", {
        bellNotifications: 0,
        systemMessages: 0,
        total: 0,
      });

      expect(mockIO.to).not.toHaveBeenCalled();
    });
  });

  describe("emitEventUpdate", () => {
    beforeEach(() => {
      socketService.initialize(mockHttpServer);
    });

    it("should emit event update globally and to event room", () => {
      const testData = { userId: "user123", role: "vocalist" };

      socketService.emitEventUpdate("event456", "user_signed_up", testData);

      // Global broadcast
      expect(mockIO.emit).toHaveBeenCalledWith("event_update", {
        eventId: "event456",
        updateType: "user_signed_up",
        data: testData,
        timestamp: expect.any(String),
      });

      // Event room broadcast
      expect(mockIO.to).toHaveBeenCalledWith("event:event456");
      expect(mockIO.emit).toHaveBeenCalledWith("event_update", {
        eventId: "event456",
        updateType: "user_signed_up",
        data: testData,
        timestamp: expect.any(String),
      });
    });

    it("should do nothing when io is not initialized", () => {
      (socketService as any).io = null;

      socketService.emitEventUpdate("event456", "test", {});

      expect(mockIO.emit).not.toHaveBeenCalled();
    });
  });

  describe("emitEventRoomUpdate", () => {
    beforeEach(() => {
      socketService.initialize(mockHttpServer);
    });

    it("should emit event room update to specific event room", () => {
      const testData = { message: "Role is now full" };

      socketService.emitEventRoomUpdate("event456", "role_full", testData);

      expect(mockIO.to).toHaveBeenCalledWith("event:event456");
      expect(mockIO.emit).toHaveBeenCalledWith("event_room_update", {
        eventId: "event456",
        updateType: "role_full",
        data: testData,
        timestamp: expect.any(String),
      });
    });

    it("should do nothing when io is not initialized", () => {
      (socketService as any).io = null;

      socketService.emitEventRoomUpdate("event456", "test", {});

      expect(mockIO.to).not.toHaveBeenCalled();
    });
  });

  describe("user tracking methods", () => {
    beforeEach(() => {
      socketService.initialize(mockHttpServer);

      // Simulate some connected users
      (socketService as any).userSockets.set(
        "user123",
        new Set(["socket1", "socket2"])
      );
      (socketService as any).userSockets.set("user456", new Set(["socket3"]));
    });

    it("should return correct online users count", () => {
      expect(socketService.getOnlineUsersCount()).toBe(2);
    });

    it("should correctly check if user is online", () => {
      expect(socketService.isUserOnline("user123")).toBe(true);
      expect(socketService.isUserOnline("user456")).toBe(true);
      expect(socketService.isUserOnline("user789")).toBe(false);
    });

    it("should return all online user IDs", () => {
      const onlineUsers = socketService.getOnlineUserIds();
      expect(onlineUsers).toContain("user123");
      expect(onlineUsers).toContain("user456");
      expect(onlineUsers).toHaveLength(2);
    });
  });

  describe("event room management", () => {
    beforeEach(() => {
      socketService.initialize(mockHttpServer);
    });

    it("should handle join event room", () => {
      socketService.handleJoinEventRoom(mockSocket as any, "event456");

      expect(mockSocket.join).toHaveBeenCalledWith("event:event456");
    });

    it("should handle leave event room", () => {
      socketService.handleLeaveEventRoom(mockSocket as any, "event456");

      expect(mockSocket.leave).toHaveBeenCalledWith("event:event456");
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      socketService.initialize(mockHttpServer);
    });

    it("should handle engine connection errors", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Get the connection_error handler
      const errorCall = vi
        .mocked(mockIO.engine.on)
        .mock.calls.find((call) => call[0] === "connection_error");
      const errorHandler = errorCall?.[1];

      const mockError = {
        req: "mock-request",
        code: "CONNECTION_ERROR",
        message: "Connection failed",
      };

      errorHandler(mockError);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Socket.IO engine connection error:",
        "mock-request",
        "CONNECTION_ERROR",
        "Connection failed"
      );

      consoleErrorSpy.mockRestore();
    });

    it("should handle socket errors", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const connectionCall = vi
        .mocked(mockIO.on)
        .mock.calls.find((call) => call[0] === "connection");
      const connectionHandler = connectionCall?.[1];

      connectionHandler(mockSocket);

      // Get the error handler
      const errorCall = vi
        .mocked(mockSocket.on)
        .mock.calls.find((call) => call[0] === "error");
      const socketErrorHandler = errorCall?.[1];

      const mockError = new Error("Socket error occurred");
      socketErrorHandler(mockError);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Socket error:", mockError);

      consoleErrorSpy.mockRestore();
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(socketService).toBeDefined();
      expect(typeof socketService.initialize).toBe("function");
    });

    it("should maintain state across multiple method calls", () => {
      socketService.initialize(mockHttpServer);

      // Simulate adding users
      (socketService as any).userSockets.set("user1", new Set(["socket1"]));

      expect(socketService.getOnlineUsersCount()).toBe(1);
      expect(socketService.isUserOnline("user1")).toBe(true);
    });
  });

  describe("internal handlers - early return branches", () => {
    it("setupSocketHandlers is a no-op when io is null (early return)", () => {
      // Ensure io is null and calling setupSocketHandlers does nothing
      (socketService as any).io = null;
      // @ts-ignore access private for test
      const result = (socketService as any).setupSocketHandlers();
      expect(result).toBeUndefined();
    });
  });
});
