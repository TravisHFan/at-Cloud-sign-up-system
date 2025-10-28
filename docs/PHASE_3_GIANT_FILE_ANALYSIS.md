# Phase 3.1: Giant File Analysis & Prioritization

**Date:** October 27, 2025  
**Purpose:** Comprehensive analysis of remaining giant files to establish refactoring priority order

---

## Executive Summary

After completing Phase 2 (Email Service Domain Refactoring), we have **4 remaining giant files** requiring refactoring:

| File                                | Lines | Priority         | Risk        | Complexity | Test Coverage |
| ----------------------------------- | ----- | ---------------- | ----------- | ---------- | ------------- |
| **eventController.ts**              | 5,552 | **P1 (Highest)** | 🔴 Critical | Very High  | Good (71%)    |
| **api.ts**                          | 3,134 | **P2**           | 🟡 Moderate | Medium     | Unknown       |
| **EventDetail.tsx**                 | 4,298 | **P3**           | 🟠 High     | Very High  | Medium        |
| **CreateEvent.tsx + EditEvent.tsx** | 4,651 | **P3**           | 🟠 High     | Very High  | Medium        |

**Recommended Order:** `eventController.ts` → `api.ts` → `EventDetail.tsx` → `CreateEvent.tsx + EditEvent.tsx`

---

## File #1: backend/src/controllers/eventController.ts

### Overview

- **Size:** 5,552 lines (LARGEST giant file)
- **Type:** Backend controller class
- **Complexity:** ⭐⭐⭐⭐⭐ (5/5 - Extremely High)
- **Test File:** 7,429 lines (`eventController.test.ts` + `eventController.mentorCircle.test.ts`)
- **Coverage:** ~71% lines, ~73% branches (from baseline metrics)

### Structure Analysis

**Static Methods:** 20 public API endpoints

- `checkTimeConflict` - Time conflict detection with timezone support
- `publishEvent` / `unpublishEvent` - Event visibility control
- `updateAllEventStatuses` - Batch status updates
- `recalculateSignupCounts` - Capacity recalculation
- `getAllEvents` - Event listing with filters
- `getEventById` - Single event retrieval
- `hasRegistrations` - Registration check
- `createEvent` - Event creation (massive method)
- `updateEvent` - Event updates (massive method)
- `deleteEvent` - Event deletion with cascades
- `signUpForEvent` - User registration
- `updateWorkshopGroupTopic` - Workshop management
- `cancelSignup` - Signup cancellation
- `removeUserFromRole` - Role removal
- `moveUserBetweenRoles` - Role transfers
- `assignUserToRole` - Role assignments
- `getUserEvents` - User event history
- `getCreatedEvents` - Created events listing
- `getEventParticipants` - Participant listing

**Private Helpers:** 3+ utility methods

- `hasOrganizerDetails` - Type guard
- `toIdString` - ID normalization
- `toInstantFromWallClock` - Timezone conversion (complex)
- `instantToWallClock` - Reverse timezone conversion
- `findConflictingEvents` - Conflict detection logic

### Complexity Factors

1. **Timezone Logic:** Complex DST-aware timezone conversions (200+ lines)
2. **Capacity Management:** User-only vs. guest-inclusive counting semantics
3. **Lock Coordination:** Distributed locking for race condition prevention
4. **Cascade Operations:** Event deletion triggers multiple cascade effects
5. **Permission Checks:** Role-based access control throughout
6. **Email Notifications:** Integration with TrioNotificationService
7. **WebSocket Events:** Real-time updates via socketService
8. **Audit Logging:** Comprehensive audit trail generation
9. **Cache Invalidation:** CachePatterns integration
10. **Registration Limits:** Complex validation rules

### Dependencies (Heavy Coupling)

- **Models:** Event, Registration, User, Program, Purchase (5 models)
- **Services:** 10+ services (Email, Socket, Lock, Cache, Logger, Trio, etc.)
- **Utils:** 8+ utility modules
- **Controllers:** UnifiedMessageController

### Risk Assessment

**Risk Level:** 🔴 **CRITICAL** (Highest priority)

**Why P1:**

1. **Central to System:** Core business logic for events
2. **High Traffic:** Most-used controller in application
3. **Complex Logic:** Timezone, locking, capacity management
4. **Well-Tested:** 71% coverage provides safety net
5. **Architectural Debt:** Violates Single Responsibility Principle massively
6. **Maintenance Burden:** Any change touches 5,500+ lines
7. **Cascading Impact:** Changes here affect entire system

**Refactoring Reward:**

- Improved maintainability
- Better testability (modular unit tests)
- Reduced cognitive load
- Easier to add features
- Lower bug risk

### Proposed Module Structure (8 modules)

```
backend/src/controllers/events/
├── index.ts                          # Re-exports all controllers
├── EventQueryController.ts           # Read operations (getAllEvents, getEventById, getUserEvents)
├── EventCreationController.ts        # Create operations (createEvent)
├── EventUpdateController.ts          # Update operations (updateEvent, publishEvent, unpublishEvent)
├── EventDeletionController.ts        # Delete operations (deleteEvent)
├── EventRegistrationController.ts    # Registration ops (signUpForEvent, cancelSignup)
├── EventRoleController.ts            # Role ops (assignUserToRole, moveUserBetweenRoles, removeUserFromRole)
├── EventConflictController.ts        # Conflict detection (checkTimeConflict, findConflictingEvents)
└── EventMaintenanceController.ts     # System ops (updateAllEventStatuses, recalculateSignupCounts)
```

**Shared Utilities:**

```
backend/src/utils/eventUtils/
├── timezoneUtils.ts                  # Extract timezone conversion logic
├── capacityUtils.ts                  # Capacity checking logic
└── eventValidation.ts                # Validation helpers
```

---

## File #2: frontend/src/services/api.ts

### Overview

- **Size:** 3,134 lines
- **Type:** API client service layer
- **Complexity:** ⭐⭐⭐ (3/5 - Medium)
- **Test Files:** Scattered across 328 frontend test files
- **Coverage:** Unknown (needs investigation)

### Structure Analysis

**Exports:** 15+ service objects

- `apiClient` - Base API client class
- `authService` - Authentication operations
- `eventService` - Event CRUD operations
- `rolesTemplateService` - Role template management
- `userService` - User management
- `notificationService` - Notifications
- `messageService` - System messages
- `fileService` - File uploads
- `analyticsService` - Analytics
- `programService` - Program management
- `searchService` - Search functionality
- `systemMessageService` - System messaging
- `assignmentService` - Assignment operations
- `purchaseService` - Purchase operations
- `adminPurchaseService` - Admin purchase ops

**Patterns:**

- API_BASE_URL configuration with normalization
- Type definitions for requests/responses
- Service object pattern (stateless methods)
- Session expiration handling

### Complexity Factors

1. **API Normalization:** URL sanitization logic
2. **Type Definitions:** 50+ TypeScript interfaces
3. **Service Coordination:** 15 different service domains
4. **Error Handling:** Session expiration detection
5. **Request/Response Mapping:** Data transformation

### Risk Assessment

**Risk Level:** 🟡 **MODERATE**

**Why P2:**

1. **Mechanical Splitting:** Most logic is straightforward CRUD
2. **Low Risk:** Breaking into modules is relatively safe
3. **Type Safety:** TypeScript helps prevent regressions
4. **Quick Wins:** Can split by service domain easily
5. **Test Coverage:** Existing tests cover API contracts

**Refactoring Reward:**

- Cleaner imports (tree-shaking benefits)
- Easier to find specific APIs
- Better code organization
- Reduced file size for faster loading

### Proposed Module Structure (15+ files)

```
frontend/src/services/api/
├── index.ts                          # Re-exports all services
├── apiClient.ts                      # Base API client class
├── apiConfig.ts                      # Configuration & normalization
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
└── types/
    ├── auth.types.ts                 # Auth type definitions
    ├── event.types.ts                # Event types
    └── ...                           # Other type files
```

---

## File #3: frontend/src/pages/EventDetail.tsx

### Overview

- **Size:** 4,298 lines (2nd largest giant file)
- **Type:** React component page
- **Complexity:** ⭐⭐⭐⭐⭐ (5/5 - Extremely High)
- **Hooks:** 35+ useState/useEffect/useRef calls
- **Test Files:** Multiple test files cover different aspects

### Structure Analysis

**Components:**

- `PublishReadinessInline` - Inline helper component
- `PublishActionButton` - Button component
- `EventDetail` - Main default export (massive component)

**State Management:**

- Event data state
- UI state (modals, loading, publishing)
- User interaction state
- Registration state
- WebSocket real-time updates
- Avatar updates
- Toast notifications

**Features in Single Component:**

1. Event detail display
2. Role signup interface
3. Guest management
4. Flyer carousel
5. Event editing
6. Event deletion
7. Publishing/unpublishing
8. Participant listing
9. Excel export
10. Share modal
11. Real-time updates (WebSocket)
12. Avatar updates
13. Name card actions
14. Guest contact visibility

### Complexity Factors

1. **State Explosion:** 35+ hooks creating tangled dependencies
2. **Side Effects:** Multiple useEffect chains
3. **Event Handlers:** 50+ inline event handlers
4. **Conditional Rendering:** Complex nested conditions
5. **API Coordination:** Calls to 10+ different API services
6. **Real-time Logic:** WebSocket event handling
7. **Modal Management:** 5+ different modals
8. **Permission Logic:** Role-based UI hiding
9. **Data Transformation:** Format conversions throughout

### Risk Assessment

**Risk Level:** 🟠 **HIGH**

**Why P3 (Lower Priority than Backend):**

1. **React Complexity:** Component splitting is tricky with hooks
2. **State Dependencies:** Hooks create implicit dependencies
3. **Testing Challenges:** React Testing Library has limitations
4. **UI Risk:** Visual regressions are harder to catch
5. **Less Critical:** Frontend bugs are less severe than backend
6. **Requires Design:** Need thoughtful component hierarchy

**Refactoring Reward:**

- Better component reusability
- Easier to test individual features
- Reduced re-render overhead
- Clearer code organization

### Proposed Module Structure

```
frontend/src/pages/EventDetail/
├── index.tsx                         # Main container (orchestrator)
├── EventDetailHeader.tsx             # Title, status, metadata
├── EventDetailInfo.tsx               # Date, time, location, organizers
├── EventDetailDescription.tsx        # Purpose, agenda, materials
├── EventDetailFlyer.tsx              # Flyer carousel
├── EventDetailRoles.tsx              # Role list with signup
├── EventDetailParticipants.tsx       # Participant list & export
├── EventDetailActions.tsx            # Edit, delete, share buttons
├── PublishControls.tsx               # Publish/unpublish logic
├── hooks/
│   ├── useEventDetail.ts             # Main event data fetching
│   ├── useEventActions.ts            # CRUD action handlers
│   ├── useEventRealtime.ts           # WebSocket updates
│   └── useEventPermissions.ts        # Permission checking
└── components/
    ├── GuestManagement.tsx           # Guest-specific UI
    ├── NameCardModal.tsx             # Name card actions
    └── ParticipantExport.tsx         # Excel export logic
```

---

## File #4: frontend/src/pages/CreateEvent.tsx + EditEvent.tsx

### Overview

- **Size:** 4,651 lines combined (2,199 + 2,452)
- **Type:** React component pages (form-heavy)
- **Complexity:** ⭐⭐⭐⭐⭐ (5/5 - Extremely High)
- **Similarity:** ~80% code duplication between Create/Edit
- **Test Files:** Multiple test files

### Structure Analysis

**Form Sections:**

1. Basic Info (title, type, date, time, location)
2. Organizer Details (name, role, contact)
3. Event Details (purpose, agenda, materials)
4. Roles Configuration (name, description, capacity, timing)
5. Hybrid/Online Settings (Zoom links)
6. Program & Circle Association
7. Flyer Upload
8. Workshop Group Topics
9. Recurrence Settings (if applicable)

**State Management:**

- Form data state (15+ fields)
- Role array state
- Validation state
- UI state (loading, modals)
- File upload state
- Program/circle selection

### Complexity Factors

1. **Form Complexity:** 20+ input fields with validation
2. **Code Duplication:** Create vs. Edit nearly identical
3. **Role Management:** Dynamic role array manipulation
4. **File Uploads:** Flyer image handling
5. **Validation Logic:** Complex validation rules
6. **Conditional Fields:** Show/hide based on selections
7. **API Coordination:** Multiple endpoints for related data

### Risk Assessment

**Risk Level:** 🟠 **HIGH**

**Why P3 (Same as EventDetail):**

1. **High Duplication:** Can eliminate with shared form component
2. **Complex State:** Form state management is tricky
3. **Validation Coupling:** Validation logic tied to UI
4. **Testing Challenges:** Form testing is complex
5. **Less Critical:** Forms have client-side validation safety net

**Refactoring Reward:**

- Eliminate code duplication (2,400+ lines saved)
- Shared form component for create/edit
- Better validation reusability
- Easier to add fields

### Proposed Module Structure

```
frontend/src/pages/EventForm/
├── CreateEvent.tsx                   # Thin wrapper (uses EventForm)
├── EditEvent.tsx                     # Thin wrapper (uses EventForm)
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
│   ├── useEventForm.ts               # Main form state management
│   ├── useEventValidation.ts         # Validation logic
│   └── useEventSubmit.ts             # Submit handling
└── components/
    ├── RoleEditor.tsx                # Single role editor
    └── OrganizerEditor.tsx           # Single organizer editor
```

---

## Final Priority Ranking

### Priority 1 (P1): `eventController.ts`

**Start Date:** Phase 3.2 (Next)  
**Estimated Duration:** 2 weeks  
**Reason:** Highest risk, highest reward, best test coverage

**Why First:**

1. ✅ **Best Test Coverage:** 71% coverage + 7,429 test lines provides safety net
2. ✅ **Critical Business Logic:** Core event operations used everywhere
3. ✅ **High Impact:** Improvements benefit entire backend
4. ✅ **Modular Structure:** Clear domain boundaries (Query, Create, Update, Delete, Registration, Roles)
5. ✅ **Architectural Debt:** Biggest Single Responsibility violation
6. ✅ **Maintenance Burden:** Every feature touches this file

**Success Criteria:**

- [ ] Split into 8-10 controller modules
- [ ] Maintain 71%+ test coverage
- [ ] All 4,028 tests still passing
- [ ] No performance regressions
- [ ] Improved import granularity

---

### Priority 2 (P2): `api.ts`

**Start Date:** After P1 complete  
**Estimated Duration:** 3-5 days  
**Reason:** Quick wins, low risk, mechanical splitting

**Why Second:**

1. ✅ **Low Risk:** TypeScript + existing tests catch regressions
2. ✅ **Quick Wins:** Mechanical splitting by service domain
3. ✅ **Tree-Shaking Benefits:** Better bundling optimization
4. ✅ **Clear Boundaries:** Each service is independent
5. ✅ **Moderate Impact:** Cleaner frontend architecture

**Success Criteria:**

- [ ] Split into 15+ service modules
- [ ] All frontend tests still passing
- [ ] Improved bundle size (tree-shaking)
- [ ] Better import clarity

---

### Priority 3 (P3): `EventDetail.tsx` OR `CreateEvent.tsx + EditEvent.tsx`

**Start Date:** After P2 complete  
**Estimated Duration:** 1 week each  
**Reason:** High complexity, requires careful design

**Why Third (Tie):**

1. ⚠️ **React Complexity:** Hooks create implicit dependencies
2. ⚠️ **State Management:** Need careful hook extraction
3. ⚠️ **Testing Challenges:** React Testing Library limitations
4. ⚠️ **UI Risk:** Visual regressions harder to catch
5. ✅ **Lower Business Impact:** Frontend bugs less critical

**Decision Point:** Choose between EventDetail or CreateEvent/EditEvent based on:

- **EventDetail:** More features, more complex, but single file
- **CreateEvent/EditEvent:** Less complex individually, but massive code duplication

**Recommendation:** Start with `CreateEvent/EditEvent` due to duplication elimination opportunity (2,400+ lines saved by sharing form component).

---

## Next Steps (Phase 3.2)

**Immediate Actions:**

1. ✅ Review and approve priority ranking
2. ⏭️ Create detailed refactoring plan for `eventController.ts`
3. ⏭️ Establish test baseline for Phase 3.3
4. ⏭️ Begin incremental extraction in Phase 3.4

**Questions to Resolve:**

- Should we add more tests before refactoring eventController?
- Should we refactor timezone utils first (separate PR)?
- How should we handle the shared utilities (eventUtils/)?

---

## Conclusion

**Priority Order:** `eventController.ts` → `api.ts` → `CreateEvent/EditEvent` → `EventDetail.tsx`

**Rationale:** Start with highest-risk, highest-reward backend file (eventController), then quick wins (api.ts), then tackle frontend complexity with duplication elimination (CreateEvent/EditEvent) before final complex UI component (EventDetail).

**Total Estimated Time:** 4-5 weeks for all four files

**Risk Mitigation:** Incremental extraction with test validation at each step, following proven Phase 2 pattern.
