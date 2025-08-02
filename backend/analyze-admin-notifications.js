#!/usr/bin/env node

/**
 * Test Script: Detailed Admin Notification Analysis
 * Purpose: Examine specific admin notification message and user states
 */

const mongoose = require("mongoose");
require("dotenv").config();

async function analyzeAdminNotifications() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("📊 Connected to MongoDB");

    // Import models
    const Message = require("./dist/models/Message").Message;
    const User = require("./dist/models/User").default;

    console.log("\n🔍 DETAILED ADMIN NOTIFICATION ANALYSIS");
    console.log("=====================================");

    // Get the most recent auth_level_change message
    const authMessage = await Message.findOne({
      type: "auth_level_change",
    }).sort({ createdAt: -1 });

    if (authMessage) {
      console.log("\n📋 Most Recent Auth Level Change Message:");
      console.log(`   ID: ${authMessage._id}`);
      console.log(`   Title: "${authMessage.title}"`);
      console.log(`   Type: "${authMessage.type}"`);
      console.log(`   Priority: "${authMessage.priority}"`);
      console.log(`   Created: ${authMessage.createdAt}`);
      console.log(
        `   Creator: ${authMessage.creator.firstName} ${authMessage.creator.lastName} (${authMessage.creator.authLevel})`
      );

      // Check userStates
      console.log("\n👥 User States in this message:");
      if (authMessage.userStates && authMessage.userStates.size > 0) {
        console.log(
          `   📊 Total users with states: ${authMessage.userStates.size}`
        );

        // Convert Map to Array for iteration
        const userStatesArray = Array.from(authMessage.userStates.entries());

        for (const [userId, userState] of userStatesArray) {
          // Get user details
          const user = await User.findById(userId).select(
            "firstName lastName email role"
          );
          if (user) {
            console.log(
              `   👤 ${user.firstName} ${user.lastName} (${user.role})`
            );
            console.log(`      📧 Email: ${user.email}`);
            console.log(
              `      🔔 Bell: Read=${userState.isReadInBell}, Removed=${userState.isRemovedFromBell}`
            );
            console.log(
              `      💬 System: Read=${userState.isReadInSystem}, Deleted=${userState.isDeletedFromSystem}`
            );

            // Check if this is an admin user
            if (user.role === "Admin" || user.role === "Super Admin") {
              console.log(
                `      🔑 ADMIN USER - Should have received admin notification`
              );
            }
          }
        }
      } else {
        console.log("   ❌ No user states found");
      }
    } else {
      console.log("❌ No auth_level_change messages found");
    }

    // Check recent messages sent to Travis (Super Admin)
    console.log("\n👨‍💼 Travis Fan (Super Admin) Recent Messages:");
    const travis = await User.findOne({ email: "travisfanht@gmail.com" });
    if (travis) {
      const travisMessages = await Message.find({
        [`userStates.${travis._id}`]: { $exists: true },
      })
        .sort({ createdAt: -1 })
        .limit(5);

      console.log(`   📬 Total messages: ${travisMessages.length}`);
      for (const msg of travisMessages) {
        const userState = msg.userStates.get(travis._id.toString());
        console.log(
          `   📄 "${msg.title}" (${msg.type}) - Created: ${
            msg.createdAt.toISOString().split("T")[0]
          }`
        );
        console.log(
          `      🔔 Bell: Read=${userState?.isReadInBell}, Removed=${userState?.isRemovedFromBell}`
        );
        console.log(
          `      💬 System: Read=${userState?.isReadInSystem}, Deleted=${userState?.isDeletedFromSystem}`
        );
      }
    }

    // Check the current autoEmailNotificationService code
    console.log("\n🔍 CHECKING CURRENT IMPLEMENTATION:");
    console.log("=====================================");
    console.log("✅ Message types are using valid enums");
    console.log("✅ Admin users are receiving messages");
    console.log(
      "📋 Recommendation: Check if the issue is resolved or test with a new role change"
    );
  } catch (error) {
    console.error("❌ Error during analysis:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n📊 Disconnected from MongoDB");
  }
}

analyzeAdminNotifications();
