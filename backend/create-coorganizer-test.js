const fs = require("fs");

// Read the existing test file
const testFile = fs.readFileSync("./test-atcloud-role-change.js", "utf8");

// Create a modified version for co-organizer testing
const coOrganizerTestContent = testFile
  .replace(
    "const { atCloudRoleChangeTest } = require('./atcloud-functionality-demo');",
    "const { coOrganizerAssignmentTest } = require('./atcloud-functionality-demo');"
  )
  .replace("atCloudRoleChangeTest();", "coOrganizerAssignmentTest();")
  .replace("atcloud-role-change.js", "test-coorganizer-assignment.js");

// Write the new test file
fs.writeFileSync("./test-coorganizer-assignment.js", coOrganizerTestContent);

console.log("✅ Created test-coorganizer-assignment.js");
console.log(
  "📝 You can run this to test co-organizer assignment notifications"
);
