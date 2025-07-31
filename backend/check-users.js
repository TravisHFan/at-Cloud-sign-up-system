/**
 * Check all users in system
 */

const mongoose = require("mongoose");

async function checkUsers() {
  try {
    console.log("🔍 Checking all users in system");

    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to MongoDB");

    const userSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.model("User", userSchema, "users");

    const allUsers = await User.find({}).select(
      "firstName lastName email role isActive"
    );

    console.log(`\n👥 Found ${allUsers.length} users in system:`);
    allUsers.forEach((user, index) => {
      console.log(
        `${index + 1}. ${user.firstName} ${user.lastName} (${user.email}) - ${
          user.role
        } - Active: ${user.isActive}`
      );
    });

    // Check for recent messages
    const messageSchema = new mongoose.Schema({}, { strict: false });
    const Message = mongoose.model("Message", messageSchema, "messages");

    const recentMessages = await Message.find({})
      .sort({ createdAt: -1 })
      .limit(5);
    console.log(`\n📱 Found ${recentMessages.length} recent messages:`);
    recentMessages.forEach((msg, index) => {
      console.log(
        `${index + 1}. "${msg.title}" - ${msg.type} - ${msg.createdAt}`
      );
      if (msg.userStates) {
        console.log(`   User states: ${msg.userStates.size} entries`);
      }
    });
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

checkUsers().catch(console.error);
