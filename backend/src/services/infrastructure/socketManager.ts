import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { User } from "../../models";

interface SocketWithUser {
  user?: any;
}

export class SocketManager {
  private io: Server;
  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware for Socket.IO
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error("Authentication error: No token provided"));
        }

        // Use the same secret as the access token
        const JWT_ACCESS_SECRET =
          process.env.JWT_ACCESS_SECRET || "your-access-secret-key";
        const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as any;
        const user = await User.findById(decoded.userId).select("-password");

        if (!user || !user.isActive) {
          return next(new Error("Authentication error: Invalid user"));
        }

        socket.user = user;
        next();
      } catch (error) {
        next(new Error("Authentication error: Invalid token"));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket: any) => {
      console.log(`User ${socket.user.username} connected (${socket.id})`);

      // Store user connection
      this.connectedUsers.set(socket.user._id.toString(), socket.id);

      // Join user to their personal room for notifications
      socket.join(`user_${socket.user._id}`);

      // Handle joining chat rooms
      socket.on("join_room", (roomId: string) => {
        socket.join(`room_${roomId}`);
        console.log(`User ${socket.user.username} joined room ${roomId}`);
      });

      // Handle leaving chat rooms
      socket.on("leave_room", (roomId: string) => {
        socket.leave(`room_${roomId}`);
        console.log(`User ${socket.user.username} left room ${roomId}`);
      });

      // Handle new messages
      socket.on(
        "send_message",
        (data: {
          chatRoomId: string;
          message: string;
          attachments?: string[];
        }) => {
          // Broadcast message to all users in the room
          socket.to(`room_${data.chatRoomId}`).emit("new_message", {
            chatRoomId: data.chatRoomId,
            message: data.message,
            attachments: data.attachments,
            sender: {
              _id: socket.user._id,
              username: socket.user.username,
              firstName: socket.user.firstName,
              lastName: socket.user.lastName,
              avatar: socket.user.avatar,
            },
            timestamp: new Date(),
          });
        }
      );

      // Handle typing indicators
      socket.on("typing_start", (roomId: string) => {
        socket.to(`room_${roomId}`).emit("user_typing", {
          userId: socket.user._id,
          username: socket.user.username,
          isTyping: true,
        });
      });

      socket.on("typing_stop", (roomId: string) => {
        socket.to(`room_${roomId}`).emit("user_typing", {
          userId: socket.user._id,
          username: socket.user.username,
          isTyping: false,
        });
      });

      // Handle message reactions
      socket.on(
        "message_reaction",
        (data: {
          messageId: string;
          chatRoomId: string;
          reaction: string;
          action: "add" | "remove";
        }) => {
          socket.to(`room_${data.chatRoomId}`).emit("message_reaction_update", {
            messageId: data.messageId,
            reaction: data.reaction,
            action: data.action,
            userId: socket.user._id,
          });
        }
      );

      // Handle event updates (for real-time event notifications)
      socket.on("join_event_updates", (eventId: string) => {
        socket.join(`event_${eventId}`);
      });

      socket.on("leave_event_updates", (eventId: string) => {
        socket.leave(`event_${eventId}`);
      });

      // Handle user status updates
      socket.on("update_status", (status: "online" | "away" | "busy") => {
        // Broadcast status update to all connected users
        socket.broadcast.emit("user_status_update", {
          userId: socket.user._id,
          status,
        });
      });

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log(`User ${socket.user.username} disconnected (${socket.id})`);
        this.connectedUsers.delete(socket.user._id.toString());

        // Broadcast user offline status
        socket.broadcast.emit("user_status_update", {
          userId: socket.user._id,
          status: "offline",
        });
      });
    });
  }

  // Send notification to specific user
  public sendNotificationToUser(userId: string, notification: any) {
    this.io.to(`user_${userId}`).emit("new_notification", notification);
  }

  // Generic method to send any event to a specific user
  public sendToUser(userId: string, event: string, data: any) {
    this.io.to(`user_${userId}`).emit(event, data);
  }

  // Send notification to multiple users
  public sendNotificationToUsers(userIds: string[], notification: any) {
    userIds.forEach((userId) => {
      this.sendNotificationToUser(userId, notification);
    });
  }

  // Broadcast event update to all event participants
  public broadcastEventUpdate(eventId: string, update: any) {
    this.io.to(`event_${eventId}`).emit("event_update", update);
  }

  // Send message to chat room
  public sendMessageToRoom(roomId: string, message: any) {
    this.io.to(`room_${roomId}`).emit("new_message", message);
  }

  // Send direct message to a specific user
  public sendDirectMessageToUser(userId: string, messageData: any) {
    console.log(`📨 Sending direct message to user ${userId}:`, messageData);
    this.io.to(`user_${userId}`).emit("new_message", messageData);
  }

  // Check if user is online
  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Get online users count
  public getOnlineUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Get online users list
  public getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  // Send system announcement to all connected users
  public broadcastSystemAnnouncement(
    message: string,
    type: "info" | "warning" | "success" | "error" = "info"
  ) {
    this.io.emit("system_announcement", {
      message,
      type,
      timestamp: new Date(),
    });
  }

  // Get Socket.IO instance for external use
  public getIO(): Server {
    return this.io;
  }
}
