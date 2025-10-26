# Promo Code Service Architecture

## Current Architecture (Phase 1 - Mock Data)

```
┌─────────────────────────────────────────────────────────────┐
│                        COMPONENTS                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ MyPromoCodes │  │ EnrollProgram│  │ PromoCodeInput  │  │
│  │    Page      │  │     Page     │  │   Component     │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                 │                     │           │
│         │  getMyPromoCodes()                   │           │
│         │  getMyPromoCodesByStatus()           │           │
│         │                 │  getUserAvailable  │           │
│         │                 │  CodesForProgram() │           │
│         │                 │                    │           │
│         │                 │                    │ validate  │
│         │                 │                    │ PromoCode()│
└─────────┼─────────────────┼────────────────────┼───────────┘
          │                 │                    │
          └─────────────────┴────────────────────┘
                            │
                  ┌─────────▼──────────┐
                  │                    │
                  │  PromoCodeService  │
                  │    (Singleton)     │
                  │                    │
                  └─────────┬──────────┘
                            │
                  ┌─────────▼──────────┐
                  │                    │
                  │   Mock Functions   │
                  │  (promoCodes.ts)   │
                  │                    │
                  │ • getMockUserPromo │
                  │   Codes()          │
                  │ • getMockAvailable │
                  │   CodesForProgram()│
                  │ • validateMock     │
                  │   PromoCode()      │
                  └────────────────────┘
```

## Future Architecture (Phase 2 - Real Backend)

```
┌─────────────────────────────────────────────────────────────┐
│                        COMPONENTS                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ MyPromoCodes │  │ EnrollProgram│  │ PromoCodeInput  │  │
│  │    Page      │  │     Page     │  │   Component     │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                 │                     │           │
│         │  Same API - No Changes!              │           │
│         │                 │                     │           │
└─────────┼─────────────────┼─────────────────────┼───────────┘
          │                 │                     │
          └─────────────────┴─────────────────────┘
                            │
                  ┌─────────▼──────────┐
                  │                    │
                  │  PromoCodeService  │
                  │    (Singleton)     │
                  │                    │
                  └─────────┬──────────┘
                            │
                  ┌─────────▼──────────┐
                  │                    │
                  │   Axios/HTTP       │
                  │   API Calls        │
                  │                    │
                  └─────────┬──────────┘
                            │
                  ┌─────────▼──────────┐
                  │                    │
                  │  Backend API       │
                  │  (Express)         │
                  │                    │
                  │ GET /api/promo-    │
                  │     codes/my       │
                  │ GET /api/promo-    │
                  │     codes/available│
                  │     /:programId    │
                  │ POST /api/promo-   │
                  │      codes/validate│
                  │                    │
                  └─────────┬──────────┘
                            │
                  ┌─────────▼──────────┐
                  │                    │
                  │   MongoDB          │
                  │   (PromoCode       │
                  │    Collection)     │
                  │                    │
                  └────────────────────┘
```

## Service Method Flow

### getMyPromoCodes()

```
User Action → MyPromoCodes Page → promoCodeService.getMyPromoCodes()
                                          ↓
                                   [Current: Mock Data]
                                   [Future: GET /api/promo-codes/my]
                                          ↓
                                   Return PromoCode[]
                                          ↓
                                   Display in Grid with Filters
```

### getUserAvailableCodesForProgram()

```
Page Load → EnrollProgram → promoCodeService.getUserAvailableCodesForProgram(id)
                                          ↓
                                   [Current: Filter Mock Data]
                                   [Future: GET /api/promo-codes/available/:id]
                                          ↓
                                   Return PromoCode[]
                                          ↓
                                   Populate PromoCodeInput Dropdown
```

### validatePromoCode()

```
User Enters Code → PromoCodeInput → promoCodeService.validatePromoCode(code, id)
                                          ↓
                                   [Current: Check Mock Data]
                                   [Future: POST /api/promo-codes/validate]
                                          ↓
                                   Return ValidationResult
                                          ↓
                                   Apply Discount OR Show Error
```

## Data Flow: Applying a Promo Code

```
┌──────────────┐
│     User     │
│  Selects or  │
│  Enters Code │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│  PromoCodeInput      │
│  handleApply()       │
└──────┬───────────────┘
       │
       ├─── Check availableCodes (client-side)
       │
       ├─── If NOT found → validatePromoCode(code, programId)
       │                         │
       │                         ▼
       │                  ┌──────────────────┐
       │                  │ PromoCodeService │
       │                  │  .validatePromo  │
       │                  │   Code()         │
       │                  └────────┬─────────┘
       │                           │
       │                           ▼
       │                  [Mock: Check mock data]
       │                  [Future: API validation]
       │                           │
       │                           ▼
       │                  ┌──────────────────┐
       │                  │  Validation      │
       │                  │  Result          │
       │                  │  • valid: bool   │
       │                  │  • discount: {}  │
       │                  │  • message: str  │
       │                  └────────┬─────────┘
       │                           │
       └───────────────────────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  onApply()      │
                          │  callback       │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │ EnrollProgram   │
                          │ updateState:    │
                          │ • appliedCode   │
                          │ • promoDiscount │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │ Recalculate     │
                          │ Total Price     │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │ Update UI       │
                          │ • Show discount │
                          │ • Update total  │
                          └─────────────────┘
```

## Key Design Benefits

### 1. Abstraction Layer

```
Components ──────────────────────┐
              (Don't care about  │
               data source)      │
                                 ▼
                        PromoCodeService
                                 │
                                 ├─ Mock Data (Now)
                                 └─ Real API (Later)
```

### 2. Type Safety

```
TypeScript Interface
        │
        ├─ PromoCode
        ├─ PromoCodeValidationResult
        └─ FilterStatus

All methods strongly typed → Catch errors at compile time
```

### 3. Single Source of Truth

```
All promo code operations ──→ PromoCodeService
                              (One place to change)
```

### 4. Testability

```
Unit Tests
    │
    ├─ Test Service Methods
    ├─ Mock Service for Component Tests
    └─ Integration Tests
```

## Migration Strategy (Todo #18)

### Step 1: Keep Service Interface

```typescript
// This stays the same:
async getMyPromoCodes(): Promise<PromoCode[]>
```

### Step 2: Replace Implementation

```typescript
// Change from:
const mockCodes = await getMockUserPromoCodes();
return mockCodes.map(this.convertMockToPromoCode);

// To:
const response = await axios.get("/api/promo-codes/my");
return response.data;
```

### Step 3: Components Don't Change

```typescript
// This code stays exactly the same in all components:
const codes = await promoCodeService.getMyPromoCodes();
```

### Step 4: Remove Mock Files

```
✅ Keep: frontend/src/services/promoCodeService.ts
❌ Remove: frontend/src/mocks/promoCodes.ts
❌ Remove: All imports of mock functions
```

## Performance Considerations

### Current (Mock):

- **Latency**: 200-500ms simulated
- **Data**: In-memory arrays
- **Caching**: None needed

### Future (Real API):

- **Latency**: Network dependent
- **Data**: Database queries
- **Caching**: Consider adding:
  - React Query for automatic caching
  - Service-level cache for frequently accessed codes
  - Local storage for offline support

## Error Handling Strategy

### Current:

```typescript
try {
  const codes = await promoCodeService.getMyPromoCodes();
  // Success
} catch (error) {
  // Handle error
  console.error("Failed to fetch codes:", error);
}
```

### Future (Enhanced):

```typescript
try {
  const codes = await promoCodeService.getMyPromoCodes();
} catch (error) {
  if (error.response?.status === 401) {
    // Redirect to login
  } else if (error.response?.status === 403) {
    // Show permission error
  } else if (error.response?.status >= 500) {
    // Show server error
  } else {
    // Show generic error
  }
}
```

---

**Last Updated**: 2025-10-18  
**Phase**: 1 (Frontend Mock Implementation)  
**Status**: Service layer complete, ready for testing
