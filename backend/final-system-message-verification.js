#!/usr/bin/env node

/**
 * Final Verification: Test System Message API Logic Directly
 */

const mongoose = require("mongoose");
require("dotenv").config();

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

const testSystemMessageAPI = async () => {
  try {
    console.log("\n🔍 TESTING SYSTEM MESSAGE API LOGIC DIRECTLY");
    console.log("============================================\n");

    // Import models
    const User = require("./dist/models/User").default;
    const { Message } = require("./dist/models/Message");

    // Get Travis Fan (Super Admin) - he's the one who would be checking his system messages
    const travisFan = await User.findOne({ email: "travisfanht@gmail.com" });

    if (!travisFan) {
      console.log("❌ Travis Fan not found");
      return;
    }

    console.log(
      `👤 Testing for: ${travisFan.firstName} ${travisFan.lastName} (${travisFan.role})`
    );
    console.log(`   User ID: ${travisFan._id}`);

    // This exactly replicates the logic used by /api/v1/notifications/system endpoint
    console.log("\n🔧 REPLICATING SYSTEM MESSAGE API LOGIC:");
    console.log("======================================");

    const userId = travisFan._id.toString();

    // Step 1: Find all messages for this user
    const allMessages = await Message.find({
      [`userStates.${userId}`]: { $exists: true },
    });

    console.log(`📊 Total messages found: ${allMessages.length}`);

    // Step 2: Filter out deleted system messages (this is the key filtering logic)
    const visibleMessages = allMessages.filter((message) => {
      const userState = message.userStates.get(userId);
      return userState && !userState.isDeletedFromSystem;
    });

    console.log(
      `📊 Visible messages after filtering: ${visibleMessages.length}`
    );

    // Step 3: Sort by creation date (newest first)
    const sortedMessages = visibleMessages.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    console.log("\n📱 SYSTEM MESSAGES THAT WOULD APPEAR ON FRONTEND:");
    console.log("================================================");

    sortedMessages.slice(0, 10).forEach((message, index) => {
      const userState = message.userStates.get(userId);
      console.log(`${index + 1}. "${message.title}"`);
      console.log(`   Type: ${message.type}`);
      console.log(`   Priority: ${message.priority}`);
      console.log(`   Created: ${message.createdAt}`);
      console.log(`   Read: ${userState?.isReadInSystem ? "✅" : "❌"}`);
      console.log(
        `   Content Preview: ${message.content.substring(0, 100)}...`
      );
      console.log("");
    });

    // Step 4: Check specifically for auth_level_change messages
    const authMessages = sortedMessages.filter(
      (msg) => msg.type === "auth_level_change"
    );
    console.log(
      `🎯 ADMIN ROLE CHANGE MESSAGES VISIBLE: ${authMessages.length}`
    );
    console.log("===================================");

    authMessages.forEach((message, index) => {
      console.log(
        `${index + 1}. "${message.title}" - Created: ${message.createdAt}`
      );
    });

    // Step 5: Check for the most recent role change message specifically
    const mostRecentRoleChange = await Message.findOne({
      type: "auth_level_change",
    }).sort({ createdAt: -1 });

    console.log("\n🔎 MOST RECENT ROLE CHANGE MESSAGE STATUS:");
    console.log("==========================================");

    if (mostRecentRoleChange) {
      const userState = mostRecentRoleChange.userStates.get(userId);
      console.log(`📨 Message: "${mostRecentRoleChange.title}"`);
      console.log(`🆔 Message ID: ${mostRecentRoleChange._id}`);
      console.log(`📅 Created: ${mostRecentRoleChange.createdAt}`);
      console.log(`👤 User has access: ${userState ? "✅ YES" : "❌ NO"}`);

      if (userState) {
        console.log(
          `🗑️ Deleted from system: ${
            userState.isDeletedFromSystem
              ? "❌ YES (HIDDEN)"
              : "✅ NO (VISIBLE)"
          }`
        );
        console.log(
          `👁️ Read in system: ${userState.isReadInSystem ? "✅ YES" : "❌ NO"}`
        );
        console.log(
          `🔔 Bell notification read: ${
            userState.isReadInBell ? "✅ YES" : "❌ NO"
          }`
        );
      }
    }

    // Final conclusion
    console.log("\n🎯 FINAL ASSESSMENT:");
    console.log("====================");

    const hasRecentRoleChangeMessage = authMessages.length > 0;
    const recentMessageVisible =
      mostRecentRoleChange &&
      mostRecentRoleChange.userStates.has(userId) &&
      !mostRecentRoleChange.userStates.get(userId)?.isDeletedFromSystem;

    if (hasRecentRoleChangeMessage && recentMessageVisible) {
      console.log(
        "✅ SUCCESS: Admin role change system messages ARE working correctly"
      );
      console.log("✅ The messages SHOULD appear on the System Messages page");
      console.log("🔍 If user reports they are not visible, check:");
      console.log("   - Frontend cache refresh");
      console.log("   - User looking in correct location");
      console.log("   - Message sorting/pagination on frontend");
    } else {
      console.log(
        "❌ CONFIRMED BUG: Admin role change system messages are not working"
      );
    }
  } catch (error) {
    console.error("❌ Error during API logic test:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
  }
};

// Run the verification
connectDB().then(() => {
  testSystemMessageAPI();
});
