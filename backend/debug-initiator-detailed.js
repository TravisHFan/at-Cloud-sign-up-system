const mongoose = require("mongoose");
const Event = require("./dist/models/Event").default;
const User = require("./dist/models/User").default;
const { EmailRecipientUtils } = require("./dist/utils/emailRecipientUtils");

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/atCloud");

async function debugInitiatorReceivingNotifications() {
  try {
    console.log(
      "🔍 Debugging why initiator receives Co-Organizer Assignment notifications...\n"
    );

    // Find an event with organizers
    const event = await Event.findOne({
      "organizerDetails.0": { $exists: true },
    }).limit(1);

    if (!event) {
      console.log("❌ No test event found");
      return;
    }

    console.log(`📅 Event: ${event.title}`);
    console.log(`🔑 Main Organizer ID (createdBy): ${event.createdBy}`);
    console.log(
      `📋 Total organizerDetails: ${event.organizerDetails.length}\n`
    );

    // Show all organizer details
    console.log("👥 All Organizer Details:");
    event.organizerDetails.forEach((org, index) => {
      console.log(`   [${index}] UserId: ${org.userId}`);
      console.log(`       Email: ${org.email}`);
      console.log(
        `       Is Main Organizer: ${
          org.userId?.toString() === event.createdBy.toString()
        }`
      );
      console.log("");
    });

    // Test the EmailRecipientUtils filtering
    console.log("🔍 Testing EmailRecipientUtils.getEventCoOrganizers():");
    const coOrganizers = await EmailRecipientUtils.getEventCoOrganizers(event);
    console.log(`📧 Co-organizers found: ${coOrganizers.length}`);

    if (coOrganizers.length > 0) {
      console.log("📋 Co-organizer details:");
      for (let i = 0; i < coOrganizers.length; i++) {
        const co = coOrganizers[i];
        console.log(`   [${i}] ${co.firstName} ${co.lastName} - ${co.email}`);

        // Check if this co-organizer is actually the main organizer
        const coUser = await User.findOne({ email: co.email });
        if (coUser) {
          const isMainOrganizer =
            coUser._id.toString() === event.createdBy.toString();
          console.log(`       User ID: ${coUser._id}`);
          console.log(`       Is Main Organizer: ${isMainOrganizer} ⚠️`);
        }
      }
    } else {
      console.log("   No co-organizers found");
    }

    // Manual step-by-step filtering to debug
    console.log("\n🔍 Manual Step-by-Step Filtering Debug:");
    const mainOrganizerId = event.createdBy.toString();
    console.log(`1. Main Organizer ID: ${mainOrganizerId}`);

    if (!event.organizerDetails || event.organizerDetails.length === 0) {
      console.log("2. No organizer details found");
      return;
    }

    console.log(`2. Total organizers: ${event.organizerDetails.length}`);

    // Filter step
    console.log("3. Filtering organizers (excluding main organizer):");
    const filteredOrganizers = event.organizerDetails.filter((organizer) => {
      const hasUserId =
        organizer.userId !== undefined && organizer.userId !== null;
      const userIdString = organizer.userId
        ? organizer.userId.toString()
        : "undefined";
      const isNotMainOrganizer = userIdString !== mainOrganizerId;

      console.log(`   Organizer: ${organizer.email}`);
      console.log(`     Has userId: ${hasUserId}`);
      console.log(`     UserId: ${userIdString}`);
      console.log(`     Is not main organizer: ${isNotMainOrganizer}`);
      console.log(`     Included: ${hasUserId && isNotMainOrganizer}`);
      console.log("");

      return (
        organizer.userId && organizer.userId.toString() !== mainOrganizerId
      );
    });

    console.log(`4. Filtered organizers: ${filteredOrganizers.length}`);

    const coOrganizerUserIds = filteredOrganizers.map(
      (organizer) => organizer.userId
    );
    console.log(`5. Co-organizer user IDs: ${coOrganizerUserIds.join(", ")}`);

    if (coOrganizerUserIds.length === 0) {
      console.log(
        "6. No co-organizer user IDs found - should return empty array"
      );
      return;
    }

    // Final User lookup
    console.log("6. Looking up users by IDs...");
    const users = await User.find({
      _id: { $in: coOrganizerUserIds },
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    }).select("email firstName lastName");

    console.log(`7. Final user lookup results: ${users.length} users`);
    users.forEach((user, index) => {
      console.log(
        `   [${index}] ${user.firstName} ${user.lastName} - ${user.email}`
      );
    });
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

debugInitiatorReceivingNotifications();
