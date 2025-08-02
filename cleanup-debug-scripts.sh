#!/bin/bash

# Cleanup Script for Debug and Test Files
# Safe to run - only removes temporary debugging files

cd "$(dirname "$0")/backend"

echo "🗑️ Cleaning up debug and test scripts..."

# List of debug/test files to remove (temporary debugging tools)
DEBUG_FILES=(
    "analyze-admin-notifications.js"
    "analyze-recent-role-change.js"
    "check-legacy-data.js"
    "check-password-change-token.js"
    "check-password-token.js"
    "check-test-user.js"
    "check-user-after-change.js"
    "check-user-roles.js"
    "create-test-user-proper.js"
    "create-test-user.js"
    "create-user-directly.js"
    "debug-admin-notifications.js"
    "debug-admin-system-messages.js"
    "debug-auth-api.js"
    "debug-avatar-data.js"
    "debug-bell-vs-system.js"
    "debug-email-dots.js"
    "debug-password-reset.js"
    "debug-role-change-messages.js"
    "debug-specific-message.js"
    "delete-test-user.js"
    "demo-message-type-comparison.js"
    "explore-database.js"
    "final-atcloud-websocket-verification.js"
    "final-system-message-verification.js"
    "find-admin-users.js"
    "find-any-user.js"
    "fix-dotun-email.js"
    "generate-test-token.js"
    "investigate-users.js"
    "list-users.js"
    "manual-test-guide-admin-role-change.js"
    "run-all-atcloud-tests.js"
    "simple-test.js"
    "test-admin-role-change-fix.js"
    "test-api-with-auth.js"
    "test-atcloud-error-handling.js"
    "test-atcloud-integration.js"
    "test-atcloud-message-type.js"
    "test-atcloud-profile-notifications.js"
    "test-atcloud-realtime-fix.js"
    "test-atcloud-signup-notifications.js"
    "test-avatar-fix.js"
    "test-email-preservation.js"
    "test-email-recipient-utils.js"
    "test-live-admin-notifications.js"
    "test-live-api.js"
    "test-role-change-avatar.js"
    "test-trio-direct.js"
    "update-test-token.js"
    "verify-atcloud-implementation.js"
    "verify-dots.js"
    "verify-message-type-fix.js"
    "verify-notification-implementations.js"
    "verify-password-reset-fix.js"
    "verify-test-user.js"
)

# Create backup directory
mkdir -p .debug-backup
BACKUP_DIR=".debug-backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Count existing files
EXISTING_COUNT=0
for file in "${DEBUG_FILES[@]}"; do
    if [ -f "$file" ]; then
        ((EXISTING_COUNT++))
    fi
done

echo "📊 Found $EXISTING_COUNT debug files to clean up"

# Move files to backup (safer than deletion)
MOVED_COUNT=0
for file in "${DEBUG_FILES[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" "$BACKUP_DIR/"
        echo "   ✅ Moved: $file"
        ((MOVED_COUNT++))
    fi
done

echo ""
echo "🎉 Cleanup Complete!"
echo "📁 Moved $MOVED_COUNT files to backup: $BACKUP_DIR"
echo "💡 Files can be restored from backup if needed"
echo ""
echo "🧹 Clean workspace achieved! Backend directory is now organized."
