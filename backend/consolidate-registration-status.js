const mongoose = require("mongoose");

// Connect to the database
mongoose.connect("mongodb://localhost:27017/atcloud-signup");

mongoose.connection.once("open", async () => {
  try {
    const Registration = mongoose.model(
      "Registration",
      new mongoose.Schema({}, { strict: false })
    );

    console.log("🔄 REGISTRATION STATUS CONSOLIDATION");
    console.log("====================================");

    // Check current status distribution
    const statusCounts = await Registration.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    console.log("\n📊 CURRENT STATUS DISTRIBUTION:");
    statusCounts.forEach((item) => {
      console.log(`  ${item._id}: ${item.count} registrations`);
    });

    // Update all active/approved/confirmed to "registered"
    const updateResult = await Registration.updateMany(
      { status: { $in: ["active", "approved", "confirmed"] } },
      { $set: { status: "registered" } }
    );

    console.log(`\n✅ CONSOLIDATION COMPLETE:`);
    console.log(
      `  Updated ${updateResult.modifiedCount} registrations to "registered" status`
    );

    // Check final status distribution
    const finalStatusCounts = await Registration.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    console.log("\n📊 FINAL STATUS DISTRIBUTION:");
    finalStatusCounts.forEach((item) => {
      console.log(`  ${item._id}: ${item.count} registrations`);
    });

    console.log("\n🎯 IMPACT ON HUNTER LIANG:");
    const hunterRegistrations = await Registration.find({
      userId: "688dbc1fed3d49cf9bb2cb49",
    }).populate("eventId");

    hunterRegistrations.forEach((reg) => {
      console.log(`  - ${reg.eventId?.title}: ${reg.status}`);
    });

    mongoose.connection.close();
  } catch (error) {
    console.error("Error:", error);
    mongoose.connection.close();
  }
});
