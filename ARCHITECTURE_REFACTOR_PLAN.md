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

## Proposed Solution: Registration-Centric Design

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
