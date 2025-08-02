require("dotenv").config();
const mongoose = require("mongoose");

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup"
    );
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
};

// Registration schema
const registrationSchema = new mongoose.Schema(
  {
    eventId: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
    status: String,
    userSnapshot: {
      firstName: String,
      lastName: String,
      email: String,
    },
  },
  { collection: "registrations" }
);

const Registration = mongoose.model("Registration", registrationSchema);

async function fixRegistrationStatuses() {
  await connectDB();

  console.log("\n🔧 FIXING REGISTRATION STATUSES");
  console.log(
    'Changing all "active" registrations to "approved" for testing...'
  );

  const result = await Registration.updateMany(
    { status: "active" },
    { status: "approved" }
  );

  console.log(
    `✅ Updated ${result.modifiedCount} registrations from "active" to "approved"`
  );

  // Verify the change
  const approvedRegistrations = await Registration.find({ status: "approved" });
  console.log("\n📋 Current approved registrations:");
  approvedRegistrations.forEach((reg, index) => {
    console.log(
      `${index + 1}. EventId: ${reg.eventId}, User: ${
        reg.userSnapshot?.firstName
      } ${reg.userSnapshot?.lastName} (${reg.userSnapshot?.email})`
    );
  });

  mongoose.disconnect();
  console.log("\n✅ Fix complete! Now test the reminder system again.");
}

fixRegistrationStatuses().catch((error) => {
  console.error("🚨 Error:", error);
  mongoose.disconnect();
});
