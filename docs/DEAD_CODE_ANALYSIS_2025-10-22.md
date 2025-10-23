# Dead Code Analysis - October 22, 2025

**Status**: 🔍 **ANALYSIS COMPLETE**  
**Date**: October 22, 2025  
**Method**: Static Analysis (ts-prune + depcheck) + Manual Review

---

## Executive Summary

Ran comprehensive static analysis to identify dead code candidates:

- **104 unused exports** found in backend
- **0 unused exports** in frontend ✅
- **1 unused npm package** identified (`mongodb`)
- **5 confirmed dead code** candidates (auth middleware never used in routes)

---

## Analysis Tools Used

### 1. ts-prune (TypeScript Export Analysis)

```bash
npx ts-prune
# Finds exported functions/types that are never imported
```

### 2. depcheck (Dependency Analysis)

```bash
npx depcheck
# Finds npm packages that are installed but never used
```

### 3. Manual Code Review

- Grep searches for actual usage
- Test file analysis
- Route registration verification

---

## 🎯 Priority 1: Confirmed Dead Code (Safe to Remove)

### 1. Unused Auth Middleware Functions ❌

**Location**: `backend/src/middleware/auth.ts`

```typescript
// Line 329 - Never used in any route
export const authorize = (roles: string[]) => { ... }

// Line 536 - Only used in tests, never in routes
export const authorizeAtCloudLeader = (req, res, next) => { ... }

// Line 562 - Only used in tests, never in routes
export const authorizeEventAccess = async (req, res, next) => { ... }

// Line 713 - Never used anywhere
export const conditionalAuthorization = (condition, fallback) => { ... }
```

**Evidence**:

- ✅ Searched all route files: **0 matches**
- ✅ Searched src folder: **Only test files** import these
- ✅ Tests exist but middleware never actually used

**Recommendation**: **DELETE** these 4 functions (~150 lines)

- Keep the tests as documentation if desired
- Or remove tests along with functions

---

### 2. Unused NPM Package ❌

**Package**: `mongodb`  
**Installed**: Yes (listed in package.json dependencies)  
**Used**: No

**Evidence**:

```bash
# Searched entire backend codebase:
grep -r "from 'mongodb'" backend/src/  # 0 matches
grep -r "import mongodb" backend/src/  # 0 matches
```

**Why it exists**: You use `mongoose` (which wraps MongoDB driver), not raw `mongodb` package

**Recommendation**: **REMOVE** from package.json

```bash
cd backend && npm uninstall mongodb
```

**Impact**: None (mongoose includes its own MongoDB driver)

---

## 🤔 Priority 2: Likely Dead Code (Needs Verification)

### 1. Guest Validation Utilities

**Location**: `backend/src/middleware/guestValidation.ts`

```typescript
// Line 97 - Not used in routes
export const guestEmailValidation = () => { ... }

// Line 124 - Not used anywhere
export const isValidPhoneNumber = (phone: string) => { ... }

// Line 140 - Not used anywhere
export const isValidFullName = (name: string) => { ... }

// Line 299 - Not used in routes
export const validateGuestSingleEventAccess = () => { ... }
```

**Status**: 🟡 **VERIFY BEFORE REMOVING**

**Verification Steps**:

1. Check if these are called dynamically
2. Check if they're used in validation schemas
3. Check if they're planned for future use

---

### 2. Test Helper Functions (Exported for Tests Only)

**Location**: Multiple files

```typescript
// backend/src/middleware/guestValidation.ts
export const __resetGuestRateLimitStore = () => { ... }      // Line 347
export const __setGuestRateLimitNowProvider = (fn) => { ... } // Line 351

// Purpose: Test-only utilities (double underscore convention)
```

**Status**: 🟢 **KEEP (By Convention)**

**Reason**: Double underscore (`__`) prefix indicates test-only exports. This is intentional for testability.

---

### 3. Service Index Re-exports

**Location**: `backend/src/services/index.ts`

Many exports flagged as unused:

```typescript
export { CacheService }; // Line 10
export { cacheService }; // Line 11
export { CacheEntry }; // Line 13
export { CacheMetrics }; // Line 14
// ... 40+ more exports
```

**Status**: 🟢 **KEEP (Barrel Export Pattern)**

**Reason**: This is a barrel export file for convenient imports. Even if not all are used now, this is a standard pattern.

**Alternative**: If concerned about bundle size, could switch to direct imports and remove barrel file.

---

### 4. Controller Index Re-exports

**Location**: `backend/src/controllers/index.ts`

```typescript
export { AuthController }; // Line 2
export { UserController }; // Line 3
export { EventController }; // Line 4
// etc.
```

**Status**: 🟡 **REVIEW**

**Question**: Are controllers imported from `controllers/index` anywhere, or are they imported directly?

**Check**:

```bash
grep -r "from.*controllers.*index" backend/src/
```

If no matches: Could remove this index file and import controllers directly from their files.

---

## 📊 Priority 3: False Positives (Keep These)

### 1. Default Exports

Many files flagged for unused `default` export:

```typescript
src/config/swagger.ts:493 - default
src/controllers/guestController.ts:2031 - default
src/middleware/imageCompression.ts:194 - default
// etc.
```

**Status**: 🟢 **KEEP (Import Style)**

**Reason**: These use default exports and are imported without explicit names:

```typescript
import swagger from "./config/swagger"; // Uses default export
import compression from "./middleware/imageCompression";
```

---

### 2. Type Definitions

```typescript
src/config/notificationConfig.ts:145 - NotificationConfigType
src/types/api-responses.ts:136 - EventListResponse
src/types/api-responses.ts:149 - EventDetailResponse
// etc.
```

**Status**: 🟢 **KEEP (Type Safety)**

**Reason**: Types may be used in:

- Type annotations (not detected by ts-prune)
- External consumers (if this is a library)
- Documentation/contracts

---

### 3. Migration Scripts

```typescript
src/scripts/migrate-role-templates.ts:22 - default
src/scripts/trio-migration-phase1.ts:536 - TrioMigrationTool
src/scripts/trio-migration-phase1.ts:536 - runPhase1Migration
```

**Status**: 🟢 **KEEP (One-Time Scripts)**

**Reason**: Migration scripts are run directly via `ts-node`, not imported. They need exports for testability.

---

## 🔍 Coverage-Based Analysis

### Next Step: Run Coverage Report

```bash
cd backend && npm run test:coverage
```

**Look for**:

1. Files with <50% coverage
2. Specific functions with 0% coverage
3. Unreachable branches in conditionals

**Cross-reference** with ts-prune results to confirm dead code.

---

## 📋 Action Items (Prioritized)

### 🔴 High Priority (Confirmed Dead Code)

1. **Remove unused auth middleware** (~150 lines)

   ```typescript
   // In backend/src/middleware/auth.ts, delete:
   -authorize() -
     authorizeAtCloudLeader() -
     authorizeEventAccess() -
     conditionalAuthorization();
   ```

2. **Uninstall mongodb package**
   ```bash
   cd backend && npm uninstall mongodb
   ```

### 🟡 Medium Priority (Verify Then Remove)

3. **Verify and remove unused guest validation utilities**

   - Check if `isValidPhoneNumber`, `isValidFullName` are used indirectly
   - If not used: Remove (~60 lines)

4. **Review controller index barrel exports**
   - If not used: Remove `controllers/index.ts`
   - Update imports to be direct

### 🟢 Low Priority (Review Later)

5. **Review services index barrel exports**

   - Consider if barrel pattern is necessary
   - Could reduce to only commonly-used exports

6. **Document test-only exports**
   - Add JSDoc comments to `__`-prefixed functions
   - Clarify they're for testing

---

## 📊 Impact Analysis

### If We Remove Confirmed Dead Code:

**Code Reduction**:

- ~150 lines (auth middleware)
- ~60 lines (guest validation utilities if confirmed unused)
- 1 npm package (mongodb)

**Benefits**:

- ✅ Smaller bundle size
- ✅ Fewer dependencies
- ✅ Less code to maintain
- ✅ Clearer codebase

**Risks**:

- ⚠️ Minimal (only removing truly unused code)
- ⚠️ Tests may need updating (if they import removed functions)

---

## 🔄 Ongoing Process

### Quarterly Dead Code Review (Recommended)

**Every 3 months**, run:

```bash
# 1. Find unused exports
cd backend && npx ts-prune | grep -v "used in module" > /tmp/unused-$(date +%Y-%m-%d).txt

# 2. Find unused dependencies
cd backend && npx depcheck

# 3. Check coverage
cd backend && npm run test:coverage

# 4. Review and cleanup
# - Compare with previous quarter's report
# - Remove confirmed dead code
# - Document intentional "unused" exports
```

---

## 🎓 Lessons Learned

### Why Dead Code Accumulates

1. **Refactoring**: Old implementation kept "just in case"
2. **Over-engineering**: Built utilities never actually needed
3. **Defensive Coding**: Error handlers for scenarios that don't occur
4. **Copy-Paste**: Copied code blocks but didn't use all functions
5. **Dependencies**: Installed packages for experiments, never removed

### Prevention Strategies

1. **Before adding new code**: Ask "Is this actually needed NOW?"
2. **After refactoring**: Delete old implementation immediately
3. **Code review**: Flag "unused" exports during review
4. **Automation**: Add ts-prune to CI/CD (warn on new unused exports)

---

## 📝 Technical Details

### Tools Installation

```bash
# Install ts-prune globally
npm install -g ts-prune

# Or use npx (no installation)
npx ts-prune
```

### Full Command Reference

```bash
# Backend analysis
cd backend
npx ts-prune --error                           # Strict mode
npx ts-prune | grep -v "used in module"       # Filter out barrel exports
npx depcheck --ignores="@types/*,typescript"   # Check dependencies

# Frontend analysis
cd frontend
npx ts-prune
npx depcheck
```

---

## 🎯 Next Steps

### Phase 1: Immediate Cleanup (30 minutes)

- [ ] Remove 4 unused auth middleware functions
- [ ] Uninstall `mongodb` package
- [ ] Run tests to verify nothing broke
- [ ] Commit with message: "chore: remove dead auth middleware and unused mongodb package"

### Phase 2: Verification (1 hour)

- [ ] Manually verify guest validation utilities usage
- [ ] Check controller/service barrel export usage
- [ ] Run full coverage report
- [ ] Document findings

### Phase 3: Documentation (15 minutes)

- [ ] Add JSDoc to test-only exports (`__`-prefixed)
- [ ] Update README with "Dead Code Prevention" section
- [ ] Add ts-prune to dev scripts in package.json

---

## 📚 References

- **ts-prune**: https://github.com/nadeesha/ts-prune
- **depcheck**: https://github.com/depcheck/depcheck
- **Your coverage thresholds**:
  - Backend: 85% lines/statements/functions, 80% branches
  - Frontend: 80% lines/statements/functions, 75% branches

---

**Analysis Performed By**: GitHub Copilot  
**Date**: October 22, 2025  
**Method**: Static Analysis + Manual Code Review  
**Status**: Ready for Action ✅
