# Discount Calculation Order Bug Fix

## Bug Description

The frontend enrollment page calculated discount amounts inconsistently depending on the order in which users selected discounts. This caused the displayed price to differ from what Stripe would actually charge (backend calculation was always consistent).

### Example of the Bug

- Program: $100
- Class Rep discount: $20
- Reward code: 50% off

**Before Fix (Order-Dependent)**:

- Path 1: Apply 50% code first ($100 × 50% = $50 discount), then Class Rep ($20) → Final: $100 - $50 - $20 = $30
- Path 2: Apply Class Rep first ($20), then 50% code ($100 × 50% = $50 discount) → Final: $100 - $20 - $50 = $30
- Both showed $30, but WRONG! Backend calculated $40.

**After Fix (Consistent)**:

- Path 1 OR Path 2: $100 - $20 (Class Rep) = $80, then $80 × 50% = $40 discount → Final: $40 ✅
- Matches backend calculation exactly

## Root Cause

`PromoCodeInput.tsx` pre-calculated the promo discount amount when the code was applied, using the full program price. It didn't account for Class Rep or Early Bird discounts that might be applied before or after. This pre-calculated amount was then subtracted in `EnrollProgram.tsx`, causing order-dependent results for percentage-based promo codes.

## Solution

Changed the frontend to match the backend's calculation order:

1. **Apply fixed discounts** (Class Rep XOR Early Bird)
2. **Apply bundle discount** (fixed dollar amount from promo code)
3. **Apply percentage discount** (staff_access or reward promo codes) to the RESULT of steps 1-2

### Code Changes

**EnrollProgram.tsx**:

- Changed state from `promoDiscountAmountInCents` (number) to `validatedPromoCode` (PromoCode object)
- Updated `calculatePrice()` to recalculate promo discount dynamically based on current base price
- Added `calculatePromoDiscountAmount()` helper for display purposes

**PromoCodeInput.tsx**:

- Changed `onApply` callback signature from `(code: string, discountAmount: number)` to `(code: string, validatedCode: PromoCode)`
- Removed pre-calculation logic - now passes full promo code object to parent
- Removed unused `programPrice` prop

## Testing

### Manual Testing ✅

Tested all discount combinations in different orders:

- Class Rep + percentage promo code (both orders) → Consistent $40
- Early Bird + percentage promo code (both orders) → Consistent result
- Class Rep overrides Early Bird correctly
- Bundle discount + percentage code → Correct order
- 100% staff discount → $0.00 (not negative)

### Automated Testing

- Added documentation in `EnrollProgram.test.tsx` describing the fix
- Existing tests verify core discount logic (Class Rep, Early Bird, mutual exclusivity)
- Integration tests in backend verify end-to-end payment flow

## Backend Reference

The correct calculation logic is implemented in `backend/src/controllers/programs/PurchaseCheckoutController.ts` lines 291-306:

```typescript
// Calculate final price
// First apply fixed discounts
let finalPrice = Math.max(
  0,
  fullPrice - classRepDiscount - earlyBirdDiscount - promoDiscountAmount
);

// Then apply percentage discounts
if (promoDiscountPercent > 0) {
  finalPrice = Math.max(
    0,
    Math.round(finalPrice * (1 - promoDiscountPercent / 100))
  );
}
```

## Impact

- **User Trust**: Frontend price now always matches what Stripe charges
- **Consistency**: Discount calculation is order-independent
- **Maintainability**: Frontend logic mirrors backend, easier to debug

## Files Changed

- `frontend/src/pages/EnrollProgram.tsx`
- `frontend/src/components/promo/PromoCodeInput.tsx`
- `frontend/src/test/pages/EnrollProgram.test.tsx` (documentation)
- `docs/DISCOUNT_CALCULATION_FIX.md` (this file)

## Date

November 8, 2025
