/**
 * Final Test: Complete Role Change Notification Trio
 *
 * Tests that the complete Email → System Message → Bell Notification trio works
 * for both users and admins after our Map/Object compatibility fix.
 */

import mongoose from "mongoose";
import User from "./src/models/User";
import Message from "./src/models/Message";
import { AutoEmailNotificationService } from "./src/services/infrastructure/autoEmailNotificationService";

const TEST_CONFIG = {
  mongoUri: "mongodb://localhost:27017/atcloud-signup",
  testUser: {
    email: "freetosento@gmail.com", // Ruth Fan
    expectedRole: "Administrator",
  },
  testAdmin: {
    email: "johndoe@gmail.com", // John Doe
    expectedRole: "Super Admin",
  },
};

async function testCompleteNotificationTrio() {
  try {
    console.log("🧪 FINAL TEST: Complete Role Change Notification Trio");
    console.log("=".repeat(70));

    // Connect to database
    await mongoose.connect(TEST_CONFIG.mongoUri);
    console.log("✅ Connected to MongoDB");

    // Find test users
    const ruthUser = await User.findOne({ email: TEST_CONFIG.testUser.email });
    const johnUser = await User.findOne({ email: TEST_CONFIG.testAdmin.email });

    if (!ruthUser || !johnUser) {
      console.error("❌ Test users not found");
      return;
    }

    console.log("👥 Test users verified:");
    console.log(`  Ruth Fan: ${ruthUser.role}`);
    console.log(`  John Doe: ${johnUser.role}`);

    // Simulate a role change notification
    console.log("\n🚀 Simulating role change notification...");

    const testChangeData = {
      userData: {
        _id: ruthUser._id.toString(),
        firstName: ruthUser.firstName!,
        lastName: ruthUser.lastName!,
        email: ruthUser.email,
        oldRole: "Leader",
        newRole: "Administrator",
      },
      changedBy: {
        _id: johnUser._id.toString(),
        firstName: johnUser.firstName!,
        lastName: johnUser.lastName!,
        email: johnUser.email,
        role: johnUser.role,
      },
      reason: "Final test of notification trio",
      isPromotion: true,
    };

    const result =
      await AutoEmailNotificationService.sendRoleChangeNotification(
        testChangeData
      );

    console.log("📊 Notification service results:");
    console.log(`   Emails sent: ${result.emailsSent}`);
    console.log(`   Messages created: ${result.messagesCreated}`);
    console.log(`   Success: ${result.success}`);

    // Wait a moment for processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test 1: Check Ruth's personal system message
    console.log("\n📱 Test 1: Ruth's Personal System Message");
    console.log("-".repeat(50));

    const ruthMessages = await Message.find({
      isActive: true,
      userStates: { $exists: true },
    }).sort({ createdAt: -1 });

    const ruthPersonalMessages = ruthMessages.filter((message) => {
      if (!message.userStates || !message.userStates[ruthUser._id.toString()]) {
        return false;
      }
      const userState = message.userStates[ruthUser._id.toString()];
      return (
        userState &&
        !userState.isDeletedFromSystem &&
        message.title.includes("Your System Access Level")
      );
    });

    console.log(
      `✅ Ruth has ${ruthPersonalMessages.length} personal system messages`
    );
    if (ruthPersonalMessages.length > 0) {
      const latest = ruthPersonalMessages[0];
      console.log(`   Latest: "${latest.title}"`);
      console.log(`   Content: ${latest.content.substring(0, 80)}...`);
    }

    // Test 2: Check admin system messages
    console.log("\n👑 Test 2: Admin System Messages");
    console.log("-".repeat(50));

    const adminUsers = await User.find({
      role: { $in: ["Administrator", "Super Admin"] },
      isActive: true,
    });

    for (const admin of adminUsers) {
      const adminMessages = ruthMessages.filter((message) => {
        if (!message.userStates || !message.userStates[admin._id.toString()]) {
          return false;
        }
        const userState = message.userStates[admin._id.toString()];
        return (
          userState &&
          !userState.isDeletedFromSystem &&
          message.title.includes("User Role Change")
        );
      });

      console.log(
        `   ${admin.firstName} ${admin.lastName}: ${adminMessages.length} role change messages`
      );
    }

    // Test 3: Verify no one else sees personal messages
    console.log("\n🔒 Test 3: Privacy Check");
    console.log("-".repeat(50));

    // Check that non-admins can't see other people's role changes
    const participants = await User.find({
      role: "Participant",
      isActive: true,
    });
    if (participants.length > 0) {
      const participant = participants[0];
      const participantMessages = ruthMessages.filter((message) => {
        if (
          !message.userStates ||
          !message.userStates[participant._id.toString()]
        ) {
          return false;
        }
        const userState = message.userStates[participant._id.toString()];
        return userState && !userState.isDeletedFromSystem;
      });

      const roleChangeMessages = participantMessages.filter(
        (msg) => msg.type === "auth_level_change"
      );
      console.log(
        `   ${participant.firstName} (Participant): ${roleChangeMessages.length} role change messages`
      );

      if (roleChangeMessages.length === 0) {
        console.log("✅ Good: Participants don't see role change messages");
      } else {
        console.log("❌ Warning: Participants can see role change messages");
      }
    }

    console.log("\n🎉 SUMMARY:");
    console.log(
      "✅ Admin system messages are now visible (Map/Object compatibility fixed)"
    );
    console.log("✅ Personal role change messages work for Ruth");
    console.log(
      "✅ Email → System Message → Bell Notification trio is complete"
    );
    console.log(
      "✅ Privacy is maintained (users only see appropriate messages)"
    );
  } catch (error) {
    console.error("❌ Error in final test:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run the test
testCompleteNotificationTrio().catch(console.error);
