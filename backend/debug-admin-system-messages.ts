/**
 * Debug Admin System Messages for Role Changes
 *
 * This test verifies why admins receive emails and bell notifications
 * but not system messages for role changes.
 */

import mongoose from "mongoose";
import User from "./src/models/User";
import Message from "./src/models/Message";
import { AutoEmailNotificationService } from "./src/services/infrastructure/autoEmailNotificationService";
import { EmailRecipientUtils } from "./src/utils/emailRecipientUtils";

// Test configuration
const TEST_CONFIG = {
  mongoUri: "mongodb://localhost:27017/atcloud_dev",
  users: {
    ruth: {
      email: "ruth.fan@example.com",
      firstName: "Ruth",
      lastName: "Fan",
    },
    john: {
      email: "john.doe@example.com",
      firstName: "John",
      lastName: "Doe",
    },
  },
};

async function debugAdminSystemMessages() {
  try {
    console.log("🔍 DEBUGGING ADMIN SYSTEM MESSAGES FOR ROLE CHANGES");
    console.log("=".repeat(60));

    // Connect to database
    await mongoose.connect(TEST_CONFIG.mongoUri);
    console.log("✅ Connected to MongoDB");

    // Step 1: Find users
    const ruthUser = await User.findOne({
      email: TEST_CONFIG.users.ruth.email,
    });
    const johnUser = await User.findOne({
      email: TEST_CONFIG.users.john.email,
    });

    if (!ruthUser || !johnUser) {
      console.error("❌ Test users not found");
      console.log("Ruth user:", ruthUser ? "Found" : "Not found");
      console.log("John user:", johnUser ? "Found" : "Not found");
      return;
    }

    console.log("👥 Test users found:");
    console.log(
      `  Ruth: ${ruthUser.firstName} ${ruthUser.lastName} (${ruthUser.role})`
    );
    console.log(
      `  John: ${johnUser.firstName} ${johnUser.lastName} (${johnUser.role})`
    );

    // Step 2: Check admin recipients
    console.log("\n📧 Checking admin recipients...");
    const adminRecipients = await EmailRecipientUtils.getAdminUsers();
    console.log(`Found ${adminRecipients.length} admin recipients:`);
    adminRecipients.forEach((admin) => {
      console.log(`  - ${admin.firstName} ${admin.lastName} (${admin.email})`);
    });

    // Step 3: Find admin users in database
    const adminEmails = adminRecipients.map((admin) => admin.email);
    const adminUsers = await User.find({
      email: { $in: adminEmails },
      isActive: true,
    }).select("_id email firstName lastName role");

    console.log(`\n🔍 Admin users in database: ${adminUsers.length}`);
    adminUsers.forEach((admin) => {
      console.log(
        `  - ${admin.firstName} ${admin.lastName} (${admin.email}) - ID: ${admin._id}`
      );
    });

    // Step 4: Check existing system messages for role changes
    console.log("\n📱 Checking existing role change system messages...");
    const roleChangeMessages = await Message.find({
      type: "auth_level_change",
      title: { $regex: "User Role Change" },
    })
      .sort({ createdAt: -1 })
      .limit(5);

    console.log(
      `Found ${roleChangeMessages.length} recent role change messages:`
    );
    for (const message of roleChangeMessages) {
      console.log(`\n📝 Message: ${message.title}`);
      console.log(`   Content: ${message.content.substring(0, 100)}...`);
      console.log(`   Created: ${message.createdAt}`);
      console.log(`   User states count: ${message.userStates?.size || 0}`);

      // Check which users have this message
      if (message.userStates) {
        console.log("   Recipients:");
        for (const [userId, state] of message.userStates) {
          const user = await User.findById(userId).select(
            "firstName lastName email role"
          );
          if (user) {
            console.log(
              `     - ${user.firstName} ${user.lastName} (${user.role}) - Deleted: ${state.isDeletedFromSystem}`
            );
          }
        }
      }
    }

    // Step 5: Simulate role change and check message creation
    console.log("\n🧪 Testing message creation for role change...");

    const testChangeData = {
      userData: {
        _id: ruthUser._id.toString(),
        firstName: ruthUser.firstName,
        lastName: ruthUser.lastName,
        email: ruthUser.email,
        oldRole: "Leader",
        newRole: "Administrator",
      },
      changedBy: {
        _id: johnUser._id.toString(),
        firstName: johnUser.firstName,
        lastName: johnUser.lastName,
        email: johnUser.email,
        role: johnUser.role,
      },
      reason: "Testing admin system message creation",
      isPromotion: true,
    };

    console.log("📊 Test data prepared:");
    console.log(
      `   User: ${testChangeData.userData.firstName} ${testChangeData.userData.lastName}`
    );
    console.log(
      `   Role change: ${testChangeData.userData.oldRole} → ${testChangeData.userData.newRole}`
    );
    console.log(
      `   Changed by: ${testChangeData.changedBy.firstName} ${testChangeData.changedBy.lastName}`
    );

    // Test the notification service directly
    console.log("\n🚀 Triggering AutoEmailNotificationService...");
    const result =
      await AutoEmailNotificationService.sendRoleChangeNotification(
        testChangeData
      );

    console.log("📊 Notification service results:");
    console.log(`   Emails sent: ${result.emailsSent}`);
    console.log(`   Messages created: ${result.messagesCreated}`);
    console.log(`   Success: ${result.success}`);

    // Step 6: Check system messages after creation
    console.log("\n🔍 Checking system messages after notification...");

    // Check messages for each admin
    for (const adminUser of adminUsers) {
      console.log(
        `\n👤 System messages for ${adminUser.firstName} ${adminUser.lastName}:`
      );

      const userMessages = await Message.find({
        isActive: true,
        userStates: { $exists: true },
      }).sort({ createdAt: -1 });

      const adminMessages = userMessages.filter((message) => {
        if (
          !message.userStates ||
          !message.userStates.has(adminUser._id.toString())
        ) {
          return false;
        }
        const userState = message.userStates.get(adminUser._id.toString());
        return userState && !userState.isDeletedFromSystem;
      });

      console.log(`   Total system messages: ${adminMessages.length}`);

      const roleChangeMessages = adminMessages.filter(
        (msg) => msg.type === "auth_level_change"
      );
      console.log(`   Role change messages: ${roleChangeMessages.length}`);

      if (roleChangeMessages.length > 0) {
        const latest = roleChangeMessages[0];
        console.log(`   Latest: "${latest.title}" - ${latest.createdAt}`);
      }
    }

    // Step 7: Check Ruth's personal system message
    console.log(`\n👤 System messages for Ruth Fan:`);
    const ruthMessages = await Message.find({
      isActive: true,
      userStates: { $exists: true },
    }).sort({ createdAt: -1 });

    const ruthPersonalMessages = ruthMessages.filter((message) => {
      if (
        !message.userStates ||
        !message.userStates.has(ruthUser._id.toString())
      ) {
        return false;
      }
      const userState = message.userStates.get(ruthUser._id.toString());
      return userState && !userState.isDeletedFromSystem;
    });

    console.log(`   Total system messages: ${ruthPersonalMessages.length}`);

    const ruthRoleChangeMessages = ruthPersonalMessages.filter(
      (msg) =>
        msg.type === "auth_level_change" &&
        msg.title.includes("Your System Access Level")
    );
    console.log(
      `   Personal role change messages: ${ruthRoleChangeMessages.length}`
    );
  } catch (error) {
    console.error("❌ Error in debug script:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run the debug script
debugAdminSystemMessages().catch(console.error);
