# Promo Code Retention Policy

## Overview

To maintain database efficiency and provide a clean user experience, the system automatically removes old promo codes based on their status.

## Retention Rules

| Code Status                      | Retention Period     | Deletion Criteria                      |
| -------------------------------- | -------------------- | -------------------------------------- |
| **Active (unused, not expired)** | ♾️ **Never deleted** | N/A                                    |
| **Used**                         | 7 days               | Deleted 7 days after `usedAt` date     |
| **Expired (unused)**             | 30 days              | Deleted 30 days after `expiresAt` date |

## Implementation

### Backend

**Service:** `PromoCodeCleanupService`

- Location: `/backend/src/services/promoCodeCleanupService.ts`
- Methods:
  - `deleteOldUsedCodes()` - Removes used codes older than 7 days
  - `deleteOldExpiredCodes()` - Removes expired codes older than 30 days
  - `runCleanup()` - Executes both cleanup tasks

**Scheduler:** `SchedulerService`

- Location: `/backend/src/services/SchedulerService.ts`
- Schedule: Runs daily at 3:00 AM server time
- Automatic: Starts when server starts (except in test environment)

### Frontend

**User Information:**

- Location: "My Promo Codes" page (`/frontend/src/pages/MyPromoCodes.tsx`)
- Display: Blue information banner at the top of the page
- Message: Clearly explains the retention policy to users

## Database Queries

### Delete Used Codes (7+ days old)

```javascript
PromoCode.deleteMany({
  isUsed: true,
  usedAt: { $lt: sevenDaysAgo },
});
```

### Delete Expired Codes (30+ days old)

```javascript
PromoCode.deleteMany({
  expiresAt: { $exists: true, $lt: thirtyDaysAgo },
  isUsed: false,
});
```

## Logging

All cleanup operations are logged with:

- Start time
- Number of codes deleted (by category)
- Completion status
- Any errors encountered

Example log output:

```
[PromoCodeCleanup] Starting promo code cleanup...
[PromoCodeCleanup] Deleted 5 used promo codes older than 7 days
[PromoCodeCleanup] Deleted 12 expired promo codes older than 30 days
[PromoCodeCleanup] Cleanup complete. Deleted 5 used codes, 12 expired codes
```

## User Impact

### What Users See:

- ✅ Active codes: Always visible in "My Promo Codes"
- ⏱️ Recently used codes: Visible for 7 days after use
- ⏱️ Recently expired codes: Visible for 30 days after expiration
- ❌ Old codes: Automatically removed from their list

### Benefits:

1. **Cleaner interface** - Users only see relevant codes
2. **Better organization** - Focus on active/usable codes
3. **Improved performance** - Smaller database, faster queries
4. **Privacy** - Old transaction data eventually removed

## Testing

To manually trigger cleanup (for testing):

```typescript
import { PromoCodeCleanupService } from "./services/promoCodeCleanupService";

// Run cleanup immediately
const result = await PromoCodeCleanupService.runCleanup();
console.log(
  `Deleted ${result.deletedUsed} used, ${result.deletedExpired} expired`
);
```

## Configuration

The retention periods are currently hardcoded:

- **Used codes**: 7 days (in `deleteOldUsedCodes()`)
- **Expired codes**: 30 days (in `deleteOldExpiredCodes()`)

To modify these values, edit:

```typescript
// backend/src/services/promoCodeCleanupService.ts

// For used codes:
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7); // Change 7 to desired days

// For expired codes:
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); // Change 30 to desired days
```

## Future Enhancements

Potential improvements:

- [ ] Make retention periods configurable via environment variables
- [ ] Add admin dashboard to view/trigger cleanup manually
- [ ] Send email notification before deleting valuable codes
- [ ] Export deleted codes to archive storage
- [ ] Add metrics/analytics for cleanup operations
