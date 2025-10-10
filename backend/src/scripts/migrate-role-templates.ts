#!/usr/bin/env ts-node
/**
 * Migration Script: Hardcoded Role Templates to Database - DEPRECATED
 *
 * NOTE: This script is no longer needed as we have removed hardcoded templates.
 * All templates should be created directly in the database via the admin UI.
 * This file is kept for historical reference only.
 */

async function migrateRoleTemplates() {
  console.log("❌ This migration script is deprecated.");
  console.log("Hardcoded templates have been removed from the codebase.");
  console.log("Please create templates directly in the database via the admin UI.");
  process.exit(1);
}

// Run if executed directly
if (require.main === module) {
  void migrateRoleTemplates();
}

export default migrateRoleTemplates;
