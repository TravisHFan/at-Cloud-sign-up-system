import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";

interface AuthenticatedSocket extends Socket {
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

/**
 * Real-time WebSocket service for system messages and notifications
 * Handles instant updates for read status, deletions, and new messages
 */
class SocketService {
  private io: SocketIOServer | null = null;
  private authenticatedSockets = new Map<string, AuthenticatedSocket>();
  private userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds

  /**
   * Initialize the WebSocket server
   */
  initialize(httpServer: HTTPServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true,
      },
      path: "/socket.io/",
    });

    this.setupSocketHandlers();
  }

  /**
   * Setup socket event handlers
   */
  private setupSocketHandlers(): void {
    if (!this.io) return;

    // Add authentication middleware
    this.io.use(this.authenticateSocket.bind(this));

    // Handle authentication errors at the namespace level
    this.io.engine.on("connection_error", (err) => {
      console.error(
        "Socket.IO engine connection error:",
        err.req,
        err.code,
        err.message
      );
    });

    this.io.on("connection", (socket: Socket) => {
      const authSocket = socket as AuthenticatedSocket;

      // Handle any connection errors
      authSocket.on("error", (error) => {
        console.error("Socket error:", error);
      }); // Track authenticated socket
      this.authenticatedSockets.set(authSocket.id, authSocket);

      // Track user sockets
      if (!this.userSockets.has(authSocket.userId)) {
        this.userSockets.set(authSocket.userId, new Set());
      }
      this.userSockets.get(authSocket.userId)!.add(authSocket.id);

      // Join user-specific room
      authSocket.join(`user:${authSocket.userId}`);

      // Handle disconnection
      authSocket.on("disconnect", () => {
        this.authenticatedSockets.delete(authSocket.id);

        const userSocketSet = this.userSockets.get(authSocket.userId);
        if (userSocketSet) {
          userSocketSet.delete(authSocket.id);
          if (userSocketSet.size === 0) {
            this.userSockets.delete(authSocket.userId);
          }
        }
      });

      // Handle status updates
      authSocket.on("update_status", (status: "online" | "away" | "busy") => {
        authSocket.broadcast.emit("user_status_update", {
          userId: authSocket.userId,
          status,
          user: authSocket.user,
        });
      });

      // Handle event room management
      authSocket.on("join_event_room", (eventId: string) => {
        this.handleJoinEventRoom(authSocket, eventId);
      });

      authSocket.on("leave_event_room", (eventId: string) => {
        this.handleLeaveEventRoom(authSocket, eventId);
      });

      // Send initial connection confirmation
      authSocket.emit("connected", {
        message: "Real-time notifications enabled",
        userId: authSocket.userId,
      });
    });
  }

  /**
   * Authenticate socket connection using JWT token
   */
  private async authenticateSocket(socket: any, next: any): Promise<void> {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication token required"));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET || "your-access-secret-key"
      ) as any;

      // Import User model dynamically to avoid circular dependencies
      const { User } = await import("../../models");
      const user = await User.findById(decoded.userId);

      if (!user || !user.isActive) {
        return next(new Error("Invalid or inactive user"));
      }

      // Attach user info to socket
      const authSocket = socket as AuthenticatedSocket;
      authSocket.userId = (user as any)._id.toString();
      authSocket.user = {
        id: (user as any)._id.toString(),
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        role: user.role,
      };

      next();
    } catch (error: any) {
      return next(new Error("Authentication failed"));
    }
  }

  /**
   * Emit system message update to specific user
   */
  emitSystemMessageUpdate(userId: string, event: string, data: any): void {
    if (!this.io) {
      return;
    }

    this.io.to(`user:${userId}`).emit("system_message_update", {
      event,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit bell notification update to specific user
   */
  emitBellNotificationUpdate(userId: string, event: string, data: any): void {
    if (!this.io) return;

    this.io.to(`user:${userId}`).emit("bell_notification_update", {
      event,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit new system message to all users
   */
  emitNewSystemMessageToAll(messageData: any): void {
    if (!this.io) return;

    this.io.emit("new_system_message", {
      data: messageData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit system message update to all users
   */
  emitSystemMessageUpdateToAll(event: string, messageData: any): void {
    if (!this.io) return;

    this.io.emit(event, {
      data: messageData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get online users count
   */
  getOnlineUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  /**
   * Get all online user IDs
   */
  getOnlineUserIds(): string[] {
    return Array.from(this.userSockets.keys());
  }

  /**
   * Emit unread count update to specific user
   */
  emitUnreadCountUpdate(
    userId: string,
    counts: {
      bellNotifications: number;
      systemMessages: number;
      total: number;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`user:${userId}`).emit("unread_count_update", {
      counts,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit event update to all users viewing a specific event
   */
  emitEventUpdate(eventId: string, updateType: string, data: any): void {
    if (!this.io) return;

    const eventUpdateData = {
      eventId,
      updateType, // 'user_removed' | 'user_moved' | 'user_signed_up' | 'user_cancelled' | 'role_full' | 'role_available'
      data,
      timestamp: new Date().toISOString(),
    };

    // Emit to all connected sockets (global broadcast)
    this.io.emit("event_update", eventUpdateData);

    // Also emit to the specific event room for good measure
    this.io.to(`event:${eventId}`).emit("event_update", eventUpdateData);
  }

  /**
   * Emit targeted event room update to users in specific event room
   */
  emitEventRoomUpdate(eventId: string, updateType: string, data: any): void {
    if (!this.io) return;

    this.io.to(`event:${eventId}`).emit("event_room_update", {
      eventId,
      updateType,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle user joining event room for real-time updates
   */
  handleJoinEventRoom(socket: AuthenticatedSocket, eventId: string): void {
    socket.join(`event:${eventId}`);
  }

  /**
   * Handle user leaving event room
   */
  handleLeaveEventRoom(socket: AuthenticatedSocket, eventId: string): void {
    socket.leave(`event:${eventId}`);
  }
}

// Export singleton instance
export const socketService = new SocketService();
