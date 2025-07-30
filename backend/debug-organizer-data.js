const mongoose = require("mongoose");
const Event = require("./dist/models/Event").default;
const User = require("./dist/models/User").default;
const {
  ResponseBuilderService,
} = require("./dist/services/ResponseBuilderService");

// Connect to database
mongoose.connect("mongodb://localhost:27017/atcloud-signup");

async function debugOrganizerData() {
  try {
    console.log("🔍 Debugging Organizer Data Structure...\n");

    // Find an event with multiple organizers
    const rawEvent = await Event.findOne({
      "organizerDetails.1": { $exists: true }, // Has at least 2 organizers
    });

    if (!rawEvent) {
      console.log("❌ No event with multiple organizers found");
      return;
    }

    console.log(`📅 Event: "${rawEvent.title}"`);
    console.log(
      `👥 Raw Event Organizer Details (${rawEvent.organizerDetails.length}):`
    );

    // Show raw organizer details structure
    rawEvent.organizerDetails.forEach((org, index) => {
      console.log(`\n   [${index}] Raw Organizer Data:`);
      console.log(`       userId: ${org.userId} (${typeof org.userId})`);
      console.log(`       name: "${org.name}"`);
      console.log(`       role: "${org.role}"`);
      console.log(`       email: "${org.email}"`);
      console.log(`       phone: "${org.phone}"`);
      console.log(`       avatar: "${org.avatar}"`);
      console.log(`       gender: "${org.gender}"`);
    });

    // Get populated event data (this is what the frontend receives)
    console.log(`\n🔄 Getting populated event data...`);
    const populatedEvent =
      await ResponseBuilderService.buildEventWithRegistrations(
        rawEvent._id.toString()
      );

    if (populatedEvent && populatedEvent.organizerDetails) {
      console.log(
        `\n👥 Populated Event Organizer Details (${populatedEvent.organizerDetails.length}):`
      );

      populatedEvent.organizerDetails.forEach((org, index) => {
        console.log(`\n   [${index}] Populated Organizer Data:`);
        console.log(`       userId: ${org.userId} (${typeof org.userId})`);
        console.log(`       name: "${org.name}"`);
        console.log(`       role: "${org.role}"`);
        console.log(`       email: "${org.email}"`);
        console.log(`       phone: "${org.phone}"`);
        console.log(`       avatar: "${org.avatar}"`);
        console.log(`       gender: "${org.gender}"`);
        console.log(`       firstName: "${org.firstName}"`);
        console.log(`       lastName: "${org.lastName}"`);
      });
    }

    // Check individual users to see their actual data
    console.log(`\n👤 Individual User Data Check:`);
    for (let i = 0; i < rawEvent.organizerDetails.length; i++) {
      const org = rawEvent.organizerDetails[i];
      if (org.userId) {
        const user = await User.findById(org.userId);
        if (user) {
          console.log(`\n   [${i}] User ${user.firstName} ${user.lastName}:`);
          console.log(`       Database email: "${user.email}"`);
          console.log(`       Database phone: "${user.phone}"`);
          console.log(`       Database avatar: "${user.avatar}"`);
          console.log(`       Database gender: "${user.gender}"`);

          console.log(`\n       Organizer Detail email: "${org.email}"`);
          console.log(`       Organizer Detail phone: "${org.phone}"`);
          console.log(
            `       Match: email=${user.email === org.email}, phone=${
              user.phone === org.phone
            }`
          );
        }
      }
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

debugOrganizerData();
