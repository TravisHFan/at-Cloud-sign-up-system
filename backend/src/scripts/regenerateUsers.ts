import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { User } from "../models/index";
import { ROLES } from "../utils/roleUtils";

// Load environment variables
dotenv.config();

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
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  loginAttempts: number;
}

// Sample user data with all required fields
const sampleUsers: UserData[] = [
  // Super Admin
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
    role: ROLES.SUPER_ADMIN,
    isActive: true,
    isVerified: true,
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: true,
    loginAttempts: 0,
  },

  // Administrator
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
    role: ROLES.ADMINISTRATOR,
    isActive: true,
    isVerified: true,
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    loginAttempts: 0,
  },

  // Leader
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
    role: ROLES.LEADER,
    isActive: true,
    isVerified: true,
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: true,
    loginAttempts: 0,
  },

  // Leader - Event Coordinator
  {
    username: "coordinator_mike",
    email: "mike.wilson@atcloud.org",
    phone: "+1234567893",
    password: "Coordinator123!",
    firstName: "Mike",
    lastName: "Wilson",
    gender: "male",
    avatar: "/default-avatar-male.jpg",
    homeAddress: "654 Event Street, City, State",
    isAtCloudLeader: true,
    roleInAtCloud: "Event Coordinator",
    occupation: "Event Manager",
    company: "@Cloud Ministry",
    weeklyChurch: "@Cloud Main Campus",
    churchAddress: "456 Church Avenue, City, State",
    role: ROLES.LEADER,
    isActive: true,
    isVerified: true,
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    loginAttempts: 0,
  },

  // Regular Participants
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
    role: ROLES.PARTICIPANT,
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
    role: ROLES.PARTICIPANT,
    isActive: true,
    isVerified: true,
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: false,
    loginAttempts: 0,
  },

  {
    username: "participant_lisa",
    email: "lisa.garcia@yahoo.com",
    phone: "+1234567896",
    password: "Lisa123!",
    firstName: "Lisa",
    lastName: "Garcia",
    gender: "female",
    avatar: "/default-avatar-female.jpg",
    homeAddress: "789 Hope Avenue, City, State",
    isAtCloudLeader: false,
    occupation: "Nurse",
    company: "City General Hospital",
    weeklyChurch: "@Cloud Youth Center",
    churchAddress: "321 Youth Boulevard, City, State",
    role: ROLES.PARTICIPANT,
    isActive: true,
    isVerified: true,
    emailNotifications: false,
    smsNotifications: false,
    pushNotifications: true,
    loginAttempts: 0,
  },

  {
    username: "participant_james",
    email: "james.miller@gmail.com",
    phone: "+1234567897",
    password: "James123!",
    firstName: "James",
    lastName: "Miller",
    gender: "male",
    avatar: "/default-avatar-male.jpg",
    homeAddress: "123 Faith Circle, City, State",
    isAtCloudLeader: false,
    occupation: "Accountant",
    company: "Financial Services LLC",
    weeklyChurch: "@Cloud Main Campus",
    churchAddress: "456 Church Avenue, City, State",
    role: ROLES.PARTICIPANT,
    isActive: true,
    isVerified: false, // Not yet verified
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    loginAttempts: 0,
  },

  // Inactive user example
  {
    username: "inactive_user",
    email: "inactive@example.com",
    phone: "+1234567898",
    password: "Inactive123!",
    firstName: "Inactive",
    lastName: "User",
    gender: "male",
    avatar: "/default-avatar-male.jpg",
    homeAddress: "999 Inactive Lane, City, State",
    isAtCloudLeader: false,
    occupation: "Former Member",
    company: "N/A",
    weeklyChurch: "@Cloud Main Campus",
    churchAddress: "456 Church Avenue, City, State",
    role: ROLES.PARTICIPANT,
    isActive: false, // Inactive account
    isVerified: true,
    emailNotifications: false,
    smsNotifications: false,
    pushNotifications: false,
    loginAttempts: 0,
  },

  // Test users for development
  {
    username: "testuser1",
    email: "test1@atcloud.test",
    phone: "+1234567899",
    password: "TestUser123!",
    firstName: "Test",
    lastName: "User One",
    gender: "female",
    avatar: "/default-avatar-female.jpg",
    homeAddress: "111 Test Street, Test City, Test State",
    isAtCloudLeader: false,
    occupation: "QA Tester",
    company: "Testing Corp",
    weeklyChurch: "@Cloud Main Campus",
    churchAddress: "456 Church Avenue, City, State",
    role: ROLES.PARTICIPANT,
    isActive: true,
    isVerified: true,
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: true,
    loginAttempts: 0,
  },
];

// Function to regenerate all user data
async function regenerateUserData() {
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

    // Create new users with all required fields
    console.log("👥 Creating new users with complete schema...");

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
          `✅ Created user: ${userData.username} (${userData.email})`
        );
      } catch (error) {
        console.error(`❌ Failed to create user ${userData.username}:`, error);
      }
    }

    // Verify the data
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

    console.log("\n📊 User Data Summary:");
    console.log(`Total Users: ${userCount}`);
    console.log(`Super Admins: ${adminCount}`);
    console.log(`Administrators: ${adminUserCount}`);
    console.log(`Leaders: ${leaderCount}`);
    console.log(`Participants: ${participantCount}`);
    console.log(`Active Users: ${activeCount}`);
    console.log(`Verified Users: ${verifiedCount}`);

    // Test a sample user to verify schema
    const testUser = await User.findOne({ username: "superadmin" });
    if (testUser) {
      console.log("\n🔍 Sample User Schema Verification:");
      console.log(
        "✅ emailNotifications:",
        (testUser as any).emailNotifications
      );
      console.log("✅ smsNotifications:", (testUser as any).smsNotifications);
      console.log("✅ pushNotifications:", (testUser as any).pushNotifications);
      console.log("✅ isAtCloudLeader:", (testUser as any).isAtCloudLeader);
      console.log("✅ roleInAtCloud:", (testUser as any).roleInAtCloud);
      console.log("✅ All required fields present!");
    }

    console.log("\n🎉 User data regeneration completed successfully!");
  } catch (error) {
    console.error("❌ Error regenerating user data:", error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
  }
}

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
