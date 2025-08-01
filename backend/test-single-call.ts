import mongoose from "mongoose";
import dotenv from "dotenv";
import { AutoEmailNotificationService } from "./src/services/infrastructure/autoEmailNotificationService";

// Load environment variables
dotenv.config();

async function testSingleCall() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("✅ Connected to MongoDB");

    console.log("🧪 Testing single call to AutoEmailNotificationService...");

    const testData = {
      userData: {
        _id: "6886abdfcef802ebd11ae59f",
        firstName: "Ruth",
        lastName: "Fan",
        email: "ruth.fan@test.com",
        oldRole: "Leader",
        newRole: "Administrator",
      },
      changedBy: {
        _id: "67890",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@test.com",
        role: "Super Admin",
      },
      isPromotion: true,
    };

    console.log("📞 SINGLE CALL - Starting...");
    const result =
      await AutoEmailNotificationService.sendRoleChangeNotification(testData);
    console.log("📞 SINGLE CALL - Completed:", result);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  }
}

testSingleCall();
