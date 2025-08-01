const mongoose = require("mongoose");

async function updateTestToken() {
  try {
    // Connect to the correct database
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to MongoDB (atcloud-signup database)");

    const userCollection = mongoose.connection.collection("users");

    // Update user with known test token
    const testTokenHash =
      "f61bb7cd2f0d776ea6729b16f3a435d42284ff5b2180876404babefd209bb570";

    const result = await userCollection.updateOne(
      { email: "debug@test.com" },
      {
        $set: {
          passwordChangeToken: testTokenHash,
          passwordChangeExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        },
      }
    );

    console.log(
      "✅ Updated user with test token:",
      result.modifiedCount,
      "user(s) updated"
    );
    console.log("🔑 Test token (raw): test-password-change-token-123");
    console.log("🔒 Test token (hashed):", testTokenHash);

    // Verify the update
    const user = await userCollection.findOne({ email: "debug@test.com" });
    console.log(
      "✅ Verification - Token updated:",
      user.passwordChangeToken === testTokenHash
    );
    console.log("📅 Token expires:", user.passwordChangeExpires);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

updateTestToken();
