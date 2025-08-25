import mongoose from "mongoose";
import dotenv from "dotenv";
import GuestRegistration from "../../models/GuestRegistration";

// Load env
dotenv.config();

async function main() {
  const mongoUri =
    process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  const count = await GuestRegistration.countDocuments({ status: "cancelled" });
  if (count === 0) {
    console.log("No cancelled guest registrations to purge.");
    await mongoose.disconnect();
    return;
  }

  const res = await GuestRegistration.deleteMany({ status: "cancelled" });
  console.log(
    `Deleted ${res.deletedCount || 0} cancelled guest registrations.`
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Purge failed:", err);
  process.exitCode = 1;
});
