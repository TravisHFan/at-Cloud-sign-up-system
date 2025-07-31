/**
 * Simple test for AutoEmailNotificationService
 */

import dotenv from "dotenv";
import { connectDatabase } from "../../src/models";
import { AutoEmailNotificationService } from "../../src/services/infrastructure/autoEmailNotificationService";

// Load environment variables
dotenv.config();

async function simpleTest() {
  console.log("🧪 Simple AutoEmailNotificationService Test...\n");

  try {
    console.log("📡 Connecting to database...");
    await connectDatabase();
    console.log("✅ Database connected\n");

    // Test data
    const userData = {
      _id: "507f1f77bcf86cd799439011",
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      oldRole: "Participant",
      newRole: "Leader",
      role: "Leader",
    };

    const changedBy = {
      _id: "507f1f77bcf86cd799439012",
      firstName: "Admin",
      lastName: "User",
      email: "admin@test.com",
      role: "Administrator",
    };

    console.log("🚀 Testing role promotion notification...");

    const result =
      await AutoEmailNotificationService.sendRoleChangeNotification({
        userData,
        changedBy,
        reason: "Test promotion",
        isPromotion: true,
      });

    console.log("\n📊 Results:");
    console.log(`   📧 Emails Sent: ${result.emailsSent}`);
    console.log(`   💬 Messages Created: ${result.messagesCreated}`);

    if (result.messagesCreated > 0) {
      console.log("\n🎉 SUCCESS: AutoEmailNotificationService is working!");
    } else {
      console.log("\n❌ ISSUE: No messages were created");
    }
  } catch (error: any) {
    console.error("❌ Test failed:", error?.message || error);
  } finally {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("\n📡 Database disconnected");
    }
    process.exit(0);
  }
}

simpleTest().catch(console.error);
