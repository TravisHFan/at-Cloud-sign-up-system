/**
 * Comprehensive Event Reminder Audit Script
 * Investigates why reminder trio (email + system message + bell) is not working
 */

import mongoose from "mongoose";
import Event from "./src/models/Event";
import User from "./src/models/User";
import Message from "./src/models/Message";
import EventReminderScheduler from "./src/services/EventReminderScheduler";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function auditEventReminderSystem() {
  console.log("🔍 EVENT REMINDER SYSTEM AUDIT");
  console.log("===============================");
  console.log(`📅 Current Date: ${new Date().toISOString()}`);
  console.log(
    `🌍 Current Time (Pacific): ${new Date().toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
    })}\n`
  );

  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup"
    );
    console.log("✅ Connected to MongoDB\n");

    // 1. Find the specific event "Effective Communication - Test 3"
    console.log("🎯 STEP 1: LOCATE TARGET EVENT");
    console.log("==============================");

    const targetEvent = await Event.findOne({
      title: { $regex: /Effective Communication.*Test.*3/i },
    });

    if (!targetEvent) {
      console.log('❌ Event "Effective Communication - Test 3" not found!');
      console.log('📋 Searching for all events with "Test" in title...\n');

      const testEvents = await Event.find({
        title: { $regex: /test/i },
      }).select("title date time format 24hReminderSent");

      console.log("🔍 Available test events:");
      testEvents.forEach((event, index) => {
        console.log(
          `   ${index + 1}. "${event.title}" - ${event.date} ${event.time}`
        );
        console.log(
          `      Format: ${event.format}, 24h Reminder Sent: ${
            (event as any)["24hReminderSent"] || false
          }`
        );
      });

      if (testEvents.length > 0) {
        // Use the first test event found
        console.log(
          `\n📌 Using event: "${testEvents[0].title}" for analysis\n`
        );
        await analyzeEvent(testEvents[0]);
      }
      return;
    }

    console.log(`✅ Found target event: "${targetEvent.title}"`);
    console.log(`📅 Event Date: ${targetEvent.date}`);
    console.log(`🕐 Event Time: ${targetEvent.time}`);
    console.log(`📍 Location: ${targetEvent.location}`);
    console.log(`🎭 Format: ${targetEvent.format}`);
    console.log(
      `🚨 24h Reminder Sent: ${
        (targetEvent as any)["24hReminderSent"] || false
      }\n`
    );

    await analyzeEvent(targetEvent);
  } catch (error) {
    console.error("❌ Audit failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

async function analyzeEvent(event: any) {
  console.log("🎯 STEP 2: ANALYZE EVENT REGISTRATIONS");
  console.log("=======================================");

  // Check registered users in roles
  let totalRegistrations = 0;
  const registeredUsers: any[] = [];

  if (event.roles && Array.isArray(event.roles)) {
    event.roles.forEach((role: any, roleIndex: number) => {
      console.log(`\n📋 Role ${roleIndex + 1}: "${role.name}"`);
      console.log(`   Max Participants: ${role.maxParticipants}`);
      console.log(`   Current Signups: ${role.currentSignups?.length || 0}`);

      if (role.currentSignups && role.currentSignups.length > 0) {
        role.currentSignups.forEach((signup: any, signupIndex: number) => {
          console.log(`      ${signupIndex + 1}. User ID: ${signup.userId}`);
          console.log(`         Username: ${signup.username}`);
          console.log(`         Name: ${signup.firstName} ${signup.lastName}`);
          registeredUsers.push(signup);
          totalRegistrations++;
        });
      } else {
        console.log("      No registrations");
      }
    });
  }

  console.log(`\n📊 Total Registrations: ${totalRegistrations}`);

  if (totalRegistrations === 0) {
    console.log("❌ NO REGISTERED USERS FOUND!");
    console.log("   This explains why no reminders were sent.");
    return;
  }

  // 3. Check timing analysis
  console.log("\n🎯 STEP 3: TIMING ANALYSIS");
  console.log("==========================");

  const eventDateTime = new Date(`${event.date}T${event.time}:00.000Z`);
  const currentTime = new Date();
  const currentTimePacific = new Date(
    currentTime.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
  );

  console.log(`📅 Event DateTime: ${eventDateTime.toISOString()}`);
  console.log(`🕐 Current Time (UTC): ${currentTime.toISOString()}`);
  console.log(`🌍 Current Time (Pacific): ${currentTimePacific.toISOString()}`);

  const timeUntilEvent = eventDateTime.getTime() - currentTimePacific.getTime();
  const hoursUntilEvent = timeUntilEvent / (1000 * 60 * 60);

  console.log(`⏰ Hours until event: ${hoursUntilEvent.toFixed(2)}`);

  // Check if within 24h window (22-26 hours to account for scheduler intervals)
  const within24hWindow = hoursUntilEvent >= 22 && hoursUntilEvent <= 26;
  console.log(
    `🎯 Within 24h reminder window (22-26h): ${
      within24hWindow ? "✅ YES" : "❌ NO"
    }`
  );

  // 4. Check reminder status
  console.log("\n🎯 STEP 4: REMINDER STATUS CHECK");
  console.log("=================================");

  console.log(
    `24h Reminder Sent: ${(event as any)["24hReminderSent"] || false}`
  );
  if ((event as any)["24hReminderSentAt"]) {
    console.log(
      `24h Reminder Sent At: ${new Date(
        (event as any)["24hReminderSentAt"]
      ).toISOString()}`
    );
  }

  // 5. Check system messages for registered users
  console.log("\n🎯 STEP 5: SYSTEM MESSAGE AUDIT");
  console.log("================================");

  for (const registration of registeredUsers.slice(0, 2)) {
    // Check first 2 users
    console.log(
      `\n👤 Checking messages for: ${registration.firstName} ${registration.lastName} (${registration.username})`
    );

    const userMessages = await Message.find({
      recipientId: registration.userId,
      type: "reminder",
    })
      .sort({ createdAt: -1 })
      .limit(5);

    console.log(`📨 Recent reminder messages: ${userMessages.length}`);

    if (userMessages.length > 0) {
      userMessages.forEach((msg: any, index: number) => {
        console.log(
          `   ${index + 1}. ${msg.title} - ${new Date(
            msg.createdAt
          ).toISOString()}`
        );
        console.log(`      Read: ${msg.isRead}, Priority: ${msg.priority}`);
      });
    } else {
      console.log("   ❌ No reminder messages found!");
    }
  }

  // 6. Test scheduler manually
  console.log("\n🎯 STEP 6: MANUAL SCHEDULER TEST");
  console.log("=================================");

  try {
    const scheduler = EventReminderScheduler.getInstance();
    console.log("✅ Scheduler instance obtained");

    console.log("🔍 Running manual reminder check...");
    await scheduler.triggerManualCheck();
    console.log("✅ Manual check completed");

    // Re-check the event to see if reminder status changed
    const updatedEvent = await Event.findById(event._id);
    console.log(
      `📋 Updated 24h Reminder Status: ${
        (updatedEvent as any)?.["24hReminderSent"] || false
      }`
    );
  } catch (error) {
    console.log("❌ Scheduler test failed:", error);
  }

  // 7. Diagnosis and recommendations
  console.log("\n🎯 STEP 7: DIAGNOSIS & RECOMMENDATIONS");
  console.log("======================================");

  console.log("\n🔍 POTENTIAL ISSUES:");

  if (totalRegistrations === 0) {
    console.log("❌ Issue: No registered users found");
    console.log("   Solution: Verify event registrations are properly saved");
  }

  if (!within24hWindow) {
    console.log("❌ Issue: Event not within 24h reminder window");
    console.log("   Current window: 22-26 hours before event");
    console.log(`   Event is ${hoursUntilEvent.toFixed(2)} hours away`);
  }

  if ((event as any)["24hReminderSent"]) {
    console.log("⚠️ Issue: 24h reminder already marked as sent");
    console.log("   This prevents duplicate reminders");
    console.log("   Check if reminder was actually delivered");
  }

  console.log("\n💡 NEXT STEPS:");
  console.log("1. Verify EventReminderScheduler is running every 10 minutes");
  console.log("2. Check email service configuration");
  console.log("3. Verify WebSocket connections for bell notifications");
  console.log("4. Test manual reminder trigger via API endpoint");
}

// Run the audit
auditEventReminderSystem().catch(console.error);
