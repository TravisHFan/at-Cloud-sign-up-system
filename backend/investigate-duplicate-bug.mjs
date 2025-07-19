import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

async function investigateDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("🔍 Connected to database");

    const db = mongoose.connection.db;

    // Check all collections
    const collections = await db.listCollections().toArray();
    console.log(
      "📋 Available collections:",
      collections.map((c) => c.name)
    );

    // Check Message collection (unified system)
    const messages = await db.collection("messages").find({}).toArray();
    console.log("\n📝 Messages collection:");
    console.log("Count:", messages.length);
    messages.forEach((msg, i) => {
      console.log(`Message ${i + 1}:`);
      console.log("  Title:", msg.title);
      console.log("  Type:", msg.type);
      console.log("  UserStates count:", msg.userStates?.length || 0);
    });

    // Check User collection for bell notifications
    const users = await db.collection("users").find({}).toArray();
    console.log("\n👥 Users with bell notifications:");
    users.forEach((user) => {
      if (user.bellNotifications && user.bellNotifications.length > 0) {
        console.log(`User: ${user.firstName} ${user.lastName}`);
        console.log(
          "  Bell notifications count:",
          user.bellNotifications.length
        );
        user.bellNotifications.forEach((notif, i) => {
          console.log(`  Notification ${i + 1}:`);
          console.log("    Title:", notif.title);
          console.log("    Text:", notif.text);
          console.log("    From:", notif.from);
        });
      }
    });

    // Check for any other notification collections
    for (const collection of collections) {
      if (
        collection.name.toLowerCase().includes("notif") ||
        collection.name.toLowerCase().includes("message") ||
        collection.name.toLowerCase().includes("bell")
      ) {
        const count = await db.collection(collection.name).countDocuments();
        console.log(`\n📊 Collection "${collection.name}": ${count} documents`);
      }
    }

    mongoose.connection.close();
  } catch (error) {
    console.error("Error:", error);
  }
}

investigateDatabase();
