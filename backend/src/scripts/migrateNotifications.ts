import mongoose from "mongoose";
import dotenv from "dotenv";
import { UnifiedNotification } from "../models";
import InAppNotification from "../models/InAppNotification";
import Notification from "../models/Notification";
import SystemMessage from "../models/SystemMessage";

dotenv.config();

class NotificationMigration {
  static async connectDB() {
    try {
      const mongoURI =
        process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
      await mongoose.connect(mongoURI);
      console.log("✅ Connected to MongoDB for migration");
    } catch (error) {
      console.error("❌ MongoDB connection failed:", error);
      process.exit(1);
    }
  }

  static async migrateInAppNotifications() {
    console.log("🔄 Migrating InApp Notifications...");

    try {
      const inAppNotifications = await InAppNotification.find({}).lean();
      let migratedCount = 0;

      for (const notification of inAppNotifications) {
        // Check if already migrated
        const existing = await UnifiedNotification.findOne({
          "metadata.legacyId": notification._id,
        });

        if (existing) {
          console.log(
            `⏭️  Skipping already migrated notification: ${notification._id}`
          );
          continue;
        }

        const unifiedNotification = new UnifiedNotification({
          userId: notification.userId,
          type: "CHAT_MESSAGE", // Most in-app notifications are chat-related
          category:
            notification.type === "user_message"
              ? "chat"
              : notification.type === "management_action"
              ? "role_change"
              : "system",
          title: notification.title,
          message: notification.message,
          isRead: notification.isRead,
          priority: "normal",
          metadata: {
            legacyId: notification._id,
            legacyType: "InAppNotification",
            fromUserId: notification.fromUser?.id,
            actionType: notification.actionType,
            actionDetails: notification.actionDetails,
          },
          deliveryChannels: ["in-app"],
          deliveryStatus: "delivered",
          createdAt: notification.createdAt,
          updatedAt: notification.updatedAt,
        });

        if (notification.isRead) {
          unifiedNotification.readAt = notification.updatedAt; // Approximate read time
        }

        await unifiedNotification.save();
        migratedCount++;
      }

      console.log(`✅ Migrated ${migratedCount} InApp Notifications`);
    } catch (error) {
      console.error("❌ Failed to migrate InApp Notifications:", error);
    }
  }

  static async migrateEventNotifications() {
    console.log("🔄 Migrating Event Notifications...");

    try {
      const eventNotifications = await Notification.find({}).lean();
      let migratedCount = 0;

      for (const notification of eventNotifications) {
        // Check if already migrated
        const existing = await UnifiedNotification.findOne({
          "metadata.legacyId": notification._id,
        });

        if (existing) {
          console.log(
            `⏭️  Skipping already migrated notification: ${notification._id}`
          );
          continue;
        }

        const unifiedNotification = new UnifiedNotification({
          userId: notification.recipient,
          type: "EVENT_NOTIFICATION",
          category: notification.category,
          title: notification.title,
          message: notification.message,
          isRead: notification.status === "read",
          priority: notification.priority,
          metadata: {
            legacyId: notification._id,
            legacyType: "Notification",
            eventId: notification.data?.eventId,
            registrationId: notification.data?.registrationId,
            actionUrl: notification.data?.actionUrl,
            additionalInfo: notification.data?.additionalInfo,
          },
          deliveryChannels: [notification.type],
          deliveryStatus:
            notification.status === "failed"
              ? "failed"
              : notification.status === "delivered"
              ? "delivered"
              : "sent",
          scheduledFor: notification.scheduledFor,
          expiresAt: notification.expiresAt,
          sentAt: notification.sentAt,
          deliveredAt: notification.deliveredAt,
          createdAt: notification.createdAt,
          updatedAt: notification.updatedAt,
        });

        if (notification.readAt) {
          unifiedNotification.readAt = notification.readAt;
        }

        await unifiedNotification.save();
        migratedCount++;
      }

      console.log(`✅ Migrated ${migratedCount} Event Notifications`);
    } catch (error) {
      console.error("❌ Failed to migrate Event Notifications:", error);
    }
  }

  static async migrateSystemMessages() {
    console.log("🔄 Migrating System Messages...");

    try {
      const systemMessages = await SystemMessage.find({}).lean();
      let migratedCount = 0;

      for (const message of systemMessages) {
        // System messages are global, so we need to create notifications for all users
        // For now, we'll create them for users who have read them
        const readByUsers = message.readByUsers || [];

        // If it's a targeted message, only create for that user
        if (message.targetUserId) {
          const existing = await UnifiedNotification.findOne({
            userId: message.targetUserId,
            "metadata.legacyId": message._id,
          });

          if (!existing) {
            const unifiedNotification = new UnifiedNotification({
              userId: message.targetUserId,
              type: "SYSTEM_MESSAGE",
              category:
                message.type === "auth_level_change"
                  ? "role_change"
                  : "announcement",
              title: message.title,
              message: message.content,
              isRead: readByUsers.includes(message.targetUserId),
              priority:
                message.priority === "medium"
                  ? "normal"
                  : (message.priority as any),
              metadata: {
                legacyId: message._id,
                legacyType: "SystemMessage",
                originalType: message.type,
                isGlobal: false,
                targetUserId: message.targetUserId,
                creator: message.creator,
              },
              deliveryChannels: ["in-app"],
              deliveryStatus: "delivered",
              expiresAt: message.expiresAt,
              createdAt: message.createdAt,
              updatedAt: message.updatedAt,
            });

            if (readByUsers.includes(message.targetUserId)) {
              unifiedNotification.readAt = message.updatedAt;
            }

            await unifiedNotification.save();
            migratedCount++;
          }
        } else {
          // Global message - create notifications for users who have read it (we know they exist)
          for (const userId of readByUsers) {
            const existing = await UnifiedNotification.findOne({
              userId: userId,
              "metadata.legacyId": message._id,
            });

            if (!existing) {
              const unifiedNotification = new UnifiedNotification({
                userId: userId,
                type: "SYSTEM_MESSAGE",
                category: "announcement",
                title: message.title,
                message: message.content,
                isRead: true, // They read it in the old system
                priority:
                  message.priority === "medium"
                    ? "normal"
                    : (message.priority as any),
                metadata: {
                  legacyId: message._id,
                  legacyType: "SystemMessage",
                  originalType: message.type,
                  isGlobal: true,
                  creator: message.creator,
                },
                deliveryChannels: ["in-app"],
                deliveryStatus: "delivered",
                readAt: message.updatedAt, // Approximate read time
                expiresAt: message.expiresAt,
                createdAt: message.createdAt,
                updatedAt: message.updatedAt,
              });

              await unifiedNotification.save();
              migratedCount++;
            }
          }
        }
      }

      console.log(`✅ Migrated ${migratedCount} System Message notifications`);
    } catch (error) {
      console.error("❌ Failed to migrate System Messages:", error);
    }
  }

  static async validateMigration() {
    console.log("🔍 Validating migration...");

    try {
      const unifiedCount = await UnifiedNotification.countDocuments({});
      const inAppCount = await InAppNotification.countDocuments({});
      const eventCount = await Notification.countDocuments({});
      const systemCount = await SystemMessage.countDocuments({});

      console.log(`📊 Migration Summary:`);
      console.log(`   - Unified Notifications: ${unifiedCount}`);
      console.log(`   - Original InApp: ${inAppCount}`);
      console.log(`   - Original Event: ${eventCount}`);
      console.log(`   - Original System: ${systemCount}`);
      console.log(
        `   - Total Original: ${inAppCount + eventCount + systemCount}`
      );

      if (unifiedCount >= inAppCount + eventCount + systemCount) {
        console.log("✅ Migration appears successful!");
      } else {
        console.log("⚠️  Migration may be incomplete - check for errors above");
      }
    } catch (error) {
      console.error("❌ Failed to validate migration:", error);
    }
  }

  static async run() {
    console.log("🚀 Starting Notification System Migration...");

    await this.connectDB();

    await this.migrateInAppNotifications();
    await this.migrateEventNotifications();
    await this.migrateSystemMessages();

    await this.validateMigration();

    await mongoose.connection.close();
    console.log("🏁 Migration completed!");
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  NotificationMigration.run().catch(console.error);
}

export default NotificationMigration;
