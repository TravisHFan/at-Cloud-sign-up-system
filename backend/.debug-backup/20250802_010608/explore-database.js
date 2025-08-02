/**
 * Check Database Collections and Models
 * This script explores the database to understand the data structure
 */

const mongoose = require("mongoose");

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/atCloudSignUp");

async function exploreDatabaseCollections() {
  try {
    console.log("🔍 EXPLORING DATABASE");
    console.log("====================");

    // Get all collection names
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    console.log(`\n📊 Found ${collections.length} collections:`);
    collections.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.name}`);
    });

    // Check users collection specifically
    if (collections.some((col) => col.name === "users")) {
      console.log("\n👥 Checking 'users' collection...");
      const userCount = await mongoose.connection.db
        .collection("users")
        .countDocuments();
      console.log(`   Documents: ${userCount}`);

      if (userCount > 0) {
        const sampleUsers = await mongoose.connection.db
          .collection("users")
          .find({})
          .limit(5)
          .toArray();
        console.log(`\n📋 Sample users:`);
        sampleUsers.forEach((user, index) => {
          console.log(
            `   ${index + 1}. ${user.firstName || "N/A"} ${
              user.lastName || "N/A"
            }`
          );
          console.log(`      ID: ${user._id}`);
          console.log(`      Email: ${user.email || "N/A"}`);
          console.log(`      Role: ${user.role || "N/A"}`);
          console.log(`      AuthLevel: ${user.authLevel || "N/A"}`);
        });
      }
    }

    // Check messages collection
    if (collections.some((col) => col.name === "messages")) {
      console.log("\n💬 Checking 'messages' collection...");
      const messageCount = await mongoose.connection.db
        .collection("messages")
        .countDocuments();
      console.log(`   Documents: ${messageCount}`);

      if (messageCount > 0) {
        const authMessages = await mongoose.connection.db
          .collection("messages")
          .find({
            type: "auth_level_change",
          })
          .limit(3)
          .toArray();
        console.log(`\n📋 Auth level change messages: ${authMessages.length}`);

        if (authMessages.length > 0) {
          console.log("Recent auth_level_change message:");
          const msg = authMessages[0];
          console.log(`   Title: ${msg.title}`);
          console.log(`   Creator ID: ${msg.creator}`);
          console.log(
            `   User States: ${
              msg.userStates ? Object.keys(msg.userStates).length : 0
            } users`
          );
        }
      }
    }

    // Check for Travis Fan specifically by looking at populated messages
    console.log("\n🔍 Looking for Travis Fan in message creators...");
    if (collections.some((col) => col.name === "messages")) {
      const messagesWithTravis = await mongoose.connection.db
        .collection("messages")
        .find({
          "creator.firstName": "Travis",
          "creator.lastName": "Fan",
        })
        .limit(1)
        .toArray();

      if (messagesWithTravis.length > 0) {
        console.log("✅ Found Travis Fan in message creator:");
        const travis = messagesWithTravis[0].creator;
        console.log(`   Name: ${travis.firstName} ${travis.lastName}`);
        console.log(`   Email: ${travis.email}`);
        console.log(`   Auth Level: ${travis.authLevel}`);
        console.log(`   Role: ${travis.role}`);
        console.log(`   ID: ${travis._id}`);
      } else {
        console.log("❌ Travis Fan not found in message creators");
      }
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run the exploration
exploreDatabaseCollections();
