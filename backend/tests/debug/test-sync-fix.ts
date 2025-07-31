/**
 * Quick Test: System Message - Bell Notification Sync Fix
 *
 * This test verifies that Ruth Fan now receives both system messages
 * and bell notifications after our Mongoose Map query fix.
 */

import dotenv from "dotenv";
import { connectDatabase } from "../../src/models";
import { Message } from "../../src/models/Message";
import { AutoEmailNotificationService } from "../../src/services/infrastructure/autoEmailNotificationService";

dotenv.config();

async function testSyncFix() {
  console.log("🧪 Testing System Message - Bell Notification Sync Fix...\n");

  try {
    await connectDatabase();
    console.log("✅ Database connected\n");

    // Test user data
    const testUserId = "507f1f77bcf86cd799439011";
    const testUserData = {
      _id: testUserId,
      firstName: "Ruth",
      lastName: "Fan",
      email: "ruth.fan@test.com",
      oldRole: "Leader",
      newRole: "Administrator",
    };

    const changedBy = {
      _id: "507f1f77bcf86cd799439012",
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@test.com",
      role: "Super Admin",
    };

    // Clean up existing messages
    console.log("🧹 Cleaning up existing test messages...");
    await Message.deleteMany({
      $or: [
        { content: { $regex: "Ruth Fan", $options: "i" } },
        { type: "auth_level_change" },
      ],
    });

    // Create a role change notification
    console.log("🚀 Creating role change notification...");
    const result =
      await AutoEmailNotificationService.sendRoleChangeNotification({
        userData: testUserData,
        changedBy,
        reason: "Test promotion to verify sync fix",
        isPromotion: true,
      });

    console.log(
      `📊 Result: ${result.emailsSent} emails, ${result.messagesCreated} messages created`
    );

    // Wait for creation
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test 1: Check bell notifications query (fixed)
    console.log("\n🔔 Testing bell notifications query...");
    const allMessages = await Message.find({
      isActive: true,
      userStates: { $exists: true },
    }).sort({ createdAt: -1 });

    const bellNotifications = allMessages.filter((message) => {
      if (!message.userStates || !message.userStates.has(testUserId)) {
        return false;
      }
      const userState = message.userStates.get(testUserId);
      return userState && !userState.isRemovedFromBell;
    });

    console.log(`🔔 Bell notifications found: ${bellNotifications.length}`);

    // Test 2: Check system messages query (fixed)
    console.log("\n📋 Testing system messages query...");
    const systemMessages = allMessages.filter((message) => {
      if (!message.userStates || !message.userStates.has(testUserId)) {
        return false;
      }
      const userState = message.userStates.get(testUserId);
      return userState && !userState.isDeletedFromSystem;
    });

    console.log(`📋 System messages found: ${systemMessages.length}`);

    // Test 3: Check that the messages are the same (sync working)
    console.log(
      "\n🔍 Checking sync between bell notifications and system messages..."
    );

    if (
      bellNotifications.length === systemMessages.length &&
      bellNotifications.length > 0
    ) {
      console.log(
        "✅ SYNC FIXED: Bell notifications and system messages count match!"
      );

      // Check if they're the same messages
      const bellIds = bellNotifications
        .map((m) => (m._id as any).toString())
        .sort();
      const systemIds = systemMessages
        .map((m) => (m._id as any).toString())
        .sort();

      if (JSON.stringify(bellIds) === JSON.stringify(systemIds)) {
        console.log(
          "✅ PERFECT: Same messages appear in both bell and system views!"
        );
      } else {
        console.log("⚠️ WARNING: Different messages in bell vs system views");
      }

      // Show the messages found
      console.log("\n📋 Messages found:");
      bellNotifications.forEach((msg, index) => {
        console.log(`   ${index + 1}. "${msg.title}"`);
        console.log(`      Content: "${msg.content.substring(0, 80)}..."`);
        console.log(`      Type: ${msg.type}, Priority: ${msg.priority}`);
      });
    } else {
      console.log(
        "❌ SYNC ISSUE: Bell notifications and system messages counts differ"
      );
      console.log(
        `   Bell: ${bellNotifications.length}, System: ${systemMessages.length}`
      );
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("🎯 SYNC FIX TEST RESULTS");
    console.log("=".repeat(60));
    console.log(`📧 Emails Created: ${result.emailsSent}`);
    console.log(`💬 Messages Created: ${result.messagesCreated}`);
    console.log(`🔔 Bell Notifications: ${bellNotifications.length}`);
    console.log(`📋 System Messages: ${systemMessages.length}`);

    if (
      bellNotifications.length > 0 &&
      systemMessages.length > 0 &&
      bellNotifications.length === systemMessages.length
    ) {
      console.log(
        "\n🎉 SUCCESS: System Message - Bell Notification sync is now WORKING!"
      );
      console.log(
        "   Ruth Fan should now see role change notifications in BOTH:"
      );
      console.log("   🔔 Bell notifications (header dropdown)");
      console.log("   📋 System messages (System Messages page)");
    } else {
      console.log(
        "\n❌ ISSUE: Sync problem still exists - needs further investigation"
      );
    }
  } catch (error: any) {
    console.error("❌ Test failed:", error?.message || error);
    console.error("Stack trace:", error?.stack);
  } finally {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("\n📡 Database disconnected");
    }
    process.exit(0);
  }
}

testSyncFix().catch(console.error);
