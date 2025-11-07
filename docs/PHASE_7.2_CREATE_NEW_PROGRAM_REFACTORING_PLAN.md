# Phase 7.2: CreateNewProgram.tsx Refactoring Plan

**Created**: November 4, 2025  
**File**: `frontend/src/pages/CreateNewProgram.tsx`  
**Current Size**: 1,012 lines  
**Target**: 50-60% reduction → ~400-500 lines  
**Status**: Planning Complete ✅

---

## Executive Summary

CreateNewProgram.tsx is a **1,012-line giant file** containing program creation logic. This refactoring will leverage **existing EditProgram components** (988 lines across 3 components) to extract shared functionality while maintaining the creation-specific workflow.

**Key Insight**: EditProgram refactoring (Phase 6.4) already created 3 reusable components:

- `ProgramFormFields.tsx` (407 lines) - Form fields for program data
- `PricingSection.tsx` (351 lines) - Tuition/pricing UI
- `PricingConfirmationModal.tsx` (230 lines) - Pricing change warnings

**Strategy**: Extract creation-specific components while **reusing EditProgram components** where applicable.

---

## File Structure Analysis

### Current Organization (1,012 lines)

```typescript
Lines 1-98:   Imports, type definitions, constants (98 lines)
              - Mentor, MentorPayload, ProgramPayload types
              - PROGRAM_TYPES, YEARS, MONTHS constants

Lines 101-280: Component state and hooks (180 lines)
              - useForm setup with defaultValues
              - useProgramValidation hook
              - Pricing validation logic
              - Combined validation
              - handleMentorsChange handler

Lines 282-313: Form submission handler (32 lines)
              - onSubmit async function
              - Month name to code mapping
              - transformMentor function
              - Payload preparation
              - API call to programService.create()

Lines 315-319: Cancel handler (5 lines)
              - handleCancel navigation

Lines 321-328: Access control check (8 lines)
              - shouldShowRestrictedOverlay logic

Lines 330-452: Restricted Access Overlay (123 lines)
              - Full overlay UI with lock icon
              - Authorization messaging
              - Positioned absolutely over form

Lines 454-570: Form Structure (117 lines)
              - Program Type dropdown
              - Title input
              - Start/End Year/Month selects (4 fields)
              - Hosted By (read-only)

Lines 572-600: Mentor Selection (29 lines)
              - OrganizerSelection component usage
              - Mentor state management

Lines 602-635: Introduction Textarea (34 lines)
              - Textarea with validation
              - ValidationIndicator

Lines 637-682: Flyer Upload Section (46 lines)
              - URL input field
              - File upload button (📎)
              - Image preview
              - fileService.uploadImage integration

Lines 684-982: Tuition/Pricing Section (299 lines)
              - Free program toggle (radio buttons)
              - Conditional pricing fields
              - Full Price Ticket ($) with validation
              - Class Rep Discount ($)
              - Class Rep Limit (integer 0-5)
              - Early Bird Discount ($)
              - Early Bird Deadline (date) with validation
              - Combined discount validation
              - Computed examples (4 pricing tiers)
              - Real-time validation feedback

Lines 984-1013: Form Actions (30 lines)
              - Overall ValidationIndicator
              - Cancel and Create Program buttons
```

### Extraction Opportunities

#### Highly Reusable (from EditProgram)

1. **ProgramFormFields** (407 lines) ✅ Already exists

   - Can extract Lines 454-600 (147 lines)
   - Program Type, Title, Dates, Hosted By, Mentors, Introduction, Flyer
   - **Reusability**: 95% compatible (needs minor prop adjustments)

2. **PricingSection** (351 lines) ✅ Already exists
   - Can extract Lines 684-982 (299 lines)
   - Free toggle, pricing fields, validation, examples
   - **Reusability**: 90% compatible (create vs edit differences minimal)

#### New Components Needed

3. **RestrictedAccessOverlay** (~130 lines)

   - Extract Lines 330-452 (123 lines)
   - Generic access control overlay
   - Props: `isRestricted`, `requiredRole`, `contactMessage`
   - **Reusability**: High (can use for other restricted pages)

4. **ProgramCreationForm** (orchestrator)
   - Remaining ~250 lines
   - State management
   - Form submission logic
   - Component composition

---

## Extraction Strategy

### Phase 7.2.1: Extract RestrictedAccessOverlay Component

**Target**: Lines 321-452 (~130 lines)  
**Reduction**: 1,012 → ~882 lines (12.8%)

**New File**: `frontend/src/components/common/RestrictedAccessOverlay.tsx`

**Component Design**:

```typescript
export interface RestrictedAccessOverlayProps {
  isRestricted: boolean;
  requiredRole?: string; // e.g., "@Cloud Co-worker"
  featureName: string; // e.g., "Create Program"
  contactMessage?: string;
}

export function RestrictedAccessOverlay({
  isRestricted,
  requiredRole = "@Cloud Co-worker",
  featureName,
  contactMessage = "Please contact your @Cloud Leaders to request access.",
}: RestrictedAccessOverlayProps);
```

**Why First**: Lowest risk, pure presentational component, high reusability.

---

### Phase 7.2.2: Reuse ProgramFormFields Component

**Target**: Lines 454-600 (~147 lines)  
**Reduction**: ~882 → ~735 lines (16.7%)

**Existing File**: `frontend/src/components/EditProgram/ProgramFormFields.tsx` (407 lines)

**Integration Strategy**:

- Import `ProgramFormFields` from `../components/EditProgram/`
- Pass `register`, `watch`, `setValue`, `errors`, `validations` props
- Pass `currentUser`, `mentors`, `onMentorsChange`
- Pass `YEARS`, `MONTHS` constants
- Set `originalFlyerUrl={null}` (no original for creation)

**Changes Needed**:

- None! Component already designed for both create/edit
- `originalFlyerUrl={null}` differentiates creation mode

**Why Second**: Already tested and proven from EditProgram refactoring.

---

### Phase 7.2.3: Reuse PricingSection Component

**Target**: Lines 684-982 (~299 lines)  
**Reduction**: ~735 → ~436 lines (40.7%)

**Existing File**: `frontend/src/components/EditProgram/PricingSection.tsx` (351 lines)

**Integration Strategy**:

- Import `PricingSection` from `../components/EditProgram/`
- Pass `register`, `watch`, `errors` props
- Pass `isFreeProgram` state
- Component handles all pricing logic internally

**Changes Needed**:

- Verify `PricingSection` works for creation (no original pricing)
- May need `isEditMode={false}` prop to hide change warnings

**Why Third**: Leverages proven EditProgram component, maintains pricing consistency.

---

### Phase 7.2.4: Extract Form Submission Logic

**Target**: Lines 101-313 (~180 lines of state/logic)  
**Reduction**: ~436 → ~356 lines (18.3%)

**Approach**: Extract submission handler to custom hook

**New File**: `frontend/src/hooks/useProgramCreation.ts`

**Hook Design**:

```typescript
export function useProgramCreation(mentors: Mentor[], onSuccess?: () => void) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: ProgramFormData) => {
    // Lines 282-313: Form submission logic
    // - Month name to code mapping
    // - transformMentor function
    // - Payload preparation
    // - API call
    // - Navigation on success
  };

  const handleCancel = () => {
    navigate("/dashboard/programs");
  };

  return { handleSubmit, handleCancel, isSubmitting };
}
```

**Why Fourth**: Separates business logic from presentation, improves testability.

---

### Phase 7.2.5: Final Orchestrator

**Result**: ~256 lines remaining  
**Reduction**: 1,012 → ~256 lines (**74.7% total reduction**)

**Final Structure**:

```typescript
export default function CreateNewProgram() {
  // 1. Auth and access control (~15 lines)
  const { currentUser } = useAuth();
  const shouldShowRestrictedOverlay = ...;

  // 2. Form setup (~20 lines)
  const { register, handleSubmit, watch, setValue, formState } = useForm(...);

  // 3. Validation (~15 lines)
  const { validations, overallStatus } = useProgramValidation(watch);
  const pricingValidation = useMemo(...);
  const combinedValidation = useMemo(...);

  // 4. Mentor state (~10 lines)
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const handleMentorsChange = (newMentors) => setMentors(newMentors);

  // 5. Submission logic hook (~5 lines)
  const { handleSubmit: onSubmit, handleCancel, isSubmitting } =
    useProgramCreation(mentors);

  // 6. Render (~191 lines)
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="relative bg-white rounded-lg shadow-sm p-6">
        {shouldShowRestrictedOverlay && (
          <RestrictedAccessOverlay
            isRestricted={true}
            featureName="Create Program"
          />
        )}

        <h1>Create New Program</h1>

        <form onSubmit={handleSubmit(onSubmit)}>
          <ProgramFormFields
            register={register}
            watch={watch}
            setValue={setValue}
            errors={errors}
            validations={validations}
            currentUser={currentUser}
            mentors={mentors}
            onMentorsChange={handleMentorsChange}
            originalFlyerUrl={null}
            YEARS={YEARS}
            MONTHS={MONTHS}
          />

          <PricingSection
            register={register}
            watch={watch}
            errors={errors}
            isFreeProgram={isFreeProgram}
            isEditMode={false}
          />

          <ValidationIndicator validation={combinedValidation} />

          {/* Form Actions */}
          <div className="flex gap-3">
            <button onClick={handleCancel}>Cancel</button>
            <button type="submit">Create Program</button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## Component Extraction Details

### 1. RestrictedAccessOverlay.tsx (~130 lines)

**Location**: `frontend/src/components/common/RestrictedAccessOverlay.tsx`

**Purpose**: Reusable access control overlay for restricted features

**Props**:

```typescript
interface RestrictedAccessOverlayProps {
  isRestricted: boolean;
  requiredRole?: string;
  featureName: string; // "Create Program", "Create Event", etc.
  contactMessage?: string;
}
```

**Exports**: `RestrictedAccessOverlay` component

**Dependencies**: Heroicons (lock icon), Tailwind CSS

**Reusability**: Can be used for any restricted page/feature

---

### 2. useProgramCreation.ts (~80 lines)

**Location**: `frontend/src/hooks/useProgramCreation.ts`

**Purpose**: Extract program creation submission logic

**API**:

```typescript
function useProgramCreation(
  mentors: Mentor[],
  onSuccess?: () => void
): {
  handleSubmit: (data: ProgramFormData) => Promise<void>;
  handleCancel: () => void;
  isSubmitting: boolean;
};
```

**Responsibilities**:

- Transform form data to API payload
- Convert dollars to cents
- Map month names to codes
- Transform mentors array
- Call `programService.create()`
- Navigate on success
- Error handling

---

## Reused Components (from EditProgram)

### 3. ProgramFormFields.tsx (Already Exists - 407 lines)

**Location**: `frontend/src/components/EditProgram/ProgramFormFields.tsx`

**Covers Lines**: 454-600 (147 lines in CreateNewProgram)

**Props Required**:

```typescript
{
  register,
  watch,
  setValue,
  errors,
  validations,
  currentUser,
  mentors,
  onMentorsChange,
  originalFlyerUrl: null, // <-- Creation mode
  YEARS,
  MONTHS
}
```

**No Changes Needed**: Component already supports creation mode via `originalFlyerUrl={null}`

---

### 4. PricingSection.tsx (Already Exists - 351 lines)

**Location**: `frontend/src/components/EditProgram/PricingSection.tsx`

**Covers Lines**: 684-982 (299 lines in CreateNewProgram)

**Props Required**:

```typescript
{
  register,
  watch,
  errors,
  isFreeProgram,
  isEditMode: false // <-- Creation mode (may need to add this prop)
}
```

**Possible Change**: May need to add `isEditMode` prop to hide "pricing change" warnings during creation.

---

## Risk Assessment

### Low Risk Extractions

- **RestrictedAccessOverlay**: Pure presentational, no business logic
- **ProgramFormFields reuse**: Already proven in EditProgram
- **PricingSection reuse**: Already proven in EditProgram

### Medium Risk Extractions

- **useProgramCreation hook**: Contains API calls and navigation
  - **Mitigation**: Extract incrementally, test submission flow

### High Risk Areas

- None identified (all extractions follow proven patterns)

---

## Testing Strategy

### Per-Phase Testing

1. **Phase 7.2.1**: Visual testing of RestrictedAccessOverlay
   - Verify overlay shows for Participant/Guest Expert
   - Verify form is blurred/disabled underneath
2. **Phase 7.2.2**: Integration testing with ProgramFormFields
   - Verify all form fields render correctly
   - Verify validation indicators work
   - Verify mentor selection works
3. **Phase 7.2.3**: Integration testing with PricingSection
   - Verify free/paid toggle works
   - Verify pricing calculations
   - Verify computed examples display
4. **Phase 7.2.4**: Submission flow testing
   - Verify program creation works end-to-end
   - Verify navigation after success
   - Verify error handling
5. **Phase 7.2.5**: Full integration testing
   - Run all 632 frontend tests
   - Manual testing of complete flow
   - Verify TypeScript compiles

### Success Criteria

- ✅ All 632 frontend tests passing
- ✅ Zero TypeScript errors
- ✅ Program creation workflow functional
- ✅ 50-60% line reduction achieved
- ✅ Reused EditProgram components successfully

---

## Timeline Estimate

- **Phase 7.2.1**: 20 minutes (RestrictedAccessOverlay)
- **Phase 7.2.2**: 15 minutes (ProgramFormFields reuse)
- **Phase 7.2.3**: 15 minutes (PricingSection reuse)
- **Phase 7.2.4**: 25 minutes (useProgramCreation hook)
- **Phase 7.2.5**: 10 minutes (Final orchestrator cleanup)
- **Testing**: 15 minutes (Full validation)

**Total**: ~100 minutes (1.5-2 hours)

---

## Expected Outcomes

### Line Reduction

- **Before**: 1,012 lines
- **After**: ~256 lines
- **Reduction**: **756 lines (74.7%)**
- **Target**: 50-60% → **EXCEEDED by 15%**

### Component Structure

- **New Components**: 2 (RestrictedAccessOverlay, useProgramCreation hook)
- **Reused Components**: 2 (ProgramFormFields, PricingSection)
- **Total Modules**: 4 supporting 1 orchestrator

### Reusability Benefits

- RestrictedAccessOverlay: Can protect any restricted feature
- useProgramCreation: Single source of truth for creation logic
- ProgramFormFields: Shared by CreateNewProgram and EditProgram
- PricingSection: Shared by CreateNewProgram and EditProgram

### Maintainability Improvements

1. **Single Responsibility**: Each component has one clear purpose
2. **DRY Principle**: Eliminated duplication between create/edit forms
3. **Testability**: Logic extracted to testable hooks
4. **Readability**: Main file becomes high-level orchestrator

---

## Dependencies

### Internal Dependencies

- `EditProgram/ProgramFormFields.tsx` (existing)
- `EditProgram/PricingSection.tsx` (existing)
- `hooks/useProgramValidation.ts` (existing)
- `services/api/programService.ts` (existing)

### External Dependencies

- `react-hook-form` (form management)
- `react-router-dom` (navigation)
- `@heroicons/react` (icons)

### Type Imports

- `Mentor`, `ProgramFormData` types (local)
- `User` type from auth context

---

## Success Metrics

| Metric                 | Target     | Expected |
| ---------------------- | ---------- | -------- |
| Line Reduction         | 50-60%     | 74.7%    |
| Test Pass Rate         | 100%       | 100%     |
| TypeScript Errors      | 0          | 0        |
| New Components Created | 2-3        | 2        |
| Reused Components      | 2          | 2        |
| Component Reusability  | High       | High     |
| Code Duplication       | Eliminated | ✅       |

---

## Commit Strategy

Each phase will have its own commit with the following format:

```
Phase 7.2.X: [Component Name] ([before]→[after] lines, [%] reduction)

- Created/Reused [ComponentName]
- Extracted [lines] lines
- [Specific achievement]
- All 632 frontend tests passing
```

Example:

```
Phase 7.2.1: Extract RestrictedAccessOverlay (1,012→882 lines, 12.8% reduction)

- Created RestrictedAccessOverlay.tsx component with 130 lines
- Extracted access control overlay from CreateNewProgram
- Generic component reusable for any restricted feature
- All 632 frontend tests passing
```

---

## Phase 7.2 Completion Checklist

- [ ] Phase 7.2.1: RestrictedAccessOverlay extracted
- [ ] Phase 7.2.2: ProgramFormFields integrated
- [ ] Phase 7.2.3: PricingSection integrated
- [ ] Phase 7.2.4: useProgramCreation hook extracted
- [ ] Phase 7.2.5: Final orchestrator validated
- [ ] All 632 frontend tests passing
- [ ] TypeScript compilation successful
- [ ] Documentation updated (GIANT_FILE_REFACTORING_MASTER_PLAN.md)
- [ ] Status summary updated (REFACTORING_STATUS_SUMMARY.md)

---

## Appendix: Component Comparison

### CreateNewProgram vs EditProgram

| Feature          | CreateNewProgram  | EditProgram           | Shared Component              |
| ---------------- | ----------------- | --------------------- | ----------------------------- |
| Form Fields      | ✅ Lines 454-600  | ✅ Extracted          | ProgramFormFields             |
| Pricing Section  | ✅ Lines 684-982  | ✅ Extracted          | PricingSection                |
| Access Control   | ✅ Lines 330-452  | ❌ Not needed         | RestrictedAccessOverlay (new) |
| Submission Logic | ✅ POST /programs | ✅ PUT /programs/:id  | Separate hooks                |
| Initial Data     | ❌ Empty form     | ✅ Load existing      | N/A                           |
| Delete Function  | ❌ Not applicable | ✅ DeleteProgramModal | N/A                           |

**Key Insight**: 60% of CreateNewProgram logic is shared with EditProgram, making component reuse highly valuable.
