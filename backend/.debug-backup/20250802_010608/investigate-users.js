#!/usr/bin/env node

/**
 * Simple Admin User Investigation
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

// Import models (from compiled JavaScript)
const User = require("./dist/models/User").default;

const investigateUsers = async () => {
  try {
    console.log("\n🔍 INVESTIGATING USER DATA");
    console.log("===========================\n");

    // Get all users to see their structure
    const allUsers = await User.find({})
      .select("_id firstName lastName email systemAuth cloudRole")
      .limit(10);

    console.log("👥 Sample Users (first 10):");
    allUsers.forEach((user) => {
      console.log(`   - ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`     ID: ${user._id}`);
      console.log(`     systemAuth: ${user.systemAuth}`);
      console.log(`     cloudRole: ${user.cloudRole}`);
      console.log("");
    });

    // Try different ways to find admins
    console.log("🔍 Searching for admins with different queries:");

    const adminQuery1 = await User.find({
      systemAuth: "admin",
    }).countDocuments();
    console.log(`   systemAuth: 'admin' -> ${adminQuery1} users`);

    const adminQuery2 = await User.find({
      systemAuth: "superadmin",
    }).countDocuments();
    console.log(`   systemAuth: 'superadmin' -> ${adminQuery2} users`);

    const adminQuery3 = await User.find({
      $or: [{ systemAuth: "admin" }, { systemAuth: "superadmin" }],
    });
    console.log(`   Combined admin query -> ${adminQuery3.length} users`);

    if (adminQuery3.length > 0) {
      console.log("   Admin users found:");
      adminQuery3.forEach((admin) => {
        console.log(
          `     - ${admin.firstName} ${admin.lastName} (${admin.email}) - ${admin.systemAuth} - ID: ${admin._id}`
        );
      });
    }

    // Search for system user
    console.log("\n🤖 Searching for system user:");
    const systemUser1 = await User.findOne({ email: "system@acloud.com" });
    console.log(
      `   email: 'system@acloud.com' -> ${systemUser1 ? "FOUND" : "NOT FOUND"}`
    );

    const systemUser2 = await User.findOne({ email: /system/i });
    console.log(
      `   email containing 'system' -> ${systemUser2 ? "FOUND" : "NOT FOUND"}`
    );

    const systemUser3 = await User.findOne({ firstName: "System" });
    console.log(
      `   firstName: 'System' -> ${systemUser3 ? "FOUND" : "NOT FOUND"}`
    );

    // Get recent message senders
    const { Message } = require("./dist/models/Message");

    const recentMessages = await Message.find({
      type: "auth_level_change",
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("createdBy", "firstName lastName email");

    console.log("\n📧 Recent auth_level_change message creators:");
    recentMessages.forEach((msg) => {
      console.log(`   - Message: "${msg.title}"`);
      console.log(
        `     Created by: ${
          msg.createdBy
            ? `${msg.createdBy.firstName} ${msg.createdBy.lastName} (${msg.createdBy.email})`
            : "UNKNOWN/NULL"
        }`
      );
      console.log(
        `     Created by ID: ${msg.createdBy ? msg.createdBy._id : "NULL"}`
      );
      console.log("");
    });
  } catch (error) {
    console.error("❌ Error during investigation:", error);
  } finally {
    await mongoose.connection.close();
    console.log("✅ Database connection closed");
  }
};

// Run the investigation script
connectDB().then(() => {
  investigateUsers();
});
