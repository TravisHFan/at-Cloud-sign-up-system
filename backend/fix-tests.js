#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Mapping of old lowercase types to new Title Case types
const typeMapping = {
  workshop: "Workshop",
  conference: "Conference",
  webinar: "Webinar",
  "mentor circle": "Mentor Circle",
};

// Valid role names from templates
const validRoles = [
  "Zoom Host",
  "Zoom Co-host",
  "Spiritual Cover",
  "Main Mentor",
  "Co-coach",
  "Group A Leader",
  "Group A Participants",
  "Group B Leader",
  "Group B Participants",
  "Group C Leader",
  "Group C Participants",
  "Group D Leader",
  "Group D Participants",
  "Group E Leader",
  "Group E Participants",
  "Group F Leader",
  "Group F Participants",
];

// Role capacity mapping (max allowed per template)
const roleCapacities = {
  "Zoom Host": 1,
  "Zoom Co-host": 1,
  "Spiritual Cover": 1,
  "Main Mentor": 1,
  "Co-coach": 2,
  "Group A Leader": 1,
  "Group A Participants": 3,
  "Group B Leader": 1,
  "Group B Participants": 3,
  "Group C Leader": 1,
  "Group C Participants": 3,
  "Group D Leader": 1,
  "Group D Participants": 3,
  "Group E Leader": 1,
  "Group E Participants": 3,
  "Group F Leader": 1,
  "Group F Participants": 3,
};

function fixTestFile(filePath) {
  console.log(`Fixing ${filePath}...`);

  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;

  // Fix type mappings
  Object.entries(typeMapping).forEach(([oldType, newType]) => {
    const regex = new RegExp(`type:\\s*["']${oldType}["']`, "g");
    if (content.match(regex)) {
      content = content.replace(regex, `type: "${newType}"`);
      changed = true;
      console.log(`  Fixed type: ${oldType} -> ${newType}`);
    }
  });

  // Fix role names - replace common invalid ones
  const invalidRoles = [
    "Participant",
    "Volunteer",
    "Organizer",
    "Helper",
    "Speaker",
  ];
  invalidRoles.forEach((invalidRole) => {
    const regex = new RegExp(`name:\\s*["']${invalidRole}["']`, "g");
    if (content.match(regex)) {
      content = content.replace(regex, `name: "Zoom Host"`);
      changed = true;
      console.log(`  Fixed role: ${invalidRole} -> Zoom Host`);
    }
  });

  // Fix maxParticipants to be within valid ranges
  const maxParticipantsRegex = /maxParticipants:\s*(\d+)/g;
  content = content.replace(maxParticipantsRegex, (match, num) => {
    const value = parseInt(num);
    if (value > 3) {
      changed = true;
      console.log(`  Fixed maxParticipants: ${value} -> 1`);
      return "maxParticipants: 1";
    }
    if (value === 0) {
      changed = true;
      console.log(`  Fixed maxParticipants: 0 -> 1`);
      return "maxParticipants: 1";
    }
    return match;
  });

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`  ✅ Updated ${filePath}`);
  } else {
    console.log(`  ⏭️  No changes needed for ${filePath}`);
  }
}

// Find and fix all eventController test files
const testDir = path.join(__dirname, "tests", "unit", "controllers");
const eventControllerTestFile = path.join(testDir, "eventController.test.ts");

if (fs.existsSync(eventControllerTestFile)) {
  fixTestFile(eventControllerTestFile);
} else {
  console.log("Event controller test file not found");
}

console.log("Test fixing complete!");
