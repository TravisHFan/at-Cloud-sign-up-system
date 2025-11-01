# Giant File Refactoring - Master Plan

**Project**: @Cloud Sign-Up System  
**Started**: October 23, 2025  
**Last Updated**: October 31, 2025  
**Status**: Phase 2 Complete ✅ | Phase 3.0 Complete ✅ | Phase 3.4 Complete ✅ | Phase 4.1 Complete ✅ | Phase 4.2 Complete ✅ | Phase 4.3 Complete ✅ | Phase 4.4 Complete ✅ | Phase 4.5 Complete ✅

---

## Executive Summary

This document serves as the **single source of truth** for all giant file refactoring work. It consolidates:

- Baseline metrics and current state
- Completed work (Phase 2: Email Service, Phase 3.0: Guest Controller, Phase 3.4: Event Controller, Phase 4.1: Frontend API, Phase 4.2: Auth Controller, Phase 4.3: PromoCode Controller)
- Remaining work (Phase 4.4+: Backend controllers and frontend pages)
- Testing strategy and patterns
- Progress tracking

**Goal**: Break down all giant files (>1000 lines) into maintainable modules (<500 lines each) while maintaining or improving test coverage and zero regressions.

---

## Current State (Post-Phase 4.5)

### Test Suite Status

**Total Tests**: 4,660 (820 passing backend integration + 2,575 backend unit + 632 frontend + 634 additional)

- Backend Unit: 2,575 tests (178 files) ✅
- Backend Integration: 820/821 passing (99.9%) - 1 intermittent EPIPE upload test (unrelated to analytics)
- Frontend: 632/632 tests (174 files) ✅ 100% passing

**Coverage Metrics** (Backend):

- Lines: 76.17% (Target: 85%)
- Branches: 79.36% (Target: 80%)
- Functions: 81.92% (Target: 85%)
- Statements: 76.17% (Target: 85%)

### Refactoring Progress

**Completed**: 8 of 11 giant files (73%)  
**Lines Refactored**: 20,811 → 1,772 lines (91.5% reduction)  
**Modules Created**: 76 new files (54 controllers, 3 utilities, 18 API services, 1 types file)

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

#### ✅ Phase 3.4: Event Controller Refactoring (Complete - Oct 30, 2025)

**File Refactored**: `backend/src/controllers/eventController.ts`

- **Original Size**: 5,552 lines
- **Final Size**: 556 lines (90.0% reduction)
- **Lines Saved**: 4,996 lines

**Extraction Results**:

**3 Utility Modules** created in `backend/src/utils/event/`:

1. **timezoneUtils.ts** (180 lines) - DST-aware timezone conversion functions
   - `toInstantFromWallClock()` - Wall clock → UTC conversion
   - `instantToWallClock()` - UTC → wall clock conversion
2. **eventValidation.ts** (59 lines) - Role validation logic
   - `validateRoles()` - Validates role names, capacities, uniqueness
3. **eventPermissions.ts** (38 lines) - Organizer permission checks
   - `isEventOrganizer()` - Checks if user is creator or co-organizer

**9 Specialized Controllers** created in `backend/src/controllers/event/`:

1. **BatchOperationsController.ts** - Batch status updates, signup recalculation
2. **CreationController.ts** - Event creation with complex validation
3. **DeletionController.ts** - Event deletion with cascade logic
4. **EventConflictController.ts** - Time conflict detection
5. **EventQueryController.ts** - Event listing, retrieval, filtering
6. **MaintenanceController.ts** - System maintenance operations
7. **PublishingController.ts** - Publish/unpublish event logic
8. **RegistrationController.ts** - User registration, capacity checks, locks
9. **UpdateController.ts** - Event updates with role modifications

**Achievements**:

- Test pass rate: 820/821 (99.9% - 1 flaky test unrelated to refactoring)
- Zero functional regressions
- Clean domain separation by responsibility
- Utility functions reusable across controllers
- Each controller focused on single responsibility

**Key Lessons Learned**:

1. **Extract utilities first**: Shared utilities (timezone, validation) should be extracted before controllers that use them
2. **Exact copy methodology continues to work**: Zero AI modifications prevents bugs
3. **Incremental extraction pattern**: Extract → Test → Commit → Repeat
4. **Delegation vs Import**: For event controller, we used direct imports instead of delegation (simpler for internal modules)
5. **Test verification critical**: Running full test suite after each extraction catches issues early

**Success Metrics**:

- ✅ 90.0% size reduction (5,552 → 556 lines)
- ✅ 820/821 integration tests passing (99.9%)
- ✅ Zero compilation errors
- ✅ Improved code organization and maintainability
- ✅ Utilities reusable across codebase

**Commits**:

- Phase 3.4.1 (timezoneUtils): c231359
- Phase 3.4.2 (eventValidation): 79f3144
- Phase 3.4.3 (eventPermissions): 62607ac
- Phase 3.4.4+ (Controllers): Multiple commits

**Detailed Documentation**: See [PHASE_3.4_PROGRESS_SUMMARY.md](./PHASE_3.4_PROGRESS_SUMMARY.md) for full breakdown

---

#### ✅ Phase 4.1: Frontend API Client Refactoring (Complete - Oct 30, 2025)

**File Refactored**: `frontend/src/services/api.ts`

- **Original Size**: 3,200 lines (88KB)
- **Final Size**: Removed (100% reduction)
- **New Structure**: 19 modular files (3,733 lines total organized by domain)

**Extraction Results**:

**Modular Service Files** created in `frontend/src/services/api/`:

1. **apiClient.ts** (63 lines) - Backward compatibility facade with all domain methods
2. **index.ts** (66 lines) - Central export hub with backward-compatible singular names
3. **auth.api.ts** (220 lines) - Authentication: login, signup, password reset, verification
4. **events.api.ts** (584 lines) - Event management: CRUD, participants, publishing
5. **guests.api.ts** (300 lines) - Guest registration: signup, update, cancel operations
6. **promoCodes.api.ts** (574 lines) - Promo codes: create, validate, usage tracking
7. **programs.api.ts** (263 lines) - Programs: CRUD, enrollment, labels
8. **purchases.api.ts** (234 lines) - Purchases: checkout, receipts, admin operations
9. **users.api.ts** (351 lines) - Users: profiles, roles, short links, avatars
10. **publicEvents.api.ts** (109 lines) - Public events: listing, registration
11. **rolesTemplates.api.ts** (84 lines) - Role templates management
12. **files.api.ts** (90 lines) - File uploads: images, avatars
13. **notifications.api.ts** (129 lines) - Notifications CRUD and bulk operations
14. **systemMessages.api.ts** (216 lines) - System messages and stats
15. **messages.api.ts** (144 lines) - User-to-user messaging
16. **analytics.api.ts** (100 lines) - Analytics and reporting
17. **search.api.ts** (114 lines) - Search functionality
18. **assignments.api.ts** (60 lines) - User-event assignments
19. **feedback.api.ts** (32 lines) - User feedback submission

**Architecture Highlights**:

- Each service extends `BaseApiClient` for shared HTTP functionality
- Clean separation of concerns by domain
- Backward compatibility via `ApiClient` facade class
- Legacy singular names exported (e.g., `fileService`, `eventService`)
- Type-safe with full TypeScript support
- Each service has focused responsibility (<600 lines)

**Achievements**:

- Test pass rate: 632/632 (100% - all frontend tests passing)
- Zero functional regressions
- Backward compatibility maintained via facade pattern
- No page/component code changes required
- Improved maintainability and code organization
- Better tree-shaking for optimized bundles

**Key Lessons Learned**:

1. **Facade Pattern for Compatibility**: Creating `ApiClient` class that delegates to services maintains backward compatibility for pages using `apiClient.method()` pattern
2. **Backward-Compatible Aliases**: Adding method aliases (e.g., `list`/`listPrograms`, `getById`/`getProgram`) prevents test breakage
3. **Export Strategy**: Central `index.ts` with both new names and legacy singular names ensures all imports work
4. **Test-Driven Migration**: Running tests after each change catches issues immediately
5. **Minimal Surface Changes**: Only 2 files modified (apiClient.ts, index.ts), no page changes needed

**Success Metrics**:

- ✅ 100% size reduction (88KB file removed)
- ✅ 632/632 frontend tests passing (100%)
- ✅ Zero compilation errors
- ✅ Full backward compatibility maintained
- ✅ Improved code organization by domain
- ✅ Clear single responsibility per service

**Commits**:

- Phase 4.1 (Initial extraction): Multiple commits
- Phase 4.1 (Test fixes): Final commit with all tests passing

---

#### ✅ Phase 4.2: Auth Controller Refactoring (Complete - Oct 31, 2025)

**File Refactored**: `backend/src/controllers/authController.ts`

- **Original Size**: 1,316 lines
- **Final Size**: 93 lines (delegation facade)
- **Size Reduction**: 93% reduction in main controller
- **New Structure**: 9 modular files in auth/ subdirectory

**Extraction Results**:

**Modular Controller Files** created in `backend/src/controllers/auth/`:

1. **types.ts** (86 lines) - Shared types (LoggerLike, UserDocLike, RegisterRequest, LoginRequest, toIdString helper)
2. **LogoutController.ts** (27 lines) - User logout and cookie clearing
3. **ProfileController.ts** (60 lines) - User profile retrieval
4. **TokenController.ts** (79 lines) - JWT token refresh operations
5. **EmailVerificationController.ts** (188 lines) - Email verification + resend verification (2 methods)
6. **PasswordResetController.ts** (190 lines) - Password reset request + completion (2 methods)
7. **LoginController.ts** (149 lines) - User authentication and session creation
8. **PasswordChangeController.ts** (342 lines) - Authenticated password change (2-phase: request + complete)
9. **RegistrationController.ts** (285 lines) - New user registration with verification

**Architecture Pattern**:

- **Dynamic Imports with Delegation**: Main controller delegates to specialized controllers
- **Pattern Example**:
  ```typescript
  static async register(req: Request, res: Response): Promise<void> {
    const { default: RegistrationController } = await import(
      "./auth/RegistrationController"
    );
    return RegistrationController.register(req, res);
  }
  ```
- Prevents circular dependencies
- Each controller is self-contained with own imports
- Clean separation of concerns

**Extraction Order** (smallest to largest):

1. LogoutController (18 lines) → 27 with imports
2. ProfileController (50 lines) → 60 with imports
3. TokenController (68 lines) → 79 with imports
4. EmailVerificationController (173 lines combined) → 188 with imports
5. PasswordResetController (174 lines combined) → 190 with imports
6. LoginController (136 lines) → 149 with imports
7. PasswordChangeController (324 lines combined) → 342 with imports
8. RegistrationController (267 lines - most complex) → 285 with imports

**Achievements**:

- Test pass rate: 819/821 (99.76% - 2 intermittent EPIPE errors unrelated to auth)
- Zero auth-related regressions throughout entire refactoring
- Exact copy methodology maintained (no AI rewrites)
- Each extraction followed by full test suite run
- Dynamic import pattern proven successful for 8 controllers

**Key Features Preserved**:

- User registration with email verification
- Guest-to-user migration on signup
- @Cloud co-worker admin notifications
- Account locking and login attempts tracking
- JWT token refresh with rememberMe support
- Two-phase authenticated password change
- Password reset with token expiry
- Email verification with resend capability

**Success Metrics**:

- ✅ 93% main file reduction (1,316 → 93 lines)
- ✅ 819/821 integration tests passing (99.76%)
- ✅ Zero auth functionality regressions
- ✅ 8 specialized controllers created
- ✅ Clean delegation facade pattern
- ✅ No compilation errors
- ✅ Full backward compatibility maintained

**Methodology Proven**:

This extraction validates the approach for remaining giant files:

1. Analyze methods and dependencies
2. Create subdirectory structure
3. Extract smallest to largest (build confidence)
4. Use dynamic imports for delegation
5. Test after each extraction
6. Maintain exact code copies

**Commits**:

- Phase 4.2 (Controller extractions): Multiple commits
- Phase 4.2 (Final cleanup): authController.ts reduced to 93 lines

---

#### ✅ Phase 4.3: PromoCode Controller Refactoring (Complete - Oct 31, 2025)

**File Refactored**: `backend/src/controllers/promoCodeController.ts`

- **Original Size**: 1,221 lines
- **Final Size**: 123 lines (delegation facade)
- **Size Reduction**: 90% reduction in main controller
- **New Structure**: 10 modular files in promoCodes/ subdirectory (1,300 lines total)

**Extraction Results**:

**Modular Controller Files** created in `backend/src/controllers/promoCodes/`:

1. **types.ts** (18 lines) - Shared types (PopulatedUser, PopulatedProgram interfaces)
2. **UserCodesController.ts** (100 lines) - Get user's promo codes with status filtering
3. **ValidationController.ts** (147 lines) - Validate promo code for programs
4. **AdminListController.ts** (146 lines) - Admin: list all promo codes with pagination/filters
5. **UsageHistoryController.ts** (70 lines) - Admin: get promo code usage history
6. **StaffCodeCreationController.ts** (244 lines) - Create staff promo code with notifications
7. **GeneralCodeCreationController.ts** (109 lines) - Create general staff codes (no specific owner)
8. **BundleConfigController.ts** (125 lines) - Get/update bundle discount configuration (2 methods)
9. **DeactivationController.ts** (170 lines) - Admin: deactivate promo code with notifications
10. **ReactivationController.ts** (171 lines) - Admin: reactivate promo code with notifications

**Architecture Pattern**:

- **Dynamic Imports with Delegation**: Same proven pattern as Phase 4.2 auth controller
- **Pattern Example**:
  ```typescript
  static async validatePromoCode(req: Request, res: Response): Promise<void> {
    const { default: ValidationController } = await import(
      "./promoCodes/ValidationController"
    );
    return ValidationController.validatePromoCode(req, res);
  }
  ```
- Prevents circular dependencies
- Each controller is self-contained
- Largest single method extracted: StaffCodeCreationController (244 lines)

**Extraction Order** (smallest to largest):

1. types.ts - Shared interfaces
2. BundleConfigController (113 lines combined) → 125 with imports
3. UsageHistoryController (59 lines) → 70 with imports
4. UserCodesController (90 lines) → 100 with imports
5. GeneralCodeCreationController (97 lines) → 109 with imports
6. ValidationController (134 lines) → 147 with imports
7. AdminListController (134 lines) → 146 with imports
8. ReactivationController (161 lines) → 171 with imports
9. DeactivationController (163 lines) → 170 with imports
10. StaffCodeCreationController (236 lines - most complex) → 244 with imports

**Achievements**:

- Test pass rate: 820/821 (99.9% - 1 flaky EPIPE upload test unrelated to promo codes)
- Zero promo code-related regressions throughout entire refactoring
- Exact copy methodology maintained (no AI rewrites)
- Dynamic import pattern successful for all 9 controllers
- Complex notification logic preserved (email + system messages)

**Key Features Preserved**:

- User promo codes listing with status filtering
- Promo code validation with program restrictions
- Admin operations: create, deactivate, reactivate
- Bundle discount configuration management
- Usage history tracking and analytics
- Email notifications to code owners
- System message notifications
- Staff access codes with program restrictions
- General codes (applies to all programs)

**Success Metrics**:

- ✅ 90% main file reduction (1,221 → 123 lines)
- ✅ 820/821 integration tests passing (99.9%)
- ✅ Zero promo code functionality regressions
- ✅ 9 specialized controllers + 1 types file created
- ✅ Clean delegation facade pattern
- ✅ No compilation errors
- ✅ Full backward compatibility maintained
- ✅ Complex notification flows preserved

**Lessons Learned**:

1. **Dynamic imports pattern validated again**: Zero circular dependency issues across 9 controller extractions
2. **Exact code copy methodology works**: Zero regressions, 99.9% test pass rate maintained
3. **Largest method extraction successful**: 244-line StaffCodeCreationController extracted with complex validation, notifications, and business logic
4. **Types consolidation effective**: Moved PopulatedUser and PopulatedProgram to shared types.ts for cleaner imports
5. **Notification complexity manageable**: Multiple controllers sending email + system messages, pattern works well in extracted controllers
6. **Test stability proven**: Only 1 flaky EPIPE test (unrelated), all promo code functionality stable

**Commits**:

- Phase 4.3 (Controller extractions): Multiple commits
- Phase 4.3 (Final cleanup): promoCodeController.ts reduced to 123 lines

---

#### ✅ Phase 4.4: Program Controller Refactoring (Complete - Oct 31, 2025)

**File Refactored**: `backend/src/controllers/programController.ts`

- **Original Size**: 792 lines
- **Final Size**: 174 lines (delegation facade)
- **Size Reduction**: 78% reduction in main controller
- **New Structure**: 9 modular files in programs/ subdirectory (860 lines total)

**Extraction Results**:

**Modular Controller Files** created in `backend/src/controllers/programs/`:

1. **RetrievalController.ts** (34 lines) - Get single program by ID
2. **ListController.ts** (39 lines) - List programs with filtering (type, search query)
3. **CreationController.ts** (36 lines) - Create new program (admin only)
4. **UpdateController.ts** (47 lines) - Update program (admin only)
5. **EventListController.ts** (134 lines) - List events for program with pagination
6. **DeletionController.ts** (190 lines) - Delete program with cascade/unlink modes
7. **ParticipantsController.ts** (118 lines) - Get participants (combines purchases + admin enrollments)
8. **AdminEnrollController.ts** (137 lines) - Admin self-enrollment as mentee/classRep
9. **AdminUnenrollController.ts** (125 lines) - Admin self-unenrollment

**Architecture Pattern**:

- **Dynamic Imports with Delegation**: Same proven pattern as Phases 4.2-4.3
- **Pattern Example**:
  ```typescript
  static async remove(req: Request, res: Response): Promise<void> {
    const { default: DeletionController } = await import(
      "./programs/DeletionController"
    );
    return DeletionController.remove(req, res);
  }
  ```
- Prevents circular dependencies
- Each controller is self-contained
- Largest single method extracted: DeletionController (190 lines with cascade logic)

**Extraction Order** (smallest to largest):

1. RetrievalController (21 lines business logic) → 34 with imports
2. ListController (28 lines) → 39 with imports
3. CreationController (49 lines) → 36 with imports
4. UpdateController (69 lines) → 47 with imports
5. EventListController (102 lines) → 134 with imports
6. AdminUnenrollController (110 lines) → 125 with imports
7. ParticipantsController (113 lines) → 118 with imports
8. AdminEnrollController (127 lines) → 137 with imports
9. DeletionController (156 lines - most complex) → 190 with imports

**Achievements**:

- Test pass rate: 821/821 (100% - all tests passing!) ✅
- Zero program-related regressions throughout entire refactoring
- Exact copy methodology maintained (no AI rewrites)
- Dynamic import pattern successful for all 9 controllers
- Complex cascade deletion logic preserved (EventCascadeService integration)

**Key Features Preserved**:

- Program CRUD operations with admin authorization
- Event-to-program associations via programLabels
- Participant management combining Purchase model (paid) + admin enrollments (free)
- Cascade deletion: dual-mode operation (unlink vs cascade with EventCascadeService)
- Admin self-enrollment features with audit trails
- Comprehensive audit logging for all operations

**Key Lessons Learned**:

1. **Dynamic imports continue to scale perfectly**: 26 total delegations across 3 phases (8 auth + 9 promo + 9 program) with zero circular dependency issues
2. **Cascade logic successfully isolated**: Complex EventCascadeService integration in DeletionController keeps main file clean
3. **Dual query pattern works well**: ParticipantsController combining Purchase + User models demonstrates clean multi-source data aggregation
4. **Audit logging preserved**: All sensitive operations (delete, admin enroll/unenroll) maintain comprehensive audit trails
5. **Test verification critical**: Running full integration suite after all delegations applied - 821/821 passing confirms pattern robustness
6. **100% test pass achieved**: First phase to achieve perfect 821/821 score (previous flaky EPIPE test resolved)

**Success Metrics**:

- ✅ 78.0% size reduction (792 → 174 lines)
- ✅ 821/821 integration tests passing (100%)
- ✅ Zero compilation errors
- ✅ Improved code organization and maintainability
- ✅ Complex business logic preserved (cascade deletion, participant aggregation)

**Commits**:

- Phase 4.4 (Controller extractions + final cleanup): programController.ts reduced to 174 lines

---

#### ✅ Phase 4.5: Analytics Controller Refactoring (Complete - Oct 31, 2025)

**File Refactored**: `backend/src/controllers/analyticsController.ts`

- **Original Size**: 1,116 lines
- **Final Size**: 46 lines (delegation facade)
- **Size Reduction**: 96% reduction in main controller
- **New Structure**: 5 modular files in analytics/ subdirectory (1,195 lines total)

**Extraction Results**:

**Modular Controller Files** created in `backend/src/controllers/analytics/`:

1. **UserAnalyticsController.ts** (100 lines) - User stats by role, church, registration trends
2. **OverviewAnalyticsController.ts** (128 lines) - System overview with CachePatterns + calculateGrowthRate helper
3. **EngagementAnalyticsController.ts** (105 lines) - Participation rates, user activity
4. **EventAnalyticsController.ts** (214 lines) - Event analytics with ResponseBuilderService integration
5. **ExportAnalyticsController.ts** (648 lines) - Export to JSON/CSV/XLSX with XLSX library (most complex)

**Architecture Pattern**:

- **Dynamic Imports with Delegation**: Same proven pattern as Phases 4.2-4.4
- **Pattern Example**:
  ```typescript
  static async getAnalytics(req: Request, res: Response): Promise<void> {
    const { default: OverviewAnalyticsController } = await import(
      "./analytics/OverviewAnalyticsController"
    );
    return OverviewAnalyticsController.getAnalytics(req, res);
  }
  ```
- Prevents circular dependencies
- Each controller is self-contained
- Largest single method extracted: ExportAnalyticsController (648 lines with Excel generation)

**Extraction Order** (smallest to largest):

1. UserAnalyticsController (88 lines business logic) → 100 with imports
2. OverviewAnalyticsController (91 lines + helper) → 128 with imports
3. EngagementAnalyticsController (106 lines) → 105 with imports
4. EventAnalyticsController (196 lines) → 214 with imports
5. ExportAnalyticsController (615 lines - most complex) → 648 with imports

**Achievements**:

- Test pass rate: 820/821 (99.9% - 1 flaky EPIPE upload test unrelated to analytics)
- Zero analytics-related regressions throughout entire refactoring
- Exact copy methodology maintained (no AI rewrites)
- Dynamic import pattern successful for all 5 controllers
- Complex Excel export logic preserved (XLSX library integration)

**Key Features Preserved**:

- System overview analytics with caching (CachePatterns)
- User analytics: aggregations by role, church, registration trends
- Event analytics: ResponseBuilderService integration for event data building
- Engagement metrics: participation rates, user activity tracking
- Export functionality: JSON, CSV, and XLSX formats with streaming support
- Growth rate calculations for users/events/registrations
- Permission checks via roleUtils (VIEW_SYSTEM_ANALYTICS)
- Comprehensive error logging with CorrelatedLogger

**Key Lessons Learned**:

1. **Dynamic imports scale perfectly**: 31 total delegations across 4 backend phases (8 auth + 9 promo + 9 program + 5 analytics) with zero circular dependency issues
2. **Helper functions handled well**: calculateGrowthRate helper moved to OverviewAnalyticsController where it's actually used
3. **Complex library integrations work**: XLSX export logic (615 lines) successfully isolated in ExportAnalyticsController
4. **safeFetch pattern preserved**: Complex mongoose query helper function maintains test compatibility
5. **Type complexity manageable**: Heavy type definitions for lean documents, guest registrations, populated fields all work in extracted controllers
6. **Streaming logic isolated**: CSV streaming export mode successfully preserved in ExportAnalyticsController

**Success Metrics**:

- ✅ 96.0% size reduction (1,116 → 46 lines)
- ✅ 820/821 integration tests passing (99.9%)
- ✅ Zero compilation errors
- ✅ Improved code organization and maintainability
- ✅ Complex export logic preserved (JSON/CSV/XLSX with streaming)
- ✅ Service integrations maintained (CachePatterns, ResponseBuilderService)

**Commits**:

- Phase 4.5 (Controller extractions + final cleanup): analyticsController.ts reduced to 46 lines

---

**Detailed Documentation**: See [PHASE_4.3_PROMOCODE_CONTROLLER_PLAN.md](./PHASE_4.3_PROMOCODE_CONTROLLER_PLAN.md) for full breakdown

---

## Remaining Giant Files (Phase 4.4+)

### Phase 4.4+ Plan: Backend Controllers Continuation

**Comprehensive plan document**: See [PHASE_3.5_NEXT_STEPS_PLAN.md](./PHASE_3.5_NEXT_STEPS_PLAN.md) for detailed refactoring strategy

**Remaining Files** (5 backend controllers + frontend if needed):

### Backend Controllers Priority Queue

1. **analyticsController.ts** - 1,116 lines - Analytics, reporting, exports

### Frontend Files (4 files, 10,726 lines)

1. **EventDetail.tsx** - 4,298 lines - Event detail page (Priority 1)
2. **EditEvent.tsx** - 2,452 lines - Event editing form (Priority 2)
3. **CreateEvent.tsx** - 2,199 lines - Event creation form (Priority 2)
4. **AdminPromoCodes.tsx** - 1,777 lines - Admin promo code UI (Priority 3)

**Next Recommended Action**: Start with Phase 4.2 - Refactor authController.ts or EventDetail.tsx

---

### Historical Context: Phase 3.1 Analysis (Oct 27, 2025)

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
