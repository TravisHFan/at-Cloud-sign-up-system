/**
 * Verification Script - Check Notification Data Cleanup
 *
 * This script verifies that the purge was successful and shows
 * the current state of the database.
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

async function verifyPurge() {
  try {
    // Connect to MongoDB
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoURI);
    console.log("✅ Connected to MongoDB for verification\n");

    const db = mongoose.connection.db;

    console.log("🔍 Database Verification Report");
    console.log("================================\n");

    // Check collections
    const collections = await db.listCollections().toArray();
    console.log("📁 Existing Collections:");
    collections.forEach((col) => {
      console.log(`   - ${col.name}`);
    });
    console.log();

    // Check users collection
    const userCount = await db.collection("users").countDocuments();
    console.log(`👥 Total Users: ${userCount}`);

    // Check for any remaining notification data in users
    const usersWithNotificationFields = await db
      .collection("users")
      .aggregate([
        {
          $project: {
            username: 1,
            hasNotifications: { $ifNull: ["$notifications", false] },
            hasBellNotifications: { $ifNull: ["$bellNotifications", false] },
            hasSystemMessageStates: {
              $ifNull: ["$systemMessageStates", false],
            },
            hasBellNotificationStates: {
              $ifNull: ["$bellNotificationStates", false],
            },
          },
        },
        {
          $match: {
            $or: [
              { hasNotifications: { $ne: false } },
              { hasBellNotifications: { $ne: false } },
              { hasSystemMessageStates: { $ne: false } },
              { hasBellNotificationStates: { $ne: false } },
            ],
          },
        },
      ])
      .toArray();

    if (usersWithNotificationFields.length > 0) {
      console.log("⚠️  Users with remaining notification data:");
      usersWithNotificationFields.forEach((user) => {
        console.log(`   - ${user.username}: ${JSON.stringify(user)}`);
      });
    } else {
      console.log("✅ No users have notification data remaining");
    }

    // Check for SystemMessage collection
    try {
      const systemMessageCount = await db
        .collection("systemmessages")
        .countDocuments();
      console.log(`⚠️  SystemMessages remaining: ${systemMessageCount}`);
    } catch (error) {
      console.log(
        "✅ SystemMessage collection does not exist (properly cleaned)"
      );
    }

    // Check for any notification-related collections
    const notificationCollections = collections.filter(
      (col) =>
        col.name.toLowerCase().includes("notification") ||
        col.name.toLowerCase().includes("message") ||
        col.name.toLowerCase().includes("bell")
    );

    if (notificationCollections.length > 0) {
      console.log("⚠️  Notification-related collections found:");
      for (const col of notificationCollections) {
        const count = await db.collection(col.name).countDocuments();
        console.log(`   - ${col.name}: ${count} documents`);
      }
    } else {
      console.log("✅ No notification-related collections found");
    }

    // Check essential collections are intact
    console.log("\n🏗️  Essential Collections Status:");
    try {
      const userSample = await db.collection("users").findOne({});
      console.log("✅ Users collection: Active");
      console.log(
        `   Sample user fields: ${Object.keys(userSample || {}).length} fields`
      );
    } catch (error) {
      console.log("❌ Users collection: Error");
    }

    try {
      const eventCount = await db.collection("events").countDocuments();
      console.log(`✅ Events collection: ${eventCount} documents`);
    } catch (error) {
      console.log("ℹ️  Events collection: Not found or empty");
    }

    console.log("\n" + "=".repeat(50));
    console.log("🎯 VERIFICATION SUMMARY");
    console.log("=".repeat(50));

    if (
      usersWithNotificationFields.length === 0 &&
      notificationCollections.length === 0
    ) {
      console.log("✅ PURGE SUCCESSFUL");
      console.log("   - All notification data removed");
      console.log("   - User accounts preserved");
      console.log("   - Database ready for unified system");
    } else {
      console.log("⚠️  PURGE INCOMPLETE");
      console.log("   - Some notification data may remain");
      console.log("   - Manual cleanup may be required");
    }
  } catch (error) {
    console.error("❌ Verification error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n👋 Verification complete");
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  verifyPurge();
}

module.exports = { verifyPurge };
