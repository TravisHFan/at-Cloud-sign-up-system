# Phone Field Architecture

## Date: 2025-10-10

## Overview

The phone field has a **flexible architecture** where it's optional at the database/backend level but can be enforced as required on specific frontend forms based on business requirements.

## Current Architecture ✅

### 1. Database/Model Level (OPTIONAL)

**File:** `backend/src/models/GuestRegistration.ts`

```typescript
phone: {
  type: String,
  required: false,  // ✅ Optional in database
  trim: true,
  minlength: 10,
  maxlength: 20,
}
```

**Interface:**

```typescript
phone?: string;  // ✅ Optional in TypeScript interface
```

**Rationale:**

- Provides flexibility for different use cases
- Allows phone to be optional in guest management, admin creation, etc.
- Existing data may not have phone numbers

---

### 2. Backend API Level (OPTIONAL)

**File:** `backend/src/controllers/publicEventController.ts`

```typescript
// ✅ No validation for phone - it's optional
if (!attendee?.name || !attendee?.email) {
  // Only name and email are required
  res.status(400).json({
    success: false,
    message: "attendee.name and attendee.email are required",
  });
  return;
}
// Note: phone is optional at the backend level but may be required by frontend validation
```

**Rationale:**

- Backend is flexible and doesn't enforce phone requirement
- Different frontends/clients can have different requirements
- API is more reusable

---

### 3. Frontend Level (REQUIRED for Public Event Registration)

**File:** `frontend/src/pages/PublicEvent.tsx`

```tsx
<label htmlFor="public-reg-phone" className="block text-sm font-medium mb-1">
  Phone
</label>
<input
  id="public-reg-phone"
  value={phone}
  onChange={(e) => setPhone(e.target.value)}
  required  // ✅ HTML5 validation - enforces requirement
  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-indigo-500"
  placeholder="+1 555 0100"
/>
```

**Submit button disabled logic:**

```tsx
disabled={submitting || !name || !email || !phone}  // ✅ Phone required for submit
```

**Rationale:**

- Public event registration specifically needs phone numbers for contact purposes
- HTML5 validation provides immediate user feedback
- Button disabled state prevents submission without phone

---

## Other Areas Where Phone is Optional

### 1. Guest Management Page

**File:** `frontend/src/pages/GuestManage.tsx`

- Phone field has placeholder: "Enter your phone number (Optional)"
- No `required` attribute on input
- Guests can update their info without providing phone

### 2. Guest Registration Form Component

**File:** `frontend/src/components/guest/GuestRegistrationForm.tsx`

- Used by organizers to register guests
- Phone is not required
- Form can be submitted without phone

### 3. User Profile/Signup

**File:** `frontend/src/components/signup/ContactSection.tsx`

```tsx
<FormField
  label="Phone"
  name="phone"
  register={register}
  errors={errors}
  type="tel"
  placeholder="Enter your phone number"
  required={false} // ✅ Optional for user signup
/>
```

---

## Type Definitions

### Frontend

**File:** `frontend/src/types/publicEvent.ts`

```typescript
export interface PublicRegistrationPayload {
  roleId: string;
  attendee: {
    name: string;
    email: string;
    phone?: string; // ✅ Optional in type definition
  };
  consent: { termsAccepted: boolean };
}
```

### Backend

**File:** `backend/src/controllers/publicEventController.ts`

```typescript
interface PublicRegistrationBody {
  roleId?: string;
  attendee?: {
    name?: string;
    email?: string;
    phone?: string; // ✅ Optional in type definition
  };
  consent?: { termsAccepted?: boolean };
}
```

---

## Validation Summary

| Layer                       | Phone Requirement | Enforcement Method                     |
| --------------------------- | ----------------- | -------------------------------------- |
| **Database (MongoDB)**      | Optional          | `required: false` in schema            |
| **Backend API**             | Optional          | No validation check                    |
| **Frontend (Public Event)** | Required          | `required` attribute + button disabled |
| **Frontend (Guest Manage)** | Optional          | No validation                          |
| **Frontend (User Signup)**  | Optional          | `required={false}` prop                |

---

## Benefits of This Architecture

1. **Flexibility**: Different features can have different requirements
2. **Reusability**: Backend API works for multiple use cases
3. **User Experience**: Frontend can enforce requirements where needed
4. **Data Integrity**: Database accepts records with or without phone
5. **Future-proof**: Easy to add phone requirement to other forms if needed

---

## Test Coverage ✅

### Unit Tests

- ✅ `tests/unit/models/GuestRegistration.test.ts` - Verifies phone is optional
- ✅ `tests/unit/controllers/searchController.test.ts` - Fixed ID mapping

### Integration Tests

- ✅ All public registration tests include phone in payload
- ✅ Backend accepts registrations without phone validation error

### Frontend Tests

- ✅ `src/test/pages/PublicEvent.registration.test.tsx` - Tests include phone field
- ✅ `src/test/components/GuestRegistrationForm.test.tsx` - Allows submission without phone

---

## Migration Notes

**No database migration needed.** The `phone` field was always present in the schema, and changing `required: true` to `required: false` only affects new validations, not existing data.

---

## Related Files

### Models

- `backend/src/models/GuestRegistration.ts`

### Controllers

- `backend/src/controllers/publicEventController.ts`

### Frontend Pages

- `frontend/src/pages/PublicEvent.tsx`
- `frontend/src/pages/GuestManage.tsx`

### Frontend Components

- `frontend/src/components/guest/GuestRegistrationForm.tsx`
- `frontend/src/components/signup/ContactSection.tsx`

### Types

- `frontend/src/types/publicEvent.ts`

### Tests

- `backend/tests/unit/models/GuestRegistration.test.ts`
- `frontend/src/test/pages/PublicEvent.registration.test.tsx`
- `frontend/src/test/components/GuestRegistrationForm.test.tsx`

---

## Summary

✅ **Model**: Phone is optional (flexible database schema)  
✅ **Backend**: Phone is optional (flexible API)  
✅ **Frontend (Public Event)**: Phone is required (HTML5 validation)  
✅ **Frontend (Other areas)**: Phone is optional (no validation)  
✅ **All tests passing**: 508/508 tests ✓
