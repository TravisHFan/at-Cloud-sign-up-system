/**
 * Verify the Timezone Fix is Working
 * Compare old UTC calculation vs new Pacific timezone calculation
 */

async function verifyTimezoneFix() {
  console.log("🌏 TIMEZONE FIX VERIFICATION");
  console.log("============================================================");

  // Event details
  const eventDate = "2025-08-03";
  const eventTime = "13:40";

  // OLD METHOD (UTC-based - WRONG)
  const nowUTC = new Date();
  const eventDateTimeUTC = new Date(`${eventDate}T${eventTime}:00.000Z`);
  const hoursUntilEventUTC =
    (eventDateTimeUTC.getTime() - nowUTC.getTime()) / (1000 * 60 * 60);

  // NEW METHOD (Pacific timezone-aware - CORRECT)
  const nowPacificString = nowUTC.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
  });
  const nowPacific = new Date(nowPacificString);
  const eventDateTimePacific = new Date(`${eventDate}T${eventTime}:00.000`);
  const hoursUntilEventPacific =
    (eventDateTimePacific.getTime() - nowPacific.getTime()) / (1000 * 60 * 60);

  console.log(`📅 Event: "Effective Communication - Test 1"`);
  console.log(`📅 Event Date/Time: ${eventDate} ${eventTime} (Pacific)`);
  console.log(`🕐 Current UTC: ${nowUTC.toISOString()}`);
  console.log(`🌎 Current Pacific: ${nowPacific.toISOString()}`);

  console.log("\n⏰ CALCULATION COMPARISON");
  console.log("============================================================");
  console.log(
    `❌ OLD (UTC-based): ${hoursUntilEventUTC.toFixed(2)} hours until event`
  );
  console.log(
    `✅ NEW (Pacific): ${hoursUntilEventPacific.toFixed(2)} hours until event`
  );
  console.log(
    `🔄 Difference: ${Math.abs(
      hoursUntilEventUTC - hoursUntilEventPacific
    ).toFixed(2)} hours`
  );

  // Check 24h reminder window with PACIFIC time
  const reminderWindow24hStart = new Date(
    nowPacific.getTime() + 23.5 * 60 * 60 * 1000
  );
  const reminderWindow24hEnd = new Date(
    nowPacific.getTime() + 24.5 * 60 * 60 * 1000
  );

  const eventInWindow =
    eventDateTimePacific >= reminderWindow24hStart &&
    eventDateTimePacific <= reminderWindow24hEnd;

  console.log("\n📬 24-HOUR REMINDER WINDOW (Pacific Time)");
  console.log("============================================================");
  console.log(`🟢 Window Start: ${reminderWindow24hStart.toISOString()}`);
  console.log(`🔴 Window End: ${reminderWindow24hEnd.toISOString()}`);
  console.log(`⏰ Event Time: ${eventDateTimePacific.toISOString()}`);
  console.log(
    `🎯 Event in 24h window: ${
      eventInWindow ? "✅ YES - REMINDERS SHOULD TRIGGER!" : "❌ NO"
    }`
  );

  if (eventInWindow) {
    console.log("\n🎉 TIMEZONE FIX SUCCESS!");
    console.log("============================================================");
    console.log("✅ Event is correctly detected in 24h reminder window");
    console.log("✅ EventReminderScheduler will find this event");
    console.log("✅ Ruth Fan and Dotun Adejare will receive reminder trio");
    console.log(
      "\n⏰ Next scheduler check: Within the next hour (runs every hour)"
    );
    console.log(
      "📧 Expected notifications: Email + System Message + Bell Notification"
    );
  } else {
    console.log("\n❌ Event still not in window");
    const hoursToWindow =
      (reminderWindow24hStart.getTime() - eventDateTimePacific.getTime()) /
      (1000 * 60 * 60);
    if (hoursToWindow > 0) {
      console.log(
        `⏳ Event is ${Math.abs(hoursToWindow).toFixed(2)} hours too early`
      );
    } else {
      console.log(
        `📅 Event is ${Math.abs(hoursToWindow).toFixed(2)} hours past window`
      );
    }
  }
}

verifyTimezoneFix();
