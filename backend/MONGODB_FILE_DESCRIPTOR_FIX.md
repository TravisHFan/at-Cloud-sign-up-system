# MongoDB File Descriptor Limit Fix - Setup Instructions

## Problem

MongoDB crashes during integration tests with error:

```
"Too many open files"
WT_PANIC: WiredTiger library panic
[1] 91676 abort mongod --config /opt/homebrew/etc/mongod.conf
```

## Root Cause

**macOS per-process file descriptor limit is only 256** (even though system-wide `ulimit -n` shows much higher).

During heavy integration test runs:

- Multiple tests create indexes concurrently
- Each index build opens multiple file handles
- MongoDB's WiredTiger journal needs additional files
- Total exceeds 256, causing MongoDB to panic and abort

## Solution: Increase Per-Process File Descriptor Limit

### Option 1: LaunchDaemon (Recommended for Permanent Fix)

This sets the limit whenever MongoDB starts via launchd/brew services.

1. **Copy the plist file to LaunchDaemons:**

   ```bash
   sudo cp backend/com.mongodb.mongod.plist /Library/LaunchDaemons/
   sudo chown root:wheel /Library/LaunchDaemons/com.mongodb.mongod.plist
   ```

2. **Stop brew services version:**

   ```bash
   brew services stop mongodb-community
   ```

3. **Load the LaunchDaemon:**

   ```bash
   sudo launchctl load /Library/LaunchDaemons/com.mongodb.mongod.plist
   ```

4. **Verify MongoDB is running:**

   ```bash
   mongosh --eval "db.serverStatus().connections"
   ```

5. **Verify file descriptor limit:**

   ```bash
   # Get MongoDB PID
   pgrep mongod

   # Check the limit (should show 10240)
   lsof -p <PID> 2>/dev/null | wc -l
   ```

### Option 2: Use the Restart Script (Quick Fix)

The `restart-mongodb.sh` script now sets `ulimit -n 10240` before starting MongoDB:

```bash
cd backend
./restart-mongodb.sh
```

This works for manual starts but won't persist across system reboots.

### Option 3: Manual Start with ulimit

```bash
# Stop MongoDB
pkill -f mongod

# Start with increased limit
ulimit -n 10240 && mongod --config /opt/homebrew/etc/mongod.conf --fork
```

## Verification

After applying the fix, verify MongoDB can handle heavy load:

```bash
# Check current open files
pgrep mongod | xargs lsof -p | wc -l

# Run integration tests
cd backend
npm run test:integration

# Monitor file descriptor usage during tests (in another terminal)
watch -n 1 'pgrep mongod | xargs lsof -p 2>/dev/null | wc -l'
```

Expected behavior:

- File descriptor count should peak around 200-400 during heavy tests
- No more "Too many open files" errors
- MongoDB should not crash/abort

## Why Previous Fixes Didn't Work

Previous attempts focused on:

1. ✅ Connection pool management - This helped but wasn't the root cause
2. ✅ WiredTiger cache tuning - Reduced memory pressure but didn't fix file descriptors
3. ✅ Cleanup batching - Reduced operations but didn't address the limit

The actual issue was **macOS's per-process file descriptor limit** which is separate from:

- Shell `ulimit -n` (applies to shell, not child processes started by launchd)
- System-wide file descriptor limits
- MongoDB configuration settings

## Additional Notes

### Why 10240?

- macOS safe maximum per-process: ~10240
- MongoDB default on Linux: 64000
- Current macOS default: 256
- Heavy test suite peak usage: ~400
- 10240 provides 25x safety margin

### Removing the LaunchDaemon

If you want to revert to brew services:

```bash
sudo launchctl unload /Library/LaunchDaemons/com.mongodb.mongod.plist
sudo rm /Library/LaunchDaemons/com.mongodb.mongod.plist
brew services start mongodb-community
```
