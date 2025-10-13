# Test Plan: EventController programLabels Migration

**Date:** 2025-10-12  
**Status:** Test-Driven Refactoring  
**Coverage Goal:** 99%+

---

## Test Strategy

Following **Option D** approach:

1. ✅ Build comprehensive tests (99%+ coverage)
2. ✅ Ensure all tests pass
3. 🔄 Make automated changes
4. ✅ Re-run tests to catch regressions
5. ✅ Deep edge case analysis

---

## Existing Test Files

### Unit Tests

- `eventController.test.ts` - Main unit tests
- `eventController.mentorCircle.test.ts` - **⚠️ Will need updates** (tests old logic)
- `eventController.timezoneBatchStatus.test.ts` - Timezone tests
- `eventController.updateWorkshopGroupTopic.auth.test.ts` - Workshop tests

### Integration Tests

- `events.programs.integration.test.ts` - **⚠️ Will need updates** (tests programId + mentorCircle)
- 50+ other integration tests

---

## New Tests Needed

### 1. Create Event with programLabels

**File:** `backend/tests/integration/api/events-program-labels.integration.test.ts`

**Test Cases:**

```typescript
describe("POST /api/events with programLabels", () => {
  test("create event with no programs (empty array)", async () => {
    // programLabels: []
    // Verify event created, programLabels: []
  });

  test("create event with one program", async () => {
    // programLabels: [programId1]
    // Verify event created, programLabels contains programId1
    // Verify program.events contains eventId
  });

  test("create event with multiple programs", async () => {
    // programLabels: [programId1, programId2, programId3]
    // Verify event created, programLabels contains all 3
    // Verify all 3 programs.events contain eventId
  });

  test("reject invalid program ID in array", async () => {
    // programLabels: ["invalid-id"]
    // Expect 400 error
  });

  test("reject non-existent program ID", async () => {
    // programLabels: [validButNonExistentId]
    // Expect 400 error with "Program not found"
  });

  test("handle null/undefined/empty string in array", async () => {
    // programLabels: [programId1, null, "", undefined, "none", programId2]
    // Verify only valid IDs are saved
  });

  test("deduplicate program IDs", async () => {
    // programLabels: [programId1, programId1, programId1]
    // Verify event.programLabels has only one entry
  });
});
```

### 2. Update Event programLabels

**Test Cases:**

```typescript
describe("PUT /api/events/:id with programLabels", () => {
  test("add programs to event with no programs", async () => {
    // Start: programLabels: []
    // Update: programLabels: [programId1, programId2]
    // Verify: event.programLabels updated
    // Verify: both programs.events contain eventId
  });

  test("remove programs from event", async () => {
    // Start: programLabels: [programId1, programId2]
    // Update: programLabels: []
    // Verify: event.programLabels empty
    // Verify: both programs.events do NOT contain eventId
  });

  test("change programs (replace)", async () => {
    // Start: programLabels: [programId1, programId2]
    // Update: programLabels: [programId3, programId4]
    // Verify: event.programLabels updated
    // Verify: programId1/2.events do NOT contain eventId
    // Verify: programId3/4.events contain eventId
  });

  test("partial update (add + remove)", async () => {
    // Start: programLabels: [programId1, programId2]
    // Update: programLabels: [programId2, programId3]
    // Verify: removed programId1, kept programId2, added programId3
    // Verify: program.events arrays updated correctly
  });

  test("update event without changing programLabels", async () => {
    // Start: programLabels: [programId1]
    // Update: { title: "New Title" } (no programLabels field)
    // Verify: programLabels unchanged
    // Verify: program.events unchanged
  });

  test("reject invalid program IDs in update", async () => {
    // Update: programLabels: ["invalid"]
    // Expect 400 error
  });
});
```

### 3. Backward Compatibility Tests

**Test Cases:**

```typescript
describe("Backward compatibility", () => {
  test("event without programLabels field (old data)", async () => {
    // Create event directly in DB without programLabels
    // Fetch via API
    // Verify: programLabels defaults to []
  });

  test("migration script idempotency", async () => {
    // Run migration twice
    // Verify: same result both times
  });

  test("programId field still exists (deprecated)", async () => {
    // Create event with programLabels
    // Check DB document
    // Verify: programId may exist for migration purposes
  });
});
```

### 4. Filter/Query Tests (Task 5)

**Test Cases:**

```typescript
describe("GET /api/events with programLabels filter", () => {
  test("filter by single program", async () => {
    // Create events with different programLabels
    // Query: ?programId=programId1
    // Verify: returns events where programLabels contains programId1
  });

  test("filter returns events with multiple programs", async () => {
    // Event has programLabels: [programId1, programId2]
    // Query: ?programId=programId1
    // Verify: event returned (programLabels contains programId1)
  });

  test("no results if program not in labels", async () => {
    // Event has programLabels: [programId2]
    // Query: ?programId=programId1
    // Verify: event NOT returned
  });
});
```

### 5. Edge Cases

**Test Cases:**

```typescript
describe("Edge cases", () => {
  test("very large programLabels array (100+ programs)", async () => {
    // Create 100 programs
    // Create event with all 100 in programLabels
    // Verify: all saved correctly
  });

  test("concurrent updates to same event programLabels", async () => {
    // Two simultaneous PUT requests
    // Verify: last write wins OR proper conflict handling
  });

  test("delete program that has events", async () => {
    // Create event with programLabels: [programId1]
    // Delete programId1
    // Verify: event.programLabels still contains ID
    // OR: cascade delete removes from programLabels
  });

  test("create event with programLabels, then delete programs", async () => {
    // Create event
    // Delete all linked programs
    // Fetch event
    // Verify: programLabels unchanged (dangling references OK)
  });
});
```

### 6. Update Existing Tests

**Files to Update:**

```typescript
// eventController.mentorCircle.test.ts
// REMOVE or UPDATE:
// - All mentorCircle validation tests
// - All mentor snapshot tests
// - Replace with programLabels tests

// events.programs.integration.test.ts
// UPDATE:
// - Replace programId with programLabels
// - Remove mentorCircle parameter
// - Remove mentors verification
// - Verify programLabels array instead
```

---

## Test Coverage Goals

### Critical Paths (Must be 100% covered):

- ✅ Create event with programLabels
- ✅ Update event programLabels
- ✅ Program.events sync (add/remove)
- ✅ Validation (invalid IDs, non-existent programs)
- ✅ Edge cases (empty array, null values, duplicates)

### Important Paths (Should be 95%+ covered):

- Filter/query by programLabels
- Backward compatibility
- Error handling
- Concurrent updates

### Nice to Have (80%+ covered):

- Performance with large arrays
- Stress testing
- Cascade behaviors

---

## Implementation Order

### Phase 1: Build New Tests (Current)

1. Create `events-program-labels.integration.test.ts`
2. Add comprehensive test cases for create/update
3. Add validation and edge case tests
4. **Run tests - expect failures** (functionality not implemented yet)

### Phase 2: Update Existing Tests

1. Update `eventController.mentorCircle.test.ts`
   - Remove mentor-related tests
   - Add programLabels tests
2. Update `events.programs.integration.test.ts`
   - Replace programId with programLabels
   - Remove mentorCircle tests

### Phase 3: Implement Changes

1. Make automated changes to eventController
2. Run tests after each change
3. Fix any test failures
4. Ensure 99%+ coverage

### Phase 4: Edge Case Analysis

1. Review all test results
2. Identify uncovered scenarios
3. Add tests for gaps
4. Retest

---

## Running Tests

### Run New Tests Only

```bash
cd backend
npm run test:integration:one tests/integration/api/events-program-labels.integration.test.ts
```

### Run All Event Tests

```bash
npm run test:integration -- tests/integration/api/events-*.test.ts
```

### Check Coverage

```bash
npm run test:coverage:integration
```

### Verify Specific Coverage

```bash
# Check eventController.ts coverage
npm run test:coverage -- --coverage-include=src/controllers/eventController.ts
```

---

## Success Criteria

- [ ] All new programLabels tests pass
- [ ] Updated existing tests pass
- [ ] No regression in other tests
- [ ] Coverage >= 99% for affected code
- [ ] All edge cases identified and tested
- [ ] Integration tests verify end-to-end flow
- [ ] Unit tests verify isolated logic

---

## Risk Mitigation

### Before Changes:

✅ Baseline test run - all pass  
✅ Coverage report - identify gaps  
✅ Document current behavior

### During Changes:

✅ Run tests after each logical change  
✅ Stop if any test fails unexpectedly  
✅ Commit working state frequently

### After Changes:

✅ Full test suite run  
✅ Coverage comparison  
✅ Manual smoke testing  
✅ Review all warnings

---

## Next Steps

1. **Create new integration test file** ✅
2. **Write all test cases** ✅
3. **Run tests (expect failures)** ✅
4. **Update existing tests** ⏳
5. **Implement changes** ⏳
6. **Verify all tests pass** ⏳

---

## Notes

- Tests should be written **before** making changes (TDD)
- Each test should be independent and isolated
- Use descriptive test names
- Mock external dependencies appropriately
- Test both happy paths and error cases
- Consider performance implications
