# Frontend Test Folder Audit & Consolidation Plan

**Date**: November 4, 2025  
**Issue**: Duplicate test folder structure causing confusion  
**Current State**: Tests split between `frontend/src/test/` and `frontend/tests/`

---

## Current Structure Analysis

### 📁 Folder 1: `frontend/src/test/` (PRIMARY - 163 files)

**Location**: Inside source directory  
**Test Count**: 163 test files  
**Structure**: Well-organized with clear categories

```
frontend/src/test/
├── setup.ts                    # Vitest setup file (referenced in config)
├── mocks.ts                    # Shared mocks
├── test-utils/                 # Testing utilities
├── a11y/                       # Accessibility tests
├── auth/                       # Authentication tests
├── bug-fixes/                  # Regression tests
├── components/                 # Component tests
│   └── promo/                  # Promo code components
├── config/                     # Configuration tests
├── e2e/                        # End-to-end tests
├── features/                   # Feature tests
├── hooks/                      # Custom hook tests
├── integration/                # Integration tests
├── layouts/                    # Layout component tests
├── migration/                  # Migration tests
├── pages/                      # Page component tests
├── privacy/                    # Privacy/security tests
├── realtime/                   # Real-time/WebSocket tests
├── schemas/                    # Schema validation tests
├── ui/                         # UI component tests
├── unit/                       # Unit tests
├── utils/                      # Utility function tests
└── [root level tests]          # 10 tests at root
    ├── BellFromSystemMessage.test.tsx
    ├── SystemMessageReadBellCount.test.tsx
    ├── avatar-upload-protection.test.tsx
    ├── profile-import.test.tsx
    ├── profileAccessRules.test.tsx
    ├── simple.test.ts
    ├── simple-react.test.tsx
    ├── workshopPrivacy.test.tsx
    └── [4 more system message tests]
```

**Status**: ✅ **MAIN TEST FOLDER** - Referenced in `vitest.config.ts`

---

### 📁 Folder 2: `frontend/tests/` (ORPHAN - 9 files)

**Location**: Root-level tests folder (parallel to src/)  
**Test Count**: 9 test files  
**Structure**: Flat + small unit subfolder

```
frontend/tests/
├── apiClient.integration.test.tsx              # API client tests
├── eventDetail.disclaimer.multiline.test.tsx   # EventDetail tests
├── eventDetail.purpose.multiline.test.tsx      # EventDetail tests
├── flyerRemoval.test.tsx                       # Flyer feature test
├── publicEvent.disclaimer.multiline.test.tsx   # PublicEvent tests
├── publicEvent.multiline.test.tsx              # PublicEvent tests
└── unit/
    ├── components/
    │   ├── events/
    │   │   └── EventListItem.ongoing.test.tsx  # EventListItem test
    │   └── rolesTemplate/
    │       ├── PopulateFromEventModal.test.tsx
    │       └── PopulateFromTemplateModal.test.tsx
    └── utils/                                   # Empty?
```

**Import Paths**: Tests use `../src/` relative imports (e.g., `from "../src/lib/apiClient"`)

**Status**: ⚠️ **ORPHAN FOLDER** - Not referenced in config, but tests likely still run

---

## Issues with Current Setup

### 1. **Confusion & Maintenance Burden**

- ❌ Developers don't know where to put new tests
- ❌ Two locations to search when looking for existing tests
- ❌ Inconsistent import paths (`../../` vs `../src/`)

### 2. **Import Path Complexity**

- `frontend/src/test/` files: Import with relative paths (`../../pages/Profile`)
- `frontend/tests/` files: Import with `../src/` paths (`../src/lib/apiClient`)
- Inconsistent and harder to refactor

### 3. **Potential Duplication Risk**

- Similar test names in both folders (e.g., multiline tests for EventDetail/PublicEvent)
- Risk of writing duplicate tests unknowingly

### 4. **Configuration Ambiguity**

- `vitest.config.ts` only references `src/test/setup.ts`
- `frontend/tests/` folder not explicitly configured
- Tests may run due to default glob patterns, but not clear

---

## Test File Categorization

### Files in `frontend/tests/` (9 files to migrate):

**Integration Tests** (1 file):

- ✅ `apiClient.integration.test.tsx` → Move to `src/test/integration/`

**Component Tests** (6 files):

- ✅ `eventDetail.disclaimer.multiline.test.tsx` → Move to `src/test/components/`
- ✅ `eventDetail.purpose.multiline.test.tsx` → Move to `src/test/components/`
- ✅ `publicEvent.disclaimer.multiline.test.tsx` → Move to `src/test/components/`
- ✅ `publicEvent.multiline.test.tsx` → Move to `src/test/components/`
- ✅ `flyerRemoval.test.tsx` → Move to `src/test/features/` (feature test)
- ✅ `unit/components/events/EventListItem.ongoing.test.tsx` → Move to `src/test/components/events/`

**Role Template Tests** (2 files):

- ✅ `unit/components/rolesTemplate/PopulateFromEventModal.test.tsx` → Move to `src/test/components/rolesTemplate/`
- ✅ `unit/components/rolesTemplate/PopulateFromTemplateModal.test.tsx` → Move to `src/test/components/rolesTemplate/`

---

## Recommended Consolidation Plan

### ✅ OPTION: Consolidate Everything into `frontend/src/test/`

**Rationale**:

1. ✅ Already the primary test location (163/172 files = 95%)
2. ✅ Already referenced in `vitest.config.ts` (`setupFiles: ["src/test/setup.ts"]`)
3. ✅ Well-organized with clear categories
4. ✅ Consistent with backend structure (`backend/tests/` at root level)
5. ✅ Co-located with source code for easier navigation
6. ✅ Simpler import paths within test files

**Migration Steps**:

#### Step 1: Create Missing Subdirectories (if needed)

```bash
mkdir -p frontend/src/test/components/rolesTemplate
mkdir -p frontend/src/test/components/events
```

#### Step 2: Move Integration Test

```bash
mv frontend/tests/apiClient.integration.test.tsx \
   frontend/src/test/integration/apiClient.integration.test.tsx
```

#### Step 3: Move Component Tests

```bash
# EventDetail tests
mv frontend/tests/eventDetail.disclaimer.multiline.test.tsx \
   frontend/src/test/components/eventDetail.disclaimer.multiline.test.tsx

mv frontend/tests/eventDetail.purpose.multiline.test.tsx \
   frontend/src/test/components/eventDetail.purpose.multiline.test.tsx

# PublicEvent tests
mv frontend/tests/publicEvent.disclaimer.multiline.test.tsx \
   frontend/src/test/components/publicEvent.disclaimer.multiline.test.tsx

mv frontend/tests/publicEvent.multiline.test.tsx \
   frontend/src/test/components/publicEvent.multiline.test.tsx

# Flyer feature test
mv frontend/tests/flyerRemoval.test.tsx \
   frontend/src/test/features/flyerRemoval.test.tsx
```

#### Step 4: Move Unit Tests

```bash
# EventListItem test
mv frontend/tests/unit/components/events/EventListItem.ongoing.test.tsx \
   frontend/src/test/components/events/EventListItem.ongoing.test.tsx

# Role template tests
mv frontend/tests/unit/components/rolesTemplate/PopulateFromEventModal.test.tsx \
   frontend/src/test/components/rolesTemplate/PopulateFromEventModal.test.tsx

mv frontend/tests/unit/components/rolesTemplate/PopulateFromTemplateModal.test.tsx \
   frontend/src/test/components/rolesTemplate/PopulateFromTemplateModal.test.tsx
```

#### Step 5: Fix Import Paths

All moved files need import path updates:

**Before** (from `frontend/tests/`):

```typescript
import { apiUrl, apiFetch } from "../src/lib/apiClient";
```

**After** (in `frontend/src/test/integration/`):

```typescript
import { apiUrl, apiFetch } from "../../lib/apiClient";
```

Pattern: Replace `../src/` with appropriate `../../` relative path based on new location.

#### Step 6: Remove Empty Folder

```bash
rm -rf frontend/tests/
```

#### Step 7: Run Tests to Verify

```bash
cd frontend && npm run test:frontend
```

---

## Detailed Migration Script

```bash
#!/bin/bash
# migrate-tests.sh

set -e

echo "🔄 Starting test folder consolidation..."

# Navigate to frontend directory
cd "$(dirname "$0")/frontend"

# Step 1: Create target directories
echo "📁 Creating target directories..."
mkdir -p src/test/components/rolesTemplate
mkdir -p src/test/components/events

# Step 2: Move integration test
echo "📦 Moving integration tests..."
mv tests/apiClient.integration.test.tsx \
   src/test/integration/apiClient.integration.test.tsx

# Step 3: Move component tests
echo "📦 Moving component tests..."
mv tests/eventDetail.disclaimer.multiline.test.tsx \
   src/test/components/eventDetail.disclaimer.multiline.test.tsx

mv tests/eventDetail.purpose.multiline.test.tsx \
   src/test/components/eventDetail.purpose.multiline.test.tsx

mv tests/publicEvent.disclaimer.multiline.test.tsx \
   src/test/components/publicEvent.disclaimer.multiline.test.tsx

mv tests/publicEvent.multiline.test.tsx \
   src/test/components/publicEvent.multiline.test.tsx

mv tests/flyerRemoval.test.tsx \
   src/test/features/flyerRemoval.test.tsx

# Step 4: Move unit tests
echo "📦 Moving unit tests..."
mv tests/unit/components/events/EventListItem.ongoing.test.tsx \
   src/test/components/events/EventListItem.ongoing.test.tsx

mv tests/unit/components/rolesTemplate/PopulateFromEventModal.test.tsx \
   src/test/components/rolesTemplate/PopulateFromEventModal.test.tsx

mv tests/unit/components/rolesTemplate/PopulateFromTemplateModal.test.tsx \
   src/test/components/rolesTemplate/PopulateFromTemplateModal.test.tsx

# Step 5: Remove empty tests folder
echo "🗑️  Removing old tests folder..."
rm -rf tests/

echo "✅ Migration complete!"
echo "⚠️  IMPORTANT: You must now fix import paths in moved files:"
echo "   - Replace '../src/' with '../../' (or appropriate relative path)"
echo "   - Run 'npm run test:frontend' to verify all tests pass"
```

---

## Import Path Fixes Needed

### Files Requiring Import Updates:

**All 9 moved files** need import path adjustments. Here's the pattern:

| File                              | Old Path                               | New Path                             | Import Change                          |
| --------------------------------- | -------------------------------------- | ------------------------------------ | -------------------------------------- |
| apiClient.integration.test.tsx    | `tests/`                               | `src/test/integration/`              | `../src/lib/` → `../../lib/`           |
| eventDetail.\*.test.tsx (2 files) | `tests/`                               | `src/test/components/`               | `../src/pages/` → `../../pages/`       |
| publicEvent.\*.test.tsx (2 files) | `tests/`                               | `src/test/components/`               | `../src/pages/` → `../../pages/`       |
| flyerRemoval.test.tsx             | `tests/`                               | `src/test/features/`                 | `../src/pages/` → `../../pages/`       |
| EventListItem.ongoing.test.tsx    | `tests/unit/components/events/`        | `src/test/components/events/`        | `../../../../src/` → `../../../`       |
| PopulateFrom\*.test.tsx (2 files) | `tests/unit/components/rolesTemplate/` | `src/test/components/rolesTemplate/` | `../../../../../src/` → `../../../../` |

---

## Benefits of Consolidation

### Immediate Benefits:

- ✅ **Single source of truth** for all tests
- ✅ **Clear organization** by test type (unit, integration, e2e, components, etc.)
- ✅ **Consistent import paths** across all test files
- ✅ **Easier to find tests** - one location to search
- ✅ **Prevents duplication** - clear where new tests belong

### Long-Term Benefits:

- ✅ **Better developer experience** - no confusion about test location
- ✅ **Easier refactoring** - all tests in one place
- ✅ **Simpler CI/CD configuration** - single test path pattern
- ✅ **Consistent with industry standards** - most projects use one test folder

---

## Alternative: Keep Both (NOT RECOMMENDED)

If you wanted to keep both folders, you'd need to:

1. Define clear rules (e.g., `src/test/` for unit/component, `tests/` for integration/e2e)
2. Update `vitest.config.ts` to explicitly include both
3. Document the separation clearly
4. Enforce with linting rules

**Why NOT recommended**:

- Adds unnecessary complexity
- Still confusing for developers
- No clear benefit over single folder
- Goes against convention

---

## Verification Checklist

After migration, verify:

- [ ] All 9 moved files have updated import paths
- [ ] `npm run test:frontend` passes (632/632 tests)
- [ ] No broken imports or module resolution errors
- [ ] `frontend/tests/` folder deleted
- [ ] Test coverage unchanged
- [ ] CI/CD pipeline still works
- [ ] Update any documentation referencing old test paths

---

## Recommended Action

**Execute consolidation now** using the migration script above, then:

1. Fix import paths in all 9 moved files
2. Run `npm run test:frontend` to verify
3. Commit changes with message: `refactor: consolidate test folders into src/test/`
4. Update any documentation

**Estimated Time**: 30-45 minutes

---

## Summary

- **Current**: 163 files in `src/test/`, 9 orphan files in `tests/`
- **Problem**: Confusion, inconsistent imports, duplication risk
- **Solution**: Move all 9 files to `src/test/` subdirectories
- **Effort**: 30-45 minutes (move + fix imports + verify)
- **Benefit**: Single, well-organized test structure

**Ready to proceed with migration?**
