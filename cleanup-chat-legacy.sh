#!/bin/bash

echo "🧹 === CHAT/SOCKET LEGACY CLEANUP === 🧹"

# Remove legacy investigation scripts
echo "Removing legacy investigation scripts..."
rm -f /Users/dr.hunter/CS\ Projects/at-Cloud-sign-up-system/backend/trace-notifications.mjs
rm -f /Users/dr.hunter/CS\ Projects/at-Cloud-sign-up-system/backend/investigate-duplicate-bug.mjs

# Remove compiled socket files in dist/
echo "Removing compiled socket files..."
rm -f /Users/dr.hunter/CS\ Projects/at-Cloud-sign-up-system/backend/dist/services/infrastructure/socketManager.js
rm -f /Users/dr.hunter/CS\ Projects/at-Cloud-sign-up-system/backend/dist/services/infrastructure/socketManager.js.map
rm -f /Users/dr.hunter/CS\ Projects/at-Cloud-sign-up-system/backend/dist/services/infrastructure/socketManager.d.ts
rm -f /Users/dr.hunter/CS\ Projects/at-Cloud-sign-up-system/backend/dist/services/infrastructure/socketManager.d.ts.map

# Check if there are any remaining socket source files (should have been removed already)
echo "Checking for source socket files..."
find /Users/dr.hunter/CS\ Projects/at-Cloud-sign-up-system -name "*socket*" -type f

# Remove chat cleanup reports (they're no longer needed)
echo "Removing chat cleanup reports..."
rm -f /Users/dr.hunter/CS\ Projects/at-Cloud-sign-up-system/CHAT_CLEANUP_REPORT.md
rm -f /Users/dr.hunter/CS\ Projects/at-Cloud-sign-up-system/WEBSOCKET_CLEANUP_REPORT.md

echo "✅ Legacy chat/socket cleanup complete!"
echo ""
echo "📋 Files removed:"
echo "  - Legacy investigation scripts (3 files)"
echo "  - Compiled socket manager files (4 files)"
echo "  - Chat/WebSocket cleanup reports (2 files)"
