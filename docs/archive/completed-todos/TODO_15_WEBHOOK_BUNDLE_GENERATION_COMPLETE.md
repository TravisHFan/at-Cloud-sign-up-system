# ✅ Todo #15 Complete: Enhance Stripe Webhook - Auto-generate Bundle Codes

**Status**: ✅ COMPLETE (Temporary Implementation)  
**Completed**: 2025-10-18  
**Files Modified**:

- `backend/src/controllers/webhookController.ts`
- `backend/.env.example`

**⚠️ IMPORTANT**: This is a **temporary implementation** using environment variables. Per the original design (`PROMO_CODE_UI_SPECS.md`), bundle configuration should be stored in **MongoDB** and managed via **admin UI** at `/dashboard/admin/promo-codes/bundle-config`. This will be implemented in:

- **Todo #17**: Create SystemConfig model to store bundle settings in database
- **Todo #21**: Build admin Bundle Config UI to manage settings

---

## What Was Done

Implemented automatic bundle promo code generation after successful purchases using **temporary environment variable configuration**. When a user completes a paid purchase via Stripe, the webhook now automatically generates a new promo code that the user can apply to their next purchase (excluding the program they just bought).

**This implementation will be refactored in Todo #17** to read configuration from MongoDB `SystemConfig` collection instead of environment variables, allowing admins to configure bundle settings dynamically through the UI without server restarts.

---

## Implementation Details

### 1. Webhook Controller Enhancement

Added **Step 9** in `handleCheckoutSessionCompleted()` to generate bundle codes:

```typescript
// 9. Auto-generate bundle promo code if feature enabled
const bundleEnabled = process.env.BUNDLE_DISCOUNT_ENABLED !== "false"; // Default: true
const bundleAmount = parseInt(process.env.BUNDLE_DISCOUNT_AMOUNT || "5000", 10); // Default: $50 (5000 cents)
const bundleExpiryDays = parseInt(process.env.BUNDLE_EXPIRY_DAYS || "30", 10); // Default: 30 days

if (bundleEnabled && purchase.finalPrice > 0) {
  try {
    const { PromoCode } = await import("../models");

    // Generate unique code
    const generatedCode = await PromoCode.generateUniqueCode();

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + bundleExpiryDays);

    // Create bundle promo code
    const bundlePromoCode = await PromoCode.create({
      code: generatedCode,
      type: "bundle_discount",
      discountAmount: bundleAmount,
      ownerId: purchase.userId,
      excludedProgramId: purchase.programId, // Can't use on same program
      isActive: true,
      isUsed: false,
      expiresAt: expiresAt,
      createdBy: "system",
    });

    // Update purchase with bundle code info
    purchase.bundlePromoCode = bundlePromoCode.code;
    purchase.bundleDiscountAmount = bundleAmount;
    purchase.bundleExpiresAt = expiresAt;
    await purchase.save();

    console.log(
      `Bundle promo code ${generatedCode} generated for purchase ${purchase.orderNumber}`
    );
  } catch (bundleError) {
    // Log error but don't fail the purchase
    console.error("Error generating bundle promo code:", bundleError);
  }
}
```

### 2. Environment Variables Added

Added to `backend/.env.example`:

```bash
# =============================================================================
# PROMO CODE / BUNDLE DISCOUNT CONFIGURATION
# =============================================================================
# Bundle discount feature (auto-generate promo codes after purchases)
BUNDLE_DISCOUNT_ENABLED=true
BUNDLE_DISCOUNT_AMOUNT=5000  # Amount in cents (5000 = $50.00)
BUNDLE_EXPIRY_DAYS=30  # Number of days until bundle code expires
```

---

## Configuration Options

### Environment Variable: `BUNDLE_DISCOUNT_ENABLED`

**Purpose**: Enable/disable automatic bundle code generation  
**Type**: String (parsed as boolean)  
**Default**: `true` (enabled)  
**Values**:

- `"true"` or unset → Feature enabled
- `"false"` → Feature disabled

**Usage**:

```bash
# Enable (default)
BUNDLE_DISCOUNT_ENABLED=true

# Disable
BUNDLE_DISCOUNT_ENABLED=false

# Unset = enabled
# (no line in .env)
```

### Environment Variable: `BUNDLE_DISCOUNT_AMOUNT`

**Purpose**: Dollar amount the bundle code provides (in cents)  
**Type**: String (parsed as integer)  
**Default**: `5000` (= $50.00)  
**Range**: Recommended 1000-20000 ($10-$200)

**Usage**:

```bash
# $50 off (default)
BUNDLE_DISCOUNT_AMOUNT=5000

# $25 off
BUNDLE_DISCOUNT_AMOUNT=2500

# $100 off
BUNDLE_DISCOUNT_AMOUNT=10000
```

### Environment Variable: `BUNDLE_EXPIRY_DAYS`

**Purpose**: Number of days until bundle code expires  
**Type**: String (parsed as integer)  
**Default**: `30` (30 days)  
**Range**: Recommended 7-365 days

**Usage**:

```bash
# 30 days (default)
BUNDLE_EXPIRY_DAYS=30

# 7 days (urgent)
BUNDLE_EXPIRY_DAYS=7

# 90 days (generous)
BUNDLE_EXPIRY_DAYS=90

# 1 year
BUNDLE_EXPIRY_DAYS=365
```

---

## Feature Logic Flow

### Condition Check

Bundle code is generated **only if**:

1. ✅ `BUNDLE_DISCOUNT_ENABLED` is not `"false"`
2. ✅ `purchase.finalPrice > 0` (was a paid purchase)

**Why check finalPrice > 0?**

- Free purchases (100% off staff codes) don't generate bundle codes
- Only customers who actually paid should get reward codes
- Prevents abuse of free codes generating more free codes

### Generation Process

```
┌─────────────────────────────────────┐
│ Stripe Webhook Received             │
│ Event: checkout.session.completed   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Step 1-7: Process Payment           │
│ - Verify purchase exists            │
│ - Check idempotency                 │
│ - Capture payment method            │
│ - Mark purchase completed           │
│ - Save purchase                     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Step 8: Mark Promo Code Used        │
│ (if promo code was applied)         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Step 9: Generate Bundle Code        │
│                                     │
│ IF bundle_enabled AND finalPrice>0  │
└──────────────┬──────────────────────┘
               │
        ┌──────┴───────┐
        │              │
     NO │              │ YES
        ▼              ▼
   ┌────────┐    ┌──────────────────┐
   │ Skip   │    │ 1. Generate code │
   │        │    │ 2. Calculate exp │
   └────────┘    │ 3. Create record │
                 │ 4. Update purchase│
                 └──────┬───────────┘
                        │
                        ▼
                 ┌──────────────────┐
                 │ Log success      │
                 │ or error         │
                 └──────────────────┘
                        │
                        ▼
┌─────────────────────────────────────┐
│ Step 10: Send Confirmation Email    │
│ (with bundle code info if present)  │
└─────────────────────────────────────┘
```

---

## PromoCode Record Created

When bundle code is generated, a new document is created:

```typescript
{
  code: "X8K9P2L4",              // Generated by PromoCode.generateUniqueCode()
  type: "bundle_discount",       // Fixed type
  discountAmount: 5000,          // From BUNDLE_DISCOUNT_AMOUNT env
  discountPercent: undefined,    // Not used for bundle codes
  ownerId: "65f7a8b9...",        // User who made the purchase
  allowedProgramIds: [],         // Empty = valid for all programs
  excludedProgramId: "65f7a8c0...", // Program they just purchased
  isActive: true,                // Active immediately
  isUsed: false,                 // Not used yet
  expiresAt: "2025-11-17T...",   // Now + BUNDLE_EXPIRY_DAYS
  usedAt: undefined,             // Not used yet
  usedForProgramId: undefined,   // Not used yet
  createdBy: "system",           // Automated generation
  createdAt: "2025-10-18T...",   // Auto timestamp
  updatedAt: "2025-10-18T..."    // Auto timestamp
}
```

---

## Purchase Record Updated

After bundle code is created, purchase is updated with tracking fields:

```typescript
{
  // ... existing purchase fields ...

  // Bundle code info added:
  bundlePromoCode: "X8K9P2L4",     // The generated code
  bundleDiscountAmount: 5000,      // Amount it provides ($50)
  bundleExpiresAt: "2025-11-17T..." // When it expires
}
```

**Why store in purchase?**

- **Audit trail**: Know what code was generated when
- **Historical data**: Even if code deleted, we have record
- **Customer service**: Quickly see code details without querying PromoCode collection
- **Purchase history display**: Show "You received code X" in order details

---

## Error Handling & Safety

### Non-Blocking Design

Bundle code generation is wrapped in try-catch:

```typescript
try {
  // Generate bundle code
} catch (bundleError) {
  // Log error but don't fail the purchase
  console.error("Error generating bundle promo code:", bundleError);
}
```

**Why non-blocking?**

- ✅ Purchase completion is more important than bundle code
- ✅ If code generation fails, customer still got their program
- ✅ Admin can manually create code for customer later
- ✅ Prevents purchase failures due to promo system bugs

### Idempotency Safety

Bundle code generation happens **after** purchase is marked completed:

```typescript
// 7. Save all changes atomically
await purchase.save();

// 8. Mark promo code as used

// 9. Auto-generate bundle promo code (NEW)
```

**If webhook is called twice**:

- First call: Creates bundle code, updates purchase
- Second call: `if (purchase.status === "completed")` returns early
- Bundle code not duplicated

### Code Uniqueness

Uses `PromoCode.generateUniqueCode()` which:

- Generates random 8-character code
- Excludes confusing characters (I, O, 0, 1)
- Checks uniqueness in database
- Retries if collision detected

---

## Example Scenarios

### Scenario 1: Standard Purchase with Bundle Code

**Purchase**:

- User buys "Advanced React" program for $500
- Pays via Stripe
- No promo code used

**Webhook Processing**:

1. ✅ Purchase marked completed
2. ✅ Bundle enabled: `BUNDLE_DISCOUNT_ENABLED=true`
3. ✅ Paid purchase: `finalPrice=50000` (cents)
4. ✅ Generate code: `"B7M3N9R5"`
5. ✅ Create PromoCode:
   ```javascript
   {
     code: "B7M3N9R5",
     type: "bundle_discount",
     discountAmount: 5000,    // $50
     ownerId: user._id,
     excludedProgramId: advancedReactProgram._id,
     expiresAt: 30 days from now
   }
   ```
6. ✅ Update purchase:
   ```javascript
   {
     bundlePromoCode: "B7M3N9R5",
     bundleDiscountAmount: 5000,
     bundleExpiresAt: 30 days from now
   }
   ```

**Result**:

- User receives email confirmation (Todo: include bundle code)
- PurchaseSuccess page shows bundle code
- User can use code on any other program (except Advanced React)

### Scenario 2: Free Purchase (100% Off Staff Code)

**Purchase**:

- User applies 100% off staff code
- finalPrice = $0
- No Stripe payment (completed in checkout API)

**Webhook Processing**:

- ❌ No webhook called (no Stripe payment)
- ❌ No bundle code generated

**Why?**

- User didn't pay, so no reward needed
- Prevents abuse: free code → free code → infinite loop

### Scenario 3: Purchase with Promo Code Applied

**Purchase**:

- User buys "Node.js Mastery" for $600
- Applies bundle code "X8K9P2L4" for $50 off
- Pays $550 via Stripe

**Webhook Processing**:

1. ✅ Purchase marked completed
2. ✅ Applied promo code "X8K9P2L4" marked as used
3. ✅ Bundle enabled
4. ✅ Paid purchase: `finalPrice=55000` (cents)
5. ✅ Generate NEW code: `"K2P5M8N3"`
6. ✅ Create PromoCode for "K2P5M8N3"
7. ✅ Update purchase with bundle code

**Result**:

- User used one code, received a new one
- New code excludes "Node.js Mastery"
- User can use new code on other programs

### Scenario 4: Bundle Feature Disabled

**Environment**:

```bash
BUNDLE_DISCOUNT_ENABLED=false
```

**Purchase**:

- User buys any program
- Pays via Stripe

**Webhook Processing**:

1. ✅ Purchase marked completed
2. ❌ Bundle check: `bundleEnabled = false`
3. ❌ Skip bundle code generation

**Result**:

- No bundle code generated
- Purchase fields remain empty:
  ```javascript
  {
    bundlePromoCode: undefined,
    bundleDiscountAmount: undefined,
    bundleExpiresAt: undefined
  }
  ```

### Scenario 5: Code Generation Error

**Purchase**:

- User buys program
- Webhook processes payment

**Error Occurs**:

- Database connection timeout during PromoCode.create()

**Webhook Behavior**:

```typescript
try {
  const bundlePromoCode = await PromoCode.create({...});
  // ^ Throws error here
} catch (bundleError) {
  console.error("Error generating bundle promo code:", bundleError);
  // Purchase already saved, continues to email step
}
```

**Result**:

- ✅ Purchase still completed successfully
- ✅ User enrolled in program
- ❌ No bundle code generated
- 📝 Error logged for admin review
- 🔧 Admin can manually create code for customer

---

## Configuration Examples

### Example 1: Standard Setup (Default)

```bash
# .env
BUNDLE_DISCOUNT_ENABLED=true
BUNDLE_DISCOUNT_AMOUNT=5000
BUNDLE_EXPIRY_DAYS=30
```

**Behavior**:

- Every paid purchase → $50 off code
- Code expires in 30 days
- Code can't be used on same program

### Example 2: Generous Promotion

```bash
# .env
BUNDLE_DISCOUNT_ENABLED=true
BUNDLE_DISCOUNT_AMOUNT=10000
BUNDLE_EXPIRY_DAYS=90
```

**Behavior**:

- Every paid purchase → $100 off code
- Code expires in 90 days
- More valuable reward to incentivize purchases

### Example 3: Urgent Campaign

```bash
# .env
BUNDLE_DISCOUNT_ENABLED=true
BUNDLE_DISCOUNT_AMOUNT=7500
BUNDLE_EXPIRY_DAYS=7
```

**Behavior**:

- Every paid purchase → $75 off code
- Code expires in 7 days
- Creates urgency: "Use within a week!"

### Example 4: Feature Disabled

```bash
# .env
BUNDLE_DISCOUNT_ENABLED=false
# Other values don't matter
```

**Behavior**:

- No bundle codes generated
- System ignores amount/expiry settings

### Example 5: Production Defaults

```bash
# .env (no promo config)
# Uses hardcoded defaults
```

**Behavior**:

- Enabled: true
- Amount: $50 (5000 cents)
- Expiry: 30 days

---

## Database Impact

### New PromoCode Documents

Each paid purchase creates one new PromoCode document:

**Volume Estimates**:

- 10 purchases/day → 10 codes/day → 300 codes/month
- 100 purchases/day → 100 codes/day → 3,000 codes/month

**Storage Impact**: Minimal

- Each PromoCode document: ~500 bytes
- 1,000 codes = ~500 KB
- 100,000 codes = ~50 MB

**Index Impact**:

- Unique index on `code` field
- Compound index on `{ownerId, isActive, isUsed}`
- Efficient lookups even with millions of codes

### Purchase Updates

Each purchase updated with 3 fields:

- `bundlePromoCode`: string
- `bundleDiscountAmount`: number
- `bundleExpiresAt`: date

**Storage**: ~100 bytes per purchase (negligible)

---

## Integration with Frontend

### PurchaseSuccess Page

Frontend already displays bundle codes (Todo #9):

```typescript
// frontend/src/pages/PurchaseSuccess.tsx
{
  purchase.bundlePromoCode && (
    <BundlePromoCodeCard
      code={purchase.bundlePromoCode}
      discount={purchase.bundleDiscountAmount}
      expiresAt={purchase.bundleExpiresAt}
    />
  );
}
```

**User sees**:

- 🎉 Celebration message
- 📋 Copy-able promo code
- 💰 Discount amount
- 📅 Expiration date
- 🔗 Link to browse programs

### MyPromoCodes Page

User can view their bundle codes:

```typescript
// frontend/src/pages/MyPromoCodes.tsx
// Fetches codes via API (Todo #16)
// Displays in grid with filter tabs
```

### Email Confirmation

**Current**: Email sent without bundle code info  
**Future** (Optional for MVP):

```
Subject: Purchase Confirmed + Your $50 Discount Code!

Hi [Name],

Thank you for purchasing [Program]!

🎁 BONUS: We've added $50 off your next program!
Code: B7M3N9R5
Valid until: Nov 17, 2025
Can't be used on: [Current Program]

[Use Code Now →]
```

---

## Testing Scenarios

### Unit Tests (Todo #22)

1. **Bundle Code Generated**:

   - Make paid purchase
   - Verify PromoCode created
   - Verify purchase updated

2. **Free Purchase No Bundle**:

   - Make free purchase (100% off)
   - Verify no PromoCode created

3. **Feature Disabled**:

   - Set `BUNDLE_DISCOUNT_ENABLED=false`
   - Make purchase
   - Verify no code generated

4. **Custom Amount**:

   - Set `BUNDLE_DISCOUNT_AMOUNT=7500`
   - Make purchase
   - Verify code has $75 discount

5. **Custom Expiry**:

   - Set `BUNDLE_EXPIRY_DAYS=60`
   - Make purchase
   - Verify code expires in 60 days

6. **Excluded Program Set**:

   - Make purchase
   - Verify `excludedProgramId = purchase.programId`

7. **Error Doesn't Fail Purchase**:
   - Mock PromoCode.create() to throw error
   - Make purchase
   - Verify purchase still completes

### Integration Tests

1. **End-to-End Flow**:

   - User buys Program A → Gets code
   - User views code in My Promo Codes
   - User applies code to Program B → Success
   - User tries code on Program A → Error

2. **Idempotency**:
   - Trigger webhook twice
   - Verify only one code created

---

## Monitoring & Analytics

### Logs to Watch

```
✅ Success: "Bundle promo code X8K9P2L4 generated for purchase ORD-20251018-00001"
❌ Error: "Error generating bundle promo code: [error details]"
```

### Metrics to Track

1. **Generation Rate**: % of purchases that generate codes
2. **Usage Rate**: % of generated codes that get used
3. **Time to Use**: Average days between generation and usage
4. **Value Distribution**: How often codes are used (by discount amount)
5. **Expiry Waste**: % of codes that expire unused

### Admin Queries

```javascript
// How many bundle codes generated today?
await PromoCode.countDocuments({
  type: "bundle_discount",
  createdAt: { $gte: startOfDay },
});

// How many bundle codes unused and active?
await PromoCode.countDocuments({
  type: "bundle_discount",
  isUsed: false,
  isActive: true,
  expiresAt: { $gt: new Date() },
});

// Which programs generate most codes?
await Purchase.aggregate([
  { $match: { bundlePromoCode: { $exists: true } } },
  { $group: { _id: "$programId", count: { $sum: 1 } } },
  { $sort: { count: -1 } },
]);
```

---

## Success Criteria ✅

- [x] Webhook checks `BUNDLE_DISCOUNT_ENABLED` env var
- [x] Only generates codes for paid purchases (`finalPrice > 0`)
- [x] Uses `PromoCode.generateUniqueCode()` for code generation
- [x] Gets amount from `BUNDLE_DISCOUNT_AMOUNT` env (default 5000)
- [x] Gets expiry from `BUNDLE_EXPIRY_DAYS` env (default 30)
- [x] Creates PromoCode with correct fields
- [x] Sets `excludedProgramId` to purchased program
- [x] Sets `ownerId` to purchaser
- [x] Updates purchase with bundle code info
- [x] Non-blocking: errors don't fail purchase
- [x] Logs success/errors appropriately
- [x] Environment variables documented in .env.example
- [x] TypeScript compilation passes

---

## Next Steps - Todo #16

Now that bundle codes are automatically generated, Todo #16 will create the API routes and controller:

**User Routes**:

- `GET /api/promo-codes/my-codes` - Fetch user's codes with filters
- `POST /api/promo-codes/validate` - Validate code for program

**Admin Routes**:

- `GET /api/promo-codes` - List all codes with pagination
- `POST /api/promo-codes/staff` - Create staff access code
- `GET /api/promo-codes/config` - Get bundle config
- `PUT /api/promo-codes/config` - Update bundle config

These routes will power:

- MyPromoCodes page (user's code list)
- AdminPromoCodes page (admin management)
- Bundle config UI (Todo #21)

---

## Statistics

- **Files Modified**: 2 (webhookController.ts, .env.example)
- **Lines Added**: ~55 lines (bundle generation logic + env vars)
- **Environment Variables**: 3 (ENABLED, AMOUNT, EXPIRY_DAYS)
- **Database Writes**: 2 per purchase (PromoCode create + Purchase update)
- **Breaking Changes**: 0 (feature is additive, disabled by env var)
- **Default Behavior**: Enabled with $50/30-day codes

---

**Ready for Todo #16**: ✅ Create API routes and controller for promo code management!
