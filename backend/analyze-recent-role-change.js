#!/usr/bin/env node

/**
 * Check the most recent role change and verify admin system message visibility
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

const checkRecentRoleChange = async () => {
  try {
    console.log("\n🔍 ANALYZING RECENT ROLE CHANGE FOR ADMIN SYSTEM MESSAGES");
    console.log("=========================================================\n");

    // Import models
    const User = require("./dist/models/User").default;
    const { Message } = require("./dist/models/Message");

    // Get all admins
    const admins = await User.find({
      $or: [{ role: "Administrator" }, { role: "Super Admin" }],
    }).select("_id firstName lastName email role");

    console.log("👥 Found Admins:");
    admins.forEach((admin) => {
      console.log(
        `   - ${admin.firstName} ${admin.lastName} (${admin.email}) - ${admin.role} - ID: ${admin._id}`
      );
    });

    // Get the most recent role change message
    const mostRecentMessage = await Message.findOne({
      type: "auth_level_change",
    }).sort({ createdAt: -1 });

    if (!mostRecentMessage) {
      console.log("❌ No auth_level_change messages found");
      return;
    }

    console.log(`\n📨 Most Recent Role Change Message:`);
    console.log(`   ID: ${mostRecentMessage._id}`);
    console.log(`   Title: ${mostRecentMessage.title}`);
    console.log(`   Content: ${mostRecentMessage.content}`);
    console.log(`   Type: ${mostRecentMessage.type}`);
    console.log(`   Priority: ${mostRecentMessage.priority}`);
    console.log(`   Created: ${mostRecentMessage.createdAt}`);
    console.log(`   UserStates count: ${mostRecentMessage.userStates.size}`);

    // Check each admin's access and system message status
    console.log("\n🔍 ADMIN ACCESS ANALYSIS:");
    console.log("=========================");

    for (const admin of admins) {
      const adminId = admin._id.toString();
      const userState = mostRecentMessage.userStates.get(adminId);

      console.log(`\n👤 ${admin.firstName} ${admin.lastName} (${admin.role})`);
      console.log(`   User ID: ${adminId}`);
      console.log(`   Has UserState: ${userState ? "✅ YES" : "❌ NO"}`);

      if (userState) {
        console.log(
          `   Bell Notification - Read: ${
            userState.isReadInBell ? "✅" : "❌"
          }, Removed: ${userState.isRemovedFromBell ? "✅" : "❌"}`
        );
        console.log(
          `   System Message - Read: ${
            userState.isReadInSystem ? "✅" : "❌"
          }, Deleted: ${userState.isDeletedFromSystem ? "✅" : "❌"}`
        );
        console.log(
          `   Last Interaction: ${userState.lastInteractionAt || "Never"}`
        );

        // This is the key check - if isDeletedFromSystem is true, it won't appear on System Messages page
        if (userState.isDeletedFromSystem) {
          console.log(
            `   🚨 ISSUE: System message is marked as DELETED - won't appear on System Messages page`
          );
        } else {
          console.log(
            `   ✅ System message should appear on System Messages page`
          );
        }
      } else {
        console.log(
          `   🚨 CRITICAL ISSUE: Admin has no userState - won't receive ANY notifications`
        );
      }
    }

    // Check system message filtering logic simulation
    console.log("\n🔧 SIMULATING SYSTEM MESSAGE PAGE FILTERING:");
    console.log("=============================================");

    for (const admin of admins) {
      const adminId = admin._id.toString();
      console.log(
        `\n📱 System Messages for ${admin.firstName} ${admin.lastName}:`
      );

      // This simulates the filtering done by the /api/v1/notifications/system endpoint
      const systemMessages = await Message.find({
        [`userStates.${adminId}`]: { $exists: true },
        [`userStates.${adminId}.isDeletedFromSystem`]: { $ne: true },
      })
        .sort({ createdAt: -1 })
        .limit(5);

      console.log(`   Found ${systemMessages.length} visible system messages:`);
      systemMessages.forEach((msg, index) => {
        const userState = msg.userStates.get(adminId);
        console.log(
          `     ${index + 1}. "${msg.title}" (${msg.type}) - Read: ${
            userState?.isReadInSystem ? "✅" : "❌"
          }`
        );
      });

      // Check specifically for auth_level_change messages
      const authMessages = systemMessages.filter(
        (msg) => msg.type === "auth_level_change"
      );
      console.log(
        `   📊 Auth level change messages visible: ${authMessages.length}`
      );
    }
  } catch (error) {
    console.error("❌ Error during analysis:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
  }
};

// Run the analysis
connectDB().then(() => {
  checkRecentRoleChange();
});
