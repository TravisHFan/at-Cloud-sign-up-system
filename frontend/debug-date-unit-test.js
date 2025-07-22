/**
 * Comprehensive Date Bug Unit Test
 * This test will help us identify exactly where the timezone conversion occurs
 */

// Test Environment Setup
console.log("=== DATE BUG INVESTIGATION ===");
console.log("Current Date:", new Date().toString());
console.log("Timezone Offset (minutes):", new Date().getTimezoneOffset());
console.log(
  "Local Timezone:",
  Intl.DateTimeFormat().resolvedOptions().timeZone
);
console.log("");

// Test Input: Tomorrow's date (what user would select)
const TEST_DATE = "2025-07-23";
console.log("🧪 TEST INPUT:", TEST_DATE);
console.log("");

// === Test 1: Raw HTML Date Input Behavior ===
console.log("--- Test 1: HTML Date Input Simulation ---");
const mockInputValue = TEST_DATE;
console.log("Input value from date picker:", mockInputValue);
console.log("Type of input value:", typeof mockInputValue);
console.log("");

// === Test 2: Date Object Creation (The Suspect) ===
console.log("--- Test 2: Date Object Creation ---");
const dateFromString = new Date(TEST_DATE);
console.log("new Date('" + TEST_DATE + "'):", dateFromString.toString());
console.log("date.getFullYear():", dateFromString.getFullYear());
console.log("date.getMonth():", dateFromString.getMonth()); // 0-based!
console.log("date.getDate():", dateFromString.getDate());
console.log("date.toISOString():", dateFromString.toISOString());
console.log(
  "date.toISOString().split('T')[0]:",
  dateFromString.toISOString().split("T")[0]
);
console.log(
  "✅ Original vs Processed:",
  TEST_DATE,
  "vs",
  dateFromString.toISOString().split("T")[0]
);
console.log(
  "❌ Date shifted?",
  TEST_DATE !== dateFromString.toISOString().split("T")[0]
);
console.log("");

// === Test 3: Different Time Additions ===
console.log("--- Test 3: Date with Different Times ---");
const dateWithMidnight = new Date(TEST_DATE + "T00:00:00");
const dateWithNoon = new Date(TEST_DATE + "T12:00:00");
const dateWithEndOfDay = new Date(TEST_DATE + "T23:59:59");

console.log("With T00:00:00:", dateWithMidnight.toISOString().split("T")[0]);
console.log("With T12:00:00:", dateWithNoon.toISOString().split("T")[0]);
console.log("With T23:59:59:", dateWithEndOfDay.toISOString().split("T")[0]);
console.log("");

// === Test 4: UTC vs Local Methods ===
console.log("--- Test 4: UTC vs Local Methods ---");
const testDate = new Date(TEST_DATE);
console.log("Local methods:");
console.log("  getFullYear():", testDate.getFullYear());
console.log("  getMonth():", testDate.getMonth());
console.log("  getDate():", testDate.getDate());

console.log("UTC methods:");
console.log("  getUTCFullYear():", testDate.getUTCFullYear());
console.log("  getUTCMonth():", testDate.getUTCMonth());
console.log("  getUTCDate():", testDate.getUTCDate());
console.log("");

// === Test 5: Manual String Parsing (No Date Object) ===
console.log("--- Test 5: Manual String Parsing ---");
function manualParse(dateStr) {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return {
      year: parseInt(year),
      month: parseInt(month) - 1, // Make it 0-based like Date
      day: parseInt(day),
      formatted: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    };
  }
  return null;
}

const manualResult = manualParse(TEST_DATE);
console.log("Manual parsing result:", manualResult);
console.log("");

// === Test 6: Form Data Simulation ===
console.log("--- Test 6: Form Data Simulation ---");
// Simulate what react-hook-form might do
const formData = {
  date: TEST_DATE,
  title: "Test Event",
  time: "10:00",
};

console.log("Form data:", formData);
console.log("Form data.date:", formData.date);
console.log("Type of form data.date:", typeof formData.date);

// Simulate JSON.stringify (what gets sent to API)
const jsonString = JSON.stringify(formData);
console.log("JSON stringified:", jsonString);
const parsed = JSON.parse(jsonString);
console.log("JSON parsed back:", parsed);
console.log("Date preserved in JSON?", formData.date === parsed.date);
console.log("");

// === Test 7: Our Current Functions ===
console.log("--- Test 7: Our Date Functions ---");

// Copy of our functions for testing
function testNormalizeEventDate(dateInput) {
  if (!dateInput) return "";

  const cleanInput = dateInput.trim();
  console.log("  🔍 normalizeEventDate input:", cleanInput);

  const yyyymmddMatch = cleanInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmddMatch) {
    const [, year, month, day] = yyyymmddMatch;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);

    if (
      yearNum >= 1900 &&
      yearNum <= 9999 &&
      monthNum >= 1 &&
      monthNum <= 12 &&
      dayNum >= 1 &&
      dayNum <= 31
    ) {
      console.log(
        "  ✅ normalizeEventDate output (already valid):",
        cleanInput
      );
      return cleanInput;
    }
  }

  return cleanInput;
}

function testHandleDateInputChange(inputValue) {
  if (!inputValue) return "";

  console.log("  📅 Date input change:", inputValue);

  if (/^\d{4}-\d{2}-\d{2}$/.test(inputValue)) {
    console.log("  ✅ Date input preserved:", inputValue);
    return inputValue;
  }

  const normalized = testNormalizeEventDate(inputValue);
  console.log("  🔄 Date input normalized:", normalized);
  return normalized;
}

const handleResult = testHandleDateInputChange(TEST_DATE);
const normalizeResult = testNormalizeEventDate(TEST_DATE);

console.log("handleDateInputChange result:", handleResult);
console.log("normalizeEventDate result:", normalizeResult);
console.log("");

// === Test 8: Browser Specifics ===
console.log("--- Test 8: Browser Environment ---");
console.log("User Agent:", navigator.userAgent);
console.log("Platform:", navigator.platform);
console.log("Language:", navigator.language);
console.log("");

// === FINAL ANALYSIS ===
console.log("=== FINAL ANALYSIS ===");
console.log("❌ PROBLEMATIC CONVERSION:");
console.log("   Input: " + TEST_DATE);
console.log(
  "   new Date(input).toISOString().split('T')[0]: " +
    new Date(TEST_DATE).toISOString().split("T")[0]
);
console.log(
  "   Issue: " +
    (TEST_DATE !== new Date(TEST_DATE).toISOString().split("T")[0]
      ? "YES - DATE SHIFTED!"
      : "No")
);
console.log("");
console.log("✅ SAFE CONVERSIONS:");
console.log(
  "   Manual parsing: " + (manualResult ? manualResult.formatted : "FAILED")
);
console.log("   Our functions: " + handleResult);
console.log("   Direct passthrough: " + TEST_DATE);
console.log("");

// === RECOMMENDATION ===
if (TEST_DATE !== new Date(TEST_DATE).toISOString().split("T")[0]) {
  console.log("🚨 RECOMMENDATION:");
  console.log(
    "   The issue is confirmed: new Date(dateString) causes timezone shift"
  );
  console.log("   Solution: Never use Date constructor with date-only strings");
  console.log(
    "   Instead: Use direct string manipulation or add explicit time"
  );
} else {
  console.log("🤔 INVESTIGATION NEEDED:");
  console.log("   Date conversion works in this environment");
  console.log(
    "   Issue might be in form handling or specific browser/timezone"
  );
}
