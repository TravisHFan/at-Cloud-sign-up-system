/**
 * Quick debug script to check admin system messages
 */

const mongoose = require("mongoose");

// Use a simpler approach to test the issue
async function quickDebug() {
  try {
    console.log("🔍 Quick debug of admin system messages");

    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/atcloud_dev");
    console.log("✅ Connected to MongoDB");

    // Define schemas inline for quick testing
    const messageSchema = new mongoose.Schema({}, { strict: false });
    const userSchema = new mongoose.Schema({}, { strict: false });

    const Message = mongoose.model("Message", messageSchema, "messages");
    const User = mongoose.model("User", userSchema, "users");

    // Find test users
    const ruthUser = await User.findOne({ email: "ruth.fan@example.com" });
    const johnUser = await User.findOne({ email: "john.doe@example.com" });

    console.log("👥 Users found:");
    console.log(
      "Ruth:",
      ruthUser
        ? `${ruthUser.firstName} ${ruthUser.lastName} (${ruthUser.role})`
        : "Not found"
    );
    console.log(
      "John:",
      johnUser
        ? `${johnUser.firstName} ${johnUser.lastName} (${johnUser.role})`
        : "Not found"
    );

    // Find recent role change messages
    console.log("\n📱 Recent role change messages:");
    const roleChangeMessages = await Message.find({
      type: "auth_level_change",
    })
      .sort({ createdAt: -1 })
      .limit(5);

    console.log(`Found ${roleChangeMessages.length} role change messages:`);

    for (const message of roleChangeMessages) {
      console.log(`\n📝 Message ID: ${message._id}`);
      console.log(`   Title: ${message.title}`);
      console.log(`   Content: ${message.content.substring(0, 100)}...`);
      console.log(`   Created: ${message.createdAt}`);
      console.log(
        `   User states: ${
          message.userStates
            ? "Map with " + message.userStates.size + " entries"
            : "None"
        }`
      );

      if (message.userStates) {
        console.log("   Recipients:");
        for (const [userId, state] of message.userStates) {
          const user = await User.findById(userId);
          if (user) {
            console.log(
              `     - ${user.firstName} ${user.lastName} (${user.role}) - Deleted: ${state.isDeletedFromSystem}`
            );
          }
        }
      }
    }

    // Check admin users
    console.log("\n👑 Admin users in system:");
    const adminUsers = await User.find({
      role: { $in: ["Administrator", "Super Admin"] },
      isActive: true,
    });

    console.log(`Found ${adminUsers.length} admin users:`);
    adminUsers.forEach((admin) => {
      console.log(
        `  - ${admin.firstName} ${admin.lastName} (${admin.email}) - ${admin.role}`
      );
    });

    // Check system messages for each admin
    console.log("\n🔍 Checking system messages for admins...");
    for (const admin of adminUsers) {
      console.log(`\n👤 Messages for ${admin.firstName} ${admin.lastName}:`);

      // Get all messages where this admin is in userStates
      const adminMessages = await Message.find({
        isActive: true,
        [`userStates.${admin._id}`]: { $exists: true },
      })
        .sort({ createdAt: -1 })
        .limit(10);

      console.log(`   Total messages in userStates: ${adminMessages.length}`);

      const roleChangeMessages = adminMessages.filter(
        (msg) => msg.type === "auth_level_change"
      );
      console.log(`   Role change messages: ${roleChangeMessages.length}`);

      if (roleChangeMessages.length > 0) {
        roleChangeMessages.forEach((msg) => {
          const userState = msg.userStates.get(admin._id.toString());
          console.log(
            `     - "${msg.title}" - Deleted: ${
              userState?.isDeletedFromSystem || false
            }`
          );
        });
      }
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

quickDebug().catch(console.error);
