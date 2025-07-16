import Notification, { INotification } from "../models/Notification";
import User, { IUser } from "../models/User";
import { SocketManager } from "./socketManager";
import mongoose from "mongoose";

export interface NotificationData {
  userId: string;
  type:
    | "SYSTEM_MESSAGE"
    | "CHAT_MESSAGE"
    | "EVENT_NOTIFICATION"
    | "USER_ACTION";
  category:
    | "registration"
    | "reminder"
    | "cancellation"
    | "update"
    | "system"
    | "marketing"
    | "chat"
    | "role_change"
    | "announcement";
  title: string;
  message: string;
  priority?: "low" | "normal" | "high" | "urgent";
  metadata?: Record<string, any>;
  deliveryChannels?: ("in-app" | "email" | "push" | "sms")[];
  expiresAt?: Date;
  scheduledFor?: Date;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  categories: {
    registration: boolean;
    reminder: boolean;
    cancellation: boolean;
    update: boolean;
    system: boolean;
    marketing: boolean;
    chat: boolean;
    role_change: boolean;
    announcement: boolean;
  };
  quietHours?: {
    enabled: boolean;
    start: string; // "22:00"
    end: string; // "08:00"
    timezone: string;
  };
}

export class NotificationService {
  private static socketManager: SocketManager;

  // Initialize with socket manager for real-time delivery
  static initialize(socketManager: SocketManager) {
    this.socketManager = socketManager;
  }

  // Create and send a notification
  static async createNotification(
    data: NotificationData
  ): Promise<INotification> {
    try {
      // Get user preferences
      const user = await User.findById(data.userId).select(
        "notificationPreferences"
      );
      if (!user) {
        throw new Error(`User not found: ${data.userId}`);
      }

      // Check if user wants this category of notification
      const preferences =
        (user.notificationPreferences as NotificationPreferences) ||
        ({} as NotificationPreferences);
      const categoryEnabled = preferences.categories?.[data.category] !== false;

      if (!categoryEnabled && data.priority !== "urgent") {
        console.log(
          `Notification blocked by user preferences: ${data.userId} - ${data.category}`
        );
        return null as any;
      }

      // Determine delivery channels based on user preferences
      let deliveryChannels = data.deliveryChannels || ["in-app"];

      // Filter based on user preferences
      if (!preferences.emailNotifications) {
        deliveryChannels = deliveryChannels.filter((ch) => ch !== "email");
      }
      if (!preferences.pushNotifications) {
        deliveryChannels = deliveryChannels.filter((ch) => ch !== "push");
      }
      if (!preferences.smsNotifications) {
        deliveryChannels = deliveryChannels.filter((ch) => ch !== "sms");
      }

      // Always include in-app for urgent notifications
      if (data.priority === "urgent" && !deliveryChannels.includes("in-app")) {
        deliveryChannels.push("in-app");
      }

      // Create notification
      const notification = new Notification({
        userId: data.userId,
        type: data.type,
        category: data.category,
        title: data.title,
        message: data.message,
        priority: data.priority || "normal",
        metadata: data.metadata || {},
        deliveryChannels,
        deliveryStatus: "pending",
        expiresAt: data.expiresAt,
        scheduledFor: data.scheduledFor,
        isRead: false,
      });

      await notification.save();

      // Send real-time notification if scheduled for now or no schedule
      if (!data.scheduledFor || data.scheduledFor <= new Date()) {
        await this.deliverNotification(notification);
      }

      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }

  // Deliver notification through appropriate channels
  private static async deliverNotification(
    notification: INotification
  ): Promise<void> {
    try {
      const deliveryPromises = [];
      const channels = notification.deliveryChannels || ["in-app"];

      // In-app delivery via Socket.IO
      if (channels.includes("in-app")) {
        deliveryPromises.push(this.deliverInApp(notification));
      }

      // Email delivery
      if (channels.includes("email")) {
        deliveryPromises.push(this.deliverEmail(notification));
      }

      // Push notification delivery
      if (channels.includes("push")) {
        deliveryPromises.push(this.deliverPush(notification));
      }

      // SMS delivery
      if (channels.includes("sms")) {
        deliveryPromises.push(this.deliverSMS(notification));
      }

      // Wait for all deliveries
      await Promise.allSettled(deliveryPromises);

      // Update delivery status
      await notification.markAsDelivered();
    } catch (error) {
      console.error("Error delivering notification:", error);

      // Update to failed status
      notification.deliveryStatus = "failed";
      await notification.save();
    }
  }

  // Real-time in-app delivery
  private static async deliverInApp(
    notification: INotification
  ): Promise<void> {
    if (!this.socketManager) {
      console.warn(
        "Socket manager not initialized for real-time notifications"
      );
      return;
    }

    try {
      // Send to user's personal room
      this.socketManager.sendToUser(
        notification.userId.toString(),
        "new_notification",
        {
          id: notification._id,
          type: notification.type,
          category: notification.category,
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          metadata: notification.metadata,
          createdAt: notification.createdAt,
          isRead: false,
        }
      );

      console.log(`Real-time notification sent to user ${notification.userId}`);
    } catch (error) {
      console.error("Error sending real-time notification:", error);
      throw error;
    }
  }

  // Email delivery (placeholder - integrate with existing EmailService)
  private static async deliverEmail(
    notification: INotification
  ): Promise<void> {
    try {
      // TODO: Integrate with existing EmailService
      console.log(`Email notification would be sent: ${notification.title}`);
    } catch (error) {
      console.error("Error sending email notification:", error);
      throw error;
    }
  }

  // Push notification delivery (placeholder)
  private static async deliverPush(notification: INotification): Promise<void> {
    try {
      // TODO: Integrate with push service (Firebase, APNs, etc.)
      console.log(`Push notification would be sent: ${notification.title}`);
    } catch (error) {
      console.error("Error sending push notification:", error);
      throw error;
    }
  }

  // SMS delivery (placeholder)
  private static async deliverSMS(notification: INotification): Promise<void> {
    try {
      // TODO: Integrate with SMS service (Twilio, etc.)
      console.log(`SMS notification would be sent: ${notification.title}`);
    } catch (error) {
      console.error("Error sending SMS notification:", error);
      throw error;
    }
  }

  // Bulk operations
  static async markAllAsRead(
    userId: string
  ): Promise<{ modifiedCount: number }> {
    const result = await Notification.markAllAsReadForUser(userId);

    // Send real-time update
    if (this.socketManager) {
      this.socketManager.sendToUser(userId, "notifications_marked_read", {
        allRead: true,
        timestamp: new Date(),
      });
    }

    return result;
  }

  static async getUnreadCount(userId: string): Promise<number> {
    return await Notification.getUnreadCountForUser(userId);
  }

  // Get notifications with advanced filtering
  static async getNotifications(
    userId: string,
    filters: {
      type?: string;
      category?: string;
      isRead?: boolean;
      priority?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    notifications: INotification[];
    totalCount: number;
    unreadCount: number;
    pagination: {
      currentPage: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const { type, category, isRead, priority, page = 1, limit = 50 } = filters;

    // Build filter query
    const filter: any = {
      userId: new mongoose.Types.ObjectId(userId),
      // Only show non-expired notifications
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } },
      ],
    };

    if (type) filter.type = type;
    if (category) filter.category = category;
    if (isRead !== undefined) filter.isRead = isRead;
    if (priority) filter.priority = priority;

    const skip = (page - 1) * limit;

    // Get notifications and counts in parallel
    const [notifications, totalCount, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.getUnreadCountForUser(userId),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      notifications,
      totalCount,
      unreadCount,
      pagination: {
        currentPage: page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  // Notification preferences management
  static async updateNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { notificationPreferences: preferences } },
      { new: true }
    ).select("notificationPreferences");

    if (!user) {
      throw new Error("User not found");
    }

    return (
      (user.notificationPreferences as NotificationPreferences) ||
      ({} as NotificationPreferences)
    );
  }

  static async getNotificationPreferences(
    userId: string
  ): Promise<NotificationPreferences> {
    const user = await User.findById(userId).select("notificationPreferences");

    if (!user) {
      throw new Error("User not found");
    }

    // Return default preferences if none set
    return (
      (user.notificationPreferences as NotificationPreferences) || {
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: false,
        categories: {
          registration: true,
          reminder: true,
          cancellation: true,
          update: true,
          system: true,
          marketing: false,
          chat: true,
          role_change: true,
          announcement: true,
        },
        quietHours: {
          enabled: false,
          start: "22:00",
          end: "08:00",
          timezone: "UTC",
        },
      }
    );
  }

  // Analytics and cleanup
  static async getNotificationAnalytics(
    userId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{
    totalSent: number;
    totalRead: number;
    readRate: number;
    byCategory: Record<string, { sent: number; read: number }>;
    byType: Record<string, { sent: number; read: number }>;
  }> {
    const notifications = await Notification.find({
      userId: new mongoose.Types.ObjectId(userId),
      createdAt: { $gte: timeRange.start, $lte: timeRange.end },
    }).lean();

    const analytics = {
      totalSent: notifications.length,
      totalRead: notifications.filter((n) => n.isRead).length,
      readRate: 0,
      byCategory: {} as Record<string, { sent: number; read: number }>,
      byType: {} as Record<string, { sent: number; read: number }>,
    };

    analytics.readRate =
      analytics.totalSent > 0
        ? (analytics.totalRead / analytics.totalSent) * 100
        : 0;

    // Aggregate by category and type
    notifications.forEach((notification) => {
      // By category
      if (!analytics.byCategory[notification.category]) {
        analytics.byCategory[notification.category] = { sent: 0, read: 0 };
      }
      analytics.byCategory[notification.category].sent++;
      if (notification.isRead) {
        analytics.byCategory[notification.category].read++;
      }

      // By type
      if (!analytics.byType[notification.type]) {
        analytics.byType[notification.type] = { sent: 0, read: 0 };
      }
      analytics.byType[notification.type].sent++;
      if (notification.isRead) {
        analytics.byType[notification.type].read++;
      }
    });

    return analytics;
  }

  static async cleanupExpiredNotifications(): Promise<{
    deletedCount: number;
  }> {
    const result = await Notification.cleanupExpiredNotifications();
    console.log(`Cleaned up ${result.deletedCount} expired notifications`);
    return result;
  }

  // Migration helpers for existing system messages
  static async migrateSystemMessage(
    systemMessage: any
  ): Promise<INotification> {
    const notificationData: NotificationData = {
      userId: systemMessage.targetUserId?.toString() || "global",
      type: "SYSTEM_MESSAGE",
      category: this.mapSystemMessageCategory(systemMessage.type),
      title: systemMessage.title,
      message: systemMessage.content,
      priority: this.mapPriority(systemMessage.priority),
      metadata: {
        originalSystemMessageId: systemMessage._id,
        creator: systemMessage.creator,
        isGlobal: !systemMessage.targetUserId,
      },
      expiresAt: systemMessage.expiresAt,
    };

    return await this.createNotification(notificationData);
  }

  private static mapSystemMessageCategory(
    type: string
  ): NotificationData["category"] {
    const mapping: Record<string, NotificationData["category"]> = {
      announcement: "announcement",
      maintenance: "system",
      update: "update",
      warning: "system",
      auth_level_change: "role_change",
    };
    return mapping[type] || "system";
  }

  private static mapPriority(priority: string): NotificationData["priority"] {
    const mapping: Record<string, NotificationData["priority"]> = {
      low: "low",
      medium: "normal",
      high: "high",
    };
    return mapping[priority] || "normal";
  }
}
