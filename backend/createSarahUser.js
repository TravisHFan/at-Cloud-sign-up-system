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

    // Create user with correct schema fields
    const user = new User({
      username: "sarah_davis",
      email: "sarah@atcloud.com",
      password: hashedPassword,
      firstName: "Sarah",
      lastName: "Davis",
      gender: "female",
      phone: "+1-555-0123", // Add phone field
      isAtCloudLeader: true,
      roleInAtCloud: "Event Coordinator",
      homeAddress: "123 Main Street, Anytown, ST 12345", // Add homeAddress field
      occupation: "Marketing Manager",
      company: "Marketing Solutions Inc",
      weeklyChurch: "@Cloud Ministry",
      churchAddress: "456 Church Ave, Faith City, ST 67890", // Add churchAddress field
      role: "leader", // System role
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
