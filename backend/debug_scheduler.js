// Quick debug script for EventReminderScheduler
const path = require("path");
const mongoose = require("mongoose");

// Mock Event model
const mockEvent = {
  find: async (query) => {
    console.log("Event.find called with:", JSON.stringify(query, null, 2));

    // Return a test event that should pass the timing filter
    const now = new Date();
    const eventDateTime = new Date(now.getTime() + 23.9 * 60 * 60 * 1000); // 23.9h from now

    // Format properly for local timezone
    const year = eventDateTime.getFullYear();
    const month = String(eventDateTime.getMonth() + 1).padStart(2, "0");
    const day = String(eventDateTime.getDate()).padStart(2, "0");
    const eventDate = `${year}-${month}-${day}`;

    const hours = String(eventDateTime.getHours()).padStart(2, "0");
    const minutes = String(eventDateTime.getMinutes()).padStart(2, "0");
    const eventTime = `${hours}:${minutes}`;

    const testEvent = {
      _id: new mongoose.Types.ObjectId(),
      title: "Debug Test Event",
      date: eventDate,
      time: eventTime,
      "24hReminderSent": false,
    };

    console.log("Returning mock event:", testEvent);
    return [testEvent];
  },
};

// Mock fetch
global.fetch = async (url, options) => {
  console.log("fetch called with:", url, options?.method);
  return {
    ok: true,
    json: () => Promise.resolve({ message: "Success" }),
  };
};

// Test the scheduler logic manually
async function testScheduler() {
  try {
    // Manually test the timing logic
    const now = new Date();
    console.log("Current time:", now.toString());

    const eventDateTime = new Date(now.getTime() + 23.9 * 60 * 60 * 1000);
    console.log("Event time:", eventDateTime.toString());

    const reminderTriggerTime = new Date(
      eventDateTime.getTime() - 24 * 60 * 60 * 1000
    );
    console.log("Trigger time:", reminderTriggerTime.toString());

    const shouldTrigger = now >= reminderTriggerTime;
    const eventIsInFuture = eventDateTime > now;

    console.log("Should trigger:", shouldTrigger);
    console.log("Event in future:", eventIsInFuture);
    console.log("Should process:", shouldTrigger && eventIsInFuture);

    // Test the query
    const events = await mockEvent.find({
      "24hReminderSent": { $ne: true },
      $or: [
        { "24hReminderSentAt": { $exists: false } },
        { "24hReminderSentAt": { $lt: new Date(Date.now() - 30 * 60 * 1000) } },
      ],
    });

    console.log("Events from query:", events.length);

    // Test filtering
    const filteredEvents = events.filter((event) => {
      const eventDateTimeString = event.date + "T" + event.time + ":00.000";
      const eventDateTime = new Date(eventDateTimeString);
      const reminderTriggerTime = new Date(
        eventDateTime.getTime() - 24 * 60 * 60 * 1000
      );

      const shouldTrigger = now >= reminderTriggerTime;
      const eventIsInFuture = eventDateTime > now;

      console.log(`Event ${event.title}:`);
      console.log(`  Event DateTime: ${eventDateTime.toString()}`);
      console.log(`  Trigger Time: ${reminderTriggerTime.toString()}`);
      console.log(`  Should trigger: ${shouldTrigger}`);
      console.log(`  In future: ${eventIsInFuture}`);
      console.log(`  Result: ${shouldTrigger && eventIsInFuture}`);

      return shouldTrigger && eventIsInFuture;
    });

    console.log("Filtered events:", filteredEvents.length);
  } catch (error) {
    console.error("Error:", error);
  }
}

testScheduler();
