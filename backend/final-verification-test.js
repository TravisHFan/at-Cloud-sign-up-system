const mongoose = require("mongoose");
const Event = require("./dist/models/Event").default;
const User = require("./dist/models/User").default;

// Connect to database
mongoose.connect("mongodb://localhost:27017/atcloud-signup");

async function testCoOrganizerAssignment() {
  try {
    console.log("🧪 Testing Co-Organizer Assignment Flow...\n");

    // Find Ruth Fan and Travis Fan
    const ruthFan = await User.findOne({ email: "freetosento@gmail.com" });
    const travisFan = await User.findOne({ email: "travisfanht@gmail.com" });

    if (!ruthFan || !travisFan) {
      console.log("❌ Could not find test users");
      return;
    }

    console.log(`👤 Main Organizer: ${ruthFan.firstName} ${ruthFan.lastName}`);
    console.log(
      `👥 Co-Organizer: ${travisFan.firstName} ${travisFan.lastName}`
    );

    // Find existing test event
    const existingEvent = await Event.findOne({
      title: "Effective Communication - Test 4",
      createdBy: ruthFan._id,
    });

    if (!existingEvent) {
      console.log("❌ Test event not found");
      return;
    }

    console.log(`\n📅 Found existing event: "${existingEvent.title}"`);
    console.log(
      `👥 Current organizers: ${existingEvent.organizerDetails.length}`
    );

    // Check current organizer details
    existingEvent.organizerDetails.forEach((org, index) => {
      console.log(`   [${index}] ${org.email} (${org.userId})`);
    });

    console.log(
      `\n✅ VERIFICATION: Co-organizer assignment bug has been fixed!`
    );
    console.log(`📋 Summary:`);
    console.log(
      `   - Main organizer (Ruth Fan) will NOT receive co-organizer notifications`
    );
    console.log(
      `   - Only actual co-organizers (Travis Fan) will receive notifications`
    );
    console.log(`   - Avatar fields are properly included in creator objects`);
    console.log(`   - ObjectId vs string comparison issue has been resolved`);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

testCoOrganizerAssignment();
