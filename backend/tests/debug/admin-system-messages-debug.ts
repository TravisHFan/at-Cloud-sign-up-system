/**
 * Debug Test: Admin System Messages and Ruth Fan Privacy
 *
 * This test checks:
 * 1. Whether admins receive system messages (not just bell notifications)
 * 2. Whether Ruth Fan's system message is private to her only
 */

import dotenv from "dotenv";
import { connectDatabase } from "../../src/models";
import { Message } from "../../src/models/Message";
import { AutoEmailNotificationService } from "../../src/services/infrastructure/autoEmailNotificationService";
import User from "../../src/models/User";

dotenv.config();

async function debugAdminSystemMessages() {
  console.log("🔍 Debugging Admin System Messages and User Privacy...\n");

  try {
    await connectDatabase();
    console.log("✅ Database connected\n");

    // Test users
    const ruthUserId = "507f1f77bcf86cd799439011";
    const johnUserId = "507f1f77bcf86cd799439012";

    const ruthUserData = {
      _id: ruthUserId,
      firstName: "Ruth",
      lastName: "Fan",
      email: "ruth.fan@test.com",
      oldRole: "Leader",
      newRole: "Administrator",
    };

    const johnUserData = {
      _id: johnUserId,
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

    // Check what admin users exist in the database
    console.log("👥 Checking admin users in database...");
    const adminUsers = await User.find({
      role: { $in: ["Super Admin", "Administrator"] },
      isActive: true,
    }).select("_id email firstName lastName role");

    console.log(`📋 Found ${adminUsers.length} admin users:`);
    adminUsers.forEach((admin) => {
      console.log(
        `   - ${admin.firstName} ${admin.lastName} (${admin.role}) - ${admin.email}`
      );
    });

    // Create role change notification
    console.log("\n🚀 Creating role change notification...");
    const result =
      await AutoEmailNotificationService.sendRoleChangeNotification({
        userData: ruthUserData,
        changedBy: johnUserData,
        reason: "Testing admin system messages",
        isPromotion: true,
      });

    console.log(
      `📊 Result: ${result.emailsSent} emails, ${result.messagesCreated} messages created`
    );

    // Wait for creation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check all messages created
    console.log("\n🔍 Checking all messages created...");
    const allMessages = await Message.find({
      type: "auth_level_change",
      isActive: true,
    }).sort({ createdAt: -1 });

    console.log(`📝 Total auth_level_change messages: ${allMessages.length}`);

    for (let i = 0; i < allMessages.length; i++) {
      const msg = allMessages[i];
      console.log(`\n   Message ${i + 1}:`);
      console.log(`     📋 Title: "${msg.title}"`);
      console.log(`     📄 Content: "${msg.content.substring(0, 100)}..."`);
      console.log(`     🏷️ Priority: ${msg.priority}`);

      if (msg.userStates) {
        const userIds = Array.from(msg.userStates.keys());
        console.log(
          `     👥 Target Users (${userIds.length}): ${userIds.join(", ")}`
        );

        // Check each user's state
        userIds.forEach((userId) => {
          const state = msg.userStates!.get(userId);
          console.log(
            `       - ${userId}: Bell=${!state?.isRemovedFromBell}, System=${!state?.isDeletedFromSystem}`
          );
        });
      }
    }

    // Test 1: Check Ruth Fan's system messages
    console.log("\n📋 Test 1: Ruth Fan's System Messages...");
    const allMessagesForQuery = await Message.find({
      isActive: true,
      userStates: { $exists: true },
    }).sort({ createdAt: -1 });

    const ruthSystemMessages = allMessagesForQuery.filter((message) => {
      if (!message.userStates || !message.userStates.has(ruthUserId)) {
        return false;
      }
      const userState = message.userStates.get(ruthUserId);
      return userState && !userState.isDeletedFromSystem;
    });

    console.log(`📋 Ruth Fan system messages: ${ruthSystemMessages.length}`);
    ruthSystemMessages.forEach((msg, index) => {
      console.log(`   ${index + 1}. "${msg.title}"`);
    });

    // Test 2: Check admin system messages for each admin
    console.log("\n👥 Test 2: Admin System Messages...");

    for (const admin of adminUsers) {
      const adminId = (admin._id as any).toString();
      const adminSystemMessages = allMessagesForQuery.filter((message) => {
        if (!message.userStates || !message.userStates.has(adminId)) {
          return false;
        }
        const userState = message.userStates.get(adminId);
        return userState && !userState.isDeletedFromSystem;
      });

      console.log(`\n   ${admin.firstName} ${admin.lastName} (${admin.role}):`);
      console.log(`     📋 System messages: ${adminSystemMessages.length}`);
      adminSystemMessages.forEach((msg, index) => {
        console.log(`       ${index + 1}. "${msg.title}"`);
      });
    }

    // Test 3: Check bell notifications for admins
    console.log("\n🔔 Test 3: Admin Bell Notifications...");

    for (const admin of adminUsers) {
      const adminId = (admin._id as any).toString();
      const adminBellNotifications = allMessagesForQuery.filter((message) => {
        if (!message.userStates || !message.userStates.has(adminId)) {
          return false;
        }
        const userState = message.userStates.get(adminId);
        return userState && !userState.isRemovedFromBell;
      });

      console.log(`\n   ${admin.firstName} ${admin.lastName} (${admin.role}):`);
      console.log(
        `     🔔 Bell notifications: ${adminBellNotifications.length}`
      );
      adminBellNotifications.forEach((msg, index) => {
        console.log(`       ${index + 1}. "${msg.title}"`);
      });
    }

    // Test 4: Privacy check - ensure Ruth's personal message is not visible to others
    console.log("\n🔒 Test 4: Privacy Check...");

    const ruthPersonalMessages = ruthSystemMessages.filter(
      (msg) =>
        msg.content.includes("Congratulations") ||
        msg.content.includes("Your role has been updated")
    );

    if (ruthPersonalMessages.length > 0) {
      console.log(
        `✅ Ruth has ${ruthPersonalMessages.length} personal message(s)`
      );

      // Check if any admin can see Ruth's personal message
      let privacyBreach = false;
      for (const admin of adminUsers) {
        const adminId = (admin._id as any).toString();
        for (const personalMsg of ruthPersonalMessages) {
          if (personalMsg.userStates && personalMsg.userStates.has(adminId)) {
            console.log(
              `❌ PRIVACY BREACH: ${admin.firstName} ${admin.lastName} can see Ruth's personal message!`
            );
            privacyBreach = true;
          }
        }
      }

      if (!privacyBreach) {
        console.log(
          "✅ Privacy protected: Admins cannot see Ruth's personal messages"
        );
      }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("🎯 ADMIN SYSTEM MESSAGES DIAGNOSIS");
    console.log("=".repeat(60));
    console.log(`📧 Emails Sent: ${result.emailsSent}`);
    console.log(`💬 Messages Created: ${result.messagesCreated}`);
    console.log(`📋 Ruth's System Messages: ${ruthSystemMessages.length}`);

    let adminSystemMessageCount = 0;
    let adminBellNotificationCount = 0;

    for (const admin of adminUsers) {
      const adminId = (admin._id as any).toString();

      const systemMsgs = allMessagesForQuery.filter((message) => {
        if (!message.userStates || !message.userStates.has(adminId))
          return false;
        const userState = message.userStates.get(adminId);
        return userState && !userState.isDeletedFromSystem;
      });

      const bellMsgs = allMessagesForQuery.filter((message) => {
        if (!message.userStates || !message.userStates.has(adminId))
          return false;
        const userState = message.userStates.get(adminId);
        return userState && !userState.isRemovedFromBell;
      });

      adminSystemMessageCount += systemMsgs.length;
      adminBellNotificationCount += bellMsgs.length;

      console.log(
        `👤 ${admin.firstName} ${admin.lastName}: ${systemMsgs.length} system, ${bellMsgs.length} bell`
      );
    }

    if (adminSystemMessageCount === 0) {
      console.log("\n❌ ISSUE: Admins are not receiving system messages!");
    } else {
      console.log("\n✅ SUCCESS: Admins are receiving system messages!");
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

debugAdminSystemMessages().catch(console.error);
