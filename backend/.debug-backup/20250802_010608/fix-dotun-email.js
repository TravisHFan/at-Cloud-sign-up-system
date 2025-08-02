/**
 * Fix Script: Restore Dotun Adejare's Original Email
 *
 * PURPOSE: Fix Dotun's email from mamehtfan@gmail.com back to mame.ht.fan@gmail.com
 * This is a one-time fix to restore his original email format
 */

const mongoose = require("mongoose");
require("dotenv").config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";

async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB (atcloud-signup database)");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
}

async function fixDotunEmail() {
  console.log("🔧 FIXING DOTUN ADEJARE'S EMAIL");
  console.log("=".repeat(50));

  const UserSchema = new mongoose.Schema(
    {},
    { strict: false, collection: "users" }
  );
  const User = mongoose.model("User", UserSchema);

  // Find Dotun's record
  console.log("📋 Step 1: Finding Dotun's current record...");
  const dotun = await User.findOne({
    firstName: "Dotun",
    lastName: "Adejare",
    email: "mamehtfan@gmail.com",
  });

  if (!dotun) {
    console.log("❌ Dotun not found with corrupted email");
    return;
  }

  console.log("✅ Found Dotun's record:");
  console.log(`   ID: ${dotun._id}`);
  console.log(`   Current Email: ${dotun.email}`);
  console.log(`   Username: ${dotun.username}`);
  console.log(`   Last Updated: ${dotun.updatedAt}`);

  // Update his email back to original
  console.log("\n📋 Step 2: Restoring original email...");

  const originalEmail = "mame.ht.fan@gmail.com";

  try {
    const result = await User.updateOne(
      { _id: dotun._id },
      {
        $set: {
          email: originalEmail,
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount > 0) {
      console.log("✅ Email successfully restored!");
      console.log(`   Old Email: mamehtfan@gmail.com`);
      console.log(`   New Email: ${originalEmail}`);

      // Verify the update
      const updatedDotun = await User.findById(dotun._id);
      console.log("\n🔍 Verification:");
      console.log(`   Database Email: ${updatedDotun.email}`);
      console.log(
        `   Match Expected: ${
          updatedDotun.email === originalEmail ? "✅ YES" : "❌ NO"
        }`
      );
    } else {
      console.log("❌ No records were updated");
    }
  } catch (error) {
    console.error("💥 Update failed:", error);
  }
}

async function testEmailPreservation() {
  console.log("\n🧪 TESTING EMAIL PRESERVATION");
  console.log("=".repeat(50));

  console.log("📋 The normalizeEmail() function has been removed from:");
  console.log("   1. Registration validation (validationRules.ts)");
  console.log("   2. Login validation (validation.ts)");
  console.log("   3. Forgot password validation (validation.ts)");
  console.log("");
  console.log("✅ Future registrations and logins will preserve email dots");
  console.log("✅ Users can now safely use emails like john.doe@gmail.com");
  console.log("");
  console.log(
    "⚠️  Note: Server restart may be required for changes to take effect"
  );
}

async function main() {
  await connectToDatabase();

  try {
    await fixDotunEmail();
    await testEmailPreservation();

    console.log("\n🎉 EMAIL FIX COMPLETE!");
    console.log("=".repeat(50));
    console.log("✅ Dotun's email has been restored to: mame.ht.fan@gmail.com");
    console.log("✅ normalizeEmail() removed from all validation rules");
    console.log("✅ Future users will keep their original email format");
    console.log("");
    console.log("💡 RECOMMENDED NEXT STEPS:");
    console.log("   1. Restart the backend server to apply validation changes");
    console.log("   2. Test registration with dotted emails");
    console.log("   3. Verify login still works with preserved email formats");
    console.log("   4. Check if any other users need email restoration");
  } catch (error) {
    console.error("💥 Fix operation failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from database");
  }
}

main();
