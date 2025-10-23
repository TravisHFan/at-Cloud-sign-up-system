# Quick Production Migration Guide

## 🚀 PRODUCTION DEPLOYMENT CHECKLIST

### Before You Start

✅ Read full migration guide: [MIGRATION_PROGRAM_LABELS.md](./MIGRATION_PROGRAM_LABELS.md)  
✅ Have database backup access ready  
✅ Have rollback plan ready  
✅ Schedule maintenance window (optional, but recommended)

---

## Step-by-Step Commands

### 1. Backup Database (CRITICAL!)

```bash
# MongoDB Atlas (recommended)
# Use Atlas UI: Clusters → Backup → On-Demand Snapshot

# Or via mongodump
mongodump --uri="$MONGODB_URI" --out=/backups/pre-migration-$(date +%Y%m%d-%H%M%S)
```

### 2. Deploy New Code

```bash
# Push to production branch
git push production main

# Or trigger deployment via hosting platform (Render, Heroku, etc.)
```

### 3. Access Production Server

Choose your method:

```bash
# Render.com Shell
# Go to Render Dashboard → Service → Shell

# Docker
docker exec -it backend-container /bin/bash

# SSH
ssh user@production-server

# Kubernetes
kubectl exec -it backend-pod-xxx -- /bin/bash
```

### 4. Run Migration

```bash
# Navigate to backend directory
cd backend  # or /app/backend depending on setup

# DRY RUN FIRST (always!)
npm run migrate:program-labels:dry

# Review output carefully - look for:
# - Total events count
# - Events with programId
# - Any errors

# If dry run looks good, run actual migration
npm run migrate:program-labels

# You'll see confirmation prompt in production:
# Type "MIGRATE" to continue
```

### 5. Verify Success

```bash
# Check migration output
# Should show:
# - "✅ Migration complete!"
# - Events updated count
# - 0 errors

# Test application immediately
# - Create a new event
# - Edit an existing event
# - Filter events by program
```

---

## Expected Output

### Dry Run

```
🔌 Connecting to database...
📍 Environment: production
📍 Database: atcloud-signup
✅ Database connected
🚀 Starting migration: programId → programLabels
Mode: DRY RUN (no changes)
────────────────────────────────────────────────────────────
📊 Found X events to process
...
✅ Dry run complete. No changes made.
```

### Actual Migration

```
⚠️  WARNING: Running migration in PRODUCTION mode!
⚠️  This will modify the production database.
⚠️  Ensure you have backed up the database before proceeding.

Type "MIGRATE" to continue, or anything else to abort: MIGRATE
✅ Proceeding with production migration...

🔌 Connecting to database...
✅ Database connected
🚀 Starting migration: programId → programLabels
Mode: LIVE (will update)
────────────────────────────────────────────────────────────
📊 Found X events to process
...
✅ Migration complete!
```

---

## Troubleshooting

### Migration Fails

1. Check error message
2. Don't panic - programId field is still there
3. Fix the issue
4. Re-run migration (it's idempotent)

### Need to Rollback

```bash
# Restore from backup
mongorestore --uri="$MONGODB_URI" --drop /backups/pre-migration-YYYYMMDD-HHMMSS/

# Revert code deployment
git revert HEAD
git push production main
```

### Can't Access Shell

```bash
# Run from local machine (ensure IP whitelisted)
export MONGODB_URI="your-production-uri"
export NODE_ENV=production
npm run migrate:program-labels:dry
npm run migrate:program-labels
```

---

## Timeline

- **Backup**: 5-30 minutes
- **Deploy**: 5-15 minutes
- **Migration**: 1-10 minutes
- **Verification**: 10-30 minutes
- **Total**: ~1 hour

---

## Emergency Contacts

**Migration Owner:** [Your Name]  
**Date:** 2025-10-12  
**Support:** [Your Email/Slack]

---

## Common Mistakes to Avoid

❌ Forgetting to backup database  
❌ Not running dry-run first  
❌ Not verifying deployment before migration  
❌ Not testing application after migration  
❌ Running on wrong database

✅ Always backup first  
✅ Always dry-run first  
✅ Always verify database name  
✅ Always test after migration  
✅ Always monitor logs

---

## Post-Migration Monitoring

```bash
# Check logs for errors
tail -f /var/log/app.log

# Monitor API endpoints
curl https://your-api.com/api/events
curl https://your-api.com/api/programs

# Check database
mongo "$MONGODB_URI"
db.events.find({ programLabels: { $exists: true } }).count()
```

---

## Success Criteria

✅ Migration completes with 0 errors  
✅ All events have programLabels field  
✅ Events with programId have programLabels populated  
✅ Application loads without errors  
✅ Can create new events  
✅ Can edit existing events  
✅ Can filter by program

---

## Need Help?

1. Check [MIGRATION_PROGRAM_LABELS.md](./MIGRATION_PROGRAM_LABELS.md)
2. Review error messages in migration output
3. Check application logs
4. Contact migration owner
