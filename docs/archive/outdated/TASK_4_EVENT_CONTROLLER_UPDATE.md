# EventController Update Guide: programId → programLabels

**Status:** In Progress (Task 4)  
**Date:** 2025-10-12

---

## Summary

This document outlines the changes needed to update `eventController.ts` to use `programLabels` array instead of single `programId`.

### Changes Made So Far ✅

1. **CreateEventRequest Interface** (Line ~104)

   - ✅ Removed: `programId?: string | null`
   - ✅ Removed: `mentorCircle?: "E" | "M" | "B" | "A" | null`
   - ✅ Removed: `mentorIds?: string[]`
   - ✅ Added: `programLabels?: string[]`

2. **Mentor Circle Validation** (Lines ~1580-1620)

   - ✅ Removed entire validation block for Mentor Circle events
   - ✅ Removed programId requirement check
   - ✅ Removed mentorCircle requirement check

3. **Program Validation in createEvent** (Lines ~1730-1770)

   - ✅ Changed from single `programId` to array `programLabels`
   - ✅ Updated validation to loop through array
   - ✅ Validates each program ID exists

4. **Mentor Snapshot Logic** (Lines ~1770-1920)

   - ✅ Removed `buildMentorsSnapshot()` function
   - ✅ Removed `buildAdditionalMentors()` function
   - ✅ Removed all mentor merging logic

5. **createAndSaveEvent Function** (Lines ~1920-1980)
   - ✅ Removed `mentors: mergedMentors` from Event creation
   - ✅ Updated program linking to loop through `linkedPrograms` array
   - ✅ Adds event to multiple programs' events arrays

### Changes Still Needed ⏳

#### 1. updateEvent Function (Lines ~2940-3050)

**Current Code** (needs replacement):

```typescript
// Line ~2942
const prevProgramId: string | null = event.programId
  ? EventController.toIdString(event.programId)
  : null;

// Compute next programId if being updated
let nextProgramId: string | null = prevProgramId;
let nextProgramDoc: unknown | null = null;
if ((updateData as { programId?: unknown }).programId !== undefined) {
  const raw = (updateData as { programId?: unknown }).programId;
  if (raw === null || raw === "" || raw === undefined || raw === "none") {
    nextProgramId = null;
  } else {
    const pid = String(raw);
    if (!mongoose.Types.ObjectId.isValid(pid)) {
      res.status(400).json({
        success: false,
        message: "Invalid programId.",
      });
      return;
    }
    nextProgramId = pid;
    nextProgramDoc = await Program.findById(pid).select("programType mentors mentorsByCircle");
    if (!nextProgramDoc) {
      res.status(400).json({
        success: false,
        message: "Program not found for provided programId.",
      });
      return;
    }
  }
} else {
  nextProgramId = prevProgramId;
}

// Persist programId change
if ((updateData as { programId?: unknown }).programId !== undefined) {
  (updateData as { programId?: unknown }).programId =
    nextProgramId !== null
      ? new mongoose.Types.ObjectId(nextProgramId)
      : null;
}

// Mentor Circle mentor snapshot refresh logic (~50 lines)
const effectiveType = (updateData.type as string) || event.type;
const effectiveMentorCircle = ...;
if (effectiveType === "Mentor Circle" && nextProgramId && effectiveMentorCircle) {
  // Refresh mentors from program.mentorsByCircle[circle]
}
```

**New Code** (should be):

```typescript
// Snapshot previous programLabels for sync logic
const prevProgramLabels = Array.isArray(event.programLabels)
  ? (event.programLabels as unknown[]).map((id) => String(id))
  : [];

// Compute next programLabels if being updated
let nextProgramLabels: string[] = [];
if ((updateData as { programLabels?: unknown }).programLabels !== undefined) {
  const raw = (updateData as { programLabels?: unknown }).programLabels;
  if (Array.isArray(raw)) {
    const validated: string[] = [];
    for (const item of raw) {
      if (
        item === null ||
        item === "" ||
        item === undefined ||
        item === "none"
      ) {
        continue;
      }
      const pid = String(item);
      if (!mongoose.Types.ObjectId.isValid(pid)) {
        res.status(400).json({
          success: false,
          message: `Invalid program ID: ${pid}`,
        });
        return;
      }
      // Verify program exists
      const programExists = await Program.findById(pid).select("_id");
      if (!programExists) {
        res.status(400).json({
          success: false,
          message: `Program not found for ID: ${pid}`,
        });
        return;
      }
      validated.push(pid);
    }
    nextProgramLabels = validated;
  } else {
    nextProgramLabels = [];
  }
} else {
  nextProgramLabels = prevProgramLabels;
}

// Persist programLabels change
if ((updateData as { programLabels?: unknown }).programLabels !== undefined) {
  (updateData as { programLabels?: unknown }).programLabels =
    nextProgramLabels.map((id) => new mongoose.Types.ObjectId(id));
}

// Remove all mentor snapshot logic (no longer needed)
```

#### 2. Program Sync Logic After Save (Lines ~3285-3350)

**Current Code**:

```typescript
// Line ~3285
if (prevProgramId !== nextProgramId) {
  // Remove event from old program
  if (prevProgramId) {
    await Program.updateOne(
      { _id: prevProgramId },
      { $pull: { events: event._id } }
    );
  }
  // Add event to new program
  if (nextProgramId) {
    await Program.updateOne(
      { _id: nextProgramId },
      { $addToSet: { events: event._id } }
    );
  }
}
```

**New Code**:

```typescript
// Calculate which programs were added/removed
const prevSet = new Set(prevProgramLabels);
const nextSet = new Set(nextProgramLabels);

const addedPrograms = nextProgramLabels.filter((id) => !prevSet.has(id));
const removedPrograms = prevProgramLabels.filter((id) => !nextSet.has(id));

// Remove event from programs no longer in labels
for (const programId of removedPrograms) {
  try {
    await Program.updateOne(
      { _id: new mongoose.Types.ObjectId(programId) },
      { $pull: { events: event._id } }
    );
  } catch (e) {
    console.warn(`Failed to remove event from program ${programId}`, e);
  }
}

// Add event to newly added programs
for (const programId of addedPrograms) {
  try {
    await Program.updateOne(
      { _id: new mongoose.Types.ObjectId(programId) },
      { $addToSet: { events: event._id } }
    );
  } catch (e) {
    console.warn(`Failed to add event to program ${programId}`, e);
  }
}
```

---

## Implementation Steps

### Step 1: Update createEvent ✅ (DONE)

- Interface updated
- Validation updated
- Program linking updated
- Mentor logic removed

### Step 2: Update updateEvent (IN PROGRESS)

1. Find lines ~2940-3050
2. Replace prev/nextProgramId logic with prev/nextProgramLabels
3. Remove mentor snapshot refresh logic (~50 lines)
4. Update validation to handle array

### Step 3: Update Program Sync After Save

1. Find lines ~3285-3350
2. Replace single program sync with array diff logic
3. Loop through added/removed programs

### Step 4: Search for Remaining References

```bash
# Search for any remaining programId usage
grep -n "programId" backend/src/controllers/eventController.ts

# Search for mentorCircle
grep -n "mentorCircle" backend/src/controllers/eventController.ts

# Search for mentors snapshot
grep -n "mentors" backend/src/controllers/eventController.ts
```

### Step 5: Test Compilation

```bash
cd backend
npx tsc --noEmit
```

---

## Testing Checklist

After all changes:

- [ ] TypeScript compiles without errors
- [ ] Create event with no programs
- [ ] Create event with one program
- [ ] Create event with multiple programs
- [ ] Update event to add programs
- [ ] Update event to remove programs
- [ ] Update event to change programs
- [ ] Verify program.events array updates correctly
- [ ] Run integration tests

---

## Related Files

### Also Need Updates:

1. ✅ `backend/src/models/Event.ts` - Model updated
2. ⏳ `backend/src/controllers/eventController.ts` - In progress (this file)
3. ⏳ `backend/src/controllers/programController.ts` - Task 6
4. ⏳ `backend/src/services/ResponseBuilderService.ts` - May need updates
5. ⏳ `shared/types/event.types.ts` - Task 7

### Search Commands:

```bash
# Find all files using programId
grep -r "programId" backend/src/

# Find all files using mentorCircle
grep -r "mentorCircle" backend/src/

# Find all files using event.mentors
grep -r "\.mentors" backend/src/
```

---

## Notes

- The eventController.ts file is 5,327 lines long
- Very complex with many edge cases
- Take care not to break existing functionality
- Test thoroughly after each change
- Consider breaking into smaller commits

---

## Next Actions

1. Complete updateEvent function changes
2. Update program sync logic
3. Search and remove remaining references
4. Test compilation
5. Run integration tests
6. Move to Task 5 (filter/query APIs)
