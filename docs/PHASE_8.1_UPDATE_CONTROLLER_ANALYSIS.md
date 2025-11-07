# Phase 8.1: UpdateController Refactoring Analysis

**Date**: November 5, 2025  
**Target**: `backend/src/controllers/event/UpdateController.ts`  
**Current Size**: 1,297 lines  
**Target Size**: <500 lines (main orchestrator)  
**Status**: Analysis Phase

---

## Executive Summary

UpdateController.ts contains a single massive `updateEvent()` method spanning 1,250+ lines. This method handles all aspects of event updates including:

- Field updates (basic info, dates, format, location)
- Role management (add/remove/modify roles)
- Registration adjustments (capacity changes, waitlist)
- Co-organizer management
- Notification distribution
- Audit logging

This represents a classic "god method" that violates Single Responsibility Principle.

---

## Current State Analysis

### Detailed Method Flow

The `updateEvent()` method (lines 47-1296) performs these operations in sequence:

```
1. VALIDATION & PERMISSIONS (lines 47-106)
   - Validate event ID format
   - Check user authentication
   - Fetch event from database
   - Verify user permissions (EDIT_ANY_EVENT or EDIT_OWN_EVENT)

2. FIELD NORMALIZATION (lines 107-250)
   - Extract suppression flags
   - Normalize endDate, time fields
   - Check time overlap conflicts
   - Normalize virtual meeting fields (zoomLink, meetingId, passcode)
   - Handle format-specific logic (Online/In-person/Hybrid)
   - Normalize location, flyerUrl, secondaryFlyerUrl, timeZone
   - Validate end datetime > start datetime

3. ROLE MANAGEMENT (lines 251-479)
   - Handle forceDeleteRegistrations flag
   - Validate new roles (names, capacities, uniqueness)
   - Protection guards:
     * Prevent deleting roles with registrations
     * Prevent capacity reduction below current registrations
   - Role merging logic (preserve openToPublic for existing roles)
   - Update event.roles array

4. ORGANIZER MANAGEMENT (lines 482-515)
   - Track old organizers for comparison
   - Normalize organizerDetails array
   - Store essential organizer info (userId, name, role, avatar, gender)
   - Use placeholder email/phone (fetched fresh at read time)

5. PROGRAM LINKAGE (lines 516-630)
   - Handle programLabels array
   - Filter invalid values, deduplicate
   - Validate program IDs exist
   - Permission checks for Leader users
     * Free programs accessible to all
     * Mentors have access without purchase
     * Leaders must have purchased
   - Clear or preserve existing programLabels

6. AUTO-UNPUBLISH LOGIC (lines 642-865)
   - Check if published event now missing required fields
   - Set autoUnpublished flag
   - Create audit log for status change
   - Notify event organizers via email
   - Create targeted system messages for organizers
   - Surface auto-unpublish in real-time

7. SAVE EVENT (lines 866-894)
   - event.save()
   - Sync Program.events bidirectional links
   - Calculate added/removed programs
   - Update Program.events arrays

8. CO-ORGANIZER NOTIFICATIONS (lines 918-1058)
   - Detect newly added co-organizers
   - Send email notifications to new co-organizers
   - Create targeted system messages
   - Process in background (fire-and-forget)

9. PARTICIPANT NOTIFICATIONS (lines 1060-1249)
   - Notify participants and guests of event edits
   - Combine users + guests for deduplication
   - Send bulk emails
   - Create unified system messages
   - Process in background

10. CACHE INVALIDATION (lines 1251-1254)
    - Invalidate event-related caches
    - Clear event detail, list, calendar caches

11. RESPONSE BUILDING (lines 1255-1297)
    - Map event to response format
    - Include maxParticipants alias
    - Return success response
    - Handle errors
```

### Code Structure Breakdown

```
UpdateController.ts (1,297 lines)
├── Imports & interfaces (45 lines)
└── updateEvent() method (1,250 lines)
    ├── Validation (60 lines) ✂️ → EventUpdateValidator
    ├── Field normalization (150 lines) ✂️ → FieldNormalizationService
    ├── Role management (230 lines) ✂️ → RoleUpdateService
    ├── Organizer management (35 lines) ✂️ → OrganizerManagementService
    ├── Program linkage (115 lines) ✂️ → ProgramLinkageService
    ├── Auto-unpublish (225 lines) ✂️ → AutoUnpublishService
    ├── Save + sync (30 lines) ⚙️ Keep in orchestrator
    ├── Co-organizer notifications (140 lines) ✂️ → CoOrganizerNotificationService
    ├── Participant notifications (190 lines) ✂️ → ParticipantNotificationService
    ├── Cache invalidation (5 lines) ⚙️ Keep in orchestrator
    └── Response building (45 lines) ⚙️ Keep in orchestrator
```

### Dependencies

**Models**: Event, Registration, User, Program, Purchase  
**Services**: EmailService, RegistrationQueryService, UnifiedMessageController, ResponseBuilderService  
**Utils**: roleUtils, emailRecipientUtils, timezoneUtils, eventValidation, eventPermissions

### Test Coverage

```bash
# Check test files
find backend/tests -name "*update*" -o -name "*UpdateController*" | grep -i event
```

---

## Refactoring Strategy

### Goal

Break down the monolithic `updateEvent()` into focused service classes:

1. **EventUpdateOrchestrator** (main controller, <200 lines)

   - Validates permissions
   - Coordinates update flow
   - Returns response

2. **EventFieldUpdateService** (~150 lines)

   - Handles basic field updates (title, description, date, format, location)
   - Validates field changes
   - Applies timezone conversions

3. **RoleDiffCalculatorService** (~200 lines)

   - Compares old vs new roles
   - Identifies added/removed/modified roles
   - Validates role changes

4. **RoleModificationService** (~300 lines)

   - Adds new roles
   - Removes roles (with registration handling)
   - Modifies existing roles (capacity, description, etc.)

5. **RegistrationAdjustmentService** (~200 lines)

   - Handles capacity increases/decreases
   - Manages waitlist promotions
   - Processes role removals

6. **CoOrganizerManagementService** (~100 lines)

   - Adds/removes co-organizers
   - Validates organizer permissions

7. **UpdateNotificationService** (~150 lines)
   - Determines notification recipients
   - Routes update notifications
   - Handles email/system messages

### Extraction Order

**Phase 8.1.1**: Analyze & document current logic flow  
**Phase 8.1.2**: Extract EventFieldUpdateService (simplest, no dependencies)  
**Phase 8.1.3**: Extract RoleDiffCalculatorService (pure logic, testable)  
**Phase 8.1.4**: Extract CoOrganizerManagementService (standalone)  
**Phase 8.1.5**: Extract RegistrationAdjustmentService  
**Phase 8.1.6**: Extract RoleModificationService  
**Phase 8.1.7**: Extract UpdateNotificationService  
**Phase 8.1.8**: Refactor main controller into EventUpdateOrchestrator  
**Phase 8.1.9**: Test verification & documentation

---

## Testing Strategy

### Current Tests

Identify integration tests covering `updateEvent`:

- Event field updates
- Role additions/removals
- Capacity changes
- Co-organizer management
- Notification triggering

### Test Approach

1. **Run existing tests first**: Establish baseline
2. **Extract with zero changes**: Copy logic exactly
3. **Add unit tests for services**: Test extracted logic in isolation
4. **Verify integration tests**: Ensure end-to-end behavior unchanged
5. **Add new edge case tests**: Cover scenarios exposed during refactoring

---

## Success Criteria

- ✅ UpdateController.ts reduced to <500 lines (60% reduction)
- ✅ 6-7 focused service classes created
- ✅ All existing tests passing (0 regressions)
- ✅ New unit tests for extracted services
- ✅ Code coverage maintained or improved
- ✅ Clear separation of concerns
- ✅ Each service <300 lines

---

## Risk Assessment

### Medium Risks

1. **Complex role diff logic**: Role comparison has edge cases
2. **Registration state management**: Capacity changes affect multiple registrations
3. **Notification routing**: Multiple notification paths based on changes

### Mitigation

- Extract pure logic functions first (RoleDiffCalculator)
- Maintain exact notification behavior
- Comprehensive test coverage before/after
- Incremental extraction with frequent testing

---

## Next Steps

1. Run test suite to establish baseline
2. Map out `updateEvent()` logic flow in detail
3. Identify clear extraction boundaries
4. Start with EventFieldUpdateService extraction
5. Test after each extraction

---

## Notes

- This is the largest single method in the codebase
- Successful refactoring will establish pattern for CreationController
- Consider whether some logic can be shared between Update/Creation controllers
