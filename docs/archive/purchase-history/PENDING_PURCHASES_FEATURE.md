# Pending Purchases Feature

## Overview

This feature manages abandoned checkout sessions and prevents duplicate purchases by providing users with visibility into their pending transactions and automatic cleanup of redundant records.

## Problem Statement

When users create checkout sessions but don't complete payment:

1. **Pending purchase records accumulate** in the database with `status: "pending"`
2. **Expired sessions** (>24 hours old) remain indefinitely
3. **Redundant pending purchases** exist after a user completes payment elsewhere
4. **No user visibility** into abandoned checkouts
5. **Risk of duplicate purchases** if user retries an old pending purchase

## Solution

### Backend Implementation

#### 1. Get Pending Purchases with Auto-Cleanup

**Endpoint**: `GET /api/purchases/my-pending-purchases`

**Auto-cleanup Logic** (runs on every fetch):

```typescript
// Cleanup 1: Remove expired sessions (>24 hours old)
const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
await Purchase.deleteMany({
  userId: req.user._id,
  status: "pending",
  createdAt: { $lt: twentyFourHoursAgo },
});

// Cleanup 2: Remove redundant pending purchases for already-completed programs
for (const pending of pendingPurchases) {
  const existingCompletedPurchase = await Purchase.findOne({
    userId: req.user._id,
    programId: pending.programId,
    status: "completed",
  });

  if (existingCompletedPurchase) {
    // Delete this redundant pending purchase
    await Purchase.deleteMany({ _id: pending._id });
  }
}
```

**Benefits**:

- ✅ Automatically removes stale data
- ✅ Prevents UI clutter from showing already-purchased programs
- ✅ Keeps database clean
- ✅ No manual intervention needed

#### 2. Retry Purchase with Duplicate Prevention

**Endpoint**: `POST /api/purchases/retry/:id`

**Validation Logic**:

```typescript
// CRITICAL: Check if user already has a completed purchase for this program
const existingCompletedPurchase = await Purchase.findOne({
  userId: req.user._id,
  programId: pendingPurchase.programId,
  status: "completed",
});

if (existingCompletedPurchase) {
  return res.status(400).json({
    success: false,
    message:
      "You have already purchased this program. Check your purchase history.",
  });
}
```

**Benefits**:

- ✅ Prevents accidental double purchases
- ✅ Clear error message guides users
- ✅ Works as last line of defense (should rarely trigger due to auto-cleanup)

#### 3. Cancel Pending Purchase

**Endpoint**: `DELETE /api/purchases/:id`

**Safety Checks**:

- Only allows deleting `status: "pending"` purchases
- Verifies user ownership before deletion
- Cannot delete completed/failed/refunded purchases

### Frontend Implementation

#### Purchase History UI

**New "Pending Purchases" Section**:

- Displayed at the top of Purchase History page
- Yellow-bordered cards for visual distinction
- Shows:
  - Program title
  - Order number
  - Creation date/time
  - Pricing with discounts
  - "Pending" badge

**Action Buttons**:

1. **"Try Again"** - Creates new Stripe checkout session
   - Redirects to payment
   - Handles "already purchased" error gracefully
2. **"Cancel"** - Removes pending purchase
   - Custom confirmation modal (not browser dialog)
   - Cannot be undone warning

**Custom Modals** (No Browser Dialogs):

```tsx
// Cancel Confirmation Modal
{
  cancelConfirm && (
    <div className="fixed inset-0 bg-black bg-opacity-50...">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3>Cancel Pending Purchase</h3>
        <p>
          Are you sure you want to cancel your pending purchase for "
          {programTitle}"?
        </p>
        <p className="text-sm">This action cannot be undone...</p>
        <button onClick={handleCancel}>Cancel Purchase</button>
        <button onClick={closeModal}>Keep Purchase</button>
      </div>
    </div>
  );
}

// Error Modal
{
  errorModal && (
    <div className="fixed inset-0 bg-black bg-opacity-50...">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3>{errorModal.title}</h3>
        <p>{errorModal.message}</p>
        <button onClick={closeModal}>Close</button>
      </div>
    </div>
  );
}
```

## User Flow Examples

### Scenario 1: User Abandons Checkout

1. User clicks "Register for Program"
2. Checkout session created → Purchase record: `status: "pending"`
3. User closes browser without paying
4. **Result**:
   - Shows in "Pending Purchases" section
   - After 24 hours → Automatically deleted
   - User can manually cancel or retry anytime

### Scenario 2: User Completes Payment Elsewhere

1. User has pending purchase for Program A
2. User completes checkout for Program A via different tab/device
3. Purchase status updated: `status: "completed"`
4. **Result**:
   - Next time user views Purchase History
   - Auto-cleanup detects redundant pending purchase
   - Silently removes the old pending record
   - User only sees the completed purchase

### Scenario 3: User Tries to Buy Same Program Twice

1. User has completed purchase for Program A
2. User accidentally clicks "Try Again" on old pending purchase
3. Backend validation catches duplicate attempt
4. **Result**:
   - Error modal shows: "You have already purchased this program"
   - User guided to check purchase history
   - No double charge occurs

## Database Cleanup Strategy

### On-Demand Cleanup

Triggered when user fetches pending purchases:

- **Expired sessions**: >24 hours old
- **Redundant purchases**: Programs already completed

### Why Not Background Job?

- ✅ **Simpler architecture**: No cron jobs or workers needed
- ✅ **User-driven**: Cleans up when relevant (user viewing history)
- ✅ **Resource efficient**: Only processes affected user's data
- ✅ **Immediate feedback**: User sees clean data instantly

### Future Enhancement (Optional)

Could add scheduled cleanup job if database grows large:

```typescript
// Daily cleanup of all users' expired/redundant pending purchases
cron.schedule("0 2 * * *", async () => {
  await Purchase.deleteMany({
    status: "pending",
    createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });
});
```

## Testing Scenarios

### Test 1: Fetch Pending with Auto-Cleanup

```bash
# Given: User has 3 pending purchases (1 expired, 1 redundant, 1 valid)
GET /api/purchases/my-pending-purchases

# Expected: Returns only 1 valid pending purchase
# Logs: "Auto-cleaned 1 expired..." and "Auto-cleaned 1 redundant..."
```

### Test 2: Retry with Duplicate Check

```bash
# Given: User has completed purchase for Program A
# Given: User has pending purchase for Program A
POST /api/purchases/retry/:pendingId

# Expected: 400 error "You have already purchased this program"
```

### Test 3: Cancel Pending

```bash
# Given: User has pending purchase
DELETE /api/purchases/:pendingId

# Expected: 200 success, purchase deleted
# Verify: Pending purchase no longer appears
```

### Test 4: UI Modal Behavior

```
1. Click "Cancel" on pending purchase
   → Custom modal appears (not browser confirm)
2. Click "Keep Purchase"
   → Modal closes, purchase remains
3. Click "Cancel Purchase"
   → Purchase deleted, UI refreshes
4. Click "Try Again" with already purchased program
   → Custom error modal appears (not browser alert)
```

## API Response Examples

### Get Pending Purchases

```json
{
  "success": true,
  "data": [
    {
      "id": "pending123",
      "orderNumber": "ORD-20250115-1234",
      "programId": {
        "_id": "prog456",
        "title": "Leadership Training",
        "programType": "Training"
      },
      "finalPrice": 89.99,
      "fullPrice": 99.99,
      "classRepDiscount": 10.0,
      "status": "pending",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### Retry Purchase (Already Purchased)

```json
{
  "success": false,
  "message": "You have already purchased this program. Check your purchase history."
}
```

### Cancel Pending Purchase

```json
{
  "success": true,
  "message": "Pending purchase cancelled successfully."
}
```

## Security Considerations

1. **Ownership Verification**: All endpoints verify `req.user._id` matches purchase `userId`
2. **Status Protection**: Cannot delete/retry completed purchases
3. **Duplicate Prevention**: Backend validates before creating new checkout session
4. **XSS Prevention**: All user input sanitized in error modals

## Performance Impact

- **Minimal**: Auto-cleanup only processes current user's records
- **Optimized Queries**: Uses indexes on `userId`, `status`, `createdAt`
- **No N+1 Problem**: Batched deletion for redundant purchases

## Future Enhancements

1. **Email Notifications**: Remind users of abandoned checkouts after 1 hour
2. **Analytics**: Track abandonment rates by program
3. **Bulk Actions**: "Cancel All Pending" button
4. **Expiration Warning**: Show countdown timer for 24-hour expiration
5. **Restore Capability**: Allow "undoing" cancelled purchases within 5 minutes

## Related Files

### Backend

- `backend/src/controllers/purchaseController.ts` - Main logic
- `backend/src/routes/purchases.ts` - Route definitions
- `backend/src/models/Purchase.ts` - Data model

### Frontend

- `frontend/src/pages/PurchaseHistory.tsx` - UI implementation
- `frontend/src/services/api.ts` - API service methods

### Documentation

- `docs/BROWSER_DIALOGS_TO_REPLACE.md` - Custom modal patterns
- `docs/PENDING_PURCHASES_FEATURE.md` - This document
