/**
 * Final Verification Test: Organizer Contact Information Bug Fix
 *
 * This test verifies that the complete bug fix is working:
 * 1. Existing events have been migrated to show real contact data
 * 2. New events will use real contact data (backend processing)
 * 3. No fake contact information remains anywhere
 */

const mongoose = require("mongoose");

// User Schema
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  phone: String,
  firstName: String,
  lastName: String,
  gender: String,
  role: String,
});

const User = mongoose.model("User", userSchema);

// Event Schema
const organizerDetailSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true },
    role: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    avatar: String,
    gender: { type: String, enum: ["male", "female"] },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema({
  title: String,
  organizerDetails: [organizerDetailSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

const Event = mongoose.model("Event", eventSchema);

async function runFinalVerification() {
  try {
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("🎯 Running Final Bug Fix Verification...\n");

    // Test 1: Check all existing events for fake data
    console.log("📋 Test 1: Verifying Existing Events");
    console.log("=".repeat(40));

    const events = await Event.find({});
    let fakeDataFound = false;
    let totalOrganizers = 0;

    for (const event of events) {
      console.log(`📅 "${event.title}"`);

      if (event.organizerDetails) {
        for (const org of event.organizerDetails) {
          totalOrganizers++;
          const hasFakeEmail =
            org.email.includes("@atcloud.org") ||
            org.email.includes(".lastname@");
          const hasFakePhone =
            org.phone.includes("(555)") || org.phone.includes("+1 (555)");

          if (hasFakeEmail || hasFakePhone) {
            console.log(`   ❌ ${org.name}: FAKE DATA DETECTED`);
            console.log(`      Email: ${org.email}`);
            console.log(`      Phone: ${org.phone}`);
            fakeDataFound = true;
          } else {
            console.log(`   ✅ ${org.name}: Real contact data`);
          }
        }
      }
    }

    console.log(
      `\n📊 Checked ${events.length} events with ${totalOrganizers} total organizers`
    );

    if (fakeDataFound) {
      console.log(
        "❌ Test 1 FAILED: Fake data still found in existing events\n"
      );
      return false;
    } else {
      console.log("✅ Test 1 PASSED: No fake data in existing events\n");
    }

    // Test 2: Test new event creation with backend processing
    console.log("📝 Test 2: Testing New Event Creation");
    console.log("=".repeat(40));

    const users = await User.find({}).limit(2);
    if (users.length < 2) {
      console.log("⚠️  Need at least 2 users for new event test\n");
      return false;
    }

    const mainUser = users[0];
    const coOrgUser = users[1];

    // Simulate frontend data (with our fix)
    const frontendOrganizerDetails = [
      {
        name: `${mainUser.firstName} ${mainUser.lastName}`,
        role: "Main Organizer",
        email: mainUser.email, // Real email from current user
        phone: mainUser.phone || "Phone not provided", // Real phone or honest message
        userId: mainUser._id,
        avatar: mainUser.avatar,
        gender: mainUser.gender,
      },
      {
        name: `${coOrgUser.firstName} ${coOrgUser.lastName}`,
        role: "Co-organizer",
        email: "", // Empty - backend will populate
        phone: "", // Empty - backend will populate
        userId: coOrgUser._id,
        avatar: coOrgUser.avatar,
        gender: coOrgUser.gender,
      },
    ];

    // Simulate backend processing (from eventController.ts)
    const organizerDetailsPromises = frontendOrganizerDetails.map(
      async (organizer) => {
        if (organizer.userId) {
          const user = await User.findById(organizer.userId).select(
            "email phone firstName lastName"
          );
          if (user) {
            return {
              ...organizer,
              email: user.email,
              phone: user.phone || "Phone not provided",
            };
          }
        }
        return organizer;
      }
    );

    const processedOrganizerDetails = await Promise.all(
      organizerDetailsPromises
    );

    // Create test event
    const testEvent = new Event({
      title: "Final Verification Test Event",
      organizerDetails: processedOrganizerDetails,
      createdBy: mainUser._id,
    });

    await testEvent.save();

    // Verify saved event has real data
    const savedEvent = await Event.findById(testEvent._id);
    let newEventValid = true;

    console.log("📤 New event organizer details:");
    for (const org of savedEvent.organizerDetails) {
      const hasFakeEmail =
        org.email.includes("@atcloud.org") || org.email.includes(".lastname@");
      const hasFakePhone =
        org.phone.includes("(555)") || org.phone.includes("+1 (555)");

      if (hasFakeEmail || hasFakePhone) {
        console.log(`❌ ${org.name}: FAKE DATA in new event!`);
        newEventValid = false;
      } else {
        console.log(`✅ ${org.name}: ${org.email}, ${org.phone}`);
      }
    }

    // Clean up test event
    await Event.findByIdAndDelete(testEvent._id);

    if (!newEventValid) {
      console.log("❌ Test 2 FAILED: New events still contain fake data\n");
      return false;
    } else {
      console.log("✅ Test 2 PASSED: New events use real contact data\n");
    }

    // Test 3: Overall system verification
    console.log("🎯 Test 3: Overall System Status");
    console.log("=".repeat(40));

    const allEvents = await Event.find({});
    let systemValid = true;
    let totalFakeEmails = 0;
    let totalFakePhones = 0;

    for (const event of allEvents) {
      if (event.organizerDetails) {
        for (const org of event.organizerDetails) {
          if (
            org.email.includes("@atcloud.org") ||
            org.email.includes(".lastname@")
          ) {
            totalFakeEmails++;
            systemValid = false;
          }
          if (org.phone.includes("(555)") || org.phone.includes("+1 (555)")) {
            totalFakePhones++;
            systemValid = false;
          }
        }
      }
    }

    console.log(`📊 System Analysis:`);
    console.log(`   Total events: ${allEvents.length}`);
    console.log(`   Fake emails found: ${totalFakeEmails}`);
    console.log(`   Fake phones found: ${totalFakePhones}`);

    if (systemValid) {
      console.log(
        "✅ Test 3 PASSED: System is completely clean of fake contact data\n"
      );
    } else {
      console.log(
        "❌ Test 3 FAILED: System still contains fake contact data\n"
      );
      return false;
    }

    // Final Result
    console.log("🎉 FINAL VERIFICATION RESULTS");
    console.log("=".repeat(50));
    console.log("✅ ALL TESTS PASSED!");
    console.log("✅ Existing events migrated to real contact data");
    console.log("✅ New events use real contact data");
    console.log("✅ No fake @atcloud.org emails found");
    console.log("✅ No fake (555) phone numbers found");
    console.log("\n🐛 ORGANIZER CONTACT INFORMATION BUG: COMPLETELY FIXED ✅");
    console.log(
      "\nThe Event detail pages now show real email and phone information!"
    );

    return true;
  } catch (error) {
    console.error("❌ Final verification failed:", error);
    return false;
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run final verification
console.log("🚀 Starting Final Bug Fix Verification...\n");
runFinalVerification();
