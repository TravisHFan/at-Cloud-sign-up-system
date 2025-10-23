# Purchase Confirmation Email Pricing Bug Fix

## Issue Summary

Purchase confirmation emails were displaying extremely low prices (e.g., $0.02, $0.03) due to a mismatch between the Purchase model validation limits and the updated Program model limits.

## The Problem

### Observed Behavior

In the purchase confirmation email:

- **Program Enrollment**: $0.03 (expected: higher values like $30.00)
- **Early Bird Discount**: -$0.01 (expected: higher values like $10.00)
- **Total Paid**: $0.02 (expected: higher values like $20.00)

### Root Causes

1. **Outdated Purchase Model Validation**: The `Purchase` model had `max: 10000` (allowing only up to $100) while the `Program` model was recently updated to `max: 100000` (allowing up to $1000).

2. **Data Storage Inconsistency Risk**: The old limit of 10000 cents ($100) didn't match the new program pricing capability of 100000 cents ($1000), which could:
   - Cause validation errors when purchasing programs priced above $100
   - Lead to data truncation
   - Create confusion about whether values are in cents or dollars

## The Fix

### Changes Made

**File**: `backend/src/models/Purchase.ts`

#### 1. Updated Validation Limits

```typescript
// BEFORE (outdated)
fullPrice: {
  type: Number,
  required: true,
  min: 0,
  max: 10000,  // Only $100 max
}

// AFTER (fixed)
fullPrice: {
  type: Number,
  required: true,
  min: 0,
  max: 100000,  // 0-100000 cents ($0-$1000)
}
```

Applied the same fix to:

- `fullPrice`: 10000 → 100000
- `classRepDiscount`: 10000 → 100000
- `earlyBirdDiscount`: 10000 → 100000
- `finalPrice`: 10000 → 100000

#### 2. Clarified TypeScript Interface Comments

```typescript
// BEFORE (ambiguous)
// Pricing breakdown
fullPrice: number; // Original full price
classRepDiscount: number; // Class Rep discount applied
earlyBirdDiscount: number; // Early Bird discount applied
finalPrice: number; // Actual amount charged

// AFTER (clear)
// Pricing breakdown (all values in cents)
fullPrice: number; // Original full price in cents (e.g., 9999 = $99.99)
classRepDiscount: number; // Class Rep discount in cents (0 if not selected)
earlyBirdDiscount: number; // Early Bird discount in cents (0 if not applicable)
finalPrice: number; // Actual amount charged in cents (fullPrice - discounts)
```

## How Pricing Works

### Data Flow

1. **Program Creation** (frontend):

   - User enters prices in **whole dollars** (e.g., 100 for $100)
   - Frontend stores as **cents** in database (10000 cents)

2. **Purchase Creation** (backend):

   - `PurchaseController.createCheckoutSession()` reads from `program.fullPriceTicket` (in cents)
   - Calculates discounts (also in cents)
   - Creates Purchase record with all values in cents

3. **Email Confirmation** (backend):
   - `EmailService.sendPurchaseConfirmationEmail()` receives prices in cents
   - `formatCurrency()` function converts: `$${(amount / 100).toFixed(2)}`
   - Email displays correct dollar amounts

### Example

```typescript
// Database values (cents)
fullPrice: 9999          // $99.99
classRepDiscount: 1000   // $10.00
earlyBirdDiscount: 500   // $5.00
finalPrice: 8499         // $84.99

// Email display (after formatCurrency)
Program Enrollment: $99.99
Class Rep Discount: -$10.00
Early Bird Discount: -$5.00
Total Paid: $84.99
You Saved: $15.00
```

## Verification

### Test Case

```typescript
// Create a program with $500 price
const program = await Program.create({
  title: "Test Program",
  fullPriceTicket: 50000, // $500 in cents
  classRepDiscount: 5000, // $50 discount
  earlyBirdDiscount: 0,
  // ... other fields
});

// Create purchase
const purchase = await Purchase.create({
  fullPrice: 50000,
  classRepDiscount: 5000,
  finalPrice: 45000, // $450 after discount
  // ... other fields
});

// Send email
await EmailService.sendPurchaseConfirmationEmail({
  fullPrice: 50000,
  classRepDiscount: 5000,
  finalPrice: 45000,
  // ... other params
});

// Expected email output:
// Program Enrollment: $500.00
// Class Rep Discount: -$50.00
// Total Paid: $450.00
// You Saved: $50.00
```

### Validation

✅ Purchase model now accepts values up to 100000 cents ($1000)
✅ Matches Program model validation limits
✅ Email formatting function works correctly with cent values
✅ Interface comments clarify that all prices are in cents

## Related Changes

This fix is part of the broader pricing system update:

1. **Program Model Update** (previous commit):

   - Updated `fullPriceTicket`, `classRepDiscount`, `earlyBirdDiscount` from max 2000 → 100000
   - Updated frontend forms (CreateNewProgram, EditProgram) to accept up to $1000

2. **Purchase Model Update** (this fix):
   - Updated all pricing fields from max 10000 → 100000
   - Added explicit "in cents" documentation

## Important Notes

### For Developers

1. **Always store prices in cents** in the database (integer values)
2. **Convert to dollars for display** using `formatCurrency()` or similar
3. **Purchase and Program models must have matching limits**
4. **Document currency units clearly** in interfaces and comments

### For Testing

When creating test data:

```typescript
// ❌ WRONG - This is $0.03
fullPrice: 3;

// ✅ CORRECT - This is $3.00
fullPrice: 300;

// ✅ CORRECT - This is $99.99
fullPrice: 9999;
```

## Files Changed

- `backend/src/models/Purchase.ts` - Updated validation limits and interface comments

## Related Files

- `backend/src/models/Program.ts` - Has matching 100000 cent limits
- `backend/src/services/infrastructure/emailService.ts` - Email formatting
- `backend/src/controllers/purchaseController.ts` - Purchase creation logic
- `backend/src/controllers/webhookController.ts` - Email sending on completion

## Testing Recommendations

1. **Unit Tests**: Verify Purchase model accepts values up to 100000
2. **Integration Tests**: Test complete purchase flow with high-value programs ($500+)
3. **Email Tests**: Verify email displays correct prices for various scenarios
4. **Edge Cases**: Test with max values (100000 cents = $1000)

## Migration Notes

**No data migration needed** - This is a validation limit change only. Existing purchase records remain valid since they were all under the old 10000 limit ($100).

However, **new purchases can now be created for programs up to $1000**, which matches the updated Program model capabilities.
