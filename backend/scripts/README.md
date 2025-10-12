# Migration Scripts Documentation

This directory contains database migration scripts for the @Cloud Sign-up System.

## Available Migrations

### 1. Program Labels Migration (programId → programLabels)

**Purpose:** Convert Event model from single program to multiple programs support.

**Files:**

- `migrate-program-to-labels.ts` - Main migration script
- `verify-program-labels.ts` - Verification script

**NPM Commands:**

```bash
# Dry run (test without changes)
npm run migrate:program-labels:dry

# Run actual migration
npm run migrate:program-labels

# Verify migration status
npm run verify:program-labels
```

**Documentation:**

- [Full Migration Guide](../../docs/MIGRATION_PROGRAM_LABELS.md)
- [Quick Reference](../../docs/MIGRATION_QUICK_GUIDE.md)

## General Guidelines

### Before Running Any Migration

1. ✅ **Backup database** - Always backup before migration
2. ✅ **Run dry-run first** - Test migration without changes
3. ✅ **Test on staging** - Run on staging/snapshot environment
4. ✅ **Read documentation** - Review migration guide
5. ✅ **Plan rollback** - Know how to revert if needed

### During Migration

1. Monitor progress and error messages
2. Don't interrupt the migration process
3. Check for errors in output
4. Verify migration summary

### After Migration

1. Verify data integrity
2. Test application functionality
3. Monitor logs for errors
4. Keep backup for 1-2 weeks

## Production Deployment

### Quick Steps

```bash
# 1. Backup database (use MongoDB Atlas UI or mongodump)
mongodump --uri="$MONGODB_URI" --out=/backups/pre-migration-$(date +%Y%m%d)

# 2. Deploy new code
git push production main

# 3. SSH into production server
ssh user@production-server

# 4. Navigate to backend
cd /app/backend

# 5. Run dry-run first
npm run migrate:program-labels:dry

# 6. Review output carefully

# 7. Run actual migration
npm run migrate:program-labels
# Type "MIGRATE" when prompted

# 8. Verify success
npm run verify:program-labels

# 9. Test application
# Create/edit events, filter by program, etc.
```

### Production Safety Features

- **Confirmation prompt** - Requires typing "MIGRATE" in production
- **Environment display** - Shows which database you're connecting to
- **Dry-run mode** - Test without changes
- **Idempotent** - Safe to run multiple times
- **Error handling** - Catches and reports errors
- **Detailed logging** - Shows every event processed

## Troubleshooting

### Migration Fails

```bash
# Check error message
# Fix the issue
# Re-run migration (it's idempotent)
npm run migrate:program-labels
```

### Need to Verify Status

```bash
# Run verification script
npm run verify:program-labels

# Shows:
# - Total events
# - Migrated count
# - Events needing migration
# - Any inconsistencies
```

### Need to Rollback

```bash
# Option 1: Restore from backup
mongorestore --uri="$MONGODB_URI" --drop /path/to/backup

# Option 2: Revert code (if programId still exists)
git revert HEAD
git push production main
```

## Migration Script Structure

### Main Components

1. **Environment Setup**

   - Load .env variables
   - Connect to database
   - Display environment info

2. **Migration Logic**

   - Find all events
   - Transform data
   - Update database
   - Handle errors

3. **Reporting**

   - Show progress
   - Display summary
   - Report errors

4. **Safety Features**
   - Dry-run mode
   - Production confirmation
   - Error handling
   - Idempotent design

## Writing New Migrations

### Template

```typescript
#!/usr/bin/env ts-node
import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";
import { connectDatabase } from "../src/models/index";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function migrate(dryRun: boolean = false): Promise<void> {
  try {
    console.log("🚀 Starting migration: [Name]");
    console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

    // Your migration logic here

    console.log("✅ Migration complete!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const dryRun = args.includes("--dry-run");

    await connectDatabase();
    await migrate(dryRun);
    await mongoose.connection.close();

    process.exit(0);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
```

### Best Practices

1. ✅ Always support dry-run mode
2. ✅ Add production confirmation for destructive operations
3. ✅ Make migrations idempotent (safe to run multiple times)
4. ✅ Log detailed progress
5. ✅ Handle errors gracefully
6. ✅ Provide clear summary at end
7. ✅ Test on development/staging first
8. ✅ Document in docs/ directory

## Support

For questions or issues:

1. Check migration documentation in docs/
2. Review script output and error messages
3. Contact migration owner
4. Check application logs

## History

| Date       | Migration                 | Status      |
| ---------- | ------------------------- | ----------- |
| 2025-10-12 | programId → programLabels | ✅ Complete |
