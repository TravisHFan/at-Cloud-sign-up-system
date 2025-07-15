const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Simple user schema
const userSchema = new mongoose.Schema(
  {
    username: String,
    email: String,
    password: String,
    firstName: String,
    lastName: String,
    gender: String,
    isAtCloudLeader: Boolean,
    roleInAtCloud: String,
    occupation: String,
    company: String,
    weeklyChurch: String,
    role: String,
    systemAuthLevel: String,
    isActive: Boolean,
    isVerified: Boolean,
    emailNotifications: Boolean,
    smsNotifications: Boolean,
    pushNotifications: Boolean,
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

async function createSarahUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to MongoDB");

    // Check if user already exists
    const existingUser = await User.findOne({ email: "sarah@atcloud.com" });
    if (existingUser) {
      console.log("✅ User sarah@atcloud.com already exists");
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash("password123", 12);

    // Create user
    const user = new User({
      username: "sarah_davis",
      email: "sarah@atcloud.com",
      password: hashedPassword,
      firstName: "Sarah",
      lastName: "Davis",
      gender: "female",
      isAtCloudLeader: true,
      roleInAtCloud: "Event Coordinator",
      occupation: "Marketing Manager",
      company: "Marketing Solutions Inc",
      weeklyChurch: "@Cloud Ministry",
      role: "leader",
      systemAuthLevel: "Leader",
      isActive: true,
      isVerified: true,
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
    });

    await user.save();
    console.log("🎉 Sarah user created successfully!");
    console.log("📋 Credentials:");
    console.log("   Email: sarah@atcloud.com");
    console.log("   Password: password123");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("📂 Database connection closed");
    process.exit(0);
  }
}

createSarahUser();
