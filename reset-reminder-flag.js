const { MongoClient } = require("mongodb");

async function resetReminderFlag() {
  console.log("🔄 Resetting reminder flag for automatic test");
  console.log("=".repeat(50));

  const client = new MongoClient("mongodb://localhost:27017");

  try {
    await client.connect();
    const db = client.db("atcloud-signup");
    const eventsCollection = db.collection("events");

    // Reset the reminder flag so the scheduler will process it again
    const result = await eventsCollection.updateOne(
      { _id: "688e9531554b937c9c2707a3" },
      { $unset: { reminder24hSent: "" } }
    );

    console.log("📊 Reset result:", result);
    console.log(
      "✅ Reminder flag reset - EventReminderScheduler will process this event again"
    );
  } catch (error) {
    console.error("❌ Error resetting reminder flag:", error);
  } finally {
    await client.close();
  }
}

// Run the reset
resetReminderFlag();
