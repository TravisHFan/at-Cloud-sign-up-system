#!/bin/bash
# MongoDB LaunchDaemon Installation Script
# This installs a custom LaunchDaemon that sets file descriptor limit to 10,240

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "🔧 MongoDB LaunchDaemon Installation"
echo "===================================="
echo ""
echo "This will:"
echo "  1. Stop Homebrew MongoDB service"
echo "  2. Copy optimized config to /opt/homebrew/etc/"
echo "  3. Install custom LaunchDaemon with 10,240 file descriptor limit"
echo "  4. Start MongoDB via LaunchDaemon"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Installation cancelled"
    exit 1
fi

echo ""
echo "1️⃣  Stopping Homebrew MongoDB service..."
brew services stop mongodb-community 2>/dev/null || true
sleep 2

echo ""
echo "2️⃣  Copying optimized MongoDB config..."
sudo cp "$SCRIPT_DIR/mongod-optimized.conf" /opt/homebrew/etc/mongod-optimized.conf
sudo chown root:wheel /opt/homebrew/etc/mongod-optimized.conf
echo "   ✅ Config copied to /opt/homebrew/etc/mongod-optimized.conf"

echo ""
echo "3️⃣  Installing LaunchDaemon..."
sudo cp "$SCRIPT_DIR/com.mongodb.mongod.plist" /Library/LaunchDaemons/
sudo chown root:wheel /Library/LaunchDaemons/com.mongodb.mongod.plist
echo "   ✅ LaunchDaemon installed to /Library/LaunchDaemons/"

echo ""
echo "4️⃣  Loading and starting MongoDB..."
sudo launchctl load /Library/LaunchDaemons/com.mongodb.mongod.plist

echo ""
echo "⏳ Waiting for MongoDB to be ready..."
for i in {1..30}; do
  if mongosh --quiet --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
    echo ""
    echo "✅ MongoDB is running via LaunchDaemon!"
    echo ""
    echo "📊 Connection status:"
    mongosh --quiet --eval "db.serverStatus().connections"
    echo ""
    echo "🔍 Verify file descriptor limit is applied:"
    MONGO_PID=$(pgrep mongod)
    if [ -n "$MONGO_PID" ]; then
      echo "   MongoDB PID: $MONGO_PID"
      echo "   Open files: $(lsof -p $MONGO_PID 2>/dev/null | wc -l | xargs)"
      echo "   (Should be well below 10,240 limit)"
    fi
    echo ""
    echo "✅ Installation complete!"
    echo ""
    echo "To uninstall:"
    echo "  sudo launchctl unload /Library/LaunchDaemons/com.mongodb.mongod.plist"
    echo "  sudo rm /Library/LaunchDaemons/com.mongodb.mongod.plist"
    echo "  brew services start mongodb-community"
    exit 0
  fi
  sleep 1
done

echo ""
echo "❌ MongoDB failed to start after 30 seconds"
echo "Check logs: tail -f /opt/homebrew/var/log/mongodb/mongo.log"
exit 1
