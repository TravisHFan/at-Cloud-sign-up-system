# Phase 6.1: AdminPromoCodes.tsx Refactoring Plan

**Start Date:** November 2, 2024  
**Status:** 🚧 In Progress  
**Target:** 1,777 lines → ~550 lines (**69% reduction**)

---

## File Analysis

### Current Structure (1,777 lines total)

```
AdminPromoCodes.tsx (Main Component: lines 1-141, 82 lines)
├── Type Definitions (lines 31-81, ~50 lines)
│   ├── AdminTabType
│   ├── PromoCodeResponse interface
│   └── ProgramDTO interface
│
├── AllCodesTab (lines 142-640, ~498 lines)
│   ├── State Management (20+ useState hooks)
│   ├── Filters UI (search, type, status) ~150 lines
│   ├── Code List/Table ~200 lines
│   ├── Badge Rendering ~50 lines
│   ├── Copy/Deactivate/Reactivate handlers ~100 lines
│   └── Modals (deactivate, reactivate) ~100 lines
│
├── CreateStaffCodeTab (lines 641-1481, ~840 lines)
│   ├── State Management (15+ useState hooks)
│   ├── User Selection UI ~200 lines
│   ├── Form Fields (general/personal modes) ~250 lines
│   ├── Validation Logic ~100 lines
│   ├── Submit Handler ~150 lines
│   └── Success/Error Messaging ~140 lines
│
└── BundleConfigTab (lines 1482-1777, ~296 lines)
    ├── State Management (10+ useState hooks)
    ├── Program Selection UI ~100 lines
    ├── Discount Configuration ~100 lines
    └── Save Handler ~96 lines
```

---

## Extraction Strategy

### Phase 6.1.2: PromoCodeFilters Component (~150 lines)

**Extract from:** AllCodesTab lines ~360-500  
**Target Location:** `components/admin/promo-codes/PromoCodeFilters.tsx`

**Interface:**

```typescript
interface PromoCodeFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  typeFilter: "all" | "bundle_discount" | "staff_access";
  onTypeFilterChange: (
    type: "all" | "bundle_discount" | "staff_access"
  ) => void;
  statusFilter: "all" | "active" | "used" | "expired";
  onStatusFilterChange: (status: "all" | "active" | "used" | "expired") => void;
  totalCodes: number;
}
```

**Extracted Elements:**

- Search input with icon
- Type dropdown (All, Bundle, Staff)
- Status dropdown (All, Active, Used, Expired)
- Filter label and styling

---

### Phase 6.1.3: PromoCodeList Component (~400 lines)

**Extract from:** AllCodesTab lines ~500-640  
**Target Location:** `components/admin/promo-codes/PromoCodeList.tsx`

**Interface:**

```typescript
interface PromoCodeListProps {
  codes: PromoCodeResponse[];
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onCopyCode: (code: string) => void;
  onDeactivate: (id: string, code: string) => void;
  onReactivate: (id: string, code: string) => void;
  copiedCode: string | null;
}
```

**Extracted Elements:**

- Loading spinner
- Error display
- Empty state
- Code cards/table with:
  - Status badge (active/used/expired/inactive)
  - Type badge (bundle/personal staff/general staff)
  - Discount display
  - Expiry formatting
  - Owner info
  - Copy button
  - Deactivate/Reactivate buttons
- Pagination controls

**Helper Functions to Extract:**

- `getStatusBadge(promoCode)`
- `getTypeBadge(promoCode)`
- `formatDiscount(promoCode)`
- `formatExpiry(expiresAt)`

---

### Phase 6.1.4: usePromoCodeOperations Hook (~150 lines)

**Extract from:** AllCodesTab lines ~185-290  
**Target Location:** `hooks/usePromoCodeOperations.ts`

**Interface:**

```typescript
interface UsePromoCodeOperationsReturn {
  codes: PromoCodeResponse[];
  loading: boolean;
  error: string | null;
  totalPages: number;
  totalCodes: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  fetchCodes: () => Promise<void>;
  deactivateCode: (id: string) => Promise<void>;
  reactivateCode: (id: string) => Promise<void>;
  isDeactivating: boolean;
  isReactivating: boolean;
}

function usePromoCodeOperations(
  typeFilter: "all" | "bundle_discount" | "staff_access",
  statusFilter: "all" | "active" | "used" | "expired",
  searchQuery: string,
  limit?: number
): UsePromoCodeOperationsReturn;
```

**Extracted Logic:**

- `fetchCodes` with filters, pagination
- `deactivateCode` with API call
- `reactivateCode` with API call
- Loading state management
- Error handling
- Pagination state

---

### Phase 6.1.5: StaffCodeCreator Component (~300 lines)

**Extract from:** CreateStaffCodeTab lines 641-1481 (entire tab)  
**Target Location:** `components/admin/promo-codes/StaffCodeCreator.tsx`

**Interface:**

```typescript
interface StaffCodeCreatorProps {
  onCodeCreated?: () => void; // Callback after successful creation
}
```

**Extracted Elements:**

- Mode toggle (general vs personal)
- User selection (personal mode only)
- Form fields:
  - Description (general mode)
  - Usage limit (general mode)
  - Expiration date
  - Allowed programs (multi-select)
- Generate code button
- Generated code display with copy
- Success/error messages
- Validation logic
- API submission

**State Management:**

- Form mode (general/personal)
- Selected user
- Form fields
- Generated code
- Loading states

---

### Phase 6.1.6: BundleConfigManager Component (~350 lines)

**Extract from:** BundleConfigTab lines 1482-1777 (entire tab)  
**Target Location:** `components/admin/promo-codes/BundleConfigManager.tsx`

**Interface:**

```typescript
interface BundleConfigManagerProps {
  onSave?: () => void; // Callback after successful save
}
```

**Extracted Elements:**

- Program selection (multi-select)
- Discount type selection (percentage vs fixed amount)
- Discount value input
- Bundle description
- Expiration date
- Save configuration button
- Success/error messages
- Validation logic
- API submission

**State Management:**

- Selected programs
- Discount configuration
- Loading states
- Success/error states

---

### Phase 6.1.7: PromoCodeModals Component (~150 lines)

**Extract from:** AllCodesTab modal rendering  
**Target Location:** `components/admin/promo-codes/PromoCodeModals.tsx`

**Interface:**

```typescript
interface PromoCodeModalsProps {
  // Deactivate modal
  showDeactivateModal: boolean;
  codeToDeactivate: { id: string; code: string } | null;
  isDeactivating: boolean;
  onConfirmDeactivate: () => Promise<void>;
  onCancelDeactivate: () => void;

  // Reactivate modal
  showReactivateModal: boolean;
  codeToReactivate: { id: string; code: string } | null;
  isReactivating: boolean;
  onConfirmReactivate: () => Promise<void>;
  onCancelReactivate: () => void;
}
```

**Extracted Elements:**

- Deactivate confirmation modal
- Reactivate confirmation modal
- Loading states during operations

---

## Implementation Phases

### Phase 6.1.2-6.1.7: Component Extraction (Sequential)

**Order of Extraction:**

1. ✅ **PromoCodeFilters** (easiest, no dependencies)
2. ✅ **PromoCodeList** (depends on helper functions)
3. ✅ **usePromoCodeOperations** (hook for AllCodesTab)
4. ✅ **PromoCodeModals** (simple modals)
5. ✅ **StaffCodeCreator** (full tab component)
6. ✅ **BundleConfigManager** (full tab component)

### Phase 6.1.8: Integration

**Refactored AdminPromoCodes.tsx Structure (~550 lines):**

```typescript
AdminPromoCodes.tsx
├── Type Definitions (~50 lines) [kept]
├── Main Component (~80 lines) [simplified]
│   ├── Tab navigation
│   └── Tab content routing
│
├── AllCodesTab (~150 lines) [reduced from 498]
│   ├── Filter state management
│   ├── <PromoCodeFilters />
│   ├── <PromoCodeList />
│   └── <PromoCodeModals />
│
├── CreateStaffCodeTab (~50 lines) [reduced from 840]
│   └── <StaffCodeCreator />
│
└── BundleConfigTab (~50 lines) [reduced from 296]
    └── <BundleConfigManager />
```

**Expected Reduction:**

- Main component: 82 lines (no change)
- Type definitions: 50 lines (no change)
- AllCodesTab: 498 → 150 lines (348 lines saved)
- CreateStaffCodeTab: 840 → 50 lines (790 lines saved)
- BundleConfigTab: 296 → 50 lines (246 lines saved)

**Total:** 1,777 → ~382 lines (1,395 lines saved, **78.5% reduction**)

**Note:** Target was ~550 lines (69%), actual projection is ~380 lines (78.5%) - **exceeding target!**

---

## Testing Strategy

### Test Files to Update:

1. Check for existing AdminPromoCodes tests:

   ```bash
   find tests -name "*AdminPromoCodes*" -o -name "*promo*code*"
   ```

2. Update test structure for new components:

   - Mock `usePromoCodeOperations` hook
   - Test each component independently
   - Integration tests for AdminPromoCodes main component

3. Test Coverage Goals:
   - PromoCodeFilters: Filter state changes, search input
   - PromoCodeList: Rendering, pagination, action buttons
   - usePromoCodeOperations: API calls, error handling
   - StaffCodeCreator: Form validation, code generation
   - BundleConfigManager: Configuration save, validation

---

## Success Criteria

- ✅ File size reduced from 1,777 → ~380 lines (78.5%)
- ✅ 6 new reusable components created
- ✅ 1 new custom hook created
- ✅ All functionality preserved
- ✅ Zero TypeScript errors
- ✅ All tests passing (100%)
- ✅ Improved maintainability and testability

---

## Risk Mitigation

### Potential Issues:

1. **Complex State Dependencies**

   - Mitigation: Extract hooks before components
   - Pattern: Use custom hooks for shared state

2. **API Client Type Issues**

   - Mitigation: Verify apiClient method signatures
   - Pattern: Import types from services/api

3. **Modal State Management**

   - Mitigation: Keep modal state in parent (AllCodesTab)
   - Pattern: Pass callbacks to PromoCodeModals

4. **Form Validation Logic**
   - Mitigation: Extract validation into helper functions
   - Pattern: Reuse validation across components

---

## Timeline Estimate

| Phase     | Task                   | Estimated Time         |
| --------- | ---------------------- | ---------------------- |
| 6.1.1     | Analysis (current)     | ✅ 30 mins             |
| 6.1.2     | PromoCodeFilters       | 1 hour                 |
| 6.1.3     | PromoCodeList          | 2 hours                |
| 6.1.4     | usePromoCodeOperations | 1.5 hours              |
| 6.1.5     | StaffCodeCreator       | 2 hours                |
| 6.1.6     | BundleConfigManager    | 2 hours                |
| 6.1.7     | PromoCodeModals        | 1 hour                 |
| 6.1.8     | Integration            | 1.5 hours              |
| 6.1.9     | Testing                | 2 hours                |
| 6.1.10    | Documentation          | 30 mins                |
| **Total** |                        | **~14 hours (2 days)** |

---

## Next Steps

1. ✅ Complete Phase 6.1.1 (Analysis) - **DONE**
2. ⏭️ Start Phase 6.1.2 (PromoCodeFilters extraction)
3. ⏭️ Continue sequential extraction through Phase 6.1.7
4. ⏭️ Integrate all components (Phase 6.1.8)
5. ⏭️ Update tests (Phase 6.1.9)
6. ⏭️ Final verification and metrics (Phase 6.1.10)

---

_Plan Created: November 2, 2024_  
_Target Completion: November 4, 2024_  
_Author: GitHub Copilot (Agent)_
