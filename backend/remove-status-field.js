const mongoose = require("mongoose");

// Connect to the database
mongoose.connect("mongodb://localhost:27017/atcloud-signup");

mongoose.connection.once("open", async () => {
  try {
    const Registration = mongoose.model(
      "Registration",
      new mongoose.Schema({}, { strict: false })
    );

    console.log("🗑️  REMOVING STATUS FIELD FROM ALL REGISTRATIONS");
    console.log("===============================================");

    // Check current registrations
    const allRegistrations = await Registration.find({});
    console.log(`📊 Found ${allRegistrations.length} total registrations`);

    // Show status distribution before removal
    const statusCounts = await Registration.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    console.log("\n📊 STATUS DISTRIBUTION (before removal):");
    statusCounts.forEach((item) => {
      console.log(`  ${item._id || "undefined"}: ${item.count} registrations`);
    });

    // Remove status field from all registrations
    const removeResult = await Registration.updateMany(
      {},
      { $unset: { status: "" } }
    );

    console.log(`\n✅ STATUS FIELD REMOVAL COMPLETE:`);
    console.log(`  Modified ${removeResult.modifiedCount} registrations`);

    // Verify removal
    const registrationsWithStatus = await Registration.find({
      status: { $exists: true },
    });
    console.log(
      `\n🔍 VERIFICATION: ${registrationsWithStatus.length} registrations still have status field`
    );

    // Show Hunter Liang's registrations
    console.log("\n🎯 HUNTER LIANG'S REGISTRATIONS (after status removal):");
    const hunterRegistrations = await Registration.find({
      userId: "688dbc1fed3d49cf9bb2cb49",
    }).populate("eventId");

    hunterRegistrations.forEach((reg) => {
      console.log(`  - ${reg.eventId?.title}: ${reg.status || "NO STATUS"}`);
    });

    mongoose.connection.close();
  } catch (error) {
    console.error("Error:", error);
    mongoose.connection.close();
  }
});
