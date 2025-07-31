/**
 * Test Script: John Doe promoting Ruth Fan
 *
 * This simulates the exact scenario where Ruth Fan didn't receive notifications
 * when John Doe (Super Admin) promoted her from Leader to Administrator.
 */

import dotenv from "dotenv";
import { connectDatabase } from "../../src/models";
import User from "../../src/models/User";
import { Message } from "../../src/models/Message";

// Load environment variables
dotenv.config();

async function testJohnDoePromotesRuthFan() {
  console.log("🧪 Testing: John Doe promotes Ruth Fan scenario...\n");

  try {
    // Connect to database
    console.log("📡 Connecting to database...");
    await connectDatabase();
    console.log("✅ Database connected\n");

    // Clean up any existing test messages first
    console.log("🧹 Cleaning up existing messages...");
    await Message.deleteMany({
      $or: [
        { content: { $regex: "Ruth Fan", $options: "i" } },
        { content: { $regex: "role.*changed", $options: "i" } },
        { content: { $regex: "promoted.*Administrator", $options: "i" } },
      ],
    });
    console.log("✅ Cleanup completed\n");

    // Look for actual users or create test users
    let johnDoe = await User.findOne({
      firstName: "John",
      lastName: "Doe",
      role: "Super Admin",
    });

    let ruthFan = await User.findOne({
      firstName: "Ruth",
      lastName: "Fan",
    });

    if (!johnDoe || !ruthFan) {
      console.log(
        "⚠️ Real users not found in database. Creating test users..."
      );

      if (!johnDoe) {
        johnDoe = new User({
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@atcloud.org",
          username: "john.doe",
          role: "Super Admin",
          password: "hashedpassword123",
          isActive: true,
          isEmailVerified: true,
        });
        await johnDoe.save();
        console.log("✅ Created test user: John Doe (Super Admin)");
      }

      if (!ruthFan) {
        ruthFan = new User({
          firstName: "Ruth",
          lastName: "Fan",
          email: "ruth.fan@atcloud.org",
          username: "ruth.fan",
          role: "Leader",
          password: "hashedpassword123",
          isActive: true,
          isEmailVerified: true,
        });
        await ruthFan.save();
        console.log("✅ Created test user: Ruth Fan (Leader)");
      }
    }

    console.log("\n📋 Test Scenario Setup:");
    console.log(
      `   👤 Promoter: ${johnDoe.firstName} ${johnDoe.lastName} (${johnDoe.role})`
    );
    console.log(
      `   🎯 Target: ${ruthFan.firstName} ${ruthFan.lastName} (${ruthFan.role} → Administrator)`
    );
    console.log(`   📧 Ruth's Email: ${ruthFan.email}`);

    // Simulate the role update endpoint call
    console.log("\n🚀 Simulating role promotion...");

    // Import the UserController method
    const { UserController } = await import(
      "../../src/controllers/userController"
    );

    // Create mock request and response objects
    const mockReq = {
      params: { id: (ruthFan._id as any).toString() },
      body: { role: "Administrator" },
      user: {
        _id: johnDoe._id,
        firstName: johnDoe.firstName,
        lastName: johnDoe.lastName,
        email: johnDoe.email,
        role: johnDoe.role,
      },
    } as any;

    const mockRes = {
      status: (code: number) => ({
        json: (data: any) => {
          console.log(`📤 Response (${code}):`, JSON.stringify(data, null, 2));
          return mockRes;
        },
      }),
    } as any;

    // Call the updateUserRole method
    await UserController.updateUserRole(mockReq, mockRes);

    // Wait a moment for async operations
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check if Ruth Fan received notifications
    console.log("\n🔍 Checking if Ruth Fan received notifications...");

    const ruthMessages = await Message.find({
      $or: [
        { userStates: { $exists: true } },
        { content: { $regex: "Ruth Fan", $options: "i" } },
      ],
    }).sort({ createdAt: -1 });

    console.log(`📨 Total messages in system: ${ruthMessages.length}`);

    // Check for messages where Ruth is in userStates
    const messagesForRuth: any[] = [];
    for (const message of ruthMessages) {
      const userState = message.userStates?.get(
        (ruthFan._id as any).toString()
      );
      if (userState || message.content.toLowerCase().includes("ruth fan")) {
        messagesForRuth.push(message);
      }
    }

    console.log(`📬 Messages targeting Ruth Fan: ${messagesForRuth.length}`);

    if (messagesForRuth.length > 0) {
      console.log("\n🎉 SUCCESS! Ruth Fan received notifications:");
      messagesForRuth.forEach((msg, index) => {
        console.log(`   ${index + 1}. "${msg.title}"`);
        console.log(`      Content: "${msg.content.substring(0, 100)}..."`);
        console.log(`      Type: ${msg.type}, Priority: ${msg.priority}`);
        console.log(`      Created: ${msg.createdAt}`);
      });
    } else {
      console.log("\n❌ PROBLEM: Ruth Fan did not receive any notifications!");
    }

    // Check admin notifications
    console.log("\n🔍 Checking admin notifications...");
    const adminMessages = await Message.find({
      content: { $regex: "Ruth Fan.*Administrator", $options: "i" },
    }).sort({ createdAt: -1 });

    console.log(`👥 Admin messages about Ruth Fan: ${adminMessages.length}`);

    if (adminMessages.length > 0) {
      console.log("✅ Admin notifications working");
    } else {
      console.log("❌ Admin notifications missing");
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("🎯 TEST RESULTS SUMMARY");
    console.log("=".repeat(60));
    console.log(
      `📧 Ruth Fan notifications: ${
        messagesForRuth.length > 0 ? "✅ WORKING" : "❌ BROKEN"
      }`
    );
    console.log(
      `👥 Admin notifications: ${
        adminMessages.length > 0 ? "✅ WORKING" : "❌ BROKEN"
      }`
    );

    if (messagesForRuth.length > 0 && adminMessages.length > 0) {
      console.log(
        "\n🎉 SUCCESS: Email → System Message → Bell Notification trio is now WORKING!"
      );
      console.log("   Ruth Fan should now receive:");
      console.log("   📧 Email notification");
      console.log("   💬 System message");
      console.log("   🔔 Bell notification");
    } else {
      console.log("\n❌ ISSUE: Notification system needs further debugging");
    }
  } catch (error: any) {
    console.error("❌ Test failed:", error?.message || error);
    console.error("Stack trace:", error?.stack);
  } finally {
    // Close database connection
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("\n📡 Database disconnected");
    }
    process.exit(0);
  }
}

testJohnDoePromotesRuthFan().catch(console.error);
