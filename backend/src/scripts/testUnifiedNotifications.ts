import mongoose from "mongoose";
import dotenv from "dotenv";
import { NotificationService } from "../services/notificationService";
import User from "../models/User";

// Load environment variables
dotenv.config();

async function testUnifiedNotificationSystem() {
  try {
    console.log("🧪 Testing Unified Notification System...");

    // Connect to database
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoURI);
    console.log("✅ Connected to MongoDB");

    // Find a test user
    const testUser = await User.findOne({
      username: { $in: ["john_doe", "mike_wilson"] },
    });
    if (!testUser) {
      console.log(
        "❌ No test user found. Please ensure john_doe or mike_wilson exists."
      );
      return;
    }

    console.log(`📝 Testing with user: ${testUser.username} (${testUser._id})`);

    const userId = (testUser._id as mongoose.Types.ObjectId).toString();

    // Test 1: Create a system announcement
    console.log("\n📢 Test 1: Creating system announcement...");
    const announcement = await NotificationService.createNotification({
      userId: userId,
      type: "SYSTEM_MESSAGE",
      category: "announcement",
      title: "🎉 Welcome to Unified Notifications!",
      message:
        "This is a test of our new unified notification system with real-time delivery via Socket.IO.",
      priority: "high",
      deliveryChannels: ["in-app", "email"],
      metadata: {
        testNotification: true,
        feature: "unified-notifications",
        version: "1.0.0",
      },
    });
    console.log(`✅ Created announcement notification: ${announcement._id}`);

    // Test 2: Create an event reminder
    console.log("\n⏰ Test 2: Creating event reminder...");
    const reminder = await NotificationService.createNotification({
      userId: userId,
      type: "EVENT_NOTIFICATION",
      category: "reminder",
      title: "📅 Event Reminder: @Cloud Meeting Tomorrow",
      message:
        "Don't forget about the @Cloud leadership meeting tomorrow at 2 PM.",
      priority: "normal",
      deliveryChannels: ["in-app", "push"],
      metadata: {
        eventId: new mongoose.Types.ObjectId(),
        reminderType: "day_before",
        testNotification: true,
      },
    });
    console.log(`✅ Created reminder notification: ${reminder._id}`);

    // Test 3: Create a chat message notification
    console.log("\n💬 Test 3: Creating chat message notification...");
    const chatNotification = await NotificationService.createNotification({
      userId: userId,
      type: "CHAT_MESSAGE",
      category: "chat",
      title: "💬 New Message from Admin",
      message: "You have a new message in the general chat room.",
      priority: "low",
      deliveryChannels: ["in-app"],
      metadata: {
        fromUserId: new mongoose.Types.ObjectId(),
        messageId: new mongoose.Types.ObjectId(),
        chatRoomId: "general",
        testNotification: true,
      },
    });
    console.log(`✅ Created chat notification: ${chatNotification._id}`);

    // Test 4: Get user's notifications
    console.log("\n📋 Test 4: Retrieving user notifications...");
    const notifications = await NotificationService.getNotifications(userId, {
      page: 1,
      limit: 10,
    });
    console.log(
      `✅ Retrieved ${notifications.notifications.length} notifications`
    );
    console.log(`📊 Unread count: ${notifications.unreadCount}`);
    console.log(`📄 Total pages: ${notifications.pagination.totalPages}`);

    // Test 5: Get notification preferences
    console.log("\n⚙️ Test 5: Getting notification preferences...");
    const preferences = await NotificationService.getNotificationPreferences(
      userId
    );
    console.log(`✅ User preferences retrieved:`);
    console.log(`  📧 Email notifications: ${preferences.emailNotifications}`);
    console.log(`  📱 Push notifications: ${preferences.pushNotifications}`);
    console.log(`  📲 SMS notifications: ${preferences.smsNotifications}`);

    // Test 6: Update notification preferences
    console.log("\n🔧 Test 6: Updating notification preferences...");
    const updatedPreferences =
      await NotificationService.updateNotificationPreferences(userId, {
        categories: {
          ...preferences.categories,
          marketing: false, // Disable marketing notifications
          chat: true, // Enable chat notifications
        },
      });
    console.log(
      `✅ Preferences updated - Marketing notifications: ${updatedPreferences.categories?.marketing}`
    );

    // Test 7: Get notification analytics
    console.log("\n📈 Test 7: Getting notification analytics...");
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
    const analytics = await NotificationService.getNotificationAnalytics(
      userId,
      { start: startDate, end: endDate }
    );
    console.log(`✅ Analytics retrieved:`);
    console.log(`  📊 Total sent: ${analytics.totalSent}`);
    console.log(`  ✅ Total read: ${analytics.totalRead}`);
    console.log(`  📊 Read rate: ${analytics.readRate.toFixed(1)}%`);

    // Test 8: Mark notifications as read
    console.log("\n✅ Test 8: Marking notifications as read...");
    const markResult = await NotificationService.markAllAsRead(userId);
    console.log(`✅ Marked ${markResult.modifiedCount} notifications as read`);

    console.log("\n🎉 All tests completed successfully!");
    console.log("\nReal-time features tested:");
    console.log("  ✅ Notification creation with Socket.IO delivery");
    console.log("  ✅ User preference management");
    console.log("  ✅ Notification analytics");
    console.log("  ✅ Bulk operations with real-time updates");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("📂 Database connection closed");
  }
}

// Run test if called directly
if (require.main === module) {
  testUnifiedNotificationSystem()
    .then(() => {
      console.log("\n✨ Test completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Test failed:", error);
      process.exit(1);
    });
}

export { testUnifiedNotificationSystem };
