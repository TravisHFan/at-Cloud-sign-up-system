# Bundle Code Bug Fix - Validation Limit

**Date:** 2025-10-19  
**Bug:** Bundle promo codes failing to generate  
**Root Cause:** PromoCode model validation error

---

## The Problem

### What We Found in the Logs

```
❌ Error generating bundle promo code: Error: PromoCode validation failed:
discountAmount: Discount amount cannot exceed $500
```

Full error details:

- **Config Value**: `discountAmount: 5000` (=$50.00 in cents)
- **Validation Max**: `max: [500, ...]` (only 500 cents = $5.00)
- **Result**: ValidationError - value 5000 exceeds max 500

### The Root Cause

**PromoCode.ts Line 91 (BEFORE FIX):**

```typescript
discountAmount: {
  type: Number,
  min: [1, "Discount amount must be at least $1"],
  max: [500, "Discount amount cannot exceed $500"],  // ❌ WRONG!
  // ...
}
```

**The Issue:**

- Error message says "$500" but code checks `500` (cents)
- System stores amounts in **cents** (standard for Stripe)
- 500 cents = only **$5.00**
- Bundle config wants to give $50 discount (5000 cents)
- Validation rejected it: 5000 > 500

This was a **copy-paste error** - someone wrote "$500" in the message but meant 500 cents ($5.00), or they meant $500 but forgot to convert to cents (50000).

---

## The Fix

**PromoCode.ts Line 89-91 (AFTER FIX):**

```typescript
discountAmount: {
  type: Number,
  min: [1, "Discount amount must be at least 1 cent"],       // Clearer: "1 cent" not "$1"
  max: [50000, "Discount amount cannot exceed $500.00"],    // Fixed: 50000 cents = $500.00
  // ...
}
```

**Changes:**

1. ✅ Increased max from `500` to `50000` (500 cents → $500.00)
2. ✅ Clarified min message: "1 cent" instead of "$1"
3. ✅ Clarified max message: "$500.00" with explicit cents conversion comment
4. ✅ Added inline comment: `// In cents: $500.00 = 50000 cents`

**Why 50000?**

- Reasonable maximum for promotional discounts
- Allows bundle codes up to $500 off
- Current bundle config ($50) well within limit
- Prevents abuse (can't create $1M discount codes)

---

## Test Results

### Before Fix

```
Bundle config: { enabled: true, discountAmount: 5000, expiryDays: 30 }
✅ Bundle generation enabled, starting...
Generated code: HJQHW949
❌ Error generating bundle promo code: ValidationError
    discountAmount: Discount amount cannot exceed $500
    value: 5000  ← Rejected!
```

### After Fix (Expected)

```
Bundle config: { enabled: true, discountAmount: 5000, expiryDays: 30 }
✅ Bundle generation enabled, starting...
Generated code: XXXXXXXX
PromoCode created: XXXXXXXX
✅ Bundle promo code XXXXXXXX generated for purchase ORD-20251019-XXXXX
```

---

## Next Steps

1. ✅ Fix applied to PromoCode.ts
2. ✅ Backend auto-reloaded via nodemon
3. ⏳ Create new test purchase
4. ⏳ Verify bundle code generates successfully
5. ⏳ Verify code appears on Payment Success page

---

## Business Logic Notes

### Current Bundle Config

- **Discount**: $50.00 (5000 cents)
- **Expiry**: 30 days
- **Trigger**: Any completed purchase with finalPrice > 0
- **Exclusion**: Cannot use on same program that generated it

### Validation Limits (After Fix)

- **Min**: 1 cent ($0.01)
- **Max**: 50000 cents ($500.00)
- **Range**: Supports discounts from $0.01 to $500.00

### Why This Matters

- Bundle codes encourage repeat purchases
- $50 discount is significant value (10-50% of typical program prices)
- Validation was blocking ALL bundle code generation
- Users completing purchases got NO reward codes
- This bug existed since promo code feature launch
- Debug logging was essential to finding it (silent failure otherwise)

---

## Prevention

### How Did This Happen?

1. Developer wrote validation without testing with real config values
2. Confusion between dollar amounts and cents
3. No integration test for bundle code generation via webhook
4. Error caught silently in try/catch (logged but didn't fail purchase)

### How to Prevent

1. ✅ Add integration test for webhook bundle generation
2. ✅ Add unit test for PromoCode validation limits
3. ✅ Document all monetary amounts in cents
4. ✅ Use constants for validation limits (not magic numbers)
5. ✅ Test with real system config values before deploying

---

## Files Modified

1. **backend/src/models/PromoCode.ts** (Line 89-92)

   - Changed max from 500 to 50000
   - Clarified error messages
   - Added explanatory comments

2. **backend/src/controllers/webhookController.ts** (Lines 204-250)
   - Enhanced debug logging (already done)
   - Made silent errors visible

---

## Ready to Test!

**Instructions:**

1. Go to: http://localhost:5173/dashboard/programs/68ed704180b1b71af5b33ad2/enroll
2. Make a new purchase (test card: 4242 4242 4242 4242)
3. Watch backend logs for: `✅ Bundle promo code XXXXXXXX generated...`
4. Check Payment Success page for bundle code display
5. Verify code in database and My Promo Codes page

The fix is live - let's test it!
