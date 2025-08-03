/**
 * Event Reminder System Audit & Debug
 * Investigate why reminder trio is not working for registered users
 */

const mongoose = require("mongoose");
require("dotenv").config();

// Import models to register schemas
require("./dist/models/Event");
require("./dist/models/User");
require("./dist/models/Message");

async function auditReminderSystem() {
  console.log("🔍 EVENT REMINDER SYSTEM AUDIT");
  console.log("============================================");

  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to MongoDB");

    // Get events collection
    const Event = mongoose.model("Event");
    const User = mongoose.model("User");

    console.log("\n📋 CURRENT EVENTS IN DATABASE:");
    console.log("=================================");

    const events = await Event.find({}).lean();
    console.log(`Found ${events.length} events total`);

    for (const event of events) {
      console.log(`\n📅 Event: "${event.title}"`);
      console.log(`   ID: ${event._id}`);
      console.log(`   Date: ${event.date}`);
      console.log(`   Time: ${event.time}`);
      console.log(`   Format: ${event.format}`);
      console.log(
        `   24h Reminder Sent: ${event["24hReminderSent"] || "false"}`
      );
      console.log(
        `   24h Reminder Sent At: ${event["24hReminderSentAt"] || "N/A"}`
      );

      // Calculate timing
      const eventDateTime = new Date(`${event.date}T${event.time}:00.000Z`);
      const now = new Date();
      const hoursUntilEvent =
        (eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      console.log(`   Hours until event: ${hoursUntilEvent.toFixed(2)}`);
      console.log(
        `   In 24h window: ${
          hoursUntilEvent >= 23.5 && hoursUntilEvent <= 24.5 ? "YES" : "NO"
        }`
      );

      // Check registered users
      let totalRegistered = 0;
      if (event.roles && Array.isArray(event.roles)) {
        event.roles.forEach((role) => {
          if (role.currentSignups && Array.isArray(role.currentSignups)) {
            totalRegistered += role.currentSignups.length;
            console.log(
              `   Role "${role.name}": ${role.currentSignups.length} registered`
            );
            role.currentSignups.forEach((signup) => {
              console.log(
                `     - ${signup.firstName} ${signup.lastName} (${signup.email})`
              );
            });
          }
        });
      }
      console.log(`   Total registered users: ${totalRegistered}`);
    }

    console.log('\n🎯 FOCUS ON "Effective Communication - Test 3":');
    console.log("===============================================");

    const testEvent = events.find((e) => e.title.includes("Test 3"));
    if (testEvent) {
      console.log(`✅ Found "Test 3" event:`);
      console.log(`   ID: ${testEvent._id}`);
      console.log(`   Date: ${testEvent.date}`);
      console.log(`   Time: ${testEvent.time}`);
      console.log(
        `   24h Reminder Sent: ${testEvent["24hReminderSent"] || "false"}`
      );

      // Calculate exact timing
      const eventDateTime = new Date(
        `${testEvent.date}T${testEvent.time}:00.000Z`
      );
      const now = new Date();
      const hoursUntilEvent =
        (eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      console.log(`   Hours until event: ${hoursUntilEvent.toFixed(2)}`);
      console.log(
        `   Should trigger reminder: ${
          hoursUntilEvent >= 23.5 &&
          hoursUntilEvent <= 24.5 &&
          !testEvent["24hReminderSent"]
            ? "YES"
            : "NO"
        }`
      );

      // Check registered users in detail
      console.log(`\n👥 REGISTERED USERS FOR TEST 3:`);
      let foundUsers = [];
      if (testEvent.roles) {
        testEvent.roles.forEach((role) => {
          if (role.currentSignups) {
            role.currentSignups.forEach((signup) => {
              foundUsers.push({
                name: `${signup.firstName} ${signup.lastName}`,
                email: signup.email,
                role: role.name,
                userId: signup.userId,
              });
            });
          }
        });
      }

      console.log(`   Found ${foundUsers.length} registered users:`);
      foundUsers.forEach((user) => {
        console.log(`   - ${user.name} (${user.email}) in role "${user.role}"`);
      });

      if (foundUsers.length === 0) {
        console.log("   ❌ NO REGISTERED USERS FOUND!");
        console.log("   This could be why reminders are not sent.");
      }
    } else {
      console.log('❌ "Test 3" event not found in database!');
    }

    console.log("\n🔧 CHECKING SYSTEM MESSAGES:");
    console.log("============================");

    const SystemMessage = mongoose.model("SystemMessage");
    const recentMessages = await SystemMessage.find({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
    })
      .sort({ createdAt: -1 })
      .limit(10);

    console.log(
      `Found ${recentMessages.length} system messages in last 24 hours:`
    );
    recentMessages.forEach((msg) => {
      console.log(`   - ${msg.type}: "${msg.title}" (${msg.createdAt})`);
    });

    console.log("\n📧 CHECKING EMAIL LOGS:");
    console.log("========================");
    // Note: Email logs might be in console output, not database
    console.log("Check backend console for email sending logs...");
  } catch (error) {
    console.error("❌ Error during audit:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

auditReminderSystem();
