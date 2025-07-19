#!/usr/bin/env node

/**
 * Create Test Admin User
 *
 * This script creates a new admin user with known credentials for testing
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

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

// Define basic User schema
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstName: String,
    lastName: String,
    gender: { type: String, enum: ["male", "female"] },
    role: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: true },
    hasReceivedWelcomeMessage: { type: Boolean, default: false },
    emailNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    isAtCloudLeader: { type: Boolean, default: false },
    loginAttempts: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    strict: false,
  }
);

const User = mongoose.model("User", userSchema);

async function createTestAdmin() {
  try {
    console.log("🔧 Creating test admin user...\n");

    // Check if test admin already exists
    const existingUser = await User.findOne({ username: "testadmin2" });
    if (existingUser) {
      console.log("⚠️  Test admin user already exists");
      await User.deleteOne({ username: "testadmin2" });
      console.log("🗑️  Deleted existing test admin");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash("testpass123", 12);

    // Create new admin user
    const newAdmin = new User({
      username: "testadmin2",
      email: "testadmin2@test.com",
      password: hashedPassword,
      firstName: "Test",
      lastName: "Admin",
      gender: "male",
      role: "Super Admin",
      isActive: true,
      isVerified: true,
      hasReceivedWelcomeMessage: false,
      emailNotifications: true,
      smsNotifications: true,
      pushNotifications: true,
      isAtCloudLeader: true,
      roleInAtCloud: "System Administrator",
      loginAttempts: 0,
    });

    await newAdmin.save();

    console.log("✅ Test admin user created successfully!");
    console.log("📋 Credentials:");
    console.log("   Username: testadmin2");
    console.log("   Password: testpass123");
    console.log("   Role: Super Admin");
    console.log("   Email: testadmin2@test.com");
  } catch (error) {
    console.error("❌ Error creating test admin:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

async function main() {
  await connectToDatabase();
  await createTestAdmin();
}

main().catch(console.error);
