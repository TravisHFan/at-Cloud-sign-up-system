#!/usr/bin/env node

/**
 * @Cloud Role Change vs System Auth Change - Visual Comparison Demo
 *
 * This script creates sample messages to demonstrate the visual difference
 * between system authorization level changes and @Cloud ministry role changes.
 *
 * Run: node demo-message-type-comparison.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

async function createComparisonDemo() {
  try {
    console.log("🎨 @Cloud Role Change vs System Auth Change - Visual Demo");
    console.log("==========================================================");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Import models
    const Message = require("./dist/models/Message").Message;
    const User = require("./dist/models/User").default;

    // Find an admin user for the demo
    const admin = await User.findOne({
      $or: [{ role: "Super Admin" }, { role: "Administrator" }],
    });

    if (!admin) {
      console.log("❌ No admin user found for demo");
      return;
    }

    console.log(
      `\n👤 Demo User: ${admin.firstName} ${admin.lastName} (${admin.role})`
    );

    // Demo message 1: System Authorization Level Change
    console.log("\n📝 Creating System Authorization Level Change message...");
    const systemMessage = await Message.createForSpecificUser(
      {
        title: "🔐 System Access Level Updated: Ruth Fan",
        content:
          "Ruth Fan's system authorization level has been changed from Participant to Leader by Admin. This affects system permissions and access levels.",
        type: "auth_level_change", // 👤 Green user icon
        priority: "high",
        creator: {
          id: "demo-system",
          firstName: "Demo",
          lastName: "Admin",
          username: "demo-admin",
          gender: "male",
          authLevel: "Super Admin",
          roleInAtCloud: "System Administrator",
        },
        isActive: true,
      },
      admin._id.toString()
    );

    // Demo message 2: @Cloud Ministry Role Change
    console.log("📝 Creating @Cloud Ministry Role Change message...");
    const atcloudMessage = await Message.createForSpecificUser(
      {
        title: "🎉 New @Cloud Leader Signup: Sarah Johnson",
        content:
          "Sarah Johnson (sarah.johnson@example.com) has signed up as an @Cloud Leader with the role: Youth Pastor. Date: " +
          new Date().toLocaleString(),
        type: "atcloud_role_change", // 🏷️ Purple tag icon
        priority: "medium",
        creator: {
          id: "demo-system",
          firstName: "Demo",
          lastName: "System",
          username: "demo-system",
          gender: "male",
          authLevel: "Super Admin",
          roleInAtCloud: "System Administrator",
        },
        isActive: true,
      },
      admin._id.toString()
    );

    console.log("\n🎯 DEMO MESSAGES CREATED!");
    console.log("=========================");

    console.log("\n1️⃣ SYSTEM AUTHORIZATION LEVEL CHANGE:");
    console.log("   📱 Title: " + systemMessage.title);
    console.log("   🎨 Type: auth_level_change");
    console.log("   🎯 Icon: 👤 User (Green)");
    console.log("   📍 Purpose: System permissions and access control");

    console.log("\n2️⃣ @CLOUD MINISTRY ROLE CHANGE:");
    console.log("   📱 Title: " + atcloudMessage.title);
    console.log("   🎨 Type: atcloud_role_change");
    console.log("   🎯 Icon: 🏷️ Tag (Purple)");
    console.log("   📍 Purpose: Ministry position and church roles");

    console.log("\n🔍 HOW TO VIEW THE DIFFERENCE:");
    console.log("==============================");
    console.log("1. 🌐 Open your browser and go to the @Cloud system");
    console.log("2. 🔔 Click the bell notification icon (top right)");
    console.log("3. 👀 Look for the two demo messages:");
    console.log("   - System auth change: GREEN 👤 user icon");
    console.log("   - @Cloud role change: PURPLE 🏷️ tag icon");
    console.log("4. 📋 Go to System Messages page to see the same distinction");
    console.log("5. 🧹 Messages will auto-expire or can be manually removed");

    console.log("\n⏰ DEMO MESSAGES WILL REMAIN FOR TESTING");
    console.log("========================================");
    console.log("The demo messages have been created for visual testing.");
    console.log("You can now see the distinct icons and colors in action!");
    console.log(`System Auth Message ID: ${systemMessage._id}`);
    console.log(`@Cloud Role Message ID: ${atcloudMessage._id}`);
  } catch (error) {
    console.error("❌ Error creating demo messages:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
  }
}

// Run the demo
createComparisonDemo().catch(console.error);
