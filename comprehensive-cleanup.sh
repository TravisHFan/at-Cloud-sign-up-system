#!/bin/bash

echo "🧹 === COMPREHENSIVE PROJECT CLEANUP === 🧹"
echo ""

# Navigate to project root
cd "/Users/dr.hunter/CS Projects/at-Cloud-sign-up-system"

echo "📋 === REMOVING LEGACY REPORTS AND DOCUMENTATION === 📋"
# Remove all the excessive report files
rm -f AUDITLOG_PERFORMANCE_REMOVAL_REPORT.md
rm -f BACKEND_REFACTORING_REPORT.md
rm -f BACKEND_REFACTORING_SUCCESS.md
rm -f BELL_NOTIFICATIONS_COMPLETE_FIX.md
rm -f BELL_NOTIFICATIONS_FIX_REPORT.md
rm -f BELL_NOTIFICATIONS_SUCCESS_REPORT.md
rm -f BELL_NOTIFICATION_COMPLETE_FIXES.md
rm -f BELL_NOTIFICATION_DUPLICATION_FIX_REPORT.md
rm -f BELL_NOTIFICATION_FINAL_FIXES.md
rm -f BELL_NOTIFICATION_REDUNDANCY_ELIMINATION_REPORT.md
rm -f BUG_1_DUPLICATE_NOTIFICATIONS_FIX_REPORT.md
rm -f CHAT_SOCKET_CLEANUP_COMPLETE.md
rm -f CODEBASE_AUDIT_CLEANUP_REPORT.md
rm -f COMPLETE_NOTIFICATION_UNIFICATION_FINAL_REPORT.md
rm -f DATABASE_CONSOLIDATION_REPORT.md
rm -f FRONTEND_BACKEND_ENDPOINT_FIXES.md
rm -f NOTIFICATION_SYSTEM_AUDIT_REPORT.md
rm -f SCRIPTS_CLEANUP_REPORT.md
rm -f SYSTEM_MESSAGES_CREATION_FIX_REPORT.md
rm -f SYSTEM_MESSAGES_IMPLEMENTATION_REPORT.md
rm -f SYSTEM_MESSAGES_TESTING_STRATEGY.md
rm -f SYSTEM_MESSAGE_IMPLEMENTATION_SUCCESS.md
rm -f UNIFIEDNOTIFICATIONS_CLEANUP_REPORT.md

echo "✅ Removed 24 legacy report files"

echo ""
echo "🧪 === REMOVING ROOT-LEVEL TEST FILES === 🧪"
# Remove all test files from root
rm -f check-users.js
rm -f test-api-audit.js
rm -f test-comprehensive-bell-system.js
rm -f test-duplicate-fix.js
rm -f test-login.js
rm -f test-refactored-system.js
rm -f test-simple-api.js
rm -f test-system-messages.js
rm -f test-unified-final.js
rm -f test-unified-system.js
rm -f setup.js

echo "✅ Removed 11 root-level test/setup files"

echo ""
echo "🧪 === REMOVING BACKEND TEST AND SCRIPT FILES === 🧪"
cd backend

# Remove investigation and test scripts
rm -f check-users.mjs
rm -f cleanup-legacy-code.mjs
rm -f create-test-admin.mjs
rm -f debug-e2e.js
rm -f purge-notification-data.mjs
rm -f test-backwards-compat.js
rm -f test-clean-api.js
rm -f test-clean-notifications.js
rm -f test-duplicate-investigation.mjs
rm -f test-endpoints.js
rm -f test-new-user.js
rm -f test-notification-system.mjs
rm -f test-system-flow.js
rm -f verify-unified-system.mjs

echo "✅ Removed 14 backend investigation/test scripts"

echo ""
echo "🗂️ === REMOVING LEGACY TEST DIRECTORIES === 🗂️"
# Remove legacy test files
rm -rf tests/legacy/
echo "✅ Removed tests/legacy/ directory"

# Remove compiled files
rm -rf dist/
echo "✅ Removed dist/ directory"

echo ""
echo "📦 === CLEANING PACKAGE DEPENDENCIES === 📦"
cd "/Users/dr.hunter/CS Projects/at-Cloud-sign-up-system"

# Clean root node_modules and package-lock
rm -rf node_modules/
rm -f package-lock.json
echo "✅ Removed root node_modules and package-lock.json"

# Clean backend
cd backend
rm -rf node_modules/
rm -f package-lock.json
echo "✅ Removed backend node_modules and package-lock.json"

# Clean frontend
cd ../frontend
rm -rf node_modules/
rm -f package-lock.json
echo "✅ Removed frontend node_modules and package-lock.json"

echo ""
echo "🧹 === REMOVING CLEANUP SCRIPTS === 🧹"
cd "/Users/dr.hunter/CS Projects/at-Cloud-sign-up-system"
rm -f cleanup-chat-legacy.sh
echo "✅ Removed cleanup scripts"

echo ""
echo "🎯 === CLEANUP COMPLETE === 🎯"
echo ""
echo "📊 Summary of removed items:"
echo "  ✅ 24 legacy report files"
echo "  ✅ 11 root-level test/setup files"  
echo "  ✅ 14 backend investigation scripts"
echo "  ✅ Legacy test directories"
echo "  ✅ All node_modules and package-lock files"
echo "  ✅ Compiled dist/ directory"
echo "  ✅ Cleanup scripts"
echo ""
echo "🚀 Project is now clean and ready for fresh npm install!"
echo "📋 To reinstall dependencies run: npm run install-all"
