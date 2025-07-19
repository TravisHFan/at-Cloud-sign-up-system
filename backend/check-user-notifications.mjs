import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

async function checkUserBellNotifications() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("🔍 Checking User collection for bell notifications...");

    const db = mongoose.connection.db;

    // Get all users and check for bell notifications
    const users = await db.collection("users").find({}).toArray();
    console.log(`\n👥 Found ${users.length} users`);

    let foundBellNotifications = false;

    users.forEach((user, i) => {
      if (user.bellNotifications && user.bellNotifications.length > 0) {
        foundBellNotifications = true;
        console.log(`\n🔔 User ${i + 1}: ${user.firstName} ${user.lastName}`);
        console.log(
          `   Bell notifications count: ${user.bellNotifications.length}`
        );
        user.bellNotifications.forEach((notif, j) => {
          console.log(`   Notification ${j + 1}:`);
          console.log(`     Title: ${notif.title}`);
          console.log(`     Text: ${notif.text}`);
          console.log(`     From: ${notif.from}`);
          console.log(`     Created: ${notif.createdAt}`);
        });
      }
    });

    if (!foundBellNotifications) {
      console.log("\n✅ No bellNotifications found in any User documents");
    }

    // Check for legacy notification fields
    const sampleUser = users[0];
    if (sampleUser) {
      console.log("\n🔍 Sample user fields:");
      const notificationFields = Object.keys(sampleUser).filter(
        (key) =>
          key.toLowerCase().includes("notification") ||
          key.toLowerCase().includes("bell") ||
          key.toLowerCase().includes("message")
      );
      console.log("Notification-related fields:", notificationFields);
    }

    mongoose.connection.close();
  } catch (error) {
    console.error("Error:", error);
  }
}

checkUserBellNotifications();
