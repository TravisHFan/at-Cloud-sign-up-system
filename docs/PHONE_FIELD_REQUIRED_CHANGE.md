# Phone Field Made Required in Public Event Registration

## Date: 2025-10-10

## Changes Made

### Frontend Changes

1. **`frontend/src/pages/PublicEvent.tsx`**

   - Removed "(optional)" text from phone label
   - Added red asterisk (\*) to indicate required field
   - Added `required` attribute to phone input
   - Updated submit button disabled logic to include phone validation: `disabled={submitting || !name || !email || !phone}`
   - Changed registration payload from `phone: phone || undefined` to `phone` (no longer optional)

2. **`frontend/src/types/publicEvent.ts`**
   - Changed `PublicRegistrationPayload.attendee.phone` from `phone?: string` to `phone: string`

### Backend Changes

1. **`backend/src/controllers/publicEventController.ts`**

   - Added phone validation in the `register` method
   - New validation block checks `if (!attendee?.phone)` and returns 400 error with message "attendee.phone is required"

2. **`backend/src/models/GuestRegistration.ts`**
   - Changed phone field from `required: false` to `required: true` in schema
   - Updated interface: `phone?: string` → `phone: string`

### Test Updates Required

The following test files need to be updated to include `phone` in all `attendee` objects:

**✅ Already Updated:**

- `backend/tests/integration/api/public-events-register.integration.test.ts`

**⚠️ Needs Updating:**

- `backend/tests/integration/api/public-end-to-end-flow.integration.test.ts`
- `backend/tests/integration/api/public-events-register-hybrid-email.integration.test.ts`
- `backend/tests/integration/api/public-events-register-negative.integration.test.ts`
- `backend/tests/integration/api/public-events-register-online-email.integration.test.ts`
- `backend/tests/integration/api/public-registration-metrics.integration.test.ts`
- `backend/tests/integration/api/public-registration-rate-limit.integration.test.ts`
- `backend/tests/integration/realtime/guests-manage-token.realtime.integration.test.ts`

## Pattern for Updating Tests

Replace:

```typescript
attendee: { name: "...", email: "..." }
```

With:

```typescript
attendee: { name: "...", email: "...", phone: "+1 555-XXXX" }
```

## Expected Behavior After Changes

### Frontend

- Phone field displays with red asterisk (\*)
- Submit button is disabled if phone is empty
- Form cannot be submitted without phone number
- Phone value is always sent in registration payload

### Backend

- Requests without `attendee.phone` return 400 error with message: "attendee.phone is required"
- GuestRegistration documents require phone field in MongoDB
- Phone must be 10-20 characters (existing validation preserved)

### API Response

**Missing Phone:**

```json
{
  "success": false,
  "message": "attendee.phone is required"
}
```

## Testing Checklist

- [x] Frontend UI shows phone as required
- [x] Frontend validation prevents submission without phone
- [x] Backend validates phone presence
- [x] Backend model requires phone in schema
- [ ] All integration tests pass
- [ ] Manual testing in development
- [ ] Manual testing in production after deployment

## Migration Notes

**Existing Data:** No migration needed. The `phone` field was already optional in the database and most guest registrations already have phone numbers. This change only affects **new registrations** going forward.

**Backwards Compatibility:** This is a breaking change for the API. Any external clients calling the registration endpoint must now include phone in the request.
