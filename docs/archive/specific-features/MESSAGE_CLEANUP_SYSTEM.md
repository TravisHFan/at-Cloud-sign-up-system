# System Message Automated Cleanup

## Overview

The System Message Automated Cleanup feature automatically removes old and deleted messages from the database to optimize storage and maintain system performance. This document describes the cleanup rules, implementation, and usage.

## Cleanup Rules

Messages are automatically deleted when they meet **any** of the following criteria:

### 1. Deleted by All Receivers

**Condition:** All users who received the message have marked it as deleted (either in System Messages or Bell Notifications)

**Purpose:** Remove messages that are no longer relevant to anyone

**Example:** A maintenance announcement that all users have dismissed

### 2. Low Priority Past 90 Days

**Condition:** Message has `priority: "low"` AND was created more than 90 days ago

**Purpose:** Remove low-importance messages after a reasonable retention period

**Example:** Minor system updates, general announcements

### 3. Medium Priority Past 160 Days

**Condition:** Message has `priority: "medium"` AND was created more than 160 days ago

**Purpose:** Retain moderately important messages longer than low priority

**Example:** Feature announcements, policy updates

### 4. High Priority Past 240 Days

**Condition:** Message has `priority: "high"` AND was created more than 240 days ago

**Purpose:** Keep critical messages for longest retention period

**Example:** Security alerts, critical system changes

### 5. Seen/Deleted by All Past 60 Days

**Condition:** All users have either:

- Read the message in System Messages, OR
- Read the message in Bell Notifications, OR
- Deleted the message from System Messages, OR
- Removed the message from Bell Notifications

AND the message is older than 60 days

**Purpose:** Quick cleanup of acknowledged messages that no longer need retention

**Example:** Welcome messages, one-time notifications that all users have seen

## Retention Timeline Summary

| Priority                | Retention Period                |
| ----------------------- | ------------------------------- |
| **Low**                 | 90 days                         |
| **Medium**              | 160 days                        |
| **High**                | 240 days                        |
| **Seen/Deleted by All** | 60 days                         |
| **Deleted by All**      | Immediate (on next cleanup run) |

## Implementation

### Automated Scheduler

The cleanup runs **automatically daily at 2:00 AM** server time.

- **Service:** `SchedulerService`
- **Cleanup Logic:** `MessageCleanupService`
- **Location:** `backend/src/services/MessageCleanupService.ts`
- **Initialization:** Started in `backend/src/index.ts` on server startup

### Manual Execution

Super Administrators can manually trigger cleanup or preview what would be deleted.

#### Preview Cleanup (Dry Run)

```http
GET /api/notifications/cleanup/preview
Authorization: Bearer <super-admin-token>
```

**Response:**

```json
{
  "success": true,
  "message": "Preview: 15 messages would be deleted",
  "data": {
    "messagesToDelete": [
      {
        "id": "60d5ec49f1b2c72b8c8e4e5a",
        "title": "System Maintenance Notice",
        "priority": "low",
        "createdAt": "2024-07-10T10:00:00.000Z",
        "reason": "Low priority past 90 days"
      }
      // ... more messages
    ],
    "stats": {
      "deletedCount": 15,
      "scannedCount": 150,
      "deletionsByReason": {
        "deletedByAllReceivers": 5,
        "lowPriorityExpired": 3,
        "mediumPriorityExpired": 2,
        "highPriorityExpired": 1,
        "seenAndExpired": 4
      },
      "executionTimeMs": 245
    }
  }
}
```

#### Execute Cleanup

```http
POST /api/notifications/cleanup/execute
Authorization: Bearer <super-admin-token>
```

**Response:**

```json
{
  "success": true,
  "message": "Cleanup completed: 15 messages deleted",
  "data": {
    "stats": {
      "deletedCount": 15,
      "scannedCount": 150,
      "deletionsByReason": {
        "deletedByAllReceivers": 5,
        "lowPriorityExpired": 3,
        "mediumPriorityExpired": 2,
        "highPriorityExpired": 1,
        "seenAndExpired": 4
      },
      "executionTimeMs": 312
    }
  }
}
```

## Logging and Audit Trail

All cleanup operations are logged with full details:

### Scheduled Cleanup

```
[INFO] [MessageCleanupService] Starting automated message cleanup...
[INFO] [MessageCleanupService] Scanned 150 messages for cleanup
[DEBUG] [MessageCleanupService] Message 60d5ec49f1b2c72b8c8e4e5a marked for deletion: low priority past 90 days
[INFO] [MessageCleanupService] Cleanup completed: deleted 15 messages. Details: {...}
[INFO] [SchedulerService] Scheduled message cleanup completed: deleted 15 messages in 312ms
```

### Manual Cleanup

Logged the same way, with additional context about the administrator who triggered it.

## Security and Access Control

- **Preview Cleanup:** Super Admin only
- **Execute Cleanup:** Super Admin only
- **Automated Cleanup:** Runs automatically (no user intervention)

Access attempts by non-Super Admin users receive:

```json
{
  "success": false,
  "message": "Only Super Administrators can execute message cleanup"
}
```

## Configuration

### Environment Variables

| Variable            | Description                                     | Default                     |
| ------------------- | ----------------------------------------------- | --------------------------- |
| `SCHEDULER_ENABLED` | Enable/disable all schedulers including cleanup | `true` (except in test env) |
| `NODE_ENV`          | Environment (schedulers disabled in `test`)     | `development`               |

### Disabling Cleanup

To disable the automated cleanup:

```bash
# In .env file
SCHEDULER_ENABLED=false
```

Or programmatically:

```typescript
import { SchedulerService } from "./services/SchedulerService";

// Stop the scheduler
SchedulerService.stop();
```

## Database Impact

### Storage Savings

- **Expected:** 5-20% reduction in message collection size monthly (varies by usage)
- **Typical:** 10-50 messages deleted per cleanup run for active systems

### Performance Impact

- **Execution Time:** <1 second for 1000 messages
- **Database Load:** Minimal (single batch delete query)
- **Runs at 2 AM:** Off-peak hours minimize user impact

## Testing

### Unit Tests

Located in: `backend/tests/unit/services/MessageCleanupService.test.ts`

### Manual Testing

1. **Create test messages with different priorities and dates:**

```bash
# Create old low-priority message (should be deleted after 90 days)
curl -X POST http://localhost:5001/api/notifications/system \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Old Low Priority Message",
    "content": "This should be cleaned up",
    "priority": "low",
    "type": "announcement"
  }'
```

2. **Preview cleanup:**

```bash
curl http://localhost:5001/api/notifications/cleanup/preview \
  -H "Authorization: Bearer <super-admin-token>"
```

3. **Execute cleanup:**

```bash
curl -X POST http://localhost:5001/api/notifications/cleanup/execute \
  -H "Authorization: Bearer <super-admin-token>"
```

## Troubleshooting

### Cleanup Not Running

**Check scheduler status:**

```typescript
import { SchedulerService } from "./services/SchedulerService";
const status = SchedulerService.getStatus();
console.log("Scheduler running:", status.isRunning);
console.log("Active intervals:", status.activeIntervals);
```

**Common causes:**

1. `SCHEDULER_ENABLED=false` in environment
2. Running in `NODE_ENV=test` mode
3. Server restarted before 2 AM (next run scheduled)

### Messages Not Being Deleted

**Verify messages meet criteria:**

1. Check message creation date
2. Verify priority level
3. Check user states (all users deleted/seen?)
4. Use preview endpoint to see what would be deleted

**Manual verification:**

```javascript
// In MongoDB shell
db.messages
  .find({
    priority: "low",
    createdAt: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
  })
  .count();
```

## Future Enhancements

Potential improvements for future versions:

1. **Configurable Retention Periods:** Allow admins to set custom retention periods per priority
2. **Cleanup Reports:** Email summary to Super Admins after each cleanup
3. **Archive Instead of Delete:** Move to archive collection instead of permanent deletion
4. **Granular Scheduling:** Configure cleanup frequency (daily, weekly, monthly)
5. **Category-Based Rules:** Different retention for announcement vs. maintenance messages

## Related Documentation

- [System Messages Architecture](./SYSTEM_MESSAGES.md)
- [Scheduler Service](./SCHEDULER_SERVICE.md)
- [Database Maintenance](./DATABASE_MAINTENANCE.md)
- [Storage Optimization](./STORAGE_OPTIMIZATION.md)

## Change Log

| Date       | Version | Changes                                             |
| ---------- | ------- | --------------------------------------------------- |
| 2025-10-11 | 1.0.0   | Initial implementation of automated message cleanup |
