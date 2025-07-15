const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// User schema matching the actual User model
const userSchema = new mongoose.Schema(
  {
    // Basic Authentication
    username: String,
    email: String,
    phone: String,
    password: String,

    // Profile Information
    firstName: String,
    lastName: String,
    gender: { type: String, enum: ["male", "female"] },
    avatar: String,

    // Address Information
    homeAddress: String,

    // @Cloud Ministry Specific Fields
    isAtCloudLeader: Boolean,
    roleInAtCloud: String,

    // Professional Information
    occupation: String,
    company: String,
    weeklyChurch: String,
    churchAddress: String,

    // System Authorization
    role: String,

    // Account Status
    isActive: Boolean,
    isVerified: Boolean,

    // Contact Preferences
    emailNotifications: Boolean,
    smsNotifications: Boolean,
    pushNotifications: Boolean,
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

async function createTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to MongoDB");

    // Check if user already exists and delete it for fresh test
    const existingUser = await User.findOne({ email: "test@atcloud.com" });
    if (existingUser) {
      await User.deleteOne({ email: "test@atcloud.com" });
      console.log("🗑️ Deleted existing test user");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash("password123", 12);

    // Create user with correct schema fields
    const user = new User({
      username: "test_user",
      email: "test@atcloud.com",
      password: hashedPassword,
      firstName: "Test",
      lastName: "User",
      gender: "male",
      phone: "+1-555-9999",
      isAtCloudLeader: false,
      roleInAtCloud: "Member",
      homeAddress: "123 Test Street, Test City, ST 12345",
      occupation: "Software Developer",
      company: "Test Company Inc",
      weeklyChurch: "@Cloud Ministry",
      churchAddress: "456 Church Ave, Faith City, ST 67890",
      role: "user", // System role
      isActive: true,
      isVerified: true,
      emailNotifications: true,
      smsNotifications: true,
      pushNotifications: true,
    });

    await user.save();
    console.log("🎉 Test user created successfully!");
    console.log("📋 Credentials:");
    console.log("   Email: test@atcloud.com");
    console.log("   Password: password123");
    console.log("");
    console.log(
      "🧪 This is a fresh user for testing welcome message functionality"
    );
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("📂 Database connection closed");
    process.exit(0);
  }
}

createTestUser();
