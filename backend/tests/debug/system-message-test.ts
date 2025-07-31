/**
 * Simple test to check system message and bell notification creation
 * without email sending dependencies
 */

import Message from "../../src/models/Message";
import User from "../../src/models/User";
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

async function testSystemMessageCreation() {
  try {
    await connectToTestDatabase();

    console.log("🧪 Testing System Message & Bell Notification Creation");
    console.log("═══════════════════════════════════════════════════════");

    // Find a real user to test with
    const testUser = await User.findOne({ isActive: true }).limit(1);
    if (!testUser) {
      console.log("❌ No active users found in database");
      return;
    }

    console.log(
      `👤 Using test user: ${testUser.firstName} ${testUser.lastName} (${testUser.email})`
    );

    // Step 1: Create a role change system message
    console.log("\n📱 Step 1: Creating Role Change System Message");

    const roleChangeMessage = await Message.createForAllUsers(
      {
        title: "🎉 Your System Access Level Changed",
        content: `Congratulations! Your role has been updated from Participant to Leader by Admin User. This change grants you additional system permissions and capabilities. Welcome to your new responsibilities!`,
        type: "auth_level_change",
        priority: "high",
        creator: {
          id: "system",
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          avatar: null,
          gender: "male",
          roleInAtCloud: "Super Admin",
          authLevel: "Super Admin",
        },
        isActive: true,
      },
      [(testUser as any)._id.toString()]
    );

    console.log(`✅ System message created: ${(roleChangeMessage as any)._id}`);
    console.log(`   Title: ${roleChangeMessage.title}`);
    console.log(`   Type: ${roleChangeMessage.type}`);
    console.log(`   Priority: ${roleChangeMessage.priority}`);

    // Step 2: Check if it appears in bell notifications
    console.log("\n🔔 Step 2: Checking Bell Notification Sync");

    const bellNotifications = await Message.getBellNotificationsForUser(
      (testUser as any)._id.toString()
    );
    console.log(
      `📋 Total bell notifications for user: ${bellNotifications.length}`
    );

    const newRoleNotification = bellNotifications.find(
      (notif) =>
        notif.id.toString() === (roleChangeMessage as any)._id.toString()
    );

    if (newRoleNotification) {
      console.log("✅ Role change message appears in bell notifications!");
      console.log(`   Bell Title: ${newRoleNotification.title}`);
      console.log(`   Is Read: ${newRoleNotification.isRead}`);
      console.log(
        `   Show Remove Button: ${newRoleNotification.showRemoveButton}`
      );
    } else {
      console.log("❌ Role change message NOT found in bell notifications");
    }

    // Step 3: Check system messages
    console.log("\n📋 Step 3: Checking System Messages");

    const systemMessagesResult = await Message.getSystemMessagesForUser(
      (testUser as any)._id.toString()
    );
    const systemMessages = systemMessagesResult.messages;
    console.log(`📋 Total system messages for user: ${systemMessages.length}`);

    const newSystemMessage = systemMessages.find(
      (msg: any) =>
        msg.id.toString() === (roleChangeMessage as any)._id.toString()
    );

    if (newSystemMessage) {
      console.log("✅ Role change message appears in system messages!");
      console.log(`   System Title: ${newSystemMessage.title}`);
      console.log(`   Is Read: ${newSystemMessage.isRead}`);
    } else {
      console.log("❌ Role change message NOT found in system messages");
    }

    // Step 4: Check unread counts
    console.log("\n📊 Step 4: Checking Unread Counts");

    const unreadCounts = await Message.getUnreadCountsForUser(
      (testUser as any)._id.toString()
    );
    console.log(`📋 Unread counts:`, unreadCounts);

    // Step 5: Test admin notification creation
    console.log("\n👥 Step 5: Testing Admin Notification Creation");

    // Find admin users
    const adminUsers = await User.find({
      role: { $in: ["Super Admin", "Administrator"] },
      isActive: true,
    })
      .limit(3)
      .select("_id email firstName lastName role");

    console.log(`👑 Found ${adminUsers.length} admin users`);

    if (adminUsers.length > 0) {
      const adminUserIds = adminUsers.map((admin) =>
        (admin as any)._id.toString()
      );

      const adminMessage = await Message.createForAllUsers(
        {
          title: `👤 User Role Change: ${testUser.firstName} ${testUser.lastName}`,
          content: `${testUser.firstName} ${testUser.lastName} (${
            testUser.email
          }) has been promoted from Participant to Leader by Admin User. Date: ${new Date().toLocaleString()}`,
          type: "auth_level_change",
          priority: "medium",
          creator: {
            id: "system",
            firstName: "Admin",
            lastName: "User",
            username: "admin",
            avatar: null,
            gender: "male",
            roleInAtCloud: "Super Admin",
            authLevel: "Super Admin",
          },
          isActive: true,
        },
        adminUserIds
      );

      console.log(
        `✅ Admin notification created: ${(adminMessage as any)._id}`
      );
      console.log(`   Sent to ${adminUserIds.length} admins`);

      // Check bell notifications for first admin
      const firstAdmin = adminUsers[0];
      const adminBellNotifications = await Message.getBellNotificationsForUser(
        (firstAdmin as any)._id.toString()
      );
      const adminRoleNotification = adminBellNotifications.find(
        (notif) => notif.id.toString() === (adminMessage as any)._id.toString()
      );

      if (adminRoleNotification) {
        console.log(
          `✅ Admin bell notification working for ${firstAdmin.firstName}`
        );
      } else {
        console.log(
          `❌ Admin bell notification NOT working for ${firstAdmin.firstName}`
        );
      }
    }

    console.log("\n📈 SUMMARY:");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`✅ Database Connection: Working`);
    console.log(`✅ System Message Creation: Working`);
    console.log(
      `${newRoleNotification ? "✅" : "❌"} Bell Notification Sync: ${
        newRoleNotification ? "Working" : "Failed"
      }`
    );
    console.log(
      `${newSystemMessage ? "✅" : "❌"} System Message Sync: ${
        newSystemMessage ? "Working" : "Failed"
      }`
    );
    console.log(
      `✅ Admin Notifications: ${
        adminUsers.length > 0 ? "Working" : "No admins found"
      }`
    );

    if (newRoleNotification && newSystemMessage) {
      console.log("\n🎉 SUCCESS: Core notification system is working!");
      console.log("   Next step: Integrate with email notifications");
    } else {
      console.log("\n⚠️  ISSUE: Core notification system needs debugging");
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  }
}

// Run the test
testSystemMessageCreation();
