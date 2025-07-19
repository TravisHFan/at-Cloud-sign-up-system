import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

async function traceNotificationCreation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("🔍 Connected to database");

    const db = mongoose.connection.db;

    console.log("\n=== COMPREHENSIVE NOTIFICATION TRACE ===");

    // 1. Check Message collection
    console.log("\n📝 Messages Collection:");
    const messages = await db.collection("messages").find({}).toArray();
    console.log(`Total messages: ${messages.length}`);
    messages.forEach((msg, i) => {
      console.log(`Message ${i + 1}: "${msg.title}" (Type: ${msg.type})`);
      console.log(
        `  UserStates: ${Object.keys(msg.userStates || {}).length} users`
      );

      // Check userStates for notification data
      if (msg.userStates) {
        Object.keys(msg.userStates).forEach((userId) => {
          const state = msg.userStates[userId];
          console.log(
            `    User ${userId}: Bell=${!state.isReadInBell}, System=${!state.isReadInSystem}`
          );
        });
      }
    });

    // 2. Check if there are any other notification collections
    console.log("\n📊 All Collections:");
    const collections = await db.listCollections().toArray();
    const notificationCollections = collections.filter(
      (c) =>
        c.name.toLowerCase().includes("notif") ||
        c.name.toLowerCase().includes("bell") ||
        c.name.toLowerCase().includes("system") ||
        c.name.toLowerCase().includes("message")
    );

    for (const collection of notificationCollections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`${collection.name}: ${count} documents`);

      if (count > 0 && count < 20) {
        const docs = await db.collection(collection.name).find({}).toArray();
        docs.forEach((doc, i) => {
          console.log(
            `  Doc ${i + 1}:`,
            JSON.stringify(doc, null, 2).substring(0, 200) + "..."
          );
        });
      }
    }

    // 3. Simulate the notification retrieval process
    console.log("\n🔔 Simulating Bell Notification Retrieval:");

    // Get a test user
    const testUser = await db
      .collection("users")
      .findOne({ firstName: "Test" });
    if (testUser) {
      console.log(
        `Testing with user: ${testUser.firstName} ${testUser.lastName} (ID: ${testUser._id})`
      );

      // This simulates the getBellNotifications query from UnifiedMessageController
      const bellNotifications = await db
        .collection("messages")
        .find({
          isActive: true,
          [`userStates.${testUser._id}.isDeletedFromBell`]: { $ne: true },
          [`userStates.${testUser._id}.isReadInBell`]: { $ne: true },
        })
        .sort({ createdAt: -1 })
        .toArray();

      console.log(
        `Found ${bellNotifications.length} unread bell notifications:`
      );
      bellNotifications.forEach((notif, i) => {
        const userState = notif.userStates?.[testUser._id] || {};
        console.log(`  ${i + 1}. "${notif.title}"`);
        console.log(`     Content: ${notif.content}`);
        console.log(
          `     Creator: ${notif.creator?.firstName} ${notif.creator?.lastName}`
        );
        console.log(`     AuthLevel: ${notif.creator?.authLevel}`);
        console.log(`     IsReadInBell: ${userState.isReadInBell}`);
        console.log(`     IsDeletedFromBell: ${userState.isDeletedFromBell}`);
      });
    }

    mongoose.connection.close();
  } catch (error) {
    console.error("Error:", error);
    mongoose.connection.close();
  }
}

traceNotificationCreation();
