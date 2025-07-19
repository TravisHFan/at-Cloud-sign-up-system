/**
 * Database Purge Script - System Messages and Notifications
 *
 * This script will completely remove all notification and system message data
 * to prepare for the unified system rebuild.
 *
 * WARNING: This will delete ALL notification and system message data!
 * Make sure you have a backup if needed.
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

async function purgeNotificationData() {
  try {
    // Connect to MongoDB
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoURI);
    console.log("✅ Connected to MongoDB");

    // Get database reference
    const db = mongoose.connection.db;

    console.log("\n🗑️  Starting notification data purge...\n");

    // 1. Drop SystemMessage collection entirely
    try {
      await db.collection("systemmessages").drop();
      console.log("✅ Dropped SystemMessage collection");
    } catch (error) {
      if (error.message.includes("ns not found")) {
        console.log("ℹ️  SystemMessage collection does not exist");
      } else {
        console.error(
          "❌ Error dropping SystemMessage collection:",
          error.message
        );
      }
    }

    // 2. Clean user notification-related fields
    const userUpdateResult = await db.collection("users").updateMany(
      {},
      {
        $unset: {
          // Remove notification arrays
          notifications: "",
          bellNotifications: "",
          systemMessageStates: "",
          bellNotificationStates: "",

          // Remove any other notification-related fields
          unreadNotificationCount: "",
          lastNotificationCheck: "",
          notificationSettings: "",
        },
      }
    );

    console.log(
      `✅ Cleaned notification data from ${userUpdateResult.modifiedCount} users`
    );

    // 3. Drop any notification-related collections that might exist
    const collections = await db.listCollections().toArray();
    const notificationCollections = collections.filter(
      (col) =>
        col.name.toLowerCase().includes("notification") ||
        col.name.toLowerCase().includes("message") ||
        col.name.toLowerCase().includes("bell")
    );

    for (const collection of notificationCollections) {
      if (collection.name !== "users") {
        // Don't drop users collection
        try {
          await db.collection(collection.name).drop();
          console.log(`✅ Dropped collection: ${collection.name}`);
        } catch (error) {
          console.log(
            `ℹ️  Could not drop ${collection.name}: ${error.message}`
          );
        }
      }
    }

    // 4. Verify cleanup
    console.log("\n📊 Verification:");

    const userCount = await db.collection("users").countDocuments();
    console.log(`👥 Users remaining: ${userCount}`);

    const usersWithNotificationData = await db
      .collection("users")
      .countDocuments({
        $or: [
          { notifications: { $exists: true } },
          { bellNotifications: { $exists: true } },
          { systemMessageStates: { $exists: true } },
          { bellNotificationStates: { $exists: true } },
        ],
      });
    console.log(
      `🔔 Users with notification data: ${usersWithNotificationData}`
    );

    try {
      const systemMessageCount = await db
        .collection("systemmessages")
        .countDocuments();
      console.log(`📝 System messages remaining: ${systemMessageCount}`);
    } catch (error) {
      console.log("📝 System messages collection: Not found (cleaned)");
    }

    console.log("\n🎉 Notification data purge completed successfully!");
    console.log("\n📝 Summary:");
    console.log("   - All SystemMessage documents deleted");
    console.log("   - All user notification states cleared");
    console.log("   - All notification-related collections dropped");
    console.log("   - User accounts preserved");
    console.log("\n✅ Database is ready for unified system rebuild");
  } catch (error) {
    console.error("❌ Error during purge:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n👋 Database connection closed");
  }
}

// Run the purge if this script is executed directly
if (require.main === module) {
  console.log(
    "⚠️  WARNING: This will delete ALL notification and system message data!"
  );
  console.log("⚠️  Make sure you have a backup if needed.");
  console.log("\nStarting purge in 3 seconds...");

  setTimeout(() => {
    purgeNotificationData();
  }, 3000);
}

module.exports = { purgeNotificationData };
