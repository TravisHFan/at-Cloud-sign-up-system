const fs = require("fs");
const path = require("path");

function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, "utf8");
    let modified = false;

    // Replace type: "Workshop" with type: "Effective Communication Workshop"
    const replacements = [
      {
        from: /type:\s*["']Workshop["']/g,
        to: 'type: "Effective Communication Workshop"',
      },
      {
        from: /type.*["']Workshop["']/g,
        to: 'type: "Effective Communication Workshop"',
      },
    ];

    replacements.forEach((replacement) => {
      if (replacement.from.test(content)) {
        content = content.replace(replacement.from, replacement.to);
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`Updated: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message);
  }
}

// Update the main test file
updateFile(
  "/Users/dr.hunter/CS Projects/at-Cloud-sign-up-system/backend/tests/unit/controllers/eventController.test.ts"
);

console.log("Test type fixes complete!");
