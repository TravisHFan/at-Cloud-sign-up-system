const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Define the user schema directly here for simplicity
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    phone: String,
    password: { type: String, required: true },
    firstName: String,
    lastName: String,
    gender: { type: String, enum: ["male", "female"] },
    avatar: { type: String, default: "/default-avatar-male.jpg" },
    homeAddress: String,
    isAtCloudLeader: { type: Boolean, default: false },
    roleInAtCloud: String,
    occupation: String,
    company: String,
    weeklyChurch: String,
    churchAddress: String,
    role: { type: String, default: "Participant" },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    emailNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false },
    pushNotifications: { type: Boolean, default: true },
    loginAttempts: { type: Number, default: 0 },
    lastLogin: Date,
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    lockUntil: Date,
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

// Sample users data
const sampleUsers = [
  {
    username: "superadmin",
    email: "superadmin@atcloud.org",
    phone: "+1234567890",
    password: "SuperAdmin123!",
    firstName: "Super",
    lastName: "Administrator",
    gender: "male",
    avatar: "/default-avatar-male.jpg",
    homeAddress: "123 Admin Street, City, State",
    isAtCloudLeader: true,
    roleInAtCloud: "Founder & Lead Pastor",
    occupation: "Pastor",
    company: "@Cloud Ministry",
    weeklyChurch: "@Cloud Main Campus",
    churchAddress: "456 Church Avenue, City, State",
    role: "Super Admin",
    isActive: true,
    isVerified: true,
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: true,
    loginAttempts: 0,
  },
  {
    username: "admin_john",
    email: "john.doe@atcloud.org",
    phone: "+1234567891",
    password: "AdminPass123!",
    firstName: "John",
    lastName: "Doe",
    gender: "male",
    avatar: "/default-avatar-male.jpg",
    homeAddress: "789 Leadership Drive, City, State",
    isAtCloudLeader: true,
    roleInAtCloud: "Assistant Pastor",
    occupation: "Pastor",
    company: "@Cloud Ministry",
    weeklyChurch: "@Cloud North Campus",
    churchAddress: "789 North Street, City, State",
    role: "Administrator",
    isActive: true,
    isVerified: true,
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    loginAttempts: 0,
  },
  {
    username: "leader_sarah",
    email: "sarah.johnson@atcloud.org",
    phone: "+1234567892",
    password: "LeaderPass123!",
    firstName: "Sarah",
    lastName: "Johnson",
    gender: "female",
    avatar: "/default-avatar-female.jpg",
    homeAddress: "321 Ministry Lane, City, State",
    isAtCloudLeader: true,
    roleInAtCloud: "Youth Pastor",
    occupation: "Youth Minister",
    company: "@Cloud Ministry",
    weeklyChurch: "@Cloud Youth Center",
    churchAddress: "321 Youth Boulevard, City, State",
    role: "Leader",
    isActive: true,
    isVerified: true,
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: true,
    loginAttempts: 0,
  },
  {
    username: "participant_emily",
    email: "emily.davis@gmail.com",
    phone: "+1234567894",
    password: "Participant123!",
    firstName: "Emily",
    lastName: "Davis",
    gender: "female",
    avatar: "/default-avatar-female.jpg",
    homeAddress: "987 Community Road, City, State",
    isAtCloudLeader: false,
    occupation: "Teacher",
    company: "Local Elementary School",
    weeklyChurch: "@Cloud Main Campus",
    churchAddress: "456 Church Avenue, City, State",
    role: "Participant",
    isActive: true,
    isVerified: true,
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    loginAttempts: 0,
  },
  {
    username: "participant_david",
    email: "david.brown@outlook.com",
    phone: "+1234567895",
    password: "David123!",
    firstName: "David",
    lastName: "Brown",
    gender: "male",
    avatar: "/default-avatar-male.jpg",
    homeAddress: "456 Family Street, City, State",
    isAtCloudLeader: false,
    occupation: "Software Engineer",
    company: "Tech Solutions Inc",
    weeklyChurch: "@Cloud North Campus",
    churchAddress: "789 North Street, City, State",
    role: "Participant",
    isActive: true,
    isVerified: true,
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: false,
    loginAttempts: 0,
  },
];

async function regenerateUsers() {
  try {
    console.log("🔄 Starting user data regeneration...");

    // Connect to MongoDB
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Clear existing users
    console.log("🗑️  Clearing existing user data...");
    await User.deleteMany({});
    console.log("✅ Existing user data cleared");

    // Create new users
    console.log("👥 Creating new users with complete schema...");

    for (const userData of sampleUsers) {
      try {
        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 12);

        const user = new User({
          ...userData,
          password: hashedPassword,
        });

        await user.save();
        console.log(
          `✅ Created user: ${userData.username} (${userData.email})`
        );
      } catch (error) {
        console.error(
          `❌ Failed to create user ${userData.username}:`,
          error.message
        );
      }
    }

    // Verify the data
    const userCount = await User.countDocuments();
    const activeCount = await User.countDocuments({ isActive: true });
    const verifiedCount = await User.countDocuments({ isVerified: true });

    console.log("\n📊 User Data Summary:");
    console.log(`Total Users: ${userCount}`);
    console.log(`Active Users: ${activeCount}`);
    console.log(`Verified Users: ${verifiedCount}`);

    // Test a sample user
    const testUser = await User.findOne({ username: "superadmin" });
    if (testUser) {
      console.log("\n🔍 Sample User Schema Verification:");
      console.log("✅ emailNotifications:", testUser.emailNotifications);
      console.log("✅ smsNotifications:", testUser.smsNotifications);
      console.log("✅ pushNotifications:", testUser.pushNotifications);
      console.log("✅ All required fields present!");
    }

    console.log("\n🎉 User data regeneration completed successfully!");
  } catch (error) {
    console.error("❌ Error regenerating user data:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  }
}

// Run the function
regenerateUsers();
