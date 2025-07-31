/**
 * Debug Test: System Message - Bell Notification Sync Issue
 *
 * This test specifically diagnoses why Ruth Fan receives bell notifications
 * but not system messages, even though they should be synchronized.
 */

import dotenv from "dotenv";
import { connectDatabase } from "../../src/models";
import { Message } from "../../src/models/Message";
import { AutoEmailNotificationService } from "../../src/services/infrastructure/autoEmailNotificationService";

dotenv.config();

async function debugSystemMessageSync() {
  console.log("🔍 Debugging System Message - Bell Notification Sync...\n");

  try {
    await connectDatabase();
    console.log("✅ Database connected\n");

    // Test user ID - Ruth Fan
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
        { content: { $regex: "test.*role.*change", $options: "i" } },
      ],
    });

    // Step 1: Create a role change notification
    console.log("🚀 Creating role change notification...");
    const result =
      await AutoEmailNotificationService.sendRoleChangeNotification({
        userData: testUserData,
        changedBy,
        reason: "Test promotion for debugging",
        isPromotion: true,
      });

    console.log(
      `📊 Notification Result: ${result.emailsSent} emails, ${result.messagesCreated} messages`
    );

    // Step 2: Check what messages were actually created
    console.log("\n🔍 Checking created messages in database...");
    const allMessages = await Message.find({
      $or: [
        { content: { $regex: "Ruth Fan", $options: "i" } },
        { content: { $regex: "Administrator", $options: "i" } },
        { type: "auth_level_change" },
      ],
    }).sort({ createdAt: -1 });

    console.log(`📝 Total messages found: ${allMessages.length}`);

    for (let i = 0; i < allMessages.length; i++) {
      const msg = allMessages[i];
      console.log(`\n   Message ${i + 1}:`);
      console.log(`     📋 Title: "${msg.title}"`);
      console.log(`     📄 Content: "${msg.content.substring(0, 100)}..."`);
      console.log(`     🏷️ Type: ${msg.type}, Priority: ${msg.priority}`);
      console.log(`     👥 UserStates type: ${typeof msg.userStates}`);
      console.log(
        `     🗺️ UserStates keys: ${
          msg.userStates ? Array.from(msg.userStates.keys()) : "None"
        }`
      );

      // Check if Ruth's user ID is in userStates
      if (msg.userStates) {
        const ruthState = msg.userStates.get(testUserId);
        console.log(
          `     👤 Ruth's state: ${
            ruthState ? JSON.stringify(ruthState) : "NOT FOUND"
          }`
        );
      }
    }

    // Step 3: Test the system messages query filter
    console.log("\n🔍 Testing system messages query filter...");

    // This is the exact query used by getSystemMessages
    const systemMessageQuery = {
      isActive: true,
      [`userStates.${testUserId}`]: { $exists: true },
      [`userStates.${testUserId}.isDeletedFromSystem`]: { $ne: true },
    };

    console.log(
      "📋 Query filter:",
      JSON.stringify(systemMessageQuery, null, 2)
    );

    const systemMessages = await Message.find(systemMessageQuery).sort({
      createdAt: -1,
    });
    console.log(
      `📋 System messages query result: ${systemMessages.length} messages`
    );

    // Step 4: Test the bell notifications query filter
    console.log("\n🔔 Testing bell notifications query filter...");

    const bellNotificationQuery = {
      isActive: true,
      [`userStates.${testUserId}`]: { $exists: true },
      [`userStates.${testUserId}.isRemovedFromBell`]: { $ne: true },
    };

    const bellNotifications = await Message.find(bellNotificationQuery).sort({
      createdAt: -1,
    });
    console.log(
      `🔔 Bell notifications query result: ${bellNotifications.length} messages`
    );

    // Step 5: Alternative query approach
    console.log("\n🔧 Testing alternative query approach...");

    const alternativeQuery = {
      isActive: true,
      userStates: { $exists: true },
    };

    const alternativeResults = await Message.find(alternativeQuery);
    const filteredResults = alternativeResults.filter(
      (msg) => msg.userStates && msg.userStates.has(testUserId)
    );

    console.log(
      `🔧 Alternative query found: ${filteredResults.length} messages for Ruth`
    );

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("🎯 SYNC DIAGNOSIS SUMMARY");
    console.log("=".repeat(60));
    console.log(`📝 Messages Created: ${allMessages.length}`);
    console.log(`📋 System Messages Query: ${systemMessages.length}`);
    console.log(`🔔 Bell Notifications Query: ${bellNotifications.length}`);
    console.log(`🔧 Alternative Query: ${filteredResults.length}`);

    if (systemMessages.length !== bellNotifications.length) {
      console.log(
        "\n❌ ISSUE FOUND: System message and bell notification queries return different results!"
      );
      console.log(
        "   This explains why Ruth sees bell notifications but not system messages."
      );
    } else if (systemMessages.length === 0) {
      console.log("\n❌ ISSUE FOUND: Both queries return 0 results!");
      console.log("   The userStates query filter is not working properly.");
    } else {
      console.log(
        "\n✅ Queries return same results - issue might be elsewhere."
      );
    }
  } catch (error: any) {
    console.error("❌ Debug test failed:", error?.message || error);
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

debugSystemMessageSync().catch(console.error);
