<!-- Deprecated planning document intentionally cleared during repository cleanup. -->

## Issues Identified & Fixes Needed:

**Problem**: Tests expect different role names than actual system

- Tests expect: `"user"`, `"admin"`
- Actual system: `"Participant"`, `"Administrator"`

**Status**: ✅ **FIXED** - Updated test data to use correct role names

### 2. API Route Design Mismatch (HIGH PRIORITY)

**Problem**: Tests expect parameterized routes, but API uses current-user patterns

**Tests Expect**:

- `PUT /api/users/:id` (update any user by ID)
- `POST /api/users/:id/avatar` (upload avatar for any user)
- `POST /api/users/:id/change-password` (change password for any user)

**Actual API**:

- `PUT /api/users/profile` (update current user's profile)
- `POST /api/users/avatar` (upload avatar for current user)
- No password change route exists

**Analysis**: The actual API design is better (security-wise) - users can only modify their own data.

**Fix Strategy**: Modify tests to use actual API patterns OR add compatibility routes.

### 3. Missing Test Data Setup (MEDIUM PRIORITY)

**Problem**: Tests expect users "user1", "user2" but only "admin", "testuser" are created

**Fix**: Update beforeEach to create all expected test users.

### 4. Error Response Format Mismatches (MEDIUM PRIORITY)

**Problem**: Tests expect `error: expect.stringContaining("token")` but actual responses have different structure

**Fix**: Update test assertions to match actual error response format.

### 5. Missing Route Implementations (MEDIUM PRIORITY)

**Problem**: Some routes like password change don't exist

**Fix**: Either implement missing routes or remove tests.

## Recommended Action Plan:

### Phase 1: Critical Fixes (DO NOW)

1. ✅ Fix role name mismatches
2. 🔄 Fix core route patterns for most critical tests
3. 🔄 Fix test data setup to create expected users

### Phase 2: Route Pattern Alignment

**Option A**: Modify tests to use actual API (RECOMMENDED)

- Change `/users/:id/avatar` tests to use `/users/avatar`
- Change `/users/:id` tests to use `/users/profile`
- Update authentication expectations

**Option B**: Add compatibility routes to API

- Add parameterized routes that delegate to current-user routes
- Requires authentication + authorization logic

### Phase 3: Error Format & Missing Features

1. Update error response assertions
2. Implement missing routes OR remove tests
3. Clean up test data expectations

## Test Categories by Fix Complexity:

### EASY FIXES (Data/Assertion Issues):

- Role name mismatches ✅
- Error message format expectations
- Test data creation

### MEDIUM FIXES (Route Pattern Changes):

- Avatar upload routes
- Profile update routes
- User search expectations

### HARD FIXES (Missing Features):

- Password change functionality
- User deletion permissions
- Search route implementations

## Current Test Results Analysis:

- **58 failed tests**: Most due to route pattern mismatches and missing features
- **68 passed tests**: Authentication and basic functionality working
- **Main success**: API versioning issue resolved - all endpoints accessible

## Next Steps:

1. Run quick test with corrected role names
2. Implement Phase 1 critical fixes
3. Choose route pattern strategy (A or B)
4. Execute systematic fixes

The foundation is solid - this is now about aligning test expectations with actual API design.
