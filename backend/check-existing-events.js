// Check existing events in database for fake contact data
const mongoose = require("mongoose");

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

async function checkExistingEvents() {
  try {
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("🔍 Checking existing events for fake contact data...\n");

    const events = await Event.find({}).limit(10);
    console.log(`Found ${events.length} events in database\n`);

    let fakeDataFound = false;

    events.forEach((event, index) => {
      console.log(`📅 Event ${index + 1}: "${event.title}"`);
      console.log(`   Created: ${event.createdAt}`);

      if (event.organizerDetails && event.organizerDetails.length > 0) {
        console.log(`   Organizers (${event.organizerDetails.length}):`);

        event.organizerDetails.forEach((org, orgIndex) => {
          console.log(`     ${orgIndex + 1}. ${org.name}`);
          console.log(`        Email: ${org.email}`);
          console.log(`        Phone: ${org.phone}`);

          // Check for fake patterns
          const hasFakeEmail =
            org.email.includes("@atcloud.org") ||
            org.email.includes(".lastname@");
          const hasFakePhone =
            org.phone.includes("(555)") || org.phone.includes("+1 (555)");

          if (hasFakeEmail || hasFakePhone) {
            console.log(`        🚨 FAKE DATA DETECTED!`);
            fakeDataFound = true;
          } else {
            console.log(`        ✅ Data looks real`);
          }
        });
      } else {
        console.log(`   No organizer details found`);
      }
      console.log("");
    });

    if (fakeDataFound) {
      console.log("❌ FAKE CONTACT DATA FOUND IN EXISTING EVENTS!");
      console.log(
        "   The database contains events with fake organizer contact information."
      );
      console.log(
        "   These need to be updated with real data from the user database."
      );
    } else {
      console.log("✅ No fake contact data found in existing events.");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

checkExistingEvents();
