# Phase 7.1: Analytics.tsx Refactoring Plan

**Date**: November 4, 2025  
**File**: `frontend/src/pages/Analytics.tsx`  
**Current Size**: 1,213 lines  
**Target Size**: ~500 lines (58.7% reduction)  
**Status**: 📋 Planning Phase

---

## Executive Summary

Analytics.tsx is the **largest remaining frontend giant file** at 1,213 lines. It contains a complex analytics dashboard with multiple data visualization sections. This plan outlines a systematic approach to extract 6-7 focused components while maintaining 100% test coverage (632/632 tests) and zero TypeScript errors.

### Target Metrics

- **Current Size**: 1,213 lines
- **Target Size**: ~500 lines
- **Reduction Goal**: 50-60% (target: 58.7%)
- **Lines to Extract**: ~713 lines
- **Components to Create**: 6-7 components + 1-2 utility files
- **Test Target**: 632/632 passing (100%)

---

## File Structure Analysis

### Current Breakdown (1,213 lines)

1. **Imports & Type Definitions** (Lines 1-149): 149 lines

   - React imports, hooks, icons
   - Type definitions: ParticipantLike, RoleLike, CurrentSignupLike, RegistrationLike, RoleUnknownShape
   - Helper functions: isObject, getRoleParticipants, getRoleSignupCount, getRoleName, getRoleMaxParticipants
   - Loading state components

2. **Calculation Functions** (Lines 150-550): 400 lines

   - calculateEventAnalytics (150-280): ~130 lines
   - calculateUserEngagement (280-420): ~140 lines
   - calculateGuestAggregates (420-450): ~30 lines
   - calculateChurchAnalytics (450-500): ~50 lines
   - calculateOccupationAnalytics (500-550): ~50 lines

3. **Main Component Logic** (Lines 550-690): 140 lines

   - Access control
   - Data fetching hooks
   - useMemo calculations
   - Access restricted UI (Lines 640-690)

4. **JSX Rendering** (Lines 690-1170): 480 lines

   - Dashboard header with export button
   - Overview cards (4 cards): Total Events, Total Users, Active Participants, Avg Signup Rate
   - Event Statistics (2 cards): Upcoming Events, Past Events
   - Role & Format Distribution (2 cards)
   - Most Active Participants & Engagement Summary (2 cards)
   - Church & Occupation Statistics (2 cards)

5. **Helper Components** (Lines 1170-1213): 43 lines
   - roleIcon function
   - DistributionRow component
   - SummaryRow component
   - ROLE_LABEL_NORMALIZATION constant

---

## Extraction Strategy

### Phase 7.1.1: Extract Calculation Utilities

**File**: `frontend/src/utils/analyticsCalculations.ts` (450 lines)

**Content to Extract**:

- All type definitions (ParticipantLike, RoleLike, etc.)
- All helper functions (isObject, getRoleParticipants, etc.)
- calculateEventAnalytics function
- calculateUserEngagement function
- calculateGuestAggregates function
- calculateChurchAnalytics function
- calculateOccupationAnalytics function

**Rationale**: These are pure calculation functions with no UI dependencies. Perfect candidates for utility extraction.

**Reduction**: 1,213 → ~760 lines (37% reduction)

---

### Phase 7.1.2: Extract Overview Cards Component

**File**: `frontend/src/components/Analytics/OverviewCards.tsx` (~100 lines)

**Props Interface**:

```typescript
interface OverviewCardsProps {
  totalEvents: number;
  totalUsers: number;
  uniqueParticipants: number;
  averageSignupRate: number;
  isLoading: boolean;
}
```

**Content to Extract**:

- 4 overview cards (Total Events, Total Users, Active Participants, Avg Signup Rate)
- Grid layout wrapper
- Loading state (AnalyticsOverviewLoadingState)
- Heroicons for each card

**Dependencies**:

- AnalyticsOverviewLoadingState from ui/LoadingStates
- Heroicons: CalendarDaysIcon, UserPlusIcon, ChartBarIcon, ArrowTrendingUpIcon

**Reduction**: ~760 → ~660 lines (8% additional)

---

### Phase 7.1.3: Extract Event Statistics Component

**File**: `frontend/src/components/Analytics/EventStatistics.tsx` (~120 lines)

**Props Interface**:

```typescript
interface EventStatisticsProps {
  upcomingStats: {
    totalEvents: number;
    totalSlots: number;
    signedUp: number;
    availableSlots: number;
    fillRate: number;
  };
  passedStats: {
    totalEvents: number;
    totalSlots: number;
    signedUp: number;
    fillRate: number;
  };
  isLoading: boolean;
}
```

**Content to Extract**:

- Upcoming Events card with progress bar
- Past Events card with progress bar
- Grid layout wrapper
- Loading state (AnalyticsCardSectionLoadingState)

**Reduction**: ~660 → ~540 lines (10% additional)

---

### Phase 7.1.4: Extract Distribution Cards Component

**File**: `frontend/src/components/Analytics/DistributionCards.tsx` (~140 lines)

**Props Interface**:

```typescript
interface DistributionCardsProps {
  roleStats: {
    superAdmin: number;
    administrators: number;
    leaders: number;
    guestExperts: number;
    participants: number;
    atCloudLeaders: number;
  };
  formatStats: Record<string, number>;
  isLoading: boolean;
}
```

**Content to Extract**:

- System Authorization Level Distribution card
- Event Format Distribution card
- DistributionRow helper component
- roleIcon helper function
- ROLE_LABEL_NORMALIZATION constant
- Grid layout wrapper

**Reduction**: ~540 → ~400 lines (12% additional)

---

### Phase 7.1.5: Extract Engagement Section Component

**File**: `frontend/src/components/Analytics/EngagementSection.tsx` (~140 lines)

**Props Interface**:

```typescript
interface EngagementSectionProps {
  mostActiveUsers: Array<{
    userId: string;
    name: string;
    roleInAtCloud: string;
    eventCount: number;
  }>;
  engagementMetrics: {
    uniqueParticipants: number;
    userSignups: number;
  };
  guestAggregates: {
    guestSignups: number;
    uniqueGuests: number;
  };
  totalEvents: number;
  avgRolesPerParticipant: number;
  isLoading: boolean;
}
```

**Content to Extract**:

- Most Active Participants card
- Engagement Summary card
- SummaryRow helper component
- Grid layout wrapper
- Badge styling (getEngagementBadgeClassNames)

**Reduction**: ~400 → ~260 lines (12% additional)

---

### Phase 7.1.6: Extract Church & Occupation Component

**File**: `frontend/src/components/Analytics/ChurchOccupationStats.tsx` (~150 lines)

**Props Interface**:

```typescript
interface ChurchOccupationStatsProps {
  churchAnalytics: {
    weeklyChurchStats: Record<string, number>;
    churchAddressStats: Record<string, number>;
    usersWithChurchInfo: number;
    usersWithoutChurchInfo: number;
    totalChurches: number;
    totalChurchLocations: number;
    churchParticipationRate: number;
  };
  occupationAnalytics: {
    occupationStats: Record<string, number>;
    usersWithOccupation: number;
    usersWithoutOccupation: number;
    totalOccupationTypes: number;
    topOccupations: Array<{ occupation: string; count: number }>;
    occupationCompletionRate: number;
  };
  isLoading: boolean;
}
```

**Content to Extract**:

- Church Statistics card with progress bar
- Occupation Statistics card with progress bar
- Top 5 churches/occupations lists
- Grid layout wrapper

**Reduction**: ~260 → ~110 lines (13% additional)

---

### Phase 7.1.7: Create Shared Analytics Types

**File**: `frontend/src/types/analytics.ts` (~100 lines)

**Content to Create**:

- Export all analytics-related interfaces
- ChurchAnalytics type
- OccupationAnalytics type
- EventAnalytics type
- EngagementMetrics type
- GuestAggregates type

**Rationale**: Centralize type definitions for better maintainability and reusability.

---

## Final Structure

### Analytics.tsx (~500 lines)

**Responsibilities**:

- Access control logic
- Data fetching (useUserData, useRoleStats, useAnalyticsData hooks)
- useMemo calculations (delegating to imported utility functions)
- Component orchestration
- Export functionality
- Access restricted UI

**Component Composition**:

```tsx
<div className="max-w-5xl mx-auto space-y-6">
  <div className="bg-white rounded-lg shadow-sm p-6">
    {/* Header with Export Button */}
    <DashboardHeader canExport={canExport} onExport={handleExport} />

    {/* Overview Cards */}
    <OverviewCards
      totalEvents={eventAnalytics.totalEvents}
      totalUsers={roleStats.total}
      uniqueParticipants={engagementMetrics.uniqueParticipants}
      averageSignupRate={eventAnalytics.averageSignupRate}
      isLoading={isLoading}
    />

    {/* Event Statistics */}
    <EventStatistics
      upcomingStats={eventAnalytics.upcomingStats}
      passedStats={eventAnalytics.passedStats}
      isLoading={isLoading}
    />

    {/* Distribution Cards */}
    <DistributionCards
      roleStats={roleStats}
      formatStats={eventAnalytics.formatStats}
      isLoading={isLoading}
    />

    {/* Engagement Section */}
    <EngagementSection
      mostActiveUsers={engagementMetrics.mostActiveUsers}
      engagementMetrics={engagementMetrics}
      guestAggregates={guestAggregates}
      totalEvents={eventAnalytics.totalEvents}
      avgRolesPerParticipant={avgRolesPerParticipant}
      isLoading={isLoading}
    />

    {/* Church & Occupation Statistics */}
    <ChurchOccupationStats
      churchAnalytics={churchAnalytics}
      occupationAnalytics={occupationAnalytics}
      isLoading={isLoading}
    />
  </div>
</div>
```

---

## Extraction Order (Recommended)

### Sub-Phase Sequence

1. **Phase 7.1.1**: Extract calculation utilities (450 lines) → Reduce to ~760 lines
2. **Phase 7.1.2**: Extract OverviewCards (100 lines) → Reduce to ~660 lines
3. **Phase 7.1.3**: Extract EventStatistics (120 lines) → Reduce to ~540 lines
4. **Phase 7.1.4**: Extract DistributionCards (140 lines) → Reduce to ~400 lines
5. **Phase 7.1.5**: Extract EngagementSection (140 lines) → Reduce to ~260 lines
6. **Phase 7.1.6**: Extract ChurchOccupationStats (150 lines) → Reduce to ~110 lines
7. **Phase 7.1.7**: Optional - create shared types file for better organization

**Final Target**: ~500 lines (accounting for imports and orchestration overhead)

---

## Testing Strategy

### Test Requirements

1. **Run tests after each extraction**: `npm run test:frontend`
2. **Target**: 632/632 tests passing (100%)
3. **Zero TypeScript errors**: Run `npm run verify` after each phase
4. **Accessibility**: Maintain all data-testid attributes
5. **Visual regression**: Manually verify dashboard after all extractions

### Known Test Files

Based on the codebase structure, Analytics.tsx likely has:

- Component tests: `Analytics.test.tsx`
- Integration tests with backend hooks
- Loading state tests
- Access control tests

### Test Fixtures

Ensure extracted components work with existing test mocks:

- Mock `useUserData` hook
- Mock `useRoleStats` hook
- Mock `useAnalyticsData` hook
- Mock event data (upcomingEvents, passedEvents)

---

## Risk Assessment

### Low Risk ✅

- **Calculation utilities**: Pure functions, easy to test, no UI dependencies
- **Presentational components**: Simple props-based rendering
- **Type definitions**: No runtime impact

### Medium Risk ⚠️

- **Loading states**: Must preserve exact skeleton UI behavior
- **Data transformations**: useMemo calculations must remain functionally identical
- **Icon imports**: Ensure all Heroicons are imported correctly in extracted components

### Mitigation Strategies

1. **Exact copy methodology**: Copy-paste code byte-for-byte during extraction
2. **Incremental commits**: Commit after each sub-phase with passing tests
3. **Props interface first**: Design and document props before extraction
4. **Test-driven validation**: Run tests immediately after each extraction

---

## Dependencies to Preserve

### External Dependencies

- `useAuth` hook - access control
- `useUserData` hook - user data fetching
- `useRoleStats` hook - role statistics
- `useAnalyticsData` hook - backend analytics data
- `getRoleBadgeClassNames` from constants/ui
- `getEngagementBadgeClassNames` from constants/ui
- `AnalyticsOverviewLoadingState` from components/ui/LoadingStates
- `AnalyticsCardSectionLoadingState` from components/ui/LoadingStates

### Internal Dependencies (to extract)

- All calculation functions
- Helper components (DistributionRow, SummaryRow, roleIcon)
- Type definitions

---

## Success Criteria

### Phase 7.1 Complete When:

1. ✅ Analytics.tsx reduced from 1,213 → ~500 lines (58.7% reduction)
2. ✅ 6-7 components created in `components/Analytics/`
3. ✅ 1 utility file created in `utils/analyticsCalculations.ts`
4. ✅ All 632 frontend tests passing (100%)
5. ✅ Zero TypeScript errors
6. ✅ All existing functionality preserved
7. ✅ Clean git history with descriptive commits
8. ✅ Documentation updated (this plan file + master plan)

---

## Estimated Timeline

- **Phase 7.1.1** (Utilities): 1-2 hours
- **Phase 7.1.2** (OverviewCards): 1-2 hours
- **Phase 7.1.3** (EventStatistics): 1-2 hours
- **Phase 7.1.4** (DistributionCards): 2-3 hours
- **Phase 7.1.5** (EngagementSection): 2-3 hours
- **Phase 7.1.6** (ChurchOccupationStats): 2-3 hours
- **Phase 7.1.7** (Types - Optional): 30 mins - 1 hour
- **Testing & Documentation**: 1-2 hours

**Total Estimated Time**: 2-3 days

---

## Lessons from Previous Phases

### Apply These Patterns

1. **Orchestrator Pattern** (from Phase 6): Parent component manages state, child components handle presentation
2. **Props Interface First** (from Phase 6): Design props before extraction
3. **Incremental Sub-Phases** (from Phase 6): 6-7 sub-phases with individual commits
4. **Test After Each Step** (from all phases): Never commit untested code
5. **Loading State Preservation** (from Phase 5): Skeleton UI must match exactly

### Avoid These Mistakes

1. ❌ AI rewrites or "improvements" - use exact copy methodology
2. ❌ Batching extractions - do one component at a time
3. ❌ Skipping test runs - test after each extraction
4. ❌ Unclear commit messages - be descriptive with metrics

---

## Next Steps

1. Review and approve this plan
2. Create `components/Analytics/` directory
3. Begin Phase 7.1.1: Extract calculation utilities
4. Execute phases 7.1.2 through 7.1.6 systematically
5. Update master plan and status summary upon completion

---

**Plan Status**: ✅ Ready for Approval and Execution
