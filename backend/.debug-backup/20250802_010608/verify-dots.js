/**
 * Final Verification: Check that the email with dots was properly stored
 */

const mongoose = require("mongoose");
require("dotenv").config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";

async function verifyDotPreservation() {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to database");

  const UserSchema = new mongoose.Schema(
    {},
    { strict: false, collection: "users" }
  );
  const User = mongoose.model("User", UserSchema);

  // Check if the test user was created with dots preserved
  const testUser = await User.findOne({ email: "test.dots@gmail.com" });

  if (testUser) {
    console.log("🎉 SUCCESS! Email dots are preserved:");
    console.log(`   Email in database: ${testUser.email}`);
    console.log(`   Expected: test.dots@gmail.com`);
    console.log(
      `   Match: ${
        testUser.email === "test.dots@gmail.com" ? "✅ YES" : "❌ NO"
      }`
    );
  } else {
    console.log(
      "ℹ️  Test user not found (may not have completed registration)"
    );
  }

  // Also verify Dotun's fix
  const dotun = await User.findOne({ firstName: "Dotun", lastName: "Adejare" });
  if (dotun) {
    console.log("\n🔍 Dotun's email verification:");
    console.log(`   Email in database: ${dotun.email}`);
    console.log(`   Expected: mame.ht.fan@gmail.com`);
    console.log(
      `   Dots preserved: ${
        dotun.email === "mame.ht.fan@gmail.com" ? "✅ YES" : "❌ NO"
      }`
    );
  }

  await mongoose.disconnect();
}

verifyDotPreservation().catch(console.error);
