# Event Collection Refactoring Plan: Eliminating Dual-Collection Sync Issues

## Overview

This document outlines the plan to refactor the event management system from a dual-collection design to a single-source-of-truth Registration-centric approach. This will eliminate synchronization issues between Event.roles.currentSignups[] and the Registration collection.

## Current Architecture Issues

### Problem Statement

- **Event collection**: Contains `roles.currentSignups[]` (live signup list)
- **Registration collection**: Individual registration records with audit trails
- **Sync Problem**: Two sources of truth that must be kept in sync
- **Race Conditions**: Concurrent operations can create inconsistent states
- **Complexity**: Application-level locking required to manage consistency

### Current Pain Points

1. **Data Consistency**: Event.roles.currentSignups[] can become out of sync with Registration collection
2. **Complex Logic**: Dual-update operations increase failure points
3. **Race Conditions**: Multiple users signing up simultaneously can cause issues
4. **Maintenance Burden**: Complex locking mechanisms needed

## Migration Execution Status

### ✅ Phase 0 Completed: Testing Infrastructure

**Status**: COMPLETED ✅
**Date**: July 26, 2025

#### Achievements

- **Comprehensive Test Suite**: 98 tests covering all migration aspects
- **Mongoose Issues Resolved**: Fixed test environment mongoose mocking for reliable testing
- **Baseline Established**: All tests passing (120/120 tests total)

#### Key Learnings from Phase 0

1. **Mongoose Mocking Challenge**: Initial tests failed due to incomplete mongoose mocking

   - **Root Cause**: `mongoose.model()`, `Schema.Types.ObjectId`, and schema methods weren't mocked
   - **Solution**: Complete mongoose mock in `tests/config/setup.ts` with MockModel, MockSchema, MockObjectId
   - **Impact**: Tests now run without database connections, ensuring consistent test environment

2. **Testing Strategy Validation**:

   - **Backend Tests**: 6 migration test files (98 tests) + 5 unit test files (22 tests)
   - **Frontend Tests**: 3 migration test files for UI compatibility
   - **Coverage**: All critical functionality paths tested before migration

3. **Migration Readiness Criteria Met**:
   - ✅ Test suite comprehensive and passing
   - ✅ Database mocking robust and reliable
   - ✅ Baseline behavior documented and validated
   - ✅ Risk assessment complete with rollback plans

#### Files Created/Modified

- `tests/migration/` - 6 comprehensive test files
- `tests/config/setup.ts` - Enhanced mongoose mocking
- `tests/unit/mongoose-import.test.ts` - Mongoose import validation
- `MONGOOSE_FIX_SUMMARY.md` - Documentation of testing challenges and solutions

### 🚀 Ready for Phase 1: Database Optimization and Indexing

### Core Principle

**Single Source of Truth**: Use only the Registration collection for all signup data

### Architecture Changes

#### Remove from Event Collection

```typescript
// REMOVE this from Event schema
Event: {
  roles: [
    {
      name: "volunteers",
      capacity: 10,
      currentSignups: [], // ❌ REMOVE THIS
    },
  ];
}
```

#### Keep in Registration Collection

```typescript
// KEEP and enhance this
Registration: {
  eventId,
  userId,
  roleId,
  status: "confirmed" | "cancelled" | "waitlist",
  registrationDate,
  notes,
  specialRequirements,
  // ... other fields
}
```

### Benefits of This Approach

1. ✅ **Eliminates sync issues** - One source of truth
2. ✅ **Simpler mental model** - All registration data in one place
3. ✅ **Better data integrity** - Impossible to have inconsistent states
4. ✅ **More flexible queries** - Easier analytics and reporting
5. ✅ **Reduced complexity** - No more dual-collection operations

## Implementation Plan

### Phase 0: Comprehensive Testing Suite (CRITICAL - Do First!)

#### Backend Tests Created ✅

- [x] **Pre-Migration Baseline Tests** (`backend/tests/migration/pre-migration-baseline.test.ts`)

  - Current dual-collection behavior validation
  - Data consistency checks between Event.currentSignups and Registration
  - Race condition scenarios testing
  - Capacity limits and user role limits testing

- [x] **Event Signup Flow Tests** (`backend/tests/migration/event-signup-flow.test.ts`)

  - Basic signup operations
  - Signup cancellation
  - Admin operations (move/remove users)
  - Data consistency validation
  - Concurrent operations handling

- [x] **Data Consistency Tests** (`backend/tests/migration/data-consistency.test.ts`)

  - Current dual-collection sync verification
  - Migration safety checks
  - Post-migration validation
  - Rollback scenarios

- [x] **Registration Query Tests** (`backend/tests/migration/registration-queries.test.ts`)

  - New Registration-centric query methods
  - Role availability calculations
  - Event listing with aggregation
  - User registration queries
  - Performance testing with indexes

- [x] **Thread Safety Tests** (`backend/tests/migration/thread-safety.test.ts`)

  - Concurrent signup scenarios
  - Lock mechanism validation
  - Database transaction testing
  - Performance under load
  - Error recovery

- [x] **Database Migration Tests** (`backend/tests/migration/database-migration.test.ts`)
  - Pre-migration validation
  - Index creation and performance
  - Helper function implementation
  - Query migration verification
  - Schema updates and rollback testing

#### Frontend Tests Created ✅

- [x] **Event Display Tests** (`frontend/src/test/migration/event-display.test.tsx`)

  - Event listing components
  - Event detail components with role information
  - Real-time updates via WebSocket
  - Error handling and user permissions

- [x] **API Integration Tests** (`frontend/src/test/migration/api-integration.test.tsx`)

  - Event API calls and signup counts
  - Signup/cancellation API calls
  - User event management
  - Real-time WebSocket events
  - Caching and state management

- [x] **End-to-End Tests** (`frontend/src/test/migration/end-to-end.test.tsx`)
  - Complete signup journey
  - Cancellation flow
  - Admin management operations
  - Real-time synchronization
  - Error handling and performance testing

#### Test Configuration Created ✅

- [x] **Migration Test Config** (`backend/tests/migration/migration-test-config.ts`)
  - Test execution order
  - Shared utilities and mock data generators
  - Environment setup and teardown
  - State capture and restoration

#### Test Execution Strategy

**Pre-Migration Testing:**

1. Run all baseline tests to establish current behavior
2. Verify data consistency in current system
3. Test race conditions and thread safety
4. Performance baseline measurements

**During Migration Testing:**

1. Run tests after each migration phase
2. Validate data integrity at each step
3. Ensure no functionality regression
4. Monitor performance impact

**Post-Migration Testing:**

1. Full regression test suite
2. Performance comparison with baseline
3. End-to-end user journey validation
4. Load testing with concurrent users

#### Test Coverage Areas

- ✅ Current dual-collection sync behavior
- ✅ Event signup/cancellation flows
- ✅ Admin user management operations
- ✅ Race condition prevention
- ✅ Database query performance
- ✅ Frontend display consistency
- ✅ Real-time WebSocket updates
- ✅ API integration points
- ✅ Error handling and recovery
- ✅ Migration safety and rollback

### Phase 1: Database Optimization

- [ ] Add efficient database indexes for fast queries
- [ ] Create compound indexes: `{ eventId: 1, roleId: 1, status: 1 }`
- [ ] Add index: `{ eventId: 1, status: 1 }`

### Phase 2: Helper Functions

- [ ] Create `getRoleAvailability(eventId, roleId)` function
- [ ] Create `getEventSignupCounts(eventId)` function
- [ ] Create `getUserSignupCount(eventId, userId)` function

### Phase 3: Update Event Operations

- [ ] Modify `signUpForEvent()` to work with Registration collection only
- [ ] Update `cancelSignup()` to work with Registration collection only
- [ ] Refactor `moveUserBetweenRoles()` to update Registration records
- [ ] Update `removeUserFromRole()` to work with Registration collection

### Phase 4: Update Query Logic

- [ ] Replace `event.roles[].currentSignups` reads with Registration queries
- [ ] Update event listing to use aggregation for signup counts
- [ ] Modify participant views to use Registration collection

### Phase 5: Schema Migration

- [ ] Remove `currentSignups` field from Event schema
- [ ] Update all references in codebase
- [ ] Remove `signedUp` calculated field (compute from Registration)

### Phase 6: Simplify Locking

- [ ] Simplify ThreadSafeEventService (only one collection to manage)
- [ ] Add database constraints as backup protection
- [ ] Remove complex dual-collection locking logic

## Race Condition Analysis & Solutions

### Still Need Locking For

1. **Concurrent Signups**: Multiple users for same role's last spot
2. **Capacity Changes**: Admin changing capacity while users signing up
3. **Role Movements**: Moving users between roles

### Recommended Locking Strategy

**Hybrid Approach**: Application-level locking + Database constraints

#### Option 1: Simplified Application Locking (Recommended)

```typescript
class ThreadSafeEventService {
  static async signupForEvent(eventId: string, data: SignupData) {
    // Simple event-level lock
    await this.withEventLock(eventId, async () => {
      // Check capacity using Registration.countDocuments()
      // Create registration record
      // No dual-collection sync needed!
    });
  }
}
```

#### Option 2: Database Constraints as Backup

```typescript
// Unique constraint prevents duplicate signups
db.registrations.createIndex(
  { eventId: 1, roleId: 1, userId: 1 },
  { unique: true }
);
```

## Migration Strategy

### Step 1: Preparation

- [ ] Create database indexes
- [ ] Implement helper functions
- [ ] Add comprehensive logging

### Step 2: Gradual Migration

- [ ] Keep both systems running in parallel
- [ ] Update write operations to use Registration-only
- [ ] Compare results for accuracy

### Step 3: Read Migration

- [ ] Update queries to use Registration collection
- [ ] Remove Event.currentSignups reads
- [ ] Validate all functionality works

### Step 4: Cleanup

- [ ] Remove currentSignups from Event schema
- [ ] Remove dual-collection logic
- [ ] Simplify locking mechanisms

### Step 5: Testing & Validation

- [ ] Load testing for performance
- [ ] Race condition testing
- [ ] End-to-end functionality testing

## Performance Considerations

### Query Performance

- **Index Impact**: Proper indexes make Registration queries very fast
- **Count Operations**: MongoDB optimizes `countDocuments()` with indexes
- **Aggregation**: Use aggregation pipeline for complex event listings

### Expected Performance

- **Single Role Check**: O(log n) with proper indexing
- **Event Listing**: Acceptable performance with aggregation
- **Real-time Updates**: No performance degradation expected

## Risk Assessment

### Low Risk

- ✅ Performance impact (indexes will handle this)
- ✅ Data loss (Registration collection already has all data)
- ✅ Functionality loss (simpler design, same features)

### Medium Risk

- ⚠️ Migration complexity (gradual approach mitigates)
- ⚠️ Query pattern changes (requires careful testing)

### Mitigation Strategies

- **Backup Strategy**: Full database backup before migration
- **Rollback Plan**: Keep old logic commented out initially
- **Gradual Rollout**: Migrate one feature at a time
- **Monitoring**: Add extensive logging during transition

## Success Criteria

### Technical Success

- [ ] Zero sync issues between collections
- [ ] Simplified codebase (less locking complexity)
- [ ] Improved query performance with indexes
- [ ] All existing functionality preserved

### Business Success

- [ ] Users can still sign up/cancel normally
- [ ] Admins can still manage participants
- [ ] Real-time updates continue working
- [ ] No data loss or corruption

## Files to Modify

### Backend Files

- [ ] `backend/src/models/Event.ts` - Remove currentSignups field
- [ ] `backend/src/controllers/eventController.ts` - Update all methods
- [ ] `backend/src/services/ThreadSafeEventService.ts` - Simplify locking
- [ ] Database migration scripts

### Frontend Files (Minimal Changes Expected)

- [ ] API response handling (structure should remain same)
- [ ] Real-time update handling (event structure unchanged)

## Timeline Estimate

- **Phase 1-2**: 1-2 days (Database & Helper Functions)
- **Phase 3-4**: 2-3 days (Core Logic Updates)
- **Phase 5-6**: 1-2 days (Schema & Cleanup)
- **Testing**: 1-2 days (Comprehensive testing)
- **Total**: 5-9 days

## Conclusion

This refactoring will significantly improve the system's reliability and maintainability by:

1. Eliminating the fundamental sync problem
2. Simplifying the codebase
3. Improving data consistency
4. Reducing race condition complexity

The Registration-centric approach is the correct architectural choice for this event management system.

---

**Status**: Planning Phase  
**Next Step**: Begin Phase 1 - Database Optimization  
**Last Updated**: 2025-01-26
