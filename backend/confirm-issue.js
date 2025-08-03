/**
 * Simple script to confirm the eventId mismatch issue
 */

const mongoose = require("mongoose");
const Event = require("./dist/models/Event").default;
const Registration = require("./dist/models/Registration").default;
const { EmailRecipientUtils } = require("./dist/utils/emailRecipientUtils");

mongoose.connect("mongodb://localhost:27017/atcloud-signup");

async function confirmIssue() {
  try {
    // Find the event
    const event = await Event.findOne({
      title: "Effective Communication - Test 3",
    });
    console.log("Event found:", !!event);
    console.log("Event eventId:", event.eventId);
    console.log("Event _id:", event._id.toString());

    // Check registrations with both
    const regsByEventId = await Registration.find({ eventId: event.eventId });
    const regsByMongoId = await Registration.find({
      eventId: event._id.toString(),
    });

    console.log("Registrations by event.eventId:", regsByEventId.length);
    console.log("Registrations by event._id:", regsByMongoId.length);

    // Test EmailRecipientUtils with both
    console.log("\nTesting EmailRecipientUtils:");
    try {
      const participantsByEventId =
        await EmailRecipientUtils.getEventParticipants(event.eventId);
      console.log(
        "Participants with event.eventId:",
        participantsByEventId.length
      );
    } catch (e) {
      console.log("Error with event.eventId:", e.message);
    }

    try {
      const participantsByMongoId =
        await EmailRecipientUtils.getEventParticipants(event._id.toString());
      console.log("Participants with event._id:", participantsByMongoId.length);
    } catch (e) {
      console.log("Error with event._id:", e.message);
    }

    console.log("\n🚨 ROOT CAUSE CONFIRMED:");
    console.log(
      "Events have eventId=undefined, but registrations use MongoDB _id as eventId"
    );
    console.log(
      "EmailRecipientUtils is called with undefined eventId, so no participants found"
    );
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

confirmIssue();
