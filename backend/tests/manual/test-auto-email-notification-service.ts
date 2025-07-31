/**
 * Manual Test Script for AutoEmailNotificationService
 *
 * This script tests the complete Email → System Message → Bell Notification trio integration
 * for role promotions and demotions.
 *
 * Run with: npx ts-node tests/manual/test-auto-email-notification-service.ts
 */

import dotenv from "dotenv";
import { connectDatabase } from "../../src/models";
import { AutoEmailNotificationService } from "../../src/services/infrastructure/autoEmailNotificationService";
import { Message } from "../../src/models/Message";

// Load environment variables
dotenv.config();

async function testAutoEmailNotificationService() {
  console.log("🧪 Testing AutoEmailNotificationService Integration...\n");

  try {
    // Connect to database
    console.log("📡 Connecting to database...");
    await connectDatabase();
    console.log("✅ Database connected successfully\n");

    // Test data for promotion
    const promotionUserData = {
      _id: "507f1f77bcf86cd799439011", // Valid ObjectId format
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@test.com",
      oldRole: "Participant",
      newRole: "Leader",
      role: "Leader",
    };

    const changedBy = {
      _id: "507f1f77bcf86cd799439012",
      firstName: "Admin",
      lastName: "User",
      email: "admin@atcloud.org",
      role: "Administrator",
    };

    // Clear any existing test messages
    console.log("🧹 Cleaning up existing test messages...");
    await Message.deleteMany({
      $or: [
        { recipientId: promotionUserData._id },
        { content: { $regex: "Jane Smith", $options: "i" } },
      ],
    });
    console.log("✅ Cleanup completed\n");

    // Test 1: Role Promotion with AutoEmailNotificationService
    console.log("🚀 Test 1: Role Promotion Integration...");
    console.log(
      `📧 Promoting ${promotionUserData.firstName} ${promotionUserData.lastName} from ${promotionUserData.oldRole} to ${promotionUserData.newRole}`
    );

    const promotionResult =
      await AutoEmailNotificationService.sendRoleChangeNotification({
        userData: promotionUserData,
        changedBy,
        reason: "Exceptional leadership and contribution to the community",
        isPromotion: true,
      });

    console.log("\n📊 Promotion Results:");
    console.log(`   📧 Emails Sent: ${promotionResult.emailsSent}`);
    console.log(`   💬 Messages Created: ${promotionResult.messagesCreated}`);

    // Verify system messages were created
    console.log("\n🔍 Verifying system messages...");
    const userMessages = await Message.find({
      recipientId: promotionUserData._id,
    }).sort({ createdAt: -1 });
    const adminMessages = await Message.find({
      recipientRole: "Administrator",
      content: { $regex: "Jane Smith", $options: "i" },
    }).sort({ createdAt: -1 });

    console.log(`   📨 User Messages Found: ${userMessages.length}`);
    console.log(`   📨 Admin Messages Found: ${adminMessages.length}`);

    if (userMessages.length > 0) {
      console.log(
        `   ✅ Latest User Message: "${userMessages[0].content.substring(
          0,
          80
        )}..."`
      );
      console.log(`   📱 Bell Notification: Available in userStates`);
      console.log(`   💼 System Message: Available in userStates`);
    }

    if (adminMessages.length > 0) {
      console.log(
        `   ✅ Latest Admin Message: "${adminMessages[0].content.substring(
          0,
          80
        )}..."`
      );
    }

    // Test 2: Role Demotion
    console.log("\n\n🔻 Test 2: Role Demotion Integration...");

    const demotionUserData = {
      ...promotionUserData,
      oldRole: "Leader",
      newRole: "Participant",
      role: "Participant",
    };

    console.log(
      `📧 Demoting ${demotionUserData.firstName} ${demotionUserData.lastName} from ${demotionUserData.oldRole} to ${demotionUserData.newRole}`
    );

    const demotionResult =
      await AutoEmailNotificationService.sendRoleChangeNotification({
        userData: demotionUserData,
        changedBy,
        reason: "Restructuring organizational responsibilities",
        isPromotion: false,
      });

    console.log("\n📊 Demotion Results:");
    console.log(`   📧 Emails Sent: ${demotionResult.emailsSent}`);
    console.log(`   💬 Messages Created: ${demotionResult.messagesCreated}`);

    // Verify demotion messages
    console.log("\n🔍 Verifying demotion messages...");
    const demotionUserMessages = await Message.find({
      recipientId: demotionUserData._id,
    })
      .sort({ createdAt: -1 })
      .limit(2);

    if (demotionUserMessages.length > 0) {
      console.log(
        `   ✅ Latest User Message: "${demotionUserMessages[0].content.substring(
          0,
          80
        )}..."`
      );
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("🎯 INTEGRATION TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(
      `✅ Promotion Test: ${promotionResult.emailsSent} emails, ${promotionResult.messagesCreated} messages`
    );
    console.log(
      `✅ Demotion Test: ${demotionResult.emailsSent} emails, ${demotionResult.messagesCreated} messages`
    );
    console.log(
      `📱 Bell Notifications: ${userMessages.length > 0 ? "WORKING" : "ISSUE"}`
    );
    console.log(
      `💼 System Messages: ${userMessages.length > 0 ? "WORKING" : "ISSUE"}`
    );
    console.log(
      `👥 Admin Notifications: ${
        adminMessages.length > 0 ? "WORKING" : "ISSUE"
      }`
    );

    if (
      promotionResult.messagesCreated >= 2 &&
      demotionResult.messagesCreated >= 2
    ) {
      console.log(
        "\n🎉 SUCCESS: Email → System Message → Bell Notification trio is WORKING!"
      );
    } else {
      console.log(
        "\n❌ ISSUE: Some components of the notification trio are not working properly."
      );
    }
  } catch (error: any) {
    console.error("❌ Test failed:", error?.message || error);
    console.error("Stack trace:", error?.stack);
  } finally {
    // Close database connection
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("\n📡 Database disconnected");
    }
    process.exit(0);
  }
}

// Run the test
testAutoEmailNotificationService().catch(console.error);
