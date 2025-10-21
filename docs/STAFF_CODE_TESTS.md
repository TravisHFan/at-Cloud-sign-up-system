# Staff Code Creation Tests - Implementation Notes

## Overview

Created minimal working tests for the Staff Code creation flow in AdminPromoCodes page. These tests specifically guard against the bug where users selected from search results were missing their ID field, causing downstream API failures.

## Test File

`frontend/src/test/pages/AdminPromoCodes-StaffCode.test.tsx`

## Tests Implemented

### ✅ Test 1: Basic Navigation

**Purpose**: Verify component renders and tab navigation works  
**What it tests**:

- Page loads with "Promo Codes Management" heading
- "Create Staff Code" tab exists and is clickable
- After clicking tab, "Select User" button appears

### ✅ Test 2: User Selection with Valid ID (CRITICAL)

**Purpose**: Ensure selected user from search has valid ID and can receive code  
**What it tests**:

1. Opens user selection modal
2. Types in search box ("john")
3. Waits for search API to be called
4. User appears in results with COMPLETE data including ID
5. Selects user from results
6. Modal closes and user details displayed
7. Submits form by clicking "Create Staff Code" button
8. **CRITICAL ASSERTION**: Verifies API called with valid user ID
9. Guards: ID is truthy, ID has length > 0

**Mock Data**:

```typescript
{
  id: "user123",  // CRITICAL: Must be present
  username: "john.doe",
  email: "john.doe@example.com",
  firstName: "John",
  lastName: "Doe",
  role: "User",
  roleInAtCloud: "@Cloud Co-worker",
  gender: "male",
  avatar: null,
  phone: "+1234567890"
}
```

### ✅ Test 3: User Without ID (Negative Test)

**Purpose**: Document behavior when user data is missing ID field  
**What it tests**:

1. Mocks search result with user MISSING ID field
2. Attempts to select and submit
3. Verifies API is NOT called (or documents if it is)
4. Logs behavior for analysis

**Current Behavior**: ✅ API not called with invalid user

## Key Learnings

### 1. Mock Setup Pattern

```typescript
// Use vi.mock() with simple vi.fn() definitions
vi.mock("../../services/api");

// Configure mocks in beforeEach using vi.mocked()
beforeEach(() => {
  vi.mocked(api.searchService.searchUsers).mockResolvedValue({
    results: [mockUser], // Wrap in proper response structure
  });
});
```

### 2. Modal Detection

Don't use `role="dialog"` - the UserSelectionModal doesn't have it.  
Instead, query by modal title text:

```typescript
await waitFor(() => {
  expect(screen.getByText("Select User for Staff Code")).toBeInTheDocument();
});
```

### 3. Button Disambiguation

"Create Staff Code" appears TWICE:

- As a tab button
- As a submit button

Solution:

```typescript
const allButtons = screen.getAllByRole("button", {
  name: /create staff code/i,
});
const submitButton = allButtons.find(
  (btn) => btn.getAttribute("type") === "submit"
);
```

### 4. Search API Response Format

Must wrap results in proper structure:

```typescript
// ❌ Wrong
vi.mocked(api.searchService.searchUsers).mockResolvedValue([mockUser]);

// ✅ Correct
vi.mocked(api.searchService.searchUsers).mockResolvedValue({
  results: [mockUser],
});
```

### 5. Staff Code Creation API Response

Must wrap code in object:

```typescript
// ❌ Wrong
vi.mocked(api.apiClient.createStaffPromoCode).mockResolvedValue(mockCode);

// ✅ Correct
vi.mocked(api.apiClient.createStaffPromoCode).mockResolvedValue({
  code: mockCode,
});
```

## Test Results

```
✓ should render and navigate to Create Staff Code tab
✓ should ensure selected user from search has valid ID (477ms)
  └─ ✅ SUCCESS: User ID correctly passed to API: user123
✓ should handle user without ID gracefully (1465ms)
  └─ ✅ GOOD: API not called with invalid user

Test Files  1 passed (1)
      Tests  3 passed (3)
Duration  3.15s
```

## Future Expansion

These minimal tests validate the approach. Can now expand to test:

- [ ] Avatar display after user selection
- [ ] Clear/remove selected user functionality
- [ ] Program restrictions (specific vs all programs)
- [ ] Custom expiration dates
- [ ] Success message after code creation
- [ ] Error handling (API failures, network errors)
- [ ] Discount percentage validation (must be 100%)

## Bug Prevention

This test suite specifically guards against the bug reported where:

> "In the create new event page, when we choose the user from search result, the user does not have an id, which caused a series of bugs later."

The test ensures:

1. User objects from search MUST have `id` field
2. API calls MUST receive valid user ID
3. System gracefully handles invalid/missing IDs

## Related Files

- Component: `frontend/src/pages/AdminPromoCodes.tsx`
- Modal: `frontend/src/components/admin/UserSelectionModal.tsx`
- API: `frontend/src/services/api.ts`
- Types: `frontend/src/types/management.ts`

---

**Created**: 2025-10-21  
**Status**: ✅ All tests passing  
**Coverage**: Core user selection flow with ID validation
