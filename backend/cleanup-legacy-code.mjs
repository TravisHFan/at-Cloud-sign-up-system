#!/usr/bin/env node

/**
 * Legacy Code Cleanup Script
 *
 * This script removes all legacy notification code that could cause duplicates:
 * 1. Remove compiled legacy controllers from dist/
 * 2. Clean up any test files referencing legacy systems
 * 3. Remove any remaining legacy notification references
 * 4. Verify the unified system is the only remaining system
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🧹 === LEGACY CODE CLEANUP ===\n");

// Files and directories to remove
const itemsToRemove = [
  // Compiled legacy controllers
  "dist/controllers/systemMessageController.js",
  "dist/controllers/systemMessageController.d.ts",
  "dist/controllers/systemMessageController.js.map",
  "dist/controllers/systemMessageController.d.ts.map",
  "dist/controllers/systemMessageController-OLD.js",
  "dist/controllers/systemMessageController-OLD.d.ts",
  "dist/controllers/systemMessageController-OLD.js.map",
  "dist/controllers/systemMessageController-OLD.d.ts.map",
  "dist/controllers/userNotificationController.js",
  "dist/controllers/userNotificationController.d.ts",
  "dist/controllers/userNotificationController.js.map",
  "dist/controllers/userNotificationController.d.ts.map",
  "dist/controllers/userNotificationController-OLD.js",
  "dist/controllers/userNotificationController-OLD.d.ts",
  "dist/controllers/userNotificationController-OLD.js.map",
  "dist/controllers/userNotificationController-OLD.d.ts.map",

  // Legacy test files that reference old systems
  "tests/legacy/bell-notification-issues-debug.test.ts",
  "tests/legacy/dual-origin-notification-investigation.test.ts",
  "tests/legacy/dual-storage-notification-problem.test.ts",
  "tests/legacy/notification-data-unification.test.ts",
  "tests/legacy/duplicate-notification-prevention.test.ts",
  "tests/legacy/complete-notification-unification.test.ts",
  "tests/legacy/redundant-system-cleanup-verification.test.ts",
  "tests/legacy/bell-delete-investigation.test.ts",
  "tests/legacy/bell-state-investigation.test.ts",
  "tests/legacy/bell-notification-complete-solution.test.ts",
  "tests/legacy/bell-notification-issues-debug.test.ts",
  "tests/legacy/verify-all-bell-notification-fixes.test.ts",
  "tests/legacy/final-bell-notification-verification.test.ts",
  "tests/legacy/send-to-all-debug.test.ts",
  "tests/legacy/diagnose-sendtoall.test.ts",
];

let removedCount = 0;
let notFoundCount = 0;

console.log("🗑️  Removing legacy files...\n");

itemsToRemove.forEach((item) => {
  const fullPath = path.join(__dirname, item);

  try {
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`   ✅ Removed directory: ${item}`);
      } else {
        fs.unlinkSync(fullPath);
        console.log(`   ✅ Removed file: ${item}`);
      }
      removedCount++;
    } else {
      console.log(`   ℹ️  Not found (already removed): ${item}`);
      notFoundCount++;
    }
  } catch (error) {
    console.log(`   ❌ Error removing ${item}: ${error.message}`);
  }
});

console.log(`\n📊 Cleanup summary:`);
console.log(`   - Files removed: ${removedCount}`);
console.log(`   - Files not found: ${notFoundCount}`);

// Check for any remaining SystemMessage references in source code
console.log("\n🔍 Checking for remaining legacy references...");

function searchInFile(filePath, searchTerm) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return content.includes(searchTerm);
  } catch (error) {
    return false;
  }
}

function findFiles(dir, extension) {
  const files = [];

  function scan(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);

      items.forEach((item) => {
        const fullPath = path.join(currentDir, item);
        const stats = fs.statSync(fullPath);

        if (
          stats.isDirectory() &&
          !item.startsWith(".") &&
          item !== "node_modules" &&
          item !== "dist"
        ) {
          scan(fullPath);
        } else if (stats.isFile() && item.endsWith(extension)) {
          files.push(fullPath);
        }
      });
    } catch (error) {
      // Ignore permission errors
    }
  }

  scan(dir);
  return files;
}

const sourceFiles = [
  ...findFiles(path.join(__dirname, "src"), ".ts"),
  ...findFiles(path.join(__dirname, "src"), ".js"),
];

const suspiciousTerms = [
  "SystemMessageController",
  "UserNotificationController",
  "NotificationService.sendBellNotificationToUser",
  "NotificationService.broadcastSystemMessage",
  "bellNotificationStates",
  "systemMessageStates",
];

let suspiciousReferences = [];

sourceFiles.forEach((file) => {
  suspiciousTerms.forEach((term) => {
    if (searchInFile(file, term)) {
      const relativePath = path.relative(__dirname, file);
      suspiciousReferences.push({ file: relativePath, term });
    }
  });
});

if (suspiciousReferences.length > 0) {
  console.log("\n⚠️  Found potentially problematic references:");
  suspiciousReferences.forEach((ref) => {
    console.log(`   - ${ref.file}: "${ref.term}"`);
  });
  console.log("\n🔧 These should be reviewed and possibly removed.");
} else {
  console.log("   ✅ No problematic legacy references found in source code");
}

// Verify unified system components exist
console.log("\n✅ Verifying unified system components...");

const requiredFiles = [
  "src/controllers/unifiedMessageController.ts",
  "src/models/Message.ts",
  "src/routes/systemMessages.ts",
];

let missingRequired = [];

requiredFiles.forEach((file) => {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) {
    missingRequired.push(file);
  } else {
    console.log(`   ✅ ${file} exists`);
  }
});

if (missingRequired.length > 0) {
  console.log("\n❌ Missing required unified system files:");
  missingRequired.forEach((file) => {
    console.log(`   - ${file}`);
  });
} else {
  console.log("\n🎉 All required unified system components are present!");
}

console.log("\n🏁 Legacy cleanup completed!");
console.log("\n📋 Recommendations:");
console.log("   1. Restart the backend server to clear any cached modules");
console.log("   2. Test system message creation in the browser");
console.log("   3. Verify only one notification appears per system message");
console.log("   4. If duplicates still occur, check frontend caching/polling");
