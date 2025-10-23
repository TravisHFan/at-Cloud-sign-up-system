# Bundle Code Debug Test Instructions

**Date:** 2025-10-19  
**Purpose:** Test bundle code generation with enhanced debug logging

## Current Status

✅ Enhanced logging added to webhookController.ts  
✅ Stripe CLI running (forwarding to localhost:5001/api/webhooks/stripe)  
✅ Backend server running with nodemon (auto-reload enabled)  
✅ Bundle config enabled: $50 discount, 30 days expiry

---

## Test Purchase Instructions

### Step 1: Open Backend Logs

**Option A: Check Task Output**

- In VS Code, view the "Start Backend Development Server" task output
- You should see logs in real-time

**Option B: Use Terminal**

```bash
tail -f /path/to/backend/logs
```

### Step 2: Make a New Purchase

1. **Navigate to enrollment page:**

   - http://localhost:5173/dashboard/programs/68ed704180b1b71af5b33ad2/enroll
   - Or navigate through UI: Programs → 2025 Melek & Preneur Circle → Enroll

2. **Fill enrollment form:**

   - Uncheck "Enroll as Class Representative" (to avoid that discount)
   - Click "Proceed to Payment"

3. **Complete Stripe checkout:**

   - Test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/30`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)
   - Click "Pay"

4. **Watch for redirect and webhook processing:**
   - You'll be redirected to Payment Success page
   - Webhook should process within 1-2 seconds
   - Page may auto-refresh when webhook completes

### Step 3: Monitor Debug Logs

Watch for these specific log messages in the backend:

```
✅ Expected Log Sequence:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Processing checkout.session.completed...
2. Checkout session completed: cs_test_xxxxx
3. Purchase completed successfully: ORD-XXXXXXX-XXXXX
4. 🎁 Checking bundle discount config...
5. Bundle config: { enabled: true, discountAmount: 5000, expiryDays: 30 }
6. ✅ Bundle generation enabled, starting...
7. Generated code: BUNDLEXXXXXX
8. PromoCode created: BUNDLEXXXXXX
9. ✅ Bundle promo code BUNDLEXXXXXX generated for purchase ORD-XXXXXXX-XXXXX
10. ✅ Webhook processed successfully
```

**If you see:**

```
❌ Bundle generation skipped - enabled: false, finalPrice: 0
```

This means either config is disabled or finalPrice is 0.

**If you see:**

```
❌ Error generating bundle promo code: [error details]
Stack trace: ...
```

This shows what went wrong.

---

## Verification After Purchase

### Check Purchase in Database

```bash
# Replace with actual order number from logs
mongosh atcloud-signup --quiet --eval '
const purchase = db.purchases.findOne(
  { orderNumber: "ORD-20251019-00003" },
  {
    orderNumber: 1,
    finalPrice: 1,
    bundlePromoCode: 1,
    bundleDiscountAmount: 1,
    bundleExpiresAt: 1
  }
);
printjson(purchase);
'
```

**Expected Output:**

```javascript
{
  _id: ObjectId("..."),
  orderNumber: "ORD-20251019-00003",
  finalPrice: 10000,  // $100.00 in cents
  bundlePromoCode: "BUNDLEXXXXXX",
  bundleDiscountAmount: 5000,
  bundleExpiresAt: ISODate("2025-11-18T...")
}
```

### Check PromoCode Document

```bash
# Replace with actual code from logs
mongosh atcloud-signup --quiet --eval '
const code = db.promocodes.findOne(
  { code: "BUNDLEXXXXXX" },
  {
    code: 1,
    type: 1,
    discountAmount: 1,
    ownerId: 1,
    excludedProgramId: 1,
    isActive: 1,
    isUsed: 1,
    expiresAt: 1
  }
);
printjson(code);
'
```

**Expected Output:**

```javascript
{
  _id: ObjectId("..."),
  code: "BUNDLEXXXXXX",
  type: "bundle_discount",
  discountAmount: 5000,
  ownerId: ObjectId("..."),
  excludedProgramId: ObjectId("68ed704180b1b71af5b33ad2"),
  isActive: true,
  isUsed: false,
  expiresAt: ISODate("2025-11-18T...")
}
```

### Check Payment Success Page

1. Refresh the page if needed
2. Look for the bundle promo code card:

```
┌─────────────────────────────────────────────┐
│  🎉 Bonus: Exclusive Discount Code!         │
│                                             │
│  BUNDLEXXXXXX                   [Copy]      │
│                                             │
│  Use this code for $50.00 off your next    │
│  program enrollment!                        │
│                                             │
│  Valid until: November 18, 2025            │
└─────────────────────────────────────────────┘
```

---

## Troubleshooting

### Problem: No bundle logs appearing

**Check 1: Is webhook firing?**

```bash
# Check Stripe CLI output
# Should show:
# → checkout.session.completed [200]
```

**Check 2: Is backend receiving webhook?**

```bash
# Look for in backend logs:
# Processing checkout.session.completed...
```

If not appearing:

```bash
# Restart backend
cd backend && npm run dev

# Restart Stripe CLI
stripe listen --forward-to localhost:5001/api/webhooks/stripe
```

### Problem: Bundle generation skipped

**If you see:**

```
❌ Bundle generation skipped - enabled: false, finalPrice: 0
```

Check config:

```bash
mongosh atcloud-signup --eval '
  db.systemconfigs.findOne({ key: "bundle_discount_config" }).value
'
```

Enable if needed:

```bash
mongosh atcloud-signup --eval '
  db.systemconfigs.updateOne(
    { key: "bundle_discount_config" },
    { $set: { "value.enabled": true } }
  )
'
```

### Problem: Error in bundle generation

Look for the stack trace in logs:

```
❌ Error generating bundle promo code: [error message]
Stack trace: [detailed trace]
```

Common issues:

- PromoCode model not found → Check imports
- Database connection issue → Check MongoDB
- Validation error → Check required fields

---

## Expected Pricing (No Class Rep)

For "2025 Melek & Preneur Circle":

- Full Price: $100.00
- Early Bird Discount: -$20.00 (if within early bird window)
- **Final Price: $80.00** (as shown in screenshot)

Bundle code should generate because finalPrice > 0.

---

## Next Steps After Successful Test

1. ✅ Verify bundle code displays on Payment Success page
2. ✅ Navigate to "My Promo Codes" to see the new code
3. ✅ Try copying the code
4. ✅ Try applying it to a different program enrollment
5. ✅ Verify it gives $50 discount
6. ✅ Verify it can't be used on the same program (exclusion works)

---

## Clean Up Test Purchases (Optional)

```bash
# Delete test purchases
mongosh atcloud-signup --eval '
  db.purchases.deleteMany({
    orderNumber: { $regex: /^ORD-20251019/ }
  })
'

# Delete test promo codes
mongosh atcloud-signup --eval '
  db.promocodes.deleteMany({
    code: { $regex: /^BUNDLE/ },
    type: "bundle_discount"
  })
'
```

---

## Summary

Current setup:

- ✅ Debug logging added
- ✅ Stripe CLI running
- ✅ Backend ready
- ✅ Config enabled

**YOU ARE READY TO TEST!**

Follow the steps above and watch the logs. The enhanced logging will show exactly what's happening during bundle code generation.
