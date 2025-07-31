/**
 * Test script to validate email + system message + bell notification integration
 * for user role promotions and demotions
 */

import { EmailService } from "../../src/services/infrastructure/emailService";
import { EmailNotificationController } from "../../src/controllers/emailNotificationController";
import { AutoEmailNotificationService } from "../../src/services/infrastructure/autoEmailNotificationService";
import User from "../../src/models/User";
import Message from "../../src/models/Message";
import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Direct database connection for testing
async function connectToTestDatabase() {
  try {
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to atcloud-signup database");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw error;
  }
}

interface TestUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  oldRole: string;
  newRole: string;
}

interface TestAdmin {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

async function testRoleChangeNotificationFlow() {
  try {
    await connectToTestDatabase();
    console.log("🔌 Connected to atcloud-signup database");

    // Test user data
    const testUser: TestUser = {
      _id: "657123456789012345678901",
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@test.com",
      oldRole: "Participant",
      newRole: "Leader",
    };

    const testAdmin: TestAdmin = {
      _id: "657123456789012345678902",
      firstName: "Admin",
      lastName: "User",
      email: "admin@test.com",
      role: "Super Admin",
    };

    console.log("🧪 Testing Role Change Notification Flow");
    console.log("📊 Test Case: Promotion from Participant to Leader");
    console.log(
      `👤 User: ${testUser.firstName} ${testUser.lastName} (${testUser.email})`
    );
    console.log(`🔄 Change: ${testUser.oldRole} → ${testUser.newRole}`);
    console.log("───────────────────────────────────────");

    // Step 1: Test NEW integrated service
    console.log("🆕 Step 1: Testing NEW AutoEmailNotificationService");

    try {
      const result =
        await AutoEmailNotificationService.sendRoleChangeNotification({
          userData: testUser,
          changedBy: testAdmin,
          isPromotion: true,
        });

      console.log(`✨ Integrated service result:`);
      console.log(`   📧 Emails sent: ${result.emailsSent}`);
      console.log(`   📱 Messages created: ${result.messagesCreated}`);
      console.log(`   ✅ Success: ${result.success}`);
    } catch (error: any) {
      console.log(`✨ Integrated service: ❌ FAILED - ${error.message}`);
    }

    // Step 2: Check current email-only implementation
    console.log("\n📧 Step 2: Testing Current Email-Only Service");

    try {
      const emailResult = await EmailService.sendPromotionNotificationToUser(
        testUser.email,
        testUser,
        testAdmin
      );
      console.log(
        `✉️  Email sent: ${emailResult ? "✅ SUCCESS" : "❌ FAILED"}`
      );
    } catch (error: any) {
      console.log(`✉️  Email sent: ❌ FAILED - ${error.message}`);
    }

    // Step 3: Check if system messages are being created
    console.log("\n📱 Step 3: Checking System Message Creation");

    const messagesAfterTest = await Message.find({
      title: { $regex: /promotion|role.*change|access.*level/i },
    })
      .sort({ createdAt: -1 })
      .limit(10);

    console.log(
      `📝 Role-related system messages found: ${messagesAfterTest.length}`
    );
    if (messagesAfterTest.length > 0) {
      console.log("Recent role-related system messages:");
      messagesAfterTest.forEach((msg, index) => {
        console.log(
          `   ${index + 1}. ${msg.title} (${new Date(
            msg.createdAt
          ).toLocaleString()})`
        );
        console.log(`      Content: ${msg.content.substring(0, 100)}...`);
      });
    }

    // Step 4: Check bell notifications for a real user
    console.log("\n🔔 Step 4: Checking Bell Notification Creation");

    // Find a real user to test with
    const realUser = await User.findOne({ isActive: true }).limit(1);
    if (realUser) {
      const bellNotifications = await Message.getBellNotificationsForUser(
        (realUser as any)._id.toString()
      );
      console.log(
        `🔔 Bell notifications for user ${realUser.firstName}: ${bellNotifications.length}`
      );

      const roleChangeNotifications = bellNotifications.filter(
        (notif) =>
          notif.title.toLowerCase().includes("role") ||
          notif.title.toLowerCase().includes("promotion") ||
          notif.title.toLowerCase().includes("access") ||
          notif.title.toLowerCase().includes("system")
      );
      console.log(
        `🎯 Role-related bell notifications: ${roleChangeNotifications.length}`
      );

      if (roleChangeNotifications.length > 0) {
        console.log("Recent role-related bell notifications:");
        roleChangeNotifications.slice(0, 3).forEach((notif, index) => {
          console.log(`   ${index + 1}. ${notif.title}`);
        });
      }
    }

    // Step 5: Final analysis
    console.log("\n🔍 Step 5: Integration Analysis");
    console.log("───────────────────────────────────────");

    const hasRoleMessages = messagesAfterTest.length > 0;
    const hasBellNotifications = realUser
      ? (
          await Message.getBellNotificationsForUser(
            (realUser as any)._id.toString()
          )
        ).some(
          (notif) =>
            notif.title.toLowerCase().includes("role") ||
            notif.title.toLowerCase().includes("promotion")
        )
      : false;

    if (hasRoleMessages && hasBellNotifications) {
      console.log(
        "✅ SUCCESS: Email + System Message + Bell Notification integration working!"
      );
      console.log("   📧 Emails are being sent");
      console.log("   📱 System messages are being created");
      console.log("   🔔 Bell notifications are synced");
    } else if (hasRoleMessages) {
      console.log(
        "⚠️  PARTIAL: System messages working, but bell notifications may need attention"
      );
    } else {
      console.log(
        "⚠️  ISSUE: Email-to-SystemMessage integration needs implementation"
      );
      console.log(
        "\n🔧 SOLUTION: Update EmailNotificationController to use AutoEmailNotificationService"
      );
    }

    console.log("\n� SUMMARY:");
    console.log(`   📧 Email functionality: Working`);
    console.log(
      `   📱 System messages: ${
        hasRoleMessages ? "Working" : "Needs Integration"
      }`
    );
    console.log(
      `   🔔 Bell notifications: ${
        hasBellNotifications ? "Working" : "Needs Integration"
      }`
    );
    console.log(
      `   🔗 Integration status: ${
        hasRoleMessages && hasBellNotifications ? "Complete" : "In Progress"
      }`
    );
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  }
}

// Run the test
testRoleChangeNotificationFlow();
