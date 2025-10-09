# Quick Start: Fixing MongoDB Crash

## Choose Your Method

### Option 1: Quick Fix (Recommended for Testing) ⚡

Use the restart script with ulimit. Good for immediate testing.

```bash
cd backend
./restart-mongodb.sh
```

**Pros:**

- ✅ Quick and easy
- ✅ Sets file descriptor limit to 10,240
- ✅ Uses optimized MongoDB config
- ✅ No sudo password needed

**Cons:**

- ❌ Need to run after reboot
- ❌ Won't auto-restart if MongoDB crashes

---

### Option 2: Permanent Fix (Recommended After Testing) 🏆

Install custom LaunchDaemon. MongoDB will auto-start at boot.

```bash
cd backend
./install-mongodb-launchdaemon.sh
```

**Pros:**

- ✅ Survives reboots
- ✅ Auto-starts at boot
- ✅ Sets file descriptor limit to 10,240
- ✅ Uses optimized MongoDB config
- ✅ Can auto-restart on crash

**Cons:**

- ❌ Requires sudo password
- ❌ Replaces Homebrew service management

---

## Current Status

Your MongoDB:

- ✅ Installed via Homebrew
- ❌ Currently in error state (exit code 48)
- ❌ Not running

---

## Test the Fix

After starting MongoDB with either method:

```bash
# 1. Run integration tests
cd backend
npm run test:integration

# 2. In another terminal, monitor file descriptors
watch -n 1 'pgrep mongod | xargs lsof -p 2>/dev/null | wc -l'
```

**Expected:**

- Peak file descriptor usage: 200-400
- Limit: 10,240
- **No crashes!** 🎉

---

## What Changed

1. **`restart-mongodb.sh`**

   - Now uses `backend/mongod-optimized.conf` instead of default config
   - Sets `ulimit -n 10240` before starting MongoDB

2. **`com.mongodb.mongod.plist`**

   - Updated to use `mongod-optimized.conf`
   - Sets file descriptor limit to 10,240

3. **`install-mongodb-launchdaemon.sh`** (NEW)
   - Automated installation script
   - Stops Homebrew service
   - Copies config to system location
   - Installs and starts LaunchDaemon

---

## Reverting to Homebrew

If you want to go back:

```bash
# Uninstall LaunchDaemon
sudo launchctl unload /Library/LaunchDaemons/com.mongodb.mongod.plist
sudo rm /Library/LaunchDaemons/com.mongodb.mongod.plist

# Restart Homebrew service
brew services start mongodb-community
```

---

## Next Steps

1. ✅ Start MongoDB using one of the methods above
2. ✅ Run integration tests to verify the fix
3. ✅ Commit the changes to git
4. ✅ Update team documentation
