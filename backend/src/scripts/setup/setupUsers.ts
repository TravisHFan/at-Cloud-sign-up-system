import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../../models/User";
import { ROLES } from "../../utils/roleUtils";

// Load environment variables
dotenv.config();

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoURI);
    console.log("✅ Connected to MongoDB");

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ role: ROLES.SUPER_ADMIN });
    if (existingAdmin) {
      console.log("⚠️  Super Admin user already exists:");
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Role: ${existingAdmin.role}`);
      return;
    }

    // Create admin user
    const adminUser = new User({
      username: "admin",
      email: "admin@atcloud.org",
      password: "AdminPassword123!",
      firstName: "System",
      lastName: "Administrator",
      gender: "male",
      isAtCloudLeader: true,
      roleInAtCloud: "IT Director",
      occupation: "System Administrator",
      company: "@Cloud Marketplace Ministry",
      weeklyChurch: "@Cloud Ministry",
      role: ROLES.SUPER_ADMIN,
      isActive: true,
      isVerified: true,
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
    });

    await adminUser.save();

    console.log("🎉 Super Admin user created successfully!");
    console.log("📋 Admin Credentials:");
    console.log(`   Username: ${adminUser.username}`);
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Password: AdminPassword123!`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   ID: ${adminUser._id}`);
    console.log("\n🔐 Please change the password after first login!");
  } catch (error: any) {
    console.error("❌ Error creating admin user:", error);

    if (error.code === 11000) {
      console.log("⚠️  User with this username or email already exists");
    }
  } finally {
    await mongoose.connection.close();
    console.log("📂 Database connection closed");
    process.exit(0);
  }
};

// Also create a test leader user
const createTestUsers = async () => {
  try {
    // Connect to MongoDB
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoURI);
    console.log("✅ Connected to MongoDB");

    // Create test leader user
    const existingLeader = await User.findOne({ username: "testleader" });
    if (!existingLeader) {
      const leaderUser = new User({
        username: "testleader",
        email: "leader@atcloud.org",
        password: "LeaderPassword123!",
        firstName: "John",
        lastName: "Leader",
        gender: "male",
        isAtCloudLeader: true,
        roleInAtCloud: "Ministry Leader",
        occupation: "Pastor",
        company: "@Cloud Ministry",
        weeklyChurch: "@Cloud Ministry",
        role: ROLES.LEADER,
        isActive: true,
        isVerified: true,
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
      });

      await leaderUser.save();
      console.log("👨‍💼 Test Leader user created!");
      console.log(`   Username: ${leaderUser.username}`);
      console.log(`   Email: ${leaderUser.email}`);
      console.log(`   Password: LeaderPassword123!`);
    }

    // Create test participant user
    const existingParticipant = await User.findOne({ username: "testuser" });
    if (!existingParticipant) {
      const participantUser = new User({
        username: "testuser",
        email: "user@atcloud.org",
        password: "UserPassword123!",
        firstName: "Jane",
        lastName: "Participant",
        gender: "female",
        isAtCloudLeader: false,
        occupation: "Software Developer",
        company: "Tech Company",
        weeklyChurch: "@Cloud Ministry",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
      });

      await participantUser.save();
      console.log("👤 Test Participant user created!");
      console.log(`   Username: ${participantUser.username}`);
      console.log(`   Email: ${participantUser.email}`);
      console.log(`   Password: UserPassword123!`);
    }
  } catch (error: any) {
    console.error("❌ Error creating test users:", error);
  } finally {
    await mongoose.connection.close();
    console.log("📂 Database connection closed");
  }
};

// Main execution
const main = async () => {
  console.log("🚀 Setting up initial users for @Cloud Sign-up System...\n");

  await createAdminUser();

  console.log("\n🧪 Creating test users...");
  await createTestUsers();

  console.log("\n✅ User setup completed!");
  console.log("\n📝 Summary of created accounts:");
  console.log("   1. Super Admin: admin@atcloud.org / AdminPassword123!");
  console.log("   2. Leader: leader@atcloud.org / LeaderPassword123!");
  console.log("   3. Participant: user@atcloud.org / UserPassword123!");
};

main();
