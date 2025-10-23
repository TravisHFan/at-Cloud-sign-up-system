# Migration Guide: programId → programLabels

**Date:** 2025-10-12  
**Migration:** Convert Event.programId to Event.programLabels array  
**Status:** ✅ Tested in development

---

## Overview

This migration converts the Event model from using a single `programId` field to a `programLabels` array, enabling events to be associated with multiple programs.

### Changes:

- **Added:** `programLabels: ObjectId[]` - Array of program IDs
- **Removed:** `mentorCircle` field (EMBA specific)
- **Removed:** `mentors` field (snapshot of program mentors)
- **Deprecated:** `programId` (kept temporarily for rollback safety)

### Transformation Logic:

```javascript
if (event.programId) {
  event.programLabels = [event.programId];
} else {
  event.programLabels = [];
}
```

---

## Development Results

✅ Successfully tested on development database:

- **Total events:** 3
- **Events updated:** 2
- **Events skipped:** 1 (no programId)
- **Errors:** 0

---

## Production Deployment Plan

### Phase 1: Pre-Deployment (Before Code Deploy)

#### Step 1: Backup Production Database

```bash
# SSH into production server (or use MongoDB Atlas backup)
mongodump --uri="$MONGODB_URI" --out=/backups/pre-program-labels-migration-$(date +%Y%m%d-%H%M%S)

# Verify backup
ls -lh /backups/

# Optional: Download backup locally for extra safety
scp -r production:/backups/pre-program-labels-migration-* ./local-backups/
```

#### Step 2: Test Migration in Production-like Environment

```bash
# Use staging environment or production snapshot
export MONGODB_URI="mongodb://staging-db-url"
npm run migrate:program-labels:dry

# Verify results match expectations
```

### Phase 2: Deployment

#### Step 3: Deploy Code with New Fields

```bash
# Deploy backend code with:
# - programLabels field added to Event model
# - programId marked as deprecated (not removed yet)
# - All API changes to support programLabels

git push production main

# Or via Render/hosting platform:
# - Trigger deployment
# - Wait for deployment to complete
# - Verify app is running
```

#### Step 4: Run Migration on Production

```bash
# SSH into production server or use Render Shell
cd /app/backend  # or wherever your backend code is

# Set production environment
export NODE_ENV=production
export MONGODB_URI="your-production-mongodb-uri"

# First, do a DRY RUN to verify
npm run migrate:program-labels:dry

# Review the output carefully:
# - Check number of events
# - Verify transformation logic
# - Ensure no unexpected errors

# If dry run looks good, run actual migration
npm run migrate:program-labels

# Verify completion
# - Check "Migration Summary" output
# - Ensure 0 errors
# - Note number of updated events
```

#### Step 5: Verify Migration Success

```bash
# Connect to MongoDB and verify programLabels
mongo "$MONGODB_URI"

# Check a few events
db.events.find({ programId: { $exists: true, $ne: null } }).limit(3).pretty()

# Verify programLabels were populated
# Each event with programId should have programLabels = [programId]

# Count events by migration status
db.events.countDocuments({ programId: { $exists: true, $ne: null }, programLabels: { $size: 1 } })
db.events.countDocuments({ programId: null, programLabels: { $size: 0 } })
```

### Phase 3: Post-Deployment Verification

#### Step 6: Test Production Application

1. **Create new event with program labels**
   - Should save with programLabels array
2. **Edit existing event**

   - Should display programLabels correctly
   - Should allow adding/removing programs

3. **Filter events by program**

   - Should return correct events using programLabels query

4. **View events on program detail page**
   - Should list all events with that program in programLabels

#### Step 7: Monitor for Issues

```bash
# Check application logs for errors
tail -f /var/log/app.log  # or your log location

# Monitor for database errors
# Check API error rates in monitoring dashboard
```

### Phase 4: Cleanup (Optional - After Verification Period)

#### Step 8: Remove Deprecated programId Field (After 1-2 weeks)

```bash
# Only after confirming programLabels works perfectly

# Create cleanup migration script
npm run migrate:remove-program-id:dry
npm run migrate:remove-program-id

# This would:
# - Remove programId field from all events
# - Update Event model to remove programId completely
```

---

## Alternative Deployment Methods

### Option 1: Render.com Deployment

If using Render:

```bash
# 1. Deploy code via Render dashboard or git push
git push origin main  # Triggers auto-deploy

# 2. Access Render Shell
# Go to Render dashboard → Your service → Shell tab

# 3. Run migration in Render shell
cd backend
npm run migrate:program-labels:dry
npm run migrate:program-labels
```

### Option 2: Docker Deployment

```bash
# 1. SSH into production server
ssh user@production-server

# 2. Enter Docker container
docker exec -it backend-container /bin/bash

# 3. Run migration
cd /app/backend
npm run migrate:program-labels:dry
npm run migrate:program-labels
```

### Option 3: Kubernetes Deployment

```bash
# 1. Get pod name
kubectl get pods -n production

# 2. Execute migration in pod
kubectl exec -it backend-pod-xxx -n production -- /bin/bash

# 3. Run migration
cd /app/backend
npm run migrate:program-labels:dry
npm run migrate:program-labels
```

### Option 4: MongoDB Atlas (Scheduled)

For MongoDB Atlas, you can also:

```bash
# 1. Create a temporary database trigger or scheduled function
# 2. Or use MongoDB Atlas App Services to run the migration
# 3. Or connect directly from local machine (not recommended for large datasets)

# Local machine connection (ensure IP whitelisted)
export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/dbname"
npm run migrate:program-labels:dry
npm run migrate:program-labels
```

---

## Rollback Plan

### If Migration Fails

**Option A: Restore from Backup**

```bash
# Stop application
systemctl stop app-backend  # or docker stop, etc.

# Restore database from backup
mongorestore --uri="$MONGODB_URI" --drop /backups/pre-program-labels-migration-YYYYMMDD-HHMMSS/

# Rollback code to previous version
git revert HEAD
git push production main

# Restart application
systemctl start app-backend
```

**Option B: Manual Rollback (If programId still exists)**

```bash
# The programId field is kept for safety
# Simply revert code changes and clear programLabels

db.events.updateMany({}, { $unset: { programLabels: "" } })

# Redeploy old code version
```

---

## Safety Features Built Into Migration Script

✅ **Dry-run mode** - Test without making changes  
✅ **Detailed logging** - Shows every event processed  
✅ **Error handling** - Catches and reports errors per event  
✅ **Idempotent** - Safe to run multiple times  
✅ **Preserves programId** - Can rollback if needed  
✅ **Summary report** - Clear success/failure counts

---

## Environment Variables Required

```bash
# Required for migration
MONGODB_URI=your-production-mongodb-uri

# Optional (defaults to production if not set)
NODE_ENV=production
```

---

## Migration Timeline Estimate

| Phase           | Duration    | Notes                       |
| --------------- | ----------- | --------------------------- |
| Backup database | 5-30 min    | Depends on database size    |
| Deploy code     | 5-15 min    | Depends on hosting platform |
| Run migration   | 1-10 min    | Depends on number of events |
| Verification    | 10-30 min   | Manual testing              |
| **Total**       | **~1 hour** | For typical deployment      |

---

## Checklist

### Pre-Migration

- [ ] Backup production database
- [ ] Test migration on staging/snapshot
- [ ] Deploy new code (with programLabels support)
- [ ] Verify deployment successful

### Migration

- [ ] Run dry-run: `npm run migrate:program-labels:dry`
- [ ] Review dry-run output
- [ ] Run actual migration: `npm run migrate:program-labels`
- [ ] Check for errors in output
- [ ] Verify migration summary (0 errors)

### Post-Migration

- [ ] Test create new event with programs
- [ ] Test edit existing event
- [ ] Test filter events by program
- [ ] Test program detail page
- [ ] Monitor logs for 24-48 hours
- [ ] Document any issues

### Cleanup (Optional)

- [ ] Wait 1-2 weeks for stability
- [ ] Create migration to remove programId
- [ ] Run cleanup migration
- [ ] Update Event model to remove programId

---

## Contact & Support

**Migration Owner:** [Your Name]  
**Date Created:** 2025-10-12  
**Last Updated:** 2025-10-12

For issues during migration:

1. Check application logs
2. Review MongoDB slow query logs
3. Check migration script output
4. Refer to rollback plan if needed

---

## Migration Script Location

- **Script:** `backend/scripts/migrate-program-to-labels.ts`
- **Commands:**
  - Dry run: `npm run migrate:program-labels:dry`
  - Actual: `npm run migrate:program-labels`

---

## Additional Notes

- Migration is **idempotent** - safe to run multiple times
- Events without programId will have empty programLabels array
- Migration preserves programId field for safety
- Can be rolled back by restoring from backup
- No downtime required during migration (run after code deployment)

---

## Related Documentation

- [Program Roadmap](./PROGRAMS_COMPREHENSIVE_ROADMAP.md)
- [Event Model](../backend/src/models/Event.ts)
- [Program Model](../backend/src/models/Program.ts)
