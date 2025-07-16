import mongoose from "mongoose";
import dotenv from "dotenv";
import SystemMessage from "../models/SystemMessage";
import {
  NotificationService,
  NotificationData,
} from "../services/notificationService";

// Load environment variables
dotenv.config();

interface MigrationStats {
  total: number;
  migrated: number;
  failed: number;
  errors: string[];
}

async function migrateSystemMessagesToNotifications(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    failed: 0,
    errors: [],
  };

  try {
    console.log(
      "🔄 Starting migration of system messages to unified notification system..."
    );

    // Connect to database
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoURI);
    console.log("✅ Connected to MongoDB");

    // Get all active system messages
    const systemMessages = await SystemMessage.find({ isActive: true });
    stats.total = systemMessages.length;

    console.log(`📊 Found ${stats.total} active system messages to migrate`);

    for (const message of systemMessages) {
      try {
        // Migrate global messages (no targetUserId)
        if (!message.targetUserId) {
          // For global messages, we need to create notifications for all users
          const User = (await import("../models/User")).default;
          const users = await User.find({ isActive: true }).select("_id");

          console.log(
            `📢 Creating ${users.length} notifications for global message: "${message.title}"`
          );

          for (const user of users) {
            try {
              await NotificationService.createNotification({
                userId: (user._id as mongoose.Types.ObjectId).toString(),
                type: "SYSTEM_MESSAGE",
                category: mapSystemMessageCategory(
                  message.type
                ) as NotificationData["category"],
                title: message.title,
                message: message.content,
                priority: mapPriority(
                  message.priority
                ) as NotificationData["priority"],
                metadata: {
                  originalSystemMessageId: message._id,
                  creator: message.creator,
                  isGlobal: true,
                  migratedAt: new Date(),
                },
                expiresAt: message.expiresAt,
              });
            } catch (userError: any) {
              console.warn(
                `Failed to create notification for user ${user._id}:`,
                userError
              );
              stats.errors.push(
                `User ${user._id}: ${userError?.message || "Unknown error"}`
              );
            }
          }

          stats.migrated++;
        } else {
          // Targeted message - create single notification
          await NotificationService.createNotification({
            userId: message.targetUserId.toString(),
            type: "SYSTEM_MESSAGE",
            category: mapSystemMessageCategory(
              message.type
            ) as NotificationData["category"],
            title: message.title,
            message: message.content,
            priority: mapPriority(
              message.priority
            ) as NotificationData["priority"],
            metadata: {
              originalSystemMessageId: message._id,
              creator: message.creator,
              isGlobal: false,
              migratedAt: new Date(),
            },
            expiresAt: message.expiresAt,
          });

          stats.migrated++;
          console.log(`✅ Migrated targeted message: "${message.title}"`);
        }
      } catch (error: any) {
        stats.failed++;
        const errorMsg = `Failed to migrate message ${message._id}: ${
          error?.message || "Unknown error"
        }`;
        stats.errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    console.log("\n📈 Migration Summary:");
    console.log(`Total system messages: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.migrated}`);
    console.log(`Failed: ${stats.failed}`);

    if (stats.errors.length > 0) {
      console.log("\n❌ Errors encountered:");
      stats.errors.forEach((error) => console.log(`  - ${error}`));
    }

    return stats;
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log("📂 Database connection closed");
  }
}

function mapSystemMessageCategory(type: string): string {
  const mapping: Record<string, string> = {
    announcement: "announcement",
    maintenance: "system",
    update: "update",
    warning: "system",
    auth_level_change: "role_change",
  };
  return mapping[type] || "system";
}

function mapPriority(priority: string): string {
  const mapping: Record<string, string> = {
    low: "low",
    medium: "normal",
    high: "high",
  };
  return mapping[priority] || "normal";
}

// Run migration if called directly
if (require.main === module) {
  migrateSystemMessagesToNotifications()
    .then((stats) => {
      console.log("\n🎉 Migration completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Migration failed:", error);
      process.exit(1);
    });
}

export { migrateSystemMessagesToNotifications };
