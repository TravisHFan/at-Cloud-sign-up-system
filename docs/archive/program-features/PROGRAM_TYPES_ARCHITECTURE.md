# Program Types - Centralized Architecture

## Overview

Program types are now centralized in a single source of truth to make the application easily expandable when adding new program types.

## Key Files

### `/frontend/src/constants/programTypes.ts`

This is the **single source of truth** for all program types in the frontend. When adding a new program type:

1. Add the new type string to the `PROGRAM_TYPES` array
2. All validation, dropdowns, and type definitions will automatically include it

```typescript
export const PROGRAM_TYPES = [
  "EMBA Mentor Circles",
  "Effective Communication Workshops",
  "Marketplace Church Incubator Program (MCIP)",
  // Add new types here
] as const;

export type ProgramType = (typeof PROGRAM_TYPES)[number];
```

### Backend Model

Also update `/backend/src/models/Program.ts`:

- Update the TypeScript interface union type
- Update the Mongoose schema enum array

## Benefits

### ✅ Single Source of Truth

- One place to add new program types
- No need to hunt through multiple files
- Reduced risk of inconsistencies

### ✅ Type Safety

- TypeScript `ProgramType` is derived from the array
- Compile-time errors if you use an invalid type
- IntelliSense autocomplete in IDEs

### ✅ Automatic Propagation

All of these automatically include new types:

- ✅ Validation (programValidationUtils.ts)
- ✅ Dropdown options (CreateNewProgram, EditProgram)
- ✅ Type definitions (api.ts, all page components)

## Migration Completed

The following files now use the centralized system:

**Constants & Validation:**

- `constants/programTypes.ts` - Source of truth
- `utils/programValidationUtils.ts` - Uses `isValidProgramType()`

**API & Services:**

- `services/api.ts` - Uses `ProgramType` type (2 locations)

**Pages:**

- `pages/CreateNewProgram.tsx` - Uses `getProgramTypes()`
- `pages/EditProgram.tsx` - Uses `getProgramTypes()` and `ProgramType`
- `pages/Programs.tsx` - Uses `ProgramType`
- `pages/ProgramDetail.tsx` - Uses `ProgramType`
- `pages/AdminPromoCodes.tsx` - Uses `ProgramType`

## Adding a New Program Type

### Step 1: Update Frontend Constants

```typescript
// frontend/src/constants/programTypes.ts
export const PROGRAM_TYPES = [
  "EMBA Mentor Circles",
  "Effective Communication Workshops",
  "Marketplace Church Incubator Program (MCIP)",
  "Your New Program Type", // Add here
] as const;
```

### Step 2: Update Backend Model

```typescript
// backend/src/models/Program.ts

// Interface
programType: "EMBA Mentor Circles" |
             "Effective Communication Workshops" |
             "Marketplace Church Incubator Program (MCIP)" |
             "Your New Program Type"; // Add here

// Schema enum
programType: {
  type: String,
  enum: [
    "EMBA Mentor Circles",
    "Effective Communication Workshops",
    "Marketplace Church Incubator Program (MCIP)",
    "Your New Program Type", // Add here
  ],
  required: true,
}
```

### Step 3: Add Color Scheme (Optional)

If you want a custom color scheme for the new program type in the Programs list:

```typescript
// frontend/src/pages/Programs.tsx - getProgramTypeColors()
case "Your New Program Type":
  return {
    card: "bg-gradient-to-br from-purple-50 to-violet-100 border-purple-200 hover:from-purple-100 hover:to-violet-200",
    badge: "bg-purple-100 text-purple-800 border-purple-300",
    title: "group-hover:text-purple-700",
    dot: "bg-purple-500 group-hover:bg-purple-700",
    shadow: "hover:shadow-purple-200/50",
  };
```

### Step 4: Update Documentation

Update `docs/PROGRAMS_COMPREHENSIVE_ROADMAP.md` interface definition.

### Step 5: Verify

```bash
# TypeScript compilation
npm run type-check

# Run tests
npm test
```

## API Usage

### Get All Program Types

```typescript
import { getProgramTypes } from "../constants/programTypes";

const types = getProgramTypes();
// ["EMBA Mentor Circles", "Effective Communication Workshops", "Marketplace Church Incubator Program (MCIP)"]
```

### Validate a Program Type

```typescript
import { isValidProgramType } from "../constants/programTypes";

if (isValidProgramType(userInput)) {
  // Type is valid and TypeScript knows it's a ProgramType
}
```

### Use Type Definition

```typescript
import type { ProgramType } from "../constants/programTypes";

interface MyInterface {
  programType: ProgramType; // Type-safe, auto-updates when array changes
}
```

## Design Principles

1. **DRY (Don't Repeat Yourself)**: Single definition for all program types
2. **Type Safety**: Leverage TypeScript's type system for compile-time checks
3. **Maintainability**: Easy to understand where to make changes
4. **Expandability**: Adding new types is a 2-minute task

## Historical Context

**Before Centralization:**

- Program types hardcoded in 10+ locations
- Validation array separate from dropdown arrays
- Risk of inconsistency when adding new types
- Required updating each file individually

**After Centralization:**

- Single source of truth in `programTypes.ts`
- All consumers automatically updated
- Type-safe with TypeScript
- Expandable architecture

---

**Last Updated:** 2025-01-21  
**Related Docs:** `PROGRAMS_COMPREHENSIVE_ROADMAP.md`
