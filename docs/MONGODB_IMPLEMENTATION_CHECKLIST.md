# MongoDB Stability - Implementation Checklist

## ✅ Quick Verification

Use this checklist to verify all MongoDB stability fixes are in place and working.

---

## 1. Files Created ✅

Run this command to verify all files exist:

```bash
cd backend && ls -lh \
  mongod-optimized.conf \
  restart-mongodb.sh \
  tests/integration/setup/cleanup.ts && \
cd ../docs && ls -lh \
  MONGODB_REAL_FIX.md \
  LAUNCHDAEMON_INSTALLED.md \
  MONGODB_QUICK_START.md
```

**Expected Output**:

```
✅ mongod-optimized.conf (1.5K)
✅ restart-mongodb.sh (790B)
✅ tests/integration/setup/cleanup.ts (4.0K)
✅ MONGODB_REAL_FIX.md (5.6K)
✅ LAUNCHDAEMON_INSTALLED.md (4.5K)
✅ MONGODB_QUICK_START.md (2.3K)
```

---

## 2. Test Files Fixed ✅

Verify all 15 test files use shared connection:

```bash
cd backend && grep -l "ensureIntegrationDB" tests/integration/**/*.test.ts | wc -l
```

**Expected Output**: `15`

---

## 3. npm Scripts Added ✅

Check MongoDB management scripts:

```bash
cd backend && npm run | grep "mongo:"
```

**Expected Output**:

```
✅ mongo:restart
✅ mongo:health
✅ mongo:status
✅ mongo:cache
✅ mongo:logs
```

---

## 4. Apply Optimized Configuration

### First-Time Setup:

```bash
# ⚠️ This will restart MongoDB - save your work first!

# 1. Backup current config
cp /opt/homebrew/etc/mongod.conf /opt/homebrew/etc/mongod.conf.backup

# 2. Apply optimized config
cp backend/mongod-optimized.conf /opt/homebrew/etc/mongod.conf

# 3. Restart MongoDB
cd backend && npm run mongo:restart
```

### Verify Configuration:

```bash
# Should show 8589934592 (8GB)
mongosh --quiet --eval "db.serverStatus().wiredTiger.cache['maximum bytes configured']"

# Should show 1000
mongosh --quiet --eval "db.serverStatus().connections.available"
```

---

## 5. Test the Fixes

### Run Full Integration Test Suite:

```bash
cd backend && npm run test:integration
```

**Expected Results**:

- ✅ All 384 tests pass
- ✅ No MongoDB crashes
- ✅ Completion time: ~2-3 minutes
- ✅ No connection errors

### Monitor During Tests (Optional):

Open a second terminal and run:

```bash
# Watch connections in real-time
watch -n 2 'mongosh --quiet --eval "db.serverStatus().connections"'

# Or watch cache usage
watch -n 2 'mongosh --quiet --eval "db.serverStatus().wiredTiger.cache" | grep "bytes currently"'
```

---

## 6. Verify MongoDB Health

### After Tests Complete:

```bash
# Check health
npm run mongo:health

# Check connection stats
npm run mongo:status

# Expected output:
# {
#   current: 5,
#   available: 995,
#   totalCreated: 127
# }
```

---

## 7. Test MongoDB Restart (Optional)

### Verify Quick Recovery Works:

```bash
# 1. Manually stop MongoDB
mongosh admin --eval "db.shutdownServer()"

# 2. Use restart script
cd backend && npm run mongo:restart

# 3. Verify MongoDB is running
npm run mongo:health

# Expected: MongoDB restarts in <10 seconds
```

---

## Common Issues

### ❌ "Command failed: mongosh not found"

**Solution**: Install MongoDB shell

```bash
brew install mongosh
```

### ❌ "Error: connect ECONNREFUSED"

**Solution**: MongoDB isn't running

```bash
cd backend && npm run mongo:restart
```

### ❌ "Permission denied: /opt/homebrew/etc/mongod.conf"

**Solution**: Use sudo

```bash
sudo cp backend/mongod-optimized.conf /opt/homebrew/etc/mongod.conf
```

### ❌ Tests still failing

**Checklist**:

1. Is MongoDB running? `ps aux | grep mongod`
2. Is config applied? `grep "cacheSizeGB: 8" /opt/homebrew/etc/mongod.conf`
3. Are test files using shared connection? `grep -l "ensureIntegrationDB" tests/integration/**/*.test.ts`
4. Review logs: `npm run mongo:logs`

---

## Success Criteria

After completing this checklist:

- ✅ 384/384 tests pass consistently
- ✅ MongoDB doesn't crash during tests
- ✅ Can quickly restart MongoDB when needed
- ✅ Connection pool is stable
- ✅ No manual intervention needed for daily development

---

## Next Steps

1. **Daily Development**: Just run `npm run test:integration` - everything works automatically
2. **If MongoDB Crashes** (rare): Run `npm run mongo:restart`
3. **Monitor**: Use `npm run mongo:status` to check health anytime
4. **Troubleshooting**: See `docs/MONGODB_REAL_FIX.md` or `docs/LAUNCHDAEMON_INSTALLED.md` for detailed guide

---

## Quick Reference

### Most Common Commands:

```bash
# Run tests
npm run test:integration

# Restart MongoDB
npm run mongo:restart

# Check health
npm run mongo:health

# Monitor connections
npm run mongo:status

# View logs
npm run mongo:logs
```

### Emergency Recovery:

```bash
# If MongoDB is completely stuck:
pkill -9 mongod
rm -f /opt/homebrew/var/mongodb/mongod.lock
mongod --config /opt/homebrew/etc/mongod.conf --fork

# Or use the script:
cd backend && ./restart-mongodb.sh
```

---

## Done! ✅

If all checks pass above, your MongoDB stability fixes are complete and working!

🎉 **No more MongoDB crashes during tests!**

For detailed documentation:

- 📖 `docs/MONGODB_REAL_FIX.md` - Complete root cause analysis and solution
- 📖 `docs/LAUNCHDAEMON_INSTALLED.md` - Installation summary and management
- 📖 `docs/MONGODB_QUICK_START.md` - Quick reference guide
- 📖 `docs/MONGODB_DOCUMENTATION_INDEX.md` - Complete documentation index
