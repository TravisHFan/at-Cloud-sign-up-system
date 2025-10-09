#!/bin/bash
# MongoDB Restart Script for Test Environment
# Use this to quickly restart MongoDB when it crashes

set -e

echo "🔄 Stopping any existing MongoDB processes..."
pkill -f "mongod --config" 2>/dev/null || true
sleep 2

echo "🧹 Cleaning up lock files..."
rm -f /opt/homebrew/var/mongodb/mongod.lock 2>/dev/null || true

echo "🚀 Starting MongoDB..."
mongod --config /opt/homebrew/etc/mongod.conf --fork

# Wait for MongoDB to be ready
echo "⏳ Waiting for MongoDB to be ready..."
for i in {1..30}; do
  if mongosh --quiet --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
    echo "✅ MongoDB is running and ready!"
    mongosh --quiet --eval "db.serverStatus().connections"
    exit 0
  fi
  sleep 1
done

echo "❌ MongoDB failed to start after 30 seconds"
exit 1
