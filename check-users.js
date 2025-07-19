#!/usr/bin/env node

/**
 * Check Database Users
 *
 * This script checks what users exist in the database for testing
 */

const mongoose = require("mongoose");
require("dotenv").config();

// Connect to MongoDB
async function connectToDatabase() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup-dev"
    );
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
}

// Define basic User schema for checking
const userSchema = new mongoose.Schema(
  {
    username: String,
    email: String,
    role: String,
    isActive: Boolean,
    isVerified: Boolean,
  },
  { strict: false }
);

const User = mongoose.model("User", userSchema);

async function checkUsers() {
  try {
    console.log("🔍 Checking existing users...\n");

    const users = await User.find(
      {},
      "username email role isActive isVerified"
    ).limit(10);

    if (users.length === 0) {
      console.log("❌ No users found in database");
      return;
    }

    console.log(`✅ Found ${users.length} users:`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. Username: ${user.username || "N/A"}`);
      console.log(`   Email: ${user.email || "N/A"}`);
      console.log(`   Role: ${user.role || "N/A"}`);
      console.log(`   Active: ${user.isActive}`);
      console.log(`   Verified: ${user.isVerified}`);
      console.log("");
    });

    // Look for admin users specifically
    const adminUsers = await User.find({
      $or: [{ role: { $regex: /admin/i } }, { username: { $regex: /admin/i } }],
    });

    if (adminUsers.length > 0) {
      console.log(`🔑 Found ${adminUsers.length} admin users:`);
      adminUsers.forEach((user) => {
        console.log(`- ${user.username} (${user.role})`);
      });
    } else {
      console.log("⚠️  No admin users found");
    }
  } catch (error) {
    console.error("❌ Error checking users:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

async function main() {
  await connectToDatabase();
  await checkUsers();
}

main().catch(console.error);
