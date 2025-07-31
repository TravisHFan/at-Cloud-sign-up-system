/**
 * Debug admin system messages in detail
 */

const mongoose = require("mongoose");

async function debugAdminMessages() {
  try {
    console.log("🔍 Debugging admin system messages in detail");

    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to MongoDB");

    const userSchema = new mongoose.Schema({}, { strict: false });
    const messageSchema = new mongoose.Schema({}, { strict: false });

    const User = mongoose.model("User", userSchema, "users");
    const Message = mongoose.model("Message", messageSchema, "messages");

    // Get Ruth Fan and John Doe
    const ruthUser = await User.findOne({ email: "freetosento@gmail.com" });
    const johnUser = await User.findOne({ email: "johndoe@gmail.com" });

    console.log("👥 Key users:");
    console.log(
      `Ruth Fan: ${ruthUser?.firstName} ${ruthUser?.lastName} (${ruthUser?.role})`
    );
    console.log(
      `John Doe: ${johnUser?.firstName} ${johnUser?.lastName} (${johnUser?.role})`
    );

    // Get all admin users
    const adminUsers = await User.find({
      role: { $in: ["Administrator", "Super Admin"] },
      isActive: true,
    });

    console.log(`\n👑 Admin users (${adminUsers.length}):`);
    adminUsers.forEach((admin) => {
      console.log(
        `  - ${admin.firstName} ${admin.lastName} (${admin.email}) - ${admin.role} - ID: ${admin._id}`
      );
    });

    // Get recent role change messages
    console.log("\n📱 Recent role change messages:");
    const roleChangeMessages = await Message.find({
      type: "auth_level_change",
    })
      .sort({ createdAt: -1 })
      .limit(3);

    for (const message of roleChangeMessages) {
      console.log(`\n📝 Message: "${message.title}"`);
      console.log(`   ID: ${message._id}`);
      console.log(`   Content: ${message.content}`);
      console.log(`   Created: ${message.createdAt}`);
      console.log(`   Type: ${message.type}`);
      console.log(`   Is Active: ${message.isActive}`);

      // Check the raw userStates structure
      console.log(`   UserStates type: ${typeof message.userStates}`);
      console.log(
        `   UserStates constructor: ${message.userStates?.constructor?.name}`
      );

      if (message.userStates) {
        if (message.userStates instanceof Map) {
          console.log(`   UserStates Map size: ${message.userStates.size}`);
          console.log("   UserStates entries:");
          for (const [userId, state] of message.userStates) {
            const user = await User.findById(userId);
            console.log(
              `     - ${userId} (${user?.firstName} ${
                user?.lastName
              }): ${JSON.stringify(state)}`
            );
          }
        } else {
          console.log(
            `   UserStates raw data: ${JSON.stringify(
              message.userStates,
              null,
              2
            )}`
          );
        }
      } else {
        console.log("   UserStates: null/undefined");
      }
    }

    // Check which admins should have system messages
    console.log("\n🔍 Checking admin system message access:");
    for (const admin of adminUsers) {
      console.log(`\n👤 ${admin.firstName} ${admin.lastName} (${admin._id}):`);

      // Check each role change message for this admin
      for (const message of roleChangeMessages) {
        if (message.title.includes("User Role Change")) {
          console.log(`   Message: "${message.title}"`);
          if (message.userStates && message.userStates instanceof Map) {
            const hasAccess = message.userStates.has(admin._id.toString());
            console.log(`     Has access: ${hasAccess}`);
            if (hasAccess) {
              const state = message.userStates.get(admin._id.toString());
              console.log(`     State: ${JSON.stringify(state)}`);
            }
          } else if (message.userStates) {
            const hasAccess =
              message.userStates[admin._id.toString()] !== undefined;
            console.log(`     Has access: ${hasAccess}`);
            if (hasAccess) {
              const state = message.userStates[admin._id.toString()];
              console.log(`     State: ${JSON.stringify(state)}`);
            }
          } else {
            console.log("     No userStates data");
          }
        }
      }
    }

    // Check Ruth's personal system messages
    if (ruthUser) {
      console.log(`\n👤 Ruth Fan's personal system messages:`);
      for (const message of roleChangeMessages) {
        if (message.title.includes("Your System Access Level")) {
          console.log(`   Message: "${message.title}"`);
          if (message.userStates && message.userStates instanceof Map) {
            const hasAccess = message.userStates.has(ruthUser._id.toString());
            console.log(`     Has access: ${hasAccess}`);
            if (hasAccess) {
              const state = message.userStates.get(ruthUser._id.toString());
              console.log(`     State: ${JSON.stringify(state)}`);
            }
          } else if (message.userStates) {
            const hasAccess =
              message.userStates[ruthUser._id.toString()] !== undefined;
            console.log(`     Has access: ${hasAccess}`);
            if (hasAccess) {
              const state = message.userStates[ruthUser._id.toString()];
              console.log(`     State: ${JSON.stringify(state)}`);
            }
          } else {
            console.log("     No userStates data");
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

debugAdminMessages().catch(console.error);
