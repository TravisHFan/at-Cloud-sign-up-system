/**
 * Fix script to set proper eventDate for testing event reminders
 */

const mongoose = require("mongoose");
const Event = require("./dist/models/Event").default;

mongoose.connect("mongodb://localhost:27017/atcloud-signup");

async function fixEventDates() {
  try {
    console.log("🔧 Fixing Event Dates for Reminder Testing...\n");

    // Find the test event
    const event = await Event.findOne({
      title: "Effective Communication - Test 3",
    });

    if (!event) {
      console.log("❌ Event not found");
      return;
    }

    console.log(`Found event: ${event.title}`);
    console.log(`Current eventDate: ${event.eventDate}`);

    // Set eventDate to 24.5 hours from now (perfect for 24h reminder)
    const futureDate = new Date(Date.now() + 24.5 * 60 * 60 * 1000);

    console.log(`Setting eventDate to: ${futureDate.toISOString()}`);
    console.log(
      `This is ${((futureDate.getTime() - Date.now()) / (1000 * 3600)).toFixed(
        1
      )} hours from now`
    );

    // Update the event
    await Event.findByIdAndUpdate(event._id, {
      eventDate: futureDate,
      reminderSent: false, // Reset reminder status for testing
      reminderScheduled: false,
    });

    console.log("\n✅ Event date updated successfully!");
    console.log("📧 The event should now be eligible for 24h reminders");
    console.log(
      "🕐 EventReminderScheduler runs every 10 minutes, so reminders should be sent within 10 minutes"
    );

    // Verify the fix
    console.log("\n🔍 Verification:");
    const updatedEvent = await Event.findById(event._id);
    console.log(`New eventDate: ${updatedEvent.eventDate}`);

    // Check if it would be found by scheduler
    const eligibleEvents = await Event.find({
      eventDate: {
        $gte: new Date(Date.now() + 23 * 60 * 60 * 1000),
        $lte: new Date(Date.now() + 25 * 60 * 60 * 1000),
      },
      reminderSent: { $ne: true },
    });

    const isEligible = eligibleEvents.some(
      (e) => e._id.toString() === event._id.toString()
    );
    console.log(
      `Is event now eligible for reminders: ${isEligible ? "✅ YES" : "❌ NO"}`
    );
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

fixEventDates();
