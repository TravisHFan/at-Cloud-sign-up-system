# Bug Fix: Class Rep Enrollment Failing on Legacy Programs

**Date:** 2025-10-19  
**Status:** ✅ FIXED  
**Severity:** HIGH (Blocking user purchases)

## Problem

Users attempting to enroll as Class Representative received a false error: **"Class Rep slots are full. Please proceed with standard pricing."** even though NO Class Rep spots were taken.

### Reproduction

1. Navigate to "2025 Melek & Preneur Circle" program
2. Click "Enroll Now"
3. Select "Enroll as Class Representative"
4. Receive browser alert: "Class Rep slots are full..."

### Expected Behavior

- Program has `classRepLimit: 2`
- No existing Class Rep enrollments
- User should be able to enroll as Class Rep successfully

## Root Cause

The `classRepCount` field was **missing (undefined)** in the database for programs created before this field was added to the schema.

```typescript
// Backend atomic update query (BEFORE FIX)
const updatedProgram = await Program.findOneAndUpdate(
  {
    _id: program._id,
    classRepCount: { $lt: program.classRepLimit }, // ❌ undefined < 2 = false
  },
  { $inc: { classRepCount: 1 } }
);

// When classRepCount is undefined, MongoDB comparison fails
// undefined < 2 evaluates to false
// findOneAndUpdate returns null
// Code throws "slots are full" error
```

### Why Field Was Missing

- Program schema has `classRepCount: { type: Number, default: 0 }`
- Schema defaults only apply to **new documents**
- Existing programs created before field was added have **no classRepCount field**
- Database migration was not performed

## Solution

Updated the atomic query to handle three cases:

1. **Existing count < limit** (normal case)
2. **Field doesn't exist** (legacy programs) ✅
3. **Field is null** (edge case)

```typescript
// AFTER FIX - with $or conditions
const updatedProgram = await Program.findOneAndUpdate(
  {
    _id: program._id,
    $or: [
      { classRepCount: { $lt: program.classRepLimit } }, // Normal case
      { classRepCount: { $exists: false } }, // Legacy programs ✅
      { classRepCount: null }, // Null case
    ],
  },
  { $inc: { classRepCount: 1 } } // Initializes to 1 if field missing
);
```

### MongoDB $inc Behavior

- `$inc` on **non-existent field** initializes it to the increment value
- `$inc: { classRepCount: 1 }` on undefined field → sets to 1 ✅
- Atomic operation prevents race conditions

## Changes Made

### 1. Backend Controller Fix

**File:** `backend/src/controllers/purchaseController.ts`  
**Lines:** 170-177

```typescript
// Added $or condition to handle missing classRepCount
$or: [
  { classRepCount: { $lt: program.classRepLimit } },
  { classRepCount: { $exists: false } },
  { classRepCount: null },
],
```

### 2. Integration Test Added

**File:** `backend/tests/integration/api/purchases-api.integration.test.ts`  
**Test:** "should allow class rep enrollment when classRepCount field is missing (legacy programs)"

```typescript
// Creates program without classRepCount using insertOne
await Program.collection.insertOne({
  _id: new mongoose.Types.ObjectId(),
  title: "Legacy Program Without ClassRepCount",
  classRepLimit: 3,
  // classRepCount: NOT SET
});

// Verifies enrollment succeeds and field is initialized
expect(response.status).toBe(200);
expect(updatedProgram?.classRepCount).toBe(1);
```

### 3. Database Fix Applied

**Program:** "2025 Melek & Preneur Circle"  
**Action:** Initialized `classRepCount: 0`

```bash
mongosh atcloud-signup --eval '
  db.programs.updateOne(
    { _id: ObjectId("68ed704180b1b71af5b33ad2") },
    { $set: { classRepCount: 0 } }
  )
'
```

## Verification

### Manual Test

```bash
# Verify query logic
mongosh atcloud-signup --eval '
  const programId = ObjectId("68ed704180b1b71af5b33ad2");

  // OLD query (fails)
  db.programs.findOne({
    _id: programId,
    classRepCount: { $lt: 2 }
  });  // Returns: null (NOT FOUND)

  // NEW query (succeeds)
  db.programs.findOne({
    _id: programId,
    $or: [
      { classRepCount: { $lt: 2 } },
      { classRepCount: { $exists: false } }
    ]
  });  // Returns: document (FOUND) ✅
'
```

### Test Results

- ✅ Integration test passes
- ✅ Manual MongoDB query verification passed
- ✅ Database updated for production program
- ✅ No TypeScript errors

## Impact

**Before Fix:**

- Users could NOT enroll as Class Rep on legacy programs
- False "slots full" error displayed
- Revenue loss from blocked enrollments

**After Fix:**

- ✅ Legacy programs work correctly
- ✅ classRepCount auto-initializes on first enrollment
- ✅ All future programs have field set to 0 by default
- ✅ Atomic operations still prevent race conditions

## Migration Plan

### For Development/Staging

```javascript
// Update all programs missing classRepCount
db.programs.updateMany(
  {
    classRepLimit: { $exists: true },
    classRepCount: { $exists: false },
  },
  { $set: { classRepCount: 0 } }
);
```

### For Production

```bash
# 1. Backup database
mongodump --db atcloud-signup --out /backup/before-classrep-fix

# 2. Apply migration
mongosh atcloud-signup --eval '
  const result = db.programs.updateMany(
    {
      classRepLimit: { $exists: true },
      classRepCount: { $exists: false }
    },
    { $set: { classRepCount: 0 } }
  );

  print("Programs updated:", result.modifiedCount);
'

# 3. Verify
mongosh atcloud-signup --eval '
  const missing = db.programs.countDocuments({
    classRepLimit: { $exists: true, $gt: 0 },
    classRepCount: { $exists: false }
  });

  print("Programs still missing classRepCount:", missing);
'
```

## Lessons Learned

1. **Schema defaults don't apply retroactively** - Always plan database migrations when adding new fields
2. **MongoDB comparisons with undefined** - `undefined < N` always returns false
3. **Atomic operations need null handling** - Include `$exists: false` checks in queries
4. **Test with legacy data** - Simulate old database states in integration tests

## Related Files

- `backend/src/controllers/purchaseController.ts` - Main fix
- `backend/src/models/Program.ts` - Schema definition
- `backend/tests/integration/api/purchases-api.integration.test.ts` - Test coverage
- `docs/BUG_FIX_CLASS_REP_MISSING_COUNT.md` - This document

## References

- MongoDB `$inc` operator: https://www.mongodb.com/docs/manual/reference/operator/update/inc/
- MongoDB `$exists` operator: https://www.mongodb.com/docs/manual/reference/operator/query/exists/
- Mongoose schema defaults: https://mongoosejs.com/docs/defaults.html
