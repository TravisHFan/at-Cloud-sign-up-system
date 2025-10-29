# Giant File Refactoring - Master Plan

**Project**: @Cloud Sign-Up System  
**Started**: October 23, 2025  
**Last Updated**: October 28, 2025  
**Status**: Phase 2 Complete ✅ | Phase 3.0 Complete ✅ | Phase 3.1 Ready to Start

---

## Executive Summary

This document serves as the **single source of truth** for all giant file refactoring work. It consolidates:

- Baseline metrics and current state
- Completed work (Phase 2: Email Service, Phase 3.0: Guest Controller)
- Remaining work (Phase 3.1+: Other giant files)
- Testing strategy and patterns
- Progress tracking

**Goal**: Break down all giant files (>1000 lines) into maintainable modules (<500 lines each) while maintaining or improving test coverage and zero regressions.

---

## Current State (Post-Phase 3.0)

### Test Suite Status

**Total Tests**: 4,028 passing (100%)

- Backend Unit: 2,575 tests (178 files)
- Backend Integration: 821 tests (125 files) ✅ All passing (was 819/821)
- Frontend: 632 tests (174 files)

**Coverage Metrics** (Backend):

- Lines: 76.17% (Target: 85%)
- Branches: 79.36% (Target: 80%)
- Functions: 81.92% (Target: 85%)
- Statements: 76.17% (Target: 85%)

### Completed Refactoring

#### ✅ Phase 2: Email Service Domain (Complete - Oct 27, 2025)

**Files Refactored**:

- EmailServiceFacade + 62 test files → 8 domain service test files
- 13 controller/service test files migrated to domain service spies
- 3 integration test files updated for cleaner imports

**Achievements**:

- Test count: 3,396 → 4,028 (+18.6%)
- Line coverage: 73.39% → 76.17% (+2.78%)
- Function coverage: 81.62% → 81.92% (+0.30%)
- Zero regressions, all tests passing
- Better organization: domain-specific test files

**Key Lessons Learned**:

1. **Incremental migration works**: Extract → Test → Validate → Commit pattern prevents breaking changes
2. **Domain-driven testing**: Tests co-located with business logic domains improve maintainability
3. **Spy over mock**: Using `vi.spyOn()` on real implementations is more robust than mocking entire facades
4. **Documentation critical**: Comprehensive docs help resume work after interruptions
5. **Coverage as indicator**: Coverage increases when tests are better organized

**Commits**:

- Phase 2.3 (Unit tests): `239847c`
- Phase 2.4 (Integration tests): `434695a`
- Phase 2.7 (Documentation): `ad23edd`

**Detailed Documentation**: See archived `PHASE_2_TEST_ORGANIZATION_PLAN.md` for full breakdown

---

#### ✅ Phase 3.0: Guest Controller Refactoring (Complete - Oct 28, 2025)

**File Refactored**: `backend/src/controllers/guestController.ts`

- **Original Size**: 2,031 lines
- **Final Size**: 224 lines (89.0% reduction)
- **Lines Saved**: 1,807 lines

**Extraction Results**:

11 specialized controllers created in `backend/src/controllers/guest/`:

1. **GuestRegistrationController.ts** (809 lines) - New guest registrations
2. **GuestDeclineController.ts** (333 lines) - Decline invitations
3. **GuestRoleManagementController.ts** (260 lines) - Move between roles
4. **GuestManageLinkController.ts** (221 lines) - Manage link operations
5. **GuestCancellationController.ts** (178 lines) - Admin cancellations
6. **GuestUpdateController.ts** (129 lines) - Admin updates
7. **GuestTokenUpdateController.ts** (113 lines) - Self-updates via token
8. **GuestTokenCancellationController.ts** (94 lines) - Self-cancellations via token
9. **GuestRetrievalController.ts** (68 lines) - Get by ID
10. **GuestTokenRetrievalController.ts** (75 lines) - Get by token
11. **GuestListController.ts** (71 lines) - Event guest lists

**Achievements**:

- Test improvement: 819/821 → 821/821 (100% passing, +2 tests fixed)
- Zero regressions, all tests passing
- Clean delegation pattern with dynamic imports
- Logical separation by domain responsibility
- Each controller <350 lines (highly maintainable)

**Key Lessons Learned**:

1. **Manual extraction effective**: For methods >100 lines, manual cut/paste more reliable than automated tools
2. **Exact copy methodology**: Zero AI modifications ensures test compatibility
3. **Delegation pattern**: Dynamic imports preserve lazy loading benefits
4. **Helper methods**: Keep with primary usage (e.g., `findByManageToken` with token operations)
5. **Incremental verification**: Check compilation and tests after each extraction
6. **Batch extractions**: Grouping similar extractions (3 at a time) improves efficiency

**Pattern Established**:

```typescript
// Main controller delegation
static async methodName(req: Request, res: Response): Promise<void> {
  const { default: SpecializedController } = await import(
    "./guest/SpecializedController"
  );
  return SpecializedController.methodName(req, res);
}
```

**Success Metrics**:

- ✅ 89.0% size reduction (2,031 → 224 lines)
- ✅ All 821 integration tests passing (100%)
- ✅ Zero compilation errors
- ✅ Improved code organization and maintainability
- ✅ Clear single responsibility per controller

---

## Remaining Giant Files (Phase 3.1+)

### Phase 3.1: Analysis Complete ✅ (Oct 27, 2025)

**Comprehensive analysis document**: See [PHASE_3_GIANT_FILE_ANALYSIS.md](./PHASE_3_GIANT_FILE_ANALYSIS.md) for detailed breakdown

**Priority Order** (based on risk, reward, test coverage, complexity):

1. **P1 (Highest)**: `eventController.ts` - 5,552 lines - Start Phase 3.2 next
2. **P2**: `api.ts` - 3,134 lines - Quick wins after P1
3. **P3**: `CreateEvent.tsx` + `EditEvent.tsx` - 4,651 combined - Duplication elimination
4. **P3**: `EventDetail.tsx` - 4,298 lines - Complex UI refactor last

---

### Priority 1: Backend Controller (Critical - HIGH RISK, HIGH REWARD)

**File**: `backend/src/controllers/eventController.ts`

- **Size**: 5,552 lines (LARGEST giant file)
- **Complexity**: ⭐⭐⭐⭐⭐ Very high - 20 API endpoints, timezone logic, locking, cascades
- **Test Coverage**: ~71% lines (7,429 test lines provide safety net)
- **Risk Level**: 🔴 **CRITICAL** (core business logic, high traffic)
- **Estimated Effort**: 2 weeks

**Why P1 (Highest Priority)**:

- ✅ Best test coverage (71% + 7,429 test lines)
- ✅ Critical business logic used everywhere
- ✅ High maintenance burden (every feature touches this)
- ✅ Clear domain boundaries for splitting
- ✅ Biggest Single Responsibility violation

**Refactoring Strategy**:

**Proposed Module Structure** (8-10 controllers):

```
backend/src/controllers/events/
├── index.ts                          # Re-exports
├── EventQueryController.ts           # Read ops (getAllEvents, getEventById, getUserEvents)
├── EventCreationController.ts        # Create ops (createEvent)
├── EventUpdateController.ts          # Update ops (updateEvent, publish/unpublish)
├── EventDeletionController.ts        # Delete ops (deleteEvent)
├── EventRegistrationController.ts    # Registration (signUpForEvent, cancelSignup)
├── EventRoleController.ts            # Role ops (assign, move, remove)
├── EventConflictController.ts        # Conflict detection (checkTimeConflict)
└── EventMaintenanceController.ts     # System ops (updateAllStatuses, recalculateSignupCounts)
```

**Shared Utilities**:

```
backend/src/utils/eventUtils/
├── timezoneUtils.ts                  # Extract timezone conversion logic (200+ lines)
├── capacityUtils.ts                  # Capacity checking logic
└── eventValidation.ts                # Validation helpers
```

**Splitting Approach**:

- Extract shared utilities first (timezone, capacity, validation)
- Split controllers by domain boundary (one at a time)
- Update route definitions incrementally
- Maintain backward compatibility with re-exports
- Validate tests after each extraction

**Success Criteria**:

- [ ] Split into 8-10 controller modules (<500 lines each)
- [ ] Extract 3 shared utility modules (timezone, capacity, validation)
- [ ] All 4,028 tests passing (zero regressions)
- [ ] Coverage maintained or improved (71% → 75%+ target)
- [ ] Clear module boundaries and responsibilities
- [ ] Improved import granularity (tree-shaking benefits)
- [ ] No performance regressions

**Complexity Highlights**:

- 20 static methods (API endpoints)
- Complex timezone logic with DST handling
- Distributed locking for race conditions
- User-only vs guest-inclusive capacity semantics
- Cascade operations on deletion
- TrioNotificationService integration
- WebSocket real-time updates
- Audit logging throughout

---

### Priority 2: Frontend API Client (Moderate Risk - QUICK WINS)

**File**: `frontend/src/services/api.ts`

- **Size**: 3,134 lines
- **Complexity**: ⭐⭐⭐ Medium - API client + 15 service objects
- **Test Coverage**: Unknown (needs investigation)
- **Risk Level**: 🟡 **MODERATE** (low risk, mechanical splitting)
- **Estimated Effort**: 3-5 days

**Why P2**:

- ✅ Low risk (TypeScript catches regressions)
- ✅ Quick wins (mechanical splitting by service)
- ✅ Tree-shaking benefits (better bundling)
- ✅ Clear boundaries (each service independent)

**Proposed Module Structure** (15+ files):

```
frontend/src/services/api/
├── index.ts                          # Re-exports
├── apiClient.ts                      # Base API client
├── apiConfig.ts                      # Config & normalization
├── auth.service.ts                   # Authentication
├── event.service.ts                  # Event operations
├── user.service.ts                   # User management
├── program.service.ts                # Program operations
├── purchase.service.ts               # Purchase operations
├── notification.service.ts           # Notifications
├── message.service.ts                # Messages
├── file.service.ts                   # File uploads
├── analytics.service.ts              # Analytics
├── search.service.ts                 # Search
├── rolesTemplate.service.ts          # Role templates
├── assignment.service.ts             # Assignments
└── types/                            # Type definitions
```

**Success Criteria**:

- [ ] Split into 15+ service modules
- [ ] All frontend tests passing (632 tests)
- [ ] Improved bundle size (tree-shaking)
- [ ] Better import clarity
- [ ] Type definitions well-organized

---

### Priority 3: Frontend Event Forms (High Complexity - DUPLICATION ELIMINATION)

**Files**: `frontend/src/pages/CreateEvent.tsx` + `EditEvent.tsx`

- **Size**: 4,651 lines combined (2,199 + 2,452)
- **Complexity**: ⭐⭐⭐⭐⭐ Very high - Complex forms with ~80% duplication
- **Test Coverage**: Medium (multiple test files)
- **Risk Level**: 🟠 **HIGH** (form state management tricky)
- **Estimated Effort**: 1 week

**Why P3**:

- ⚠️ High code duplication (~2,400 lines can be eliminated)
- ⚠️ Complex form state management
- ⚠️ Validation coupling with UI
- ✅ Lower business impact (client-side validation safety net)

**Proposed Module Structure**:

```
frontend/src/pages/EventForm/
├── CreateEvent.tsx                   # Thin wrapper
├── EditEvent.tsx                     # Thin wrapper
├── EventForm.tsx                     # Shared form component
├── sections/
│   ├── BasicInfoSection.tsx          # Title, type, dates
│   ├── OrganizerSection.tsx          # Organizer details
│   ├── DetailsSection.tsx            # Purpose, agenda
│   ├── RolesSection.tsx              # Role configuration
│   ├── HybridSection.tsx             # Zoom settings
│   ├── ProgramSection.tsx            # Program/circle
│   ├── FlyerSection.tsx              # Flyer upload
│   └── RecurrenceSection.tsx         # Recurrence settings
├── hooks/
│   ├── useEventForm.ts               # Form state management
│   ├── useEventValidation.ts         # Validation logic
│   └── useEventSubmit.ts             # Submit handling
└── components/
    ├── RoleEditor.tsx                # Single role editor
    └── OrganizerEditor.tsx           # Single organizer editor
```

**Success Criteria**:

- [ ] Eliminate ~2,400 lines of duplication
- [ ] All frontend tests passing
- [ ] Shared form component for create/edit
- [ ] Better validation reusability

---

### Priority 3 (Tied): Frontend Event Detail (Highest Complexity - LAST)

**File**: `frontend/src/pages/EventDetail.tsx`

- **Size**: 4,298 lines (2nd largest giant file)
- **Complexity**: ⭐⭐⭐⭐⭐ Very high - 35+ hooks, real-time updates
- **Test Coverage**: Medium (multiple test files)
- **Risk Level**: 🟠 **HIGH** (React hooks create implicit dependencies)
- **Estimated Effort**: 1 week

**Why P3 (Last)**:

- ⚠️ React complexity (hooks create dependencies)
- ⚠️ State explosion (35+ useState/useEffect)
- ⚠️ Testing challenges (React Testing Library limitations)
- ⚠️ UI risk (visual regressions harder to catch)
- ✅ Lower business impact (frontend bugs less critical)

**Proposed Module Structure**:

```
frontend/src/pages/EventDetail/
├── index.tsx                         # Main container
├── EventDetailHeader.tsx             # Title, status, metadata
├── EventDetailInfo.tsx               # Date, time, location
├── EventDetailDescription.tsx        # Purpose, agenda
├── EventDetailFlyer.tsx              # Flyer carousel
├── EventDetailRoles.tsx              # Role list with signup
├── EventDetailParticipants.tsx       # Participant list & export
├── EventDetailActions.tsx            # Edit, delete, share
├── PublishControls.tsx               # Publish/unpublish
├── hooks/
│   ├── useEventDetail.ts             # Event data fetching
│   ├── useEventActions.ts            # CRUD handlers
│   ├── useEventRealtime.ts           # WebSocket updates
│   └── useEventPermissions.ts        # Permission checking
└── components/
    ├── GuestManagement.tsx           # Guest UI
    ├── NameCardModal.tsx             # Name card actions
    └── ParticipantExport.tsx         # Excel export
```

**Success Criteria**:

- [ ] Split into 10+ component modules
- [ ] All frontend tests passing
- [ ] Better component reusability
- [ ] Reduced re-render overhead

---

### Priority 2: Frontend Component (Medium Risk, High Impact)

**File**: `frontend/src/pages/EventDetail.tsx`

- **Size**: 4,298 lines
- **Complexity**: Very high - 20+ hooks, complex state management
- **Test Coverage**: ~67% (needs improvement)
- **Risk Level**: Medium (UI component, easier to validate visually)
- **Estimated Effort**: 2-3 weeks

**Refactoring Strategy**:

- Split by feature area: Event Info, Roles, Participants, Actions, Modals
- Extract custom hooks: useEventData, useRoleManagement, useParticipants
- Create smaller sub-components for each section

**Success Criteria**:

- 6-8 component files (<500 lines each)
- 3-5 custom hooks (<200 lines each)
- All 632 frontend tests passing
- UI functionality unchanged
- Improved test coverage (target: 75%)

---

### Priority 3: Quick Wins (Low Risk, Easy Extraction)

**Files**:

1. `frontend/src/utils/api.ts` (3,134 lines)

   - Simple API wrapper functions
   - Easy to split by domain (events, users, auth, etc.)
   - Estimated: 3-5 days

2. `frontend/src/pages/CreateEvent.tsx` + `EditEvent.tsx` (4,651 lines combined)
   - 80% code duplication between two files
   - Extract shared EventForm component
   - Estimated: 5-7 days

**Strategy**: Extract shared components first, then split by domain. These are low-risk and can build momentum.

---

## Refactoring Process (Proven Pattern)

### Phase X.1: Identify & Prioritize

1. Analyze file structure and dependencies
2. Assess test coverage and risk level
3. Create priority ranking (risk vs reward)

### Phase X.2: Create Detailed Plan

1. Identify logical domains/modules within file
2. Plan directory structure and file organization
3. Define splitting strategy (vertical vs horizontal)
4. Identify shared utilities and types
5. Establish test strategy for each module
6. Define success criteria and validation steps

### Phase X.3: Establish Test Baseline

1. Run full test suite and document passing counts
2. Run coverage analysis for target file
3. Identify gaps in current test coverage
4. Add missing critical tests if needed
5. Commit baseline state with documented metrics

### Phase X.4: Execute Refactoring (Incremental)

1. Extract first logical module with tests
2. Validate tests still pass
3. Commit checkpoint
4. Repeat for each module
5. **Pattern**: Extract → Test → Validate → Commit
6. Keep original file functional until complete

### Phase X.5: Integration & Cleanup

1. Remove original giant file
2. Update all imports across codebase
3. Run full test suite validation
4. Verify no regressions in functionality
5. Run coverage analysis (ensure maintained or improved)

### Phase X.6: Documentation & Retrospective

1. Update this master plan with new file structure
2. Document architectural improvements
3. Note lessons learned and patterns discovered
4. Update testing approach if new patterns emerged
5. Celebrate completion and plan next file

---

## Testing Strategy

### Unit Tests

- **Approach**: Use `vi.spyOn()` on real implementations, not mocks
- **Pattern**: Test business logic separately from infrastructure
- **Coverage Target**: 85%+ lines, 85%+ functions, 80%+ branches

### Integration Tests

- **Approach**: Mock external services (email, websockets) but test real coordination
- **Pattern**: Test end-to-end flows with real database (test DB)
- **Import Strategy**: Use centralized exports (`src/services`) for cleaner imports

### Frontend Tests

- **Approach**: React Testing Library for component testing
- **Pattern**: Test user interactions and component behavior, not implementation
- **Coverage Target**: 80%+ lines, 75%+ branches

### Key Principles

1. **Test Quality > Test Quantity**: Focus on meaningful tests
2. **Coverage as Indicator**: High coverage reveals untested areas, not success
3. **Incremental Validation**: Test after each extraction, not at the end
4. **Zero Regressions**: All existing tests must pass throughout refactoring

---

## Progress Tracking

### Completed Phases

| Phase       | File                      | Status      | Completion Date | Commits                   |
| ----------- | ------------------------- | ----------- | --------------- | ------------------------- |
| **Phase 2** | EmailService Domain       | ✅ Complete | 2025-10-27      | 239847c, 434695a, ad23edd |
| Phase 2.1   | Planning & Architecture   | ✅          | 2025-10-25      | -                         |
| Phase 2.2   | Domain Service Test Files | ✅          | 2025-10-26      | -                         |
| Phase 2.3   | Unit Test Migration       | ✅          | 2025-10-27      | 239847c                   |
| Phase 2.4   | Integration Test Updates  | ✅          | 2025-10-27      | 434695a                   |
| Phase 2.5   | Validation & Coverage     | ✅          | 2025-10-27      | -                         |
| Phase 2.6   | Archive Legacy Files      | ✅          | 2025-10-27      | -                         |
| Phase 2.7   | Documentation             | ✅          | 2025-10-27      | ad23edd                   |

### Upcoming Phases

| Phase       | File                  | Status     | Est. Start | Est. Duration |
| ----------- | --------------------- | ---------- | ---------- | ------------- |
| **Phase 3** | eventController.ts    | 📋 Ready   | 2025-10-28 | 2-3 weeks     |
| **Phase 4** | EventDetail.tsx       | ⏳ Pending | TBD        | 2-3 weeks     |
| **Phase 5** | CreateEvent/EditEvent | ⏳ Pending | TBD        | 5-7 days      |
| **Phase 6** | api.ts                | ⏳ Pending | TBD        | 3-5 days      |

---

## Metrics & Goals

### Coverage Goals

- **Backend**: 85%+ lines, 85%+ functions, 80%+ branches
- **Frontend**: 80%+ lines, 75%+ branches, 80%+ functions

### File Size Goals

- **Target**: <500 lines per file
- **Maximum**: <1000 lines (temporary during transition)
- **Controller files**: <400 lines
- **Service files**: <300 lines
- **Component files**: <400 lines

### Test Count Goals

- Maintain or increase total test count
- Add tests for previously untested paths
- Remove redundant/duplicate tests
- **Current**: 4,028 tests → **Target**: 4,500+ tests

---

## Key Architectural Patterns

### Domain-Driven Design

- Organize code by business domain, not technical layer
- Example: AuthEmailService, EventEmailService, RoleEmailService

### Separation of Concerns

- **Controllers**: Route handling, request/response transformation
- **Services**: Business logic, orchestration
- **Models**: Data structure, validation
- **Utilities**: Shared helpers, no business logic

### Test Organization

- Test files mirror source structure
- Domain service tests in `tests/unit/services/email/domains/`
- Controller tests use spies on services, not mocks
- Integration tests mock external dependencies only

---

## Risk Management

### High-Risk Files (Require Extra Care)

1. **eventController.ts**: Critical business logic, complex authorization
2. **EventDetail.tsx**: Complex state management, user-facing

### Mitigation Strategies

1. **Comprehensive Testing**: Add missing tests before refactoring
2. **Incremental Approach**: Small, validated steps
3. **Frequent Commits**: Checkpoint after each module extraction
4. **Feature Flags**: Use for risky frontend changes
5. **Rollback Plan**: Keep original files until fully validated

---

## Timeline Estimate

- ✅ **Phase 2 (Email Service)**: Complete (5 days)
- **Phase 3 (eventController)**: 2-3 weeks
- **Phase 4 (EventDetail)**: 2-3 weeks
- **Phase 5 (CreateEvent/EditEvent)**: 5-7 days
- **Phase 6 (api.ts)**: 3-5 days
- **Final Validation**: 2-3 days

**Total Remaining**: ~6-8 weeks

---

## Quick Start Guide (After History Loss)

If you lose conversation history, follow these steps:

1. **Read this document** - Understand current state and plan
2. **Check test suite** - Run `npm test` to verify all 4,028 tests pass
3. **Review last commit** - Check git log for most recent refactoring work
4. **Check todo list** - Current phase and next actions tracked in workspace
5. **Pick up where left off** - Follow the 6-phase refactoring process

**Critical Files**:

- This document: `docs/GIANT_FILE_REFACTORING_MASTER_PLAN.md`
- Baseline metrics: See "Current State" section above
- Test conventions: `docs/TESTING_CONVENTIONS.md`

---

## Notes & Observations

### What Works Well

- Incremental refactoring with frequent commits
- Domain-driven organization
- Spy pattern for testing (not mocks)
- Comprehensive documentation for context preservation

### What to Avoid

- Large batch refactorings (high risk of breaking changes)
- Mocking entire facades (brittle tests)
- Skipping test validation between steps
- Under-documenting decisions and rationale

### Lessons from Phase 2

- Coverage can improve when tests are better organized
- Finding bugs during refactoring is common (e.g., co-organizer routing fix)
- Integration tests require different mocking strategy than unit tests
- Documentation time is never wasted - saves hours later

---

## Contact & Resources

**Related Documentation**:

- Test Conventions: `docs/TESTING_CONVENTIONS.md`
- MongoDB Quick Start: `docs/MONGODB_QUICK_START.md`
- Deployment Guide: `docs/DEPLOYMENT_GUIDE.md`

**Archived Documentation**:

- Phase 2 Detailed Plan: `docs/archive/completed-tasks/PHASE_2_TEST_ORGANIZATION_PLAN.md` (after archiving)
- Email Service Analysis: `docs/archive/completed-tasks/EMAILSERVICE_REFACTORING_ANALYSIS.md`

**Version Control**:

- Repository: at-Cloud-sign-up-system
- Branch: main
- Key Commits: 239847c (Phase 2.3), 434695a (Phase 2.4), ad23edd (Phase 2.7)

---

**Last Updated**: October 27, 2025  
**Next Review**: After Phase 3 completion  
**Maintained By**: Development Team
