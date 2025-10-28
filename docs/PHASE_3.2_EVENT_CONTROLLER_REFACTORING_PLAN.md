# Phase 3.2: EventController Refactoring Plan

**Target File:** `backend/src/controllers/eventController.ts`  
**Size:** 5,552 lines  
**Date Created:** October 27, 2025  
**Status:** Planning Complete - Ready for Phase 3.3 (Baseline)

---

## Executive Summary

This document provides the **detailed refactoring roadmap** for splitting `eventController.ts` into 8-10 maintainable controller modules plus 3 shared utility modules. The plan follows an **incremental extraction pattern** proven successful in Phase 2.

**Key Metrics:**

- **Current:** 1 giant file (5,552 lines)
- **Target:** 11-13 files (<500 lines each)
- **Methods:** 20 public + 5 private = 25 total
- **Test Coverage:** ~71% (7,429 test lines)
- **Estimated Duration:** 2 weeks

**Strategy:** Extract utilities first → Extract controllers one domain at a time → Validate → Commit → Repeat

---

## Method Inventory & Size Analysis

### Public API Endpoints (20 methods)

| Method                     | Lines  | Category     | Complexity   | Priority |
| -------------------------- | ------ | ------------ | ------------ | -------- |
| `createEvent`              | ~1,200 | Creation     | 🔴 Very High | P1       |
| `updateEvent`              | ~1,250 | Update       | 🔴 Very High | P1       |
| `deleteEvent`              | ~300   | Deletion     | 🟠 High      | P2       |
| `signUpForEvent`           | ~300   | Registration | 🟠 High      | P2       |
| `cancelSignup`             | ~100   | Registration | 🟢 Low       | P2       |
| `assignUserToRole`         | ~200   | Role Mgmt    | 🟠 Medium    | P3       |
| `moveUserBetweenRoles`     | ~200   | Role Mgmt    | 🟠 Medium    | P3       |
| `removeUserFromRole`       | ~120   | Role Mgmt    | 🟢 Low       | P3       |
| `publishEvent`             | ~100   | Publishing   | 🟢 Low       | P4       |
| `unpublishEvent`           | ~100   | Publishing   | 🟢 Low       | P4       |
| `getAllEvents`             | ~350   | Query        | 🟠 Medium    | P5       |
| `getEventById`             | ~80    | Query        | 🟢 Low       | P5       |
| `getUserEvents`            | ~170   | Query        | 🟢 Low       | P5       |
| `getCreatedEvents`         | ~30    | Query        | 🟢 Low       | P5       |
| `getEventParticipants`     | ~80    | Query        | 🟢 Low       | P5       |
| `hasRegistrations`         | ~50    | Query        | 🟢 Low       | P5       |
| `checkTimeConflict`        | ~80    | Conflict     | 🟢 Low       | P6       |
| `updateWorkshopGroupTopic` | ~140   | Workshop     | 🟢 Low       | P7       |
| `updateAllEventStatuses`   | ~100   | Maintenance  | 🟢 Low       | P8       |
| `recalculateSignupCounts`  | ~100   | Maintenance  | 🟢 Low       | P8       |

### Private Helper Methods (5+ methods)

| Method                           | Lines | Purpose                         |
| -------------------------------- | ----- | ------------------------------- |
| `hasOrganizerDetails`            | ~10   | Type guard                      |
| `toIdString`                     | ~15   | ID normalization                |
| `toInstantFromWallClock`         | ~100  | Timezone conversion (DST-aware) |
| `instantToWallClock`             | ~30   | Reverse timezone conversion     |
| `findConflictingEvents`          | ~90   | Conflict detection logic        |
| `updateEventStatusIfNeeded`      | ~30   | Status auto-update              |
| `populateFreshOrganizerContacts` | ~40   | Organizer data refresh          |
| `deleteAllRegistrationsForEvent` | ~45   | Cascade deletion                |
| `updateAllEventStatusesHelper`   | ~100  | Batch status update             |
| `recalculateSignupCountsHelper`  | ~100  | Batch count recalculation       |

---

## Proposed Module Structure

### Phase 3.4.1: Extract Shared Utilities FIRST (Foundation)

**Why First:** These are used by multiple controllers, must extract before controllers

```
backend/src/utils/eventUtils/
├── index.ts                          # Re-exports all utilities
├── timezoneUtils.ts                  # ~200 lines - EXTRACT FIRST
│   ├── toInstantFromWallClock()      # DST-aware wall clock → UTC conversion
│   ├── instantToWallClock()          # UTC → wall clock conversion
│   └── [timezone calculation helpers]
│
├── capacityUtils.ts                  # ~150 lines
│   ├── calculateRoleCapacity()       # Capacity checking (user-only vs guest-inclusive)
│   ├── hasRoleCapacity()             # Boolean capacity check
│   ├── getRoleRegistrationCounts()   # Count aggregation
│   └── [capacity validation helpers]
│
└── eventValidation.ts                # ~100 lines
    ├── hasOrganizerDetails()         # Type guard (move from controller)
    ├── toIdString()                  # ID normalization (move from controller)
    ├── validateEventDates()          # Date validation
    └── [other validation helpers]
```

**Test Strategy for Utilities:**

- Create `eventUtils/timezoneUtils.test.ts` (extract from eventController.test.ts)
- Create `eventUtils/capacityUtils.test.ts` (extract existing capacity tests)
- Create `eventUtils/eventValidation.test.ts` (extract validation tests)

**Success Criteria:**

- [ ] All 3 utility modules extracted
- [ ] Tests passing for each module
- [ ] eventController.ts imports utilities (no inline duplication)
- [ ] Zero regressions in eventController tests

---

### Phase 3.4.2-3.4.9: Extract Controller Modules (One at a Time)

```
backend/src/controllers/events/
├── index.ts                          # Re-exports all controllers for backward compatibility
│
├── EventQueryController.ts           # ~400 lines - Query operations
│   ├── getAllEvents()                # List with filters, pagination
│   ├── getEventById()                # Single event retrieval
│   ├── getUserEvents()               # User's registered events
│   ├── getCreatedEvents()            # Events created by user
│   ├── getEventParticipants()        # Participant listing
│   └── hasRegistrations()            # Registration existence check
│
├── EventCreationController.ts        # ~1,300 lines - Creation logic
│   ├── createEvent()                 # Main creation endpoint (HUGE METHOD)
│   └── [creation helper methods]
│
├── EventUpdateController.ts          # ~1,400 lines - Update logic
│   ├── updateEvent()                 # Main update endpoint (HUGE METHOD)
│   ├── publishEvent()                # Make event public
│   ├── unpublishEvent()              # Make event private
│   ├── updateEventStatusIfNeeded()   # Auto status updates
│   └── populateFreshOrganizerContacts() # Organizer refresh
│
├── EventDeletionController.ts        # ~350 lines - Deletion logic
│   ├── deleteEvent()                 # Main deletion endpoint
│   └── deleteAllRegistrationsForEvent() # Cascade helper
│
├── EventRegistrationController.ts    # ~450 lines - Registration ops
│   ├── signUpForEvent()              # User sign-up
│   └── cancelSignup()                # Sign-up cancellation
│
├── EventRoleController.ts            # ~550 lines - Role management
│   ├── assignUserToRole()            # Assign user to role
│   ├── moveUserBetweenRoles()        # Transfer between roles
│   └── removeUserFromRole()          # Remove from role
│
├── EventConflictController.ts        # ~200 lines - Conflict detection
│   ├── checkTimeConflict()           # Public endpoint
│   └── findConflictingEvents()       # Private helper (move here)
│
├── EventWorkshopController.ts        # ~150 lines - Workshop features
│   └── updateWorkshopGroupTopic()    # Workshop group management
│
└── EventMaintenanceController.ts     # ~250 lines - System operations
    ├── updateAllEventStatuses()      # Batch status updates
    ├── updateAllEventStatusesHelper()
    ├── recalculateSignupCounts()     # Batch count recalculation
    └── recalculateSignupCountsHelper()
```

---

## Extraction Order & Strategy

### Stage 1: Foundation (Phase 3.4.1) - 2 days

**Extract utilities in this order:**

1. **timezoneUtils.ts** (Day 1 morning)

   - Extract `toInstantFromWallClock`, `instantToWallClock`
   - Create unit tests (extract from eventController.test.ts)
   - Update eventController.ts to import
   - Run full test suite
   - Commit: "refactor: extract timezone utilities from EventController"

2. **capacityUtils.ts** (Day 1 afternoon)

   - Extract capacity checking logic
   - Create unit tests
   - Update eventController.ts imports
   - Run tests
   - Commit: "refactor: extract capacity utilities from EventController"

3. **eventValidation.ts** (Day 2 morning)

   - Extract validation helpers
   - Create unit tests
   - Update imports
   - Run tests
   - Commit: "refactor: extract validation utilities from EventController"

4. **Validate Stage 1** (Day 2 afternoon)
   - Run full test suite (all 4,028 tests must pass)
   - Run coverage analysis (maintain 71%+)
   - Review code for any missed utilities
   - Commit: "refactor: complete utility extraction from EventController"

---

### Stage 2: Query Controllers (Phase 3.4.2) - 1 day

**Low risk, high confidence - good starting point**

5. **EventQueryController.ts** (Day 3)
   - Extract all 6 query methods (getAllEvents, getEventById, etc.)
   - Create tests/unit/controllers/events/EventQueryController.test.ts
   - Move relevant tests from eventController.test.ts
   - Update routes/events.ts imports
   - Run tests
   - Commit: "refactor: extract EventQueryController from EventController"

**Why Start Here:**

- ✅ Read-only operations (lowest risk)
- ✅ Clear boundaries (no side effects)
- ✅ Easy to test
- ✅ Builds confidence for harder extractions

---

### Stage 3: Simple Controllers (Phase 3.4.3-3.4.6) - 2 days

**Extract smaller, well-defined domains**

6. **EventConflictController.ts** (Day 4 morning)

   - Extract checkTimeConflict + findConflictingEvents
   - Move tests
   - Update routes
   - Commit: "refactor: extract EventConflictController"

7. **EventWorkshopController.ts** (Day 4 afternoon)

   - Extract updateWorkshopGroupTopic
   - Move tests
   - Update routes
   - Commit: "refactor: extract EventWorkshopController"

8. **EventMaintenanceController.ts** (Day 5 morning)

   - Extract updateAllEventStatuses, recalculateSignupCounts
   - Move tests
   - Update routes (may need new admin routes)
   - Commit: "refactor: extract EventMaintenanceController"

9. **EventDeletionController.ts** (Day 5 afternoon)
   - Extract deleteEvent + deleteAllRegistrationsForEvent
   - Move tests (deletion is well-tested)
   - Update routes
   - Commit: "refactor: extract EventDeletionController"

---

### Stage 4: Complex Controllers (Phase 3.4.7-3.4.9) - 3 days

**Highest risk, most complex methods - do last**

10. **EventRegistrationController.ts** (Day 6)

    - Extract signUpForEvent, cancelSignup
    - These involve locking, capacity checks, notifications
    - Carefully move tests (many edge cases)
    - Update routes
    - Commit: "refactor: extract EventRegistrationController"

11. **EventRoleController.ts** (Day 7)

    - Extract assignUserToRole, moveUserBetweenRoles, removeUserFromRole
    - Role transfers have complex logic
    - Move tests
    - Update routes
    - Commit: "refactor: extract EventRoleController"

12. **EventCreationController.ts** (Day 8)

    - Extract createEvent (~1,200 lines - HUGE)
    - Most complex single method
    - Carefully preserve all logic
    - Move creation tests
    - Update routes
    - Commit: "refactor: extract EventCreationController"

13. **EventUpdateController.ts** (Day 9)
    - Extract updateEvent (~1,250 lines - HUGE)
    - Extract publish/unpublish
    - Most complex single method
    - Move update tests
    - Update routes
    - Commit: "refactor: extract EventUpdateController"

---

### Stage 5: Integration & Cleanup (Phase 3.5) - 1 day

14. **Remove Original File** (Day 10 morning)

    - Delete eventController.ts (now empty)
    - Update controllers/index.ts to re-export from events/
    - Update any remaining imports
    - Commit: "refactor: remove original EventController, complete split"

15. **Final Validation** (Day 10 afternoon)
    - Run full test suite (all 4,028 tests)
    - Run coverage analysis (target: maintain or improve 71%+)
    - Performance testing (no regressions)
    - Review all route files for correct imports
    - Commit: "refactor: validate EventController split complete"

---

## Test Strategy

### Test File Organization

**Current Structure:**

```
tests/unit/controllers/
├── eventController.test.ts           # 7,220 lines
└── eventController.mentorCircle.test.ts  # 209 lines
```

**Target Structure:**

```
tests/unit/controllers/events/
├── EventQueryController.test.ts       # ~1,000 lines (extracted)
├── EventCreationController.test.ts    # ~2,000 lines (extracted)
├── EventUpdateController.test.ts      # ~2,500 lines (extracted)
├── EventDeletionController.test.ts    # ~500 lines (extracted)
├── EventRegistrationController.test.ts # ~800 lines (extracted)
├── EventRoleController.test.ts        # ~600 lines (extracted)
├── EventConflictController.test.ts    # ~200 lines (extracted)
├── EventWorkshopController.test.ts    # ~200 lines (extracted)
└── EventMaintenanceController.test.ts # ~200 lines (extracted)

tests/unit/utils/eventUtils/
├── timezoneUtils.test.ts              # ~500 lines (new)
├── capacityUtils.test.ts              # ~300 lines (new)
└── eventValidation.test.ts            # ~100 lines (new)
```

### Test Migration Pattern (Per Controller)

For each controller extraction:

1. **Identify Test Blocks**

   - Search eventController.test.ts for describe blocks matching controller domain
   - Example: For EventQueryController, find "getAllEvents", "getEventById", etc.

2. **Extract Test Code**

   - Copy relevant describe blocks to new test file
   - Update imports to point to new controller
   - Preserve all test setup, mocks, assertions

3. **Update Mocks**

   - Change `EventController.method` to `EventQueryController.method`
   - Ensure all spies point to correct module

4. **Run Tests**

   - Run new test file: `npm run test:unit tests/unit/controllers/events/EventQueryController.test.ts`
   - Verify all tests pass
   - Run old test file to ensure remaining tests still pass

5. **Remove from Original**

   - Delete extracted test blocks from eventController.test.ts
   - Re-run to ensure no breakage

6. **Coverage Check**
   - Run coverage for both new and remaining files
   - Ensure no coverage loss

### Integration Test Updates

**Current Integration Tests:**

```
tests/integration/api/
├── events-email.integration.test.ts
├── events-assignment-ics.integration.test.ts
└── [other event integration tests]
```

**Strategy:**

- Integration tests may reference EventController methods
- Update imports to use new controller modules
- Tests should still pass without modification (API contracts unchanged)
- If needed, update imports in integration tests last (after all extractions)

---

## Route Integration Strategy

### Current Route Structure

**File:** `src/routes/events.ts` (469 lines)

**Current Imports:**

```typescript
import { EventController } from "../controllers/eventController";
```

**Current Route Definitions:**

```typescript
router.get("/", EventController.getAllEvents);
router.get("/check-conflict", EventController.checkTimeConflict);
router.get("/:id", EventController.getEventById);
router.post("/", EventController.createEvent);
router.put("/:id", EventController.updateEvent);
router.delete("/:id", EventController.deleteEvent);
router.post("/:id/signup", EventController.signUpForEvent);
router.post("/:id/cancel", EventController.cancelSignup);
// ... etc
```

### Target Route Structure

**Option A: Update imports incrementally (Recommended)**

```typescript
// Phase 3.4.1: After utility extraction - no route changes

// Phase 3.4.2: After QueryController extraction
import { EventQueryController } from "../controllers/events/EventQueryController";
import { EventController } from "../controllers/eventController"; // Still exists

router.get("/", EventQueryController.getAllEvents);
router.get("/:id", EventQueryController.getEventById);
// ... other routes still use EventController

// Continue until all extracted, then:
```

**Option B: Use index.ts re-exports (Lower risk)**

```typescript
// After all extractions complete
import {
  EventQueryController,
  EventCreationController,
  EventUpdateController,
  // ... all controllers
} from "../controllers/events"; // index.ts re-exports

// OR use namespace pattern:
import * as EventControllers from "../controllers/events";

router.get("/", EventControllers.EventQueryController.getAllEvents);
```

**Recommendation:** Use **Option B** - Update routes only AFTER all controllers extracted. This minimizes route file churn and reduces risk of routing errors during transition.

### Backward Compatibility Layer

**During extraction (controllers/events/index.ts):**

```typescript
// Re-export for backward compatibility
export { EventQueryController } from "./EventQueryController";
export { EventCreationController } from "./EventCreationController";
// ... etc

// OPTIONAL: Legacy namespace (if routes need time to migrate)
export const EventController = {
  // Re-map old names to new controllers
  getAllEvents: EventQueryController.getAllEvents,
  getEventById: EventQueryController.getEventById,
  createEvent: EventCreationController.createEvent,
  updateEvent: EventUpdateController.updateEvent,
  // ... etc
};
```

**This allows routes to continue using:**

```typescript
import { EventController } from "../controllers/events";
// Works exactly as before!
```

---

## Dependency Management

### Current Dependencies (Heavy Coupling)

**Models (5):**

- Event, Registration, User, Program, Purchase

**Services (10+):**

- EmailService, SocketService, LockService, CachePatterns
- TrioNotificationService, ResponseBuilderService
- RegistrationQueryService, EventCascadeService
- UnifiedMessageController, Logger, CorrelatedLogger

**Utils (8+):**

- roleUtils, emailRecipientUtils, publicSlug, publicEventSerializer
- systemMessageFormatUtils, roleAssignmentRejectionToken
- validatePublish, roleRegistrationLimits

### Dependency Injection Strategy

**Problem:** Controllers are static classes with no dependency injection
**Solution:** Keep static for now (maintains backward compatibility), refactor later if needed

**Pattern:**

```typescript
// Keep existing pattern
export class EventQueryController {
  static async getAllEvents(req: Request, res: Response): Promise<void> {
    // Direct imports remain unchanged
    const events = await Event.find({...});
    // ...
  }
}
```

**Future Improvement (Post-Phase 3):**

- Could introduce constructor-based DI for easier testing
- For now, keep static pattern to minimize changes

---

## Risk Mitigation

### Identified Risks

| Risk                                | Probability | Impact | Mitigation                                                     |
| ----------------------------------- | ----------- | ------ | -------------------------------------------------------------- |
| **Test failures during extraction** | High        | High   | Extract utilities first, run tests after each extraction       |
| **Missed method dependencies**      | Medium      | High   | Use grep/semantic search to find all method calls              |
| **Route import errors**             | Medium      | Medium | Use re-export index.ts for backward compatibility              |
| **Coverage regression**             | Low         | High   | Run coverage after each extraction, compare to baseline        |
| **Performance regression**          | Low         | Medium | Keep static methods (no runtime overhead), benchmark if needed |
| **Merge conflicts (long branch)**   | Medium      | Low    | Commit frequently, rebase often                                |

### Rollback Strategy

**If extraction fails:**

1. Revert last commit (`git revert HEAD`)
2. Re-run tests to ensure stable state
3. Analyze failure, adjust plan
4. Retry extraction with fixes

**If tests break after extraction:**

1. Check imports in test files
2. Verify mock/spy targets updated
3. Check for method signature changes
4. Fix tests, re-run

**If production issues found:**

1. Revert entire PR (all extractions)
2. Deploy previous version
3. Fix offline, re-test thoroughly
4. Re-deploy

---

## Success Criteria (Phase 3.4-3.5 Complete)

### Quantitative Metrics

- [ ] **File Count:** 1 file → 11+ files (8-10 controllers + 3 utilities + index)
- [ ] **Max File Size:** All files <500 lines (target: 200-400 lines)
- [ ] **Test Count:** All 4,028 tests passing (zero regressions)
- [ ] **Coverage:** Maintain or improve 71%+ line coverage
- [ ] **Performance:** No measurable performance regression (benchmark if needed)

### Qualitative Metrics

- [ ] **Code Organization:** Clear domain boundaries, Single Responsibility Principle
- [ ] **Test Organization:** Tests co-located with controllers, easy to find
- [ ] **Import Clarity:** No circular dependencies, clean import tree
- [ ] **Documentation:** Each controller has clear JSDoc comments
- [ ] **Backward Compatibility:** Existing imports still work via index.ts re-exports

### Validation Checklist

**Before marking Phase 3.4-3.5 complete:**

1. [ ] Run full test suite: `npm test`
2. [ ] Run coverage analysis: `npm run test:coverage`
3. [ ] Check no TypeScript errors: `npm run type-check`
4. [ ] Check no ESLint errors: `npm run lint`
5. [ ] Review all route files for correct imports
6. [ ] Review all controller imports in other files
7. [ ] Verify backward compatibility index.ts works
8. [ ] Test API endpoints manually (smoke test)
9. [ ] Review PR for any missed TODOs
10. [ ] Update documentation (REFACTORING_BASELINE.md, this document)

---

## Timeline Estimate

| Stage                    | Days        | Tasks                         | Risk           |
| ------------------------ | ----------- | ----------------------------- | -------------- |
| **Stage 1: Foundation**  | 2           | Extract 3 utilities           | 🟢 Low         |
| **Stage 2: Query**       | 1           | Extract EventQueryController  | 🟢 Low         |
| **Stage 3: Simple**      | 2           | Extract 4 simple controllers  | 🟡 Medium      |
| **Stage 4: Complex**     | 4           | Extract 4 complex controllers | 🔴 High        |
| **Stage 5: Integration** | 1           | Cleanup, validation           | 🟡 Medium      |
| **Total**                | **10 days** | **~2 weeks**                  | 🟠 Medium-High |

**Buffer:** Add 20% buffer (2 days) for unexpected issues = **12 days total**

---

## Next Steps (Phase 3.3)

**Before starting extraction:**

1. **Establish Test Baseline**

   - Run full test suite, document current passing counts
   - Run coverage analysis, capture baseline metrics
   - Identify any flaky tests, fix before starting
   - Commit: "test: establish baseline for EventController refactoring"

2. **Create Feature Branch**

   - Branch: `refactor/event-controller-split`
   - Set up CI to run tests on every push
   - Enable code review for all commits

3. **Review & Approve Plan**
   - Review this plan with team
   - Adjust timeline if needed
   - Get approval to proceed

**Then proceed to Phase 3.4 (Execution)**

---

## Appendix: Method Call Graph

**Dependencies between EventController methods:**

```
createEvent()
  └─> findConflictingEvents() (private)
      └─> toInstantFromWallClock() (private)
          └─> [timezone logic]

updateEvent()
  ├─> updateEventStatusIfNeeded() (private)
  ├─> populateFreshOrganizerContacts() (private)
  └─> findConflictingEvents() (private)

deleteEvent()
  └─> deleteAllRegistrationsForEvent() (private)

signUpForEvent()
  └─> [uses lockService for race condition prevention]

updateAllEventStatuses()
  └─> updateAllEventStatusesHelper() (private)

recalculateSignupCounts()
  └─> recalculateSignupCountsHelper() (private)
```

**Note:** Private helpers stay with their primary users (or move to utilities if shared).

---

## Appendix: Import Impact Analysis

**Files importing EventController (must update):**

1. `src/routes/events.ts` - Main route file (469 lines)
2. `src/routes/publicEvents.ts` - Public routes (if any)
3. `src/controllers/index.ts` - Controller barrel export
4. `src/controllers/publicEventController.ts` - May reference EventController

**Test files importing EventController (must update):**

1. `tests/unit/controllers/eventController.test.ts` (7,220 lines)
2. `tests/unit/controllers/eventController.mentorCircle.test.ts` (209 lines)
3. Various integration tests (update imports)

**Total Files to Update:** ~6-8 files

---

## Conclusion

This plan provides a **detailed, step-by-step roadmap** for refactoring `eventController.ts` from a 5,552-line monolith into 11+ maintainable modules. The **incremental extraction pattern** (utilities first → simple controllers → complex controllers) minimizes risk while maximizing confidence at each step.

**Key Principles:**

1. **Extract utilities FIRST** (foundation for all controllers)
2. **One domain at a time** (validate tests after each extraction)
3. **Commit frequently** (easy rollback if issues)
4. **Backward compatibility** (re-export index.ts)
5. **Test-driven** (run tests after every change)

**Next:** Proceed to **Phase 3.3 (Establish Test Baseline)** to capture current state before starting extraction.
