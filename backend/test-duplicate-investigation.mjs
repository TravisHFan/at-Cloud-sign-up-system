#!/usr/bin/env node

/**
 * Duplicate Notification Investigation Script
 *
 * This script will:
 * 1. Create a system message via the API
 * 2. Check bell notifications immediately after
 * 3. Report if duplicates are found
 * 4. Help identify the source of duplication
 */

import axios from "axios";
import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const BASE_URL = "http://localhost:5001/api/v1";

// Connect to database for direct inspection
async function connectDB() {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoURI);
    console.log("✅ Connected to MongoDB for inspection");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
}

// Define models for direct inspection
const messageSchema = new mongoose.Schema({}, { strict: false });
const Message = mongoose.model("Message", messageSchema);

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model("User", userSchema);

async function investigateDuplicates() {
  try {
    console.log("🔍 === DUPLICATE NOTIFICATION INVESTIGATION ===\n");

    // 1. Login as admin to get token
    console.log("1. 🔐 Logging in as admin...");
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      emailOrUsername: "testadmin2@test.com",
      password: "testpass123",
    });

    if (loginResponse.status !== 200) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const authToken = loginResponse.data.data.accessToken;
    console.log("   ✅ Admin login successful");

    // 2. Get initial counts
    console.log("\n2. 📊 Getting initial state...");

    // Check Message collection
    const initialMessageCount = await Message.countDocuments();
    console.log(`   - Message documents: ${initialMessageCount}`);

    // Check User notification states
    const users = await User.find({})
      .select(
        "username bellNotificationStates systemMessageStates bellNotifications"
      )
      .lean();
    console.log(`   - Total users: ${users.length}`);

    users.forEach((user) => {
      const bellStates = user.bellNotificationStates?.length || 0;
      const systemStates = user.systemMessageStates?.length || 0;
      const bellNotifs = user.bellNotifications?.length || 0;
      if (bellStates + systemStates + bellNotifs > 0) {
        console.log(
          `   - ${user.username}: bellStates=${bellStates}, systemStates=${systemStates}, bellNotifs=${bellNotifs}`
        );
      }
    });

    // 3. Create a system message
    console.log("\n3. 📝 Creating system message...");
    const createResponse = await axios.post(
      `${BASE_URL}/system-messages`,
      {
        title: "Duplicate Investigation Test",
        content: "Testing for duplicate bell notifications with this message",
        type: "announcement",
        priority: "medium",
      },
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    if (createResponse.status !== 201) {
      throw new Error(`Create message failed: ${createResponse.status}`);
    }

    const messageId = createResponse.data.data.message.id;
    console.log(`   ✅ System message created with ID: ${messageId}`);

    // 4. Immediately check database state
    console.log("\n4. 🔍 Checking database state after creation...");

    const finalMessageCount = await Message.countDocuments();
    console.log(
      `   - Message documents: ${finalMessageCount} (change: +${
        finalMessageCount - initialMessageCount
      })`
    );

    // Get the created message
    const createdMessage = await Message.findById(messageId);
    if (createdMessage) {
      console.log(`   - Created message title: "${createdMessage.title}"`);
      console.log(
        `   - User states count: ${
          createdMessage.userStates ? createdMessage.userStates.size : 0
        }`
      );
    }

    // Check users again
    const finalUsers = await User.find({})
      .select(
        "username bellNotificationStates systemMessageStates bellNotifications"
      )
      .lean();

    console.log("\n   User notification states after creation:");
    finalUsers.forEach((user) => {
      const bellStates = user.bellNotificationStates?.length || 0;
      const systemStates = user.systemMessageStates?.length || 0;
      const bellNotifs = user.bellNotifications?.length || 0;
      if (bellStates + systemStates + bellNotifs > 0) {
        console.log(
          `   - ${user.username}: bellStates=${bellStates}, systemStates=${systemStates}, bellNotifs=${bellNotifs}`
        );
      }
    });

    // 5. Check bell notifications API
    console.log("\n5. 🔔 Checking bell notifications API...");
    const bellResponse = await axios.get(
      `${BASE_URL}/system-messages/bell-notifications`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    if (bellResponse.status !== 200) {
      throw new Error(`Bell notifications failed: ${bellResponse.status}`);
    }

    const notifications = bellResponse.data.data.notifications;
    console.log(`   - API returned ${notifications.length} bell notifications`);

    // Check for duplicates
    const titles = notifications.map((n) => n.title);
    const uniqueTitles = [...new Set(titles)];

    if (titles.length !== uniqueTitles.length) {
      console.log("   ❌ DUPLICATES FOUND!");
      console.log("   📋 All notification titles:");
      notifications.forEach((notif, i) => {
        console.log(`     ${i + 1}. "${notif.title}" (ID: ${notif.id})`);
      });
    } else {
      console.log("   ✅ No duplicates found");
      if (notifications.length > 0) {
        console.log(`   📋 Notification title: "${notifications[0].title}"`);
      }
    }

    console.log("\n🎉 Investigation completed!");
  } catch (error) {
    console.error("❌ Investigation failed:", error.message);
    if (error.response) {
      console.error("   Response data:", error.response.data);
    }
  }
}

async function main() {
  try {
    await connectDB();
    await investigateDuplicates();
  } catch (error) {
    console.error("❌ Script failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  }
}

main().catch(console.error);
