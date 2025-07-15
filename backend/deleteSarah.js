const mongoose = require("mongoose");

async function deleteSarahUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to MongoDB");

    // Delete the user
    const result = await mongoose.connection.db
      .collection("users")
      .deleteOne({ email: "sarah@atcloud.com" });
    console.log(
      `🗑️ Deleted ${result.deletedCount} user(s) with email sarah@atcloud.com`
    );
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("📂 Database connection closed");
    process.exit(0);
  }
}

deleteSarahUser();
