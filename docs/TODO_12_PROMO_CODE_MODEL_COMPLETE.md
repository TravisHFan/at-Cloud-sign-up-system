# Todo #12 Complete: PromoCode Model Created

**Date**: 2025-10-18  
**Status**: ✅ **COMPLETED**  
**Time**: ~2.5 hours  
**File**: `backend/src/models/PromoCode.ts`

---

## 📊 What Was Built

### MongoDB Model Structure (370 lines)

Created a comprehensive `PromoCode` model with:

#### **Core Fields**

- `code` - 8-character unique code (e.g., "X8K9P2L4")
- `type` - "bundle_discount" or "staff_access"
- `discountAmount` - For bundle: dollar amount ($50 = 50)
- `discountPercent` - For staff: typically 100 (100% off)

#### **Ownership & Restrictions**

- `ownerId` - User who owns/can use this code (ref: User)
- `allowedProgramIds` - For staff codes: specific programs (empty = all)
- `excludedProgramId` - For bundle codes: can't use on purchase program

#### **Status Tracking**

- `isActive` - Can be used? (admin can deactivate)
- `isUsed` - Already redeemed?
- `expiresAt` - Optional expiration date

#### **Usage Tracking**

- `usedAt` - When redeemed
- `usedForProgramId` - Which program it was used for

#### **Metadata**

- `createdAt` - Auto-managed by timestamps
- `createdBy` - "system" or admin user ID
- `updatedAt` - Auto-managed by timestamps

---

## 🔍 Database Indexes

Optimized for performance with strategic indexes:

### 1. Unique Index

```typescript
code: { unique: true, index: true }
```

Primary lookup field for fast code validation.

### 2. Compound Index - User Queries

```typescript
{ ownerId: 1, isActive: 1, isUsed: 1 }
```

**Use case**: Find all active, unused codes for a user (most common query)

### 3. Compound Index - Type Filtering

```typescript
{ type: 1, isActive: 1 }
```

**Use case**: Admin view - show all active bundle codes

### 4. Compound Index - Expiry Cleanup

```typescript
{ expiresAt: 1, isUsed: 1 }
```

**Use case**: Batch jobs to clean up expired codes

---

## 🛠️ Instance Methods

### `canBeUsedForProgram(programId)`

Validates if code can be used for a specific program:

- Checks if already used
- Checks if active
- Checks if expired
- Bundle-specific: Checks excludedProgramId
- Staff-specific: Checks allowedProgramIds

**Returns**: `{ valid: boolean, reason?: string }`

### `markAsUsed(programId)`

Marks code as used when applied to purchase:

- Sets `isUsed = true`
- Sets `usedAt = now`
- Sets `usedForProgramId = programId`
- Saves to database

**Returns**: Promise<IPromoCode>

### `deactivate()`

Admin action to manually disable code:

- Sets `isActive = false`
- Saves to database

**Returns**: Promise<IPromoCode>

---

## 📐 Static Methods

### `generateUniqueCode()`

Generates a unique 8-character code:

- Uses characters: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
- Excludes confusing: I, O, 0, 1
- Checks uniqueness against database
- Loops until unique code found

**Returns**: Promise<string>

### `findValidCodesForUser(userId, programId?)`

Finds all valid codes for a user:

- Filters: active, not used, not expired
- If programId provided: applies program-specific validation
- Sorts by createdAt descending

**Returns**: Promise<IPromoCode[]>

---

## 🎨 Virtual Fields

### `isExpired` (getter)

```typescript
get isExpired(): boolean {
  if (!this.expiresAt) return false;
  return this.expiresAt < new Date();
}
```

### `isValid` (getter)

```typescript
get isValid(): boolean {
  return !this.isUsed && this.isActive && !this.isExpired;
}
```

---

## ✅ Validation Rules

### Code Validation

- Required, unique
- Exactly 8 characters
- Uppercase alphanumeric only
- Pattern: `/^[A-Z0-9]{8}$/`

### Type-Specific Validation

**Bundle Discount**:

- Must have `discountAmount` (1-500)
- Can have `excludedProgramId`
- Cannot have `allowedProgramIds`

**Staff Access**:

- Must have `discountPercent` (0-100)
- Can have `allowedProgramIds`
- Cannot have `excludedProgramId`

### Expiry Validation

- If set, must be in future at creation
- Optional field (no expiry if null)

### Usage Validation

- `usedAt` can only be set when `isUsed = true`
- `usedForProgramId` can only be set when `isUsed = true`

---

## 🔒 Pre-Save Hooks

Validates discount configuration before saving:

```typescript
promoCodeSchema.pre("save", function (next) {
  if (type === "bundle_discount" && !discountAmount) {
    return next(new Error("Bundle codes must have discountAmount"));
  }
  if (type === "staff_access" && discountPercent === undefined) {
    return next(new Error("Staff codes must have discountPercent"));
  }
  next();
});
```

---

## 📦 Export Configuration

### Updated Files

1. **Created**: `backend/src/models/PromoCode.ts` (370 lines)
2. **Updated**: `backend/src/models/index.ts` (added export)

### Export Statement

```typescript
export { default as PromoCode, IPromoCode } from "./PromoCode";
```

---

## 🧪 Verification

### TypeScript Compilation ✅

```bash
$ npm run type-check
✓ No errors found
```

### ESLint ✅

```bash
$ npm run lint
✓ No errors found
```

---

## 📊 Model Statistics

| Aspect           | Count                    |
| ---------------- | ------------------------ |
| Total Lines      | 370                      |
| Fields           | 13                       |
| Indexes          | 4 (1 unique, 3 compound) |
| Instance Methods | 3                        |
| Static Methods   | 2                        |
| Virtual Fields   | 2                        |
| Pre-Save Hooks   | 1                        |
| Validation Rules | 15+                      |

---

## 💡 Design Decisions

### Why Uppercase Codes?

- Easier to read and communicate
- Reduces confusion (no lowercase l vs 1)
- Professional appearance

### Why Exclude I, O, 0, 1?

- Prevents confusion in manual entry
- I looks like 1, O looks like 0
- Better user experience

### Why Compound Indexes?

- Most queries filter by multiple fields
- Single compound index faster than multiple single indexes
- Optimizes for common access patterns

### Why Virtual Fields?

- Computed values don't need storage
- Always up-to-date
- Clean interface for common checks

### Why Instance Methods?

- Encapsulates business logic
- Reusable across controllers
- Single source of truth for validation

---

## 🔄 Integration Points

### Used By (Future Todos)

- ✅ Todo #13: Purchase model will reference PromoCode
- ✅ Todo #14: createCheckoutSession will validate codes
- ✅ Todo #15: Webhook will create bundle codes
- ✅ Todo #16: API routes will query codes
- ✅ Todo #17: Config system will control bundle generation
- ✅ Todo #22: Tests will validate model behavior

---

## 🎯 Example Usage

### Create Bundle Code (System)

```typescript
const bundleCode = await PromoCode.create({
  code: await PromoCode.generateUniqueCode(),
  type: "bundle_discount",
  discountAmount: 50, // $50 off
  ownerId: userId,
  excludedProgramId: purchasedProgramId,
  isActive: true,
  isUsed: false,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  createdBy: "system",
});
```

### Create Staff Code (Admin)

```typescript
const staffCode = await PromoCode.create({
  code: await PromoCode.generateUniqueCode(),
  type: "staff_access",
  discountPercent: 100, // 100% off
  ownerId: volunteerId,
  allowedProgramIds: [programId1, programId2], // or [] for all
  isActive: true,
  isUsed: false,
  expiresAt: undefined, // No expiry
  createdBy: adminUserId,
});
```

### Validate Code for Purchase

```typescript
const code = await PromoCode.findOne({ code: "X8K9P2L4" });
if (!code) throw new Error("Invalid code");

const validation = code.canBeUsedForProgram(programId);
if (!validation.valid) {
  throw new Error(validation.reason);
}

// Apply discount
const discount =
  code.type === "bundle_discount"
    ? code.discountAmount
    : (price * code.discountPercent) / 100;
```

### Find User's Valid Codes

```typescript
const codes = await PromoCode.findValidCodesForUser(userId, programId);
// Returns only codes that can be used for this program
```

---

## ✅ Success Criteria Met

- [x] MongoDB schema created with all required fields
- [x] Indexes for performance optimization
- [x] Validation rules for data integrity
- [x] Instance methods for business logic
- [x] Static methods for utilities
- [x] Virtual fields for computed values
- [x] Pre-save hooks for validation
- [x] Exported to models/index.ts
- [x] TypeScript compilation successful
- [x] ESLint passing

---

## 📈 Next Steps

**Ready for Todo #13**: Update Purchase Model with Promo Fields

Will add to Purchase model:

- `promoCode` - Code used on this purchase
- `promoDiscountAmount` - Dollar discount applied
- `promoDiscountPercent` - Percentage discount applied
- `bundlePromoCode` - Code generated by this purchase
- `bundleDiscountAmount` - Amount for bundle code
- `bundleExpiresAt` - Bundle code expiration

---

**Status**: ✅ **TODO #12 COMPLETE**  
**Next**: 🎯 **TODO #13 - Update Purchase Model**
