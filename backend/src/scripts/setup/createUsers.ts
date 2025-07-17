import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User, { IUser } from "../../models/User";
import { UserRole, ROLES } from "../../utils/roleUtils";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../../.env") });

interface UserData {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  adminNotes?: string;
}

const defaultUsers: UserData[] = [
  {
    username: "admin",
    email: "admin@cloud.ministry",
    password: "AdminPassword123!",
    firstName: "System",
    lastName: "Administrator",
    phone: "+1234567890",
    role: ROLES.SUPER_ADMIN,
    isActive: true,
    adminNotes: "Default system administrator account",
  },
  {
    username: "ministry.leader",
    email: "leader@cloud.ministry",
    password: "LeaderPass123!",
    firstName: "Ministry",
    lastName: "Leader",
    phone: "+1234567891",
    role: ROLES.LEADER,
    isActive: true,
    adminNotes: "Default ministry leader account",
  },
  {
    username: "test.participant",
    email: "participant@cloud.ministry",
    password: "ParticipantPass123!",
    firstName: "Test",
    lastName: "Participant",
    phone: "+1234567892",
    role: ROLES.PARTICIPANT,
    isActive: true,
    adminNotes: "Default test participant account",
  },
];

async function setupUsers(): Promise<void> {
  try {

    const mongoUri =
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/atcloud-signup-system";
    await mongoose.connect(mongoUri);


    for (const userData of defaultUsers) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({
          $or: [{ username: userData.username }, { email: userData.email }],
        });

        if (existingUser) {
          continue;
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

        // Create user
        const user = new User({
          username: userData.username,
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          role: userData.role,
          isActive: userData.isActive,
          isVerified: true,
          emailNotifications: true,
          smsNotifications: false,
          pushNotifications: true,
          hasReceivedWelcomeMessage: false,
          loginAttempts: 0,
          isAtCloudLeader:
            userData.role === ROLES.LEADER ||
            userData.role === ROLES.ADMINISTRATOR ||
            userData.role === ROLES.SUPER_ADMIN,
          roleInAtCloud:
            userData.role === ROLES.SUPER_ADMIN
              ? "System Administrator"
              : userData.role === ROLES.ADMINISTRATOR
              ? "Ministry Administrator"
              : userData.role === ROLES.LEADER
              ? "Ministry Leader"
              : undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await user.save();
      } catch (error) {
        console.error(`❌ Failed to create user ${userData.username}:`, error);
      }
    }

  } catch (error) {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  setupUsers();
}

export { setupUsers };
