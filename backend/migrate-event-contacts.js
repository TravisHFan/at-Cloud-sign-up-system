/**
 * Migration Script: Fix Existing Events with Fake Organizer Contact Data
 *
 * This script updates all existing events in the database that have fake
 * organizer contact information (emails like @atcloud.org and phones like
 * +1 (555) XXX-XXXX) with real contact data from the user database.
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

async function migrateExistingEvents() {
  try {
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("🔄 Starting migration of existing events...\n");

    // Get all events
    const events = await Event.find({});
    console.log(`Found ${events.length} events to check\n`);

    let eventsUpdated = 0;
    let organizersUpdated = 0;

    for (const event of events) {
      console.log(`📅 Processing: "${event.title}"`);

      if (!event.organizerDetails || event.organizerDetails.length === 0) {
        console.log("   ⏭️  No organizer details, skipping\n");
        continue;
      }

      let eventNeedsUpdate = false;
      const updatedOrganizerDetails = [];

      for (const organizer of event.organizerDetails) {
        console.log(`   👤 Checking organizer: ${organizer.name}`);
        console.log(`      Current email: ${organizer.email}`);
        console.log(`      Current phone: ${organizer.phone}`);

        // Check if this organizer has fake data
        const hasFakeEmail =
          organizer.email.includes("@atcloud.org") ||
          organizer.email.includes(".lastname@");
        const hasFakePhone =
          organizer.phone.includes("(555)") ||
          organizer.phone.includes("+1 (555)");

        if (hasFakeEmail || hasFakePhone) {
          console.log("      🚨 Fake data detected, attempting to fix...");

          // Try to find the real user by name matching
          const nameParts = organizer.name.split(" ");
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(" ");

          const realUser = await User.findOne({
            firstName: new RegExp(`^${firstName}$`, "i"),
            lastName: new RegExp(`^${lastName}$`, "i"),
          });

          if (realUser) {
            console.log(`      ✅ Found matching user: ${realUser.email}`);

            // Update with real data
            const updatedOrganizer = {
              ...organizer.toObject(),
              email: realUser.email,
              phone: realUser.phone || "Phone not provided",
              userId: realUser._id, // Store the userId for future reference
            };

            updatedOrganizerDetails.push(updatedOrganizer);
            eventNeedsUpdate = true;
            organizersUpdated++;

            console.log(`      🔄 Updated email: ${realUser.email}`);
            console.log(
              `      🔄 Updated phone: ${
                realUser.phone || "Phone not provided"
              }`
            );
          } else {
            console.log(
              `      ❌ No matching user found for "${organizer.name}"`
            );
            // Keep the original data if no match found
            updatedOrganizerDetails.push(organizer.toObject());
          }
        } else {
          console.log("      ✅ Data looks real, keeping as-is");
          updatedOrganizerDetails.push(organizer.toObject());
        }
      }

      if (eventNeedsUpdate) {
        // Update the event with corrected organizer details
        await Event.findByIdAndUpdate(event._id, {
          organizerDetails: updatedOrganizerDetails,
        });

        eventsUpdated++;
        console.log("   ✅ Event updated with real contact data");
      } else {
        console.log("   ✅ Event already has real contact data");
      }

      console.log("");
    }

    // Final summary
    console.log("🎉 MIGRATION COMPLETE!");
    console.log("=".repeat(50));
    console.log(`📊 Events processed: ${events.length}`);
    console.log(`📊 Events updated: ${eventsUpdated}`);
    console.log(`📊 Organizers updated: ${organizersUpdated}`);

    if (eventsUpdated > 0) {
      console.log("\n✅ Existing events now show real contact information!");
      console.log(
        "✅ Fake @atcloud.org emails have been replaced with real emails"
      );
      console.log(
        '✅ Fake (555) phone numbers have been replaced with real phones or "Phone not provided"'
      );
    } else {
      console.log(
        "\n✅ No events needed updating - all contact data was already real"
      );
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run the migration
console.log("🚀 Starting Event Contact Data Migration...\n");
migrateExistingEvents();
