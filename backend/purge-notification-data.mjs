#!/usr/bin/env node

/**
 * Database Cleanup Script - Purge All Notification Data
 *
 * This script will:
 * 1. Remove all Message documents (unified system messages)
 * 2. Clean any legacy notification data from users
 * 3. Reset notification states to fresh start
 *
 * Run after fixing duplicate notification bug to test clean system
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Connect to database
async function connectDB() {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoURI);
    console.log("✅ Connected to MongoDB for cleanup");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
}

// Define Message schema (for cleanup)
const messageSchema = new mongoose.Schema({}, { strict: false });
const Message = mongoose.model("Message", messageSchema);

// Define User schema (for cleanup)
const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model("User", userSchema);

async function purgeNotificationData() {
  try {
    console.log("🧹 Starting notification data cleanup...\n");

    // 1. Count existing data
    const messageCount = await Message.countDocuments();
    const userCount = await User.countDocuments();

    console.log(`📊 Current state:`);
    console.log(`   - Messages: ${messageCount}`);
    console.log(`   - Users: ${userCount}`);

    // 2. Remove all Message documents (unified system)
    console.log("\n🗑️  Removing all Message documents...");
    const messageResult = await Message.deleteMany({});
    console.log(`   ✅ Deleted ${messageResult.deletedCount} messages`);

    // 3. Clean legacy notification fields from users (if any exist)
    console.log("\n🧽 Cleaning legacy notification data from users...");

    // Remove any legacy fields that might still exist
    const userUpdateResult = await User.updateMany(
      {},
      {
        $unset: {
          bellNotifications: "",
          bellNotificationStates: "",
          systemMessageStates: "",
          systemMessages: "",
          notifications: "",
        },
      }
    );

    console.log(
      `   ✅ Cleaned ${userUpdateResult.modifiedCount} user documents`
    );

    // 4. Verify cleanup
    const finalMessageCount = await Message.countDocuments();
    const finalUserCount = await User.countDocuments();

    console.log("\n📊 Final state:");
    console.log(`   - Messages: ${finalMessageCount}`);
    console.log(`   - Users: ${finalUserCount}`);
    console.log(`   - Users with clean notification data: ${finalUserCount}`);

    console.log("\n🎉 Notification data cleanup completed successfully!");
    console.log("\n🧪 Ready to test unified notification system:");
    console.log("   1. Create a system message via admin panel");
    console.log("   2. Check bell notifications dropdown");
    console.log("   3. Verify no duplicates appear");
    console.log("   4. Test mark as read/remove functionality");
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    throw error;
  }
}

async function main() {
  try {
    await connectDB();
    await purgeNotificationData();
  } catch (error) {
    console.error("❌ Script failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  }
}

// Run the script
main().catch(console.error);
