# Phase 6.5: ProgramDetail.tsx Refactoring Analysis

**Date**: 2025-11-03  
**File**: `frontend/src/pages/ProgramDetail.tsx`  
**Current Size**: 1,277 lines  
**Status**: Analysis Complete - Ready for Extraction

## Executive Summary

ProgramDetail.tsx is a complex page component responsible for displaying program information, managing events, handling access control, and providing admin functions. The file contains multiple distinct responsibilities that can be extracted into focused components.

**Target Reduction**: 40-50% (similar to Phase 6.2 EventDetail: 43.0%)

## Current Structure Analysis

### File Breakdown

1. **Imports & Types** (Lines 1-61): 61 lines

   - React, routing, services
   - Types, utilities, components
   - Type definition for `Program`

2. **Main Component** (Lines 62-1277): 1,216 lines
   - State management (~100 lines)
   - Data fetching & effects (~150 lines)
   - Event handlers (~200 lines)
   - Helper functions (~100 lines)
   - JSX rendering (~666 lines)

### Key Responsibilities

1. **Program Information Display**

   - Title, type, hosted by
   - Period (start/end dates)
   - Introduction text
   - Flyer image
   - Mentors section with avatars

2. **Access Control & Purchasing**

   - Check if user has access
   - Display purchase status
   - Show pricing information
   - Early bird/class rep discounts

3. **Events List Management**

   - Fetch program events
   - Server/client pagination toggle
   - Sorting (asc/desc by date)
   - Status badges (upcoming/past/ongoing)
   - Event list rendering

4. **Pagination Controls**

   - Page navigation (prev/next)
   - Direct page input with validation
   - URL sync with query params
   - Loading states

5. **Admin Actions**

   - Edit program button
   - Delete program modal
   - Cascade vs preserve events option
   - Delete confirmation flow

6. **Participants Management**

   - ProgramParticipants component integration
   - Enrollment management

7. **Real-time Updates**
   - WebSocket connection
   - Avatar update listening
   - Auto-refresh on changes

## Extraction Candidates

### Priority 1: High-Impact Extractions

#### 1. **ProgramHeader Component** (~150 lines)

**Lines**: ~490-640  
**Responsibility**: Display program title, type, period, hosted by, edit button  
**Benefits**:

- Clear separation of header section
- Reusable across different program views
- Easier to test header rendering

**Props**:

```typescript
interface ProgramHeaderProps {
  program: Program;
  canEdit: boolean;
  onEdit: () => void;
}
```

#### 2. **ProgramPricingCard Component** (~100 lines)

**Lines**: ~640-740  
**Responsibility**: Display pricing, access status, purchase info  
**Benefits**:

- Isolated pricing logic
- Complex discount calculations
- Access control display

**Props**:

```typescript
interface ProgramPricingCardProps {
  program: Program;
  hasAccess: boolean | null;
  accessReason: string | null;
  currentUser: User | null;
}
```

#### 3. **ProgramMentors Component** (~150 lines)

**Lines**: ~740-890  
**Responsibility**: Display mentor list with avatars and contact info  
**Benefits**:

- Complex avatar handling
- Access control for contact info
- Profile navigation logic

**Props**:

```typescript
interface ProgramMentorsProps {
  mentors: Program["mentors"];
  avatarUpdateCounter: number;
  canViewProfiles: boolean;
  hasAccess: boolean | null;
  onMentorClick: (userId: string) => void;
}
```

#### 4. **EventsList Component** (~300 lines)

**Lines**: ~890-1190  
**Responsibility**: Render paginated events with status badges  
**Benefits**:

- Complex pagination logic
- Server/client mode switching
- Status calculation

**Props**:

```typescript
interface EventsListProps {
  events: EventData[];
  serverPageEvents: EventData[] | null;
  isLoading: boolean;
  serverPaginationEnabled: boolean;
  getEventStatus: (event: EventData) => "upcoming" | "past" | "ongoing";
  onEventClick: (eventId: string) => void;
}
```

#### 5. **PaginationControls Component** (~150 lines)

**Lines**: ~1050-1200  
**Responsibility**: Page navigation, input validation, URL sync  
**Benefits**:

- Complex validation logic
- Debouncing input
- Accessibility announcements

**Props**:

```typescript
interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}
```

#### 6. **DeleteProgramModal Component** (~200 lines)

**Lines**: ~483-683  
**Responsibility**: Delete confirmation with cascade option  
**Benefits**:

- Complex modal flow
- Two-step confirmation
- Error handling

**Props**:

```typescript
interface DeleteProgramModalProps {
  isOpen: boolean;
  showFinalConfirm: boolean;
  isDeleting: boolean;
  linkedEventsCount: number;
  deleteCascade: boolean;
  programTitle: string;
  onCascadeChange: (cascade: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}
```

### Priority 2: Utility Extractions

#### 7. **useProgram Hook** (~200 lines)

**Responsibility**: Program data fetching, access checking, WebSocket  
**Benefits**:

- Separate data logic from UI
- Reusable across program views
- Easier to test

#### 8. **useProgramEvents Hook** (~250 lines)

**Responsibility**: Events fetching, pagination, sorting  
**Benefits**:

- Complex pagination logic isolated
- Server/client mode handling
- State management cleanup

#### 9. **StatusBadge Component** (~30 lines)

**Responsibility**: Display event status badge  
**Benefits**:

- Reusable badge component
- Consistent styling

### Priority 3: Helper Functions

#### 10. **periodText Function** (~25 lines)

**Lines**: 446-470  
**Can remain in parent or move to utils**

#### 11. **getEventStatus Function** (~25 lines)

**Lines**: 282-307  
**Should move to events utility or hook**

## Refactoring Strategy

### Phase 6.5.1: Extract ProgramHeader Component

- Lines: ~490-640 → ~150 lines
- New file: `frontend/src/components/ProgramDetail/ProgramHeader.tsx`
- Reduction: 1,277 → 1,127 lines

### Phase 6.5.2: Extract ProgramPricingCard Component

- Lines: ~640-740 → ~100 lines
- New file: `frontend/src/components/ProgramDetail/ProgramPricingCard.tsx`
- Reduction: 1,127 → 1,027 lines

### Phase 6.5.3: Extract ProgramMentors Component

- Lines: ~740-890 → ~150 lines
- New file: `frontend/src/components/ProgramDetail/ProgramMentors.tsx`
- Reduction: 1,027 → 877 lines

### Phase 6.5.4: Extract DeleteProgramModal Component

- Lines: ~483-683 → ~200 lines
- New file: `frontend/src/components/ProgramDetail/DeleteProgramModal.tsx`
- Reduction: 877 → 677 lines

### Phase 6.5.5: Extract EventsList Component

- Lines: ~890-1190 → ~300 lines
- New file: `frontend/src/components/ProgramDetail/EventsList.tsx`
- Reduction: 677 → 377 lines

### Phase 6.5.6: Extract PaginationControls Component

- Lines: ~1050-1200 → ~150 lines
- New file: `frontend/src/components/ProgramDetail/PaginationControls.tsx`
- Reduction: 377 → 227 lines (if extracted separately)
- Note: Might be combined with EventsList for cohesion

### Phase 6.5.7: Extract Custom Hooks

- useProgram hook → ~200 lines
- useProgramEvents hook → ~250 lines
- New files:
  - `frontend/src/hooks/useProgram.ts`
  - `frontend/src/hooks/useProgramEvents.ts`

## Expected Outcome

**Before**: 1,277 lines  
**After Core Extractions** (6.5.1-6.5.6): ~377-477 lines  
**After Hook Extractions** (6.5.7): ~227 lines  
**Total Reduction**: ~1,050 lines (82%) or ~600-700 lines (47-55%)

**Realistic Target**: 500-600 lines (50-53% reduction)

### Component Distribution

- ProgramHeader: 150 lines
- ProgramPricingCard: 100 lines
- ProgramMentors: 150 lines
- DeleteProgramModal: 200 lines
- EventsList: 300 lines
- PaginationControls: 150 lines
- useProgram hook: 200 lines
- useProgramEvents hook: 250 lines
- ProgramDetail.tsx (orchestrator): 500-600 lines

**Total**: ~2,000 lines (from 1,277 monolithic)  
**Components**: 6 components + 2 hooks + 1 orchestrator

## Risk Assessment

### Low Risk

- ProgramHeader (simple display)
- StatusBadge (pure presentation)
- DeleteProgramModal (self-contained)

### Medium Risk

- ProgramPricingCard (complex calculations)
- ProgramMentors (avatar + access logic)
- PaginationControls (validation logic)

### High Risk

- EventsList (pagination modes, state)
- useProgramEvents hook (complex state management)
- URL sync and state coordination

## Testing Considerations

1. **Maintain existing tests** - ProgramDetail has test coverage
2. **Add component-level tests** for extracted components
3. **Test hooks independently** with renderHook utility
4. **Integration tests** for pagination flow
5. **Access control tests** for mentors/pricing

## Dependencies

**Internal**:

- `programService`, `purchaseService` (API)
- `useAuth` (access control)
- `useAvatarUpdates` (real-time)
- `ProgramParticipants` (already extracted)

**External**:

- react-router-dom (navigation, params)
- heroicons (icons)

## Implementation Notes

1. **Preserve URL sync** - Critical for pagination
2. **Maintain access control** - Complex permission checks
3. **Keep WebSocket integration** - Real-time updates
4. **Protect pagination state** - Server/client mode toggle
5. **Test with different user roles** - Access varies by role

## Next Steps

1. ✅ Analysis complete
2. ⏭️ Begin Phase 6.5.1: Extract ProgramHeader
3. Iterate through phases 6.5.2-6.5.7
4. Final verification and testing
5. Documentation update

---

**Phase 6 Progress**:

- ✅ Phase 6.1: AdminPromoCodes (91.4%)
- ✅ Phase 6.2: EventDetail (43.0%)
- ✅ Phase 6.3: SystemMessages (65.8%)
- ✅ Phase 6.4: EditProgram (54.0%)
- 🔄 Phase 6.5: ProgramDetail (Target: 50-53%)
