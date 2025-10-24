import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { User } from "../../models/index";
import { ROLES } from "../../utils/roleUtils";

// Load environment variables
dotenv.config();

/**
 * Regenerate Users Script
 *
 * Creates a comprehensive set of test users across all roles for development and testing.
 * WARNING: This will DELETE all existing users and create fresh ones.
 *
 * Created users:
 * - Super Admin: test-superadmin@example.com / SuperAdmin123!
 * - Administrator: test-admin-john@example.com / AdminPass123!
 * - Leader: test-leader-sarah@example.com / LeaderPass123!
 * - Participant 1: test-participant-mike@example.com / ParticipantPass123!
 * - Participant 2: test-participant-emily@example.com / ParticipantPass123!
 *
 * Usage: npm run regenerate-users
 */

interface UserData {
  username: string;
  email: string;
  phone?: string;
  password: string;
  firstName: string;
  lastName: string;
  gender: "male" | "female";
  avatar?: string;
  homeAddress?: string;
  isAtCloudLeader: boolean;
  roleInAtCloud?: string;
  occupation?: string;
  company?: string;
  weeklyChurch?: string;
  churchAddress?: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  loginAttempts: number;
}

// Sample user data with all required fields
const sampleUsers: UserData[] = [
  // Super Admin
  {
    username: "testsuperadmin",
    email: "test-superadmin@example.com",
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
    role: ROLES.SUPER_ADMIN,
    isActive: true,
    isVerified: true,
    loginAttempts: 0,
  },

  // Administrator
  {
    username: "testadminjohn",
    email: "test-admin-john@example.com",
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
    role: ROLES.ADMINISTRATOR,
    isActive: true,
    isVerified: true,
    loginAttempts: 0,
  },

  // Leader
  {
    username: "testleadersarah",
    email: "test-leader-sarah@example.com",
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
    role: ROLES.LEADER,
    isActive: true,
    isVerified: true,
    loginAttempts: 0,
  },

  // Participant 1
  {
    username: "testparticipantmike",
    email: "test-participant-mike@example.com",
    phone: "+1234567893",
    password: "ParticipantPass123!",
    firstName: "Mike",
    lastName: "Wilson",
    gender: "male",
    avatar: "/default-avatar-male.jpg",
    homeAddress: "654 Participant Street, City, State",
    isAtCloudLeader: false,
    occupation: "Software Engineer",
    company: "Tech Company Inc.",
    weeklyChurch: "@Cloud Main Campus",
    churchAddress: "456 Church Avenue, City, State",
    role: ROLES.PARTICIPANT,
    isActive: true,
    isVerified: true,
    loginAttempts: 0,
  },

  // Participant 2
  {
    username: "testparticipantemily",
    email: "test-participant-emily@example.com",
    phone: "+1234567894",
    password: "ParticipantPass123!",
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
    role: ROLES.PARTICIPANT,
    isActive: true,
    isVerified: true,
    loginAttempts: 0,
  },
];

// Function to regenerate all user data
async function regenerateUserData() {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoUri);

    console.log("🚀 Starting user regeneration...");
    console.log("⚠️  WARNING: This will DELETE all existing users!\n");

    // Clear existing users
    const deleteResult = await User.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing users\n`);

    // Create new users with all required fields
    console.log("📝 Creating test users...");

    for (const userData of sampleUsers) {
      try {
        // Hash password before saving
        const hashedPassword = await bcrypt.hash(userData.password, 12);

        const user = new User({
          ...userData,
          password: hashedPassword,
        });

        await user.save();
        console.log(
          `✅ Created: ${userData.username} (${userData.email}) - ${userData.role}`
        );
      } catch (error) {
        console.error(`❌ Failed to create user ${userData.username}:`, error);
      }
    }

    // Verify the data
    console.log("\n📊 User Statistics:");
    const userCount = await User.countDocuments();
    const adminCount = await User.countDocuments({ role: ROLES.SUPER_ADMIN });
    const adminUserCount = await User.countDocuments({
      role: ROLES.ADMINISTRATOR,
    });
    const leaderCount = await User.countDocuments({ role: ROLES.LEADER });
    const participantCount = await User.countDocuments({
      role: ROLES.PARTICIPANT,
    });
    const activeCount = await User.countDocuments({ isActive: true });
    const verifiedCount = await User.countDocuments({ isVerified: true });

    console.log(`Total Users: ${userCount}`);
    console.log(`Super Admins: ${adminCount}`);
    console.log(`Administrators: ${adminUserCount}`);
    console.log(`Leaders: ${leaderCount}`);
    console.log(`Participants: ${participantCount}`);
    console.log(`Active: ${activeCount}`);
    console.log(`Verified: ${verifiedCount}`);

    // Test a sample user to verify schema
    const testUser = await User.findOne({ username: "testsuperadmin" });
    if (testUser) {
      console.log("\n✅ Sample user verification successful");
      console.log(`   Username: ${testUser.username}`);
      console.log(`   Email: ${testUser.email}`);
      console.log(`   Role: ${testUser.role}`);
    }
  } catch (error) {
    console.error("❌ Error regenerating user data:", error);
    process.exit(1);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log("\n✨ User regeneration complete!");
    process.exit(0);
  }
}

// Run the function
regenerateUserData();

// Export the function and run if this file is executed directly
export { regenerateUserData, sampleUsers };

if (require.main === module) {
  regenerateUserData()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
}
