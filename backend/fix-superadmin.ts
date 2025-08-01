import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { User } from "./src/models";

dotenv.config();

async function createTestUser() {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Check if superadmin exists
    const existingUser = await User.findOne({ username: "superadmin" });
    
    if (existingUser) {
      console.log("🔍 Superadmin exists, checking password...");
      console.log("User details:", {
        username: existingUser.username,
        email: existingUser.email,
        isActive: existingUser.isActive,
        isVerified: existingUser.isVerified,
        hasPassword: !!existingUser.password,
        passwordLength: existingUser.password?.length
      });

      // Test password
      const isValidPassword = await bcrypt.compare("SuperAdmin123!", existingUser.password);
      console.log("Password validation result:", isValidPassword);

      if (!isValidPassword) {
        console.log("🔧 Password is invalid, updating it...");
        const hashedPassword = await bcrypt.hash("SuperAdmin123!", 12);
        await User.findByIdAndUpdate(existingUser._id, { password: hashedPassword });
        console.log("✅ Password updated successfully");
      }
    } else {
      console.log("🆕 Creating new superadmin user...");
      const hashedPassword = await bcrypt.hash("SuperAdmin123!", 12);
      
      await User.create({
        username: "superadmin",
        email: "superadmin@atcloud.org",
        phone: "+1234567890",
        password: hashedPassword,
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
        loginAttempts: 0,
      });
      console.log("✅ Superadmin created successfully");
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

createTestUser();
