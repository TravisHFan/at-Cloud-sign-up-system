# Guest Registration Role Limit

**UPDATED: 2025-10-10** - Guest limit reduced to **1 role** per event.

A single guest (identified by email, **not authenticated**) may register for only **one (1)** role within the same event.

## Current Policy (2025-10-10)

| Registration Type       | Limit          | Notes                                      |
| ----------------------- | -------------- | ------------------------------------------ |
| **Email-only Guest**    | **1 role**     | Must create account for additional roles   |
| **Authenticated Users** | **Role-based** | See USER_ROLE_REGISTRATION_LIMIT_REPORT.md |

## Rationale

1. **Simplicity**: Single-role registration is straightforward for unauthenticated users
2. **Account Creation Incentive**: Encourages users to create accounts for multi-role participation
3. **Administrative Clarity**: Easier tracking and management of guest registrations
4. **Resource Optimization**: Prevents capacity hoarding by anonymous users

## Enforcement

- Application-layer validation counts active `GuestRegistration` documents per `(eventId, email)`
- Constant: `GUEST_MAX_ROLES_PER_EVENT = 1` (see `backend/src/middleware/guestValidation.ts`)
- Error Message: `This guest has reached the 1-role limit for this event.`

**Backend Files**:

- `backend/src/middleware/guestValidation.ts` - Validation logic
- `backend/src/controllers/publicEventController.ts` - Public registration enforcement

## Migration from Previous Policy

### Timeline

| Date           | Policy                    | Limit      |
| -------------- | ------------------------- | ---------- |
| **2025-10-01** | Multi-role guests allowed | 3 roles    |
| **2025-10-10** | **Single-role guests**    | **1 role** |

### Database Migration

No schema changes required. The `GUEST_MAX_ROLES_PER_EVENT` constant change automatically enforces the new limit.

Existing guests with multiple roles are **grandfathered** (not retroactively removed). New registrations are subject to the 1-role limit.

## Frontend Behavior

### Public Event Registration Page

**After 1st Role Registration**:

```
You've already registered for this event. If you need to change your role,
please contact the event organizer.
```

**Duplicate Registration** (same role):

- Returns success (idempotent)
- Message: "Already registered"

**Account Creation Prompt**:

```
Want to register for more roles?
Create an account to unlock additional role registrations!
```

### Admin/Organizer View

- Guest registrations show "Guest (Email Only)" badge
- Warning: "This guest can only register for 1 role"

## Testing

### Integration Tests

**File**: `backend/tests/integration/api/guest-one-role-limit.integration.test.ts`

Tests:

- ✅ Guest can register for 1 role successfully
- ✅ 2nd role registration blocked with 400 error
- ✅ Duplicate registration is idempotent (allowed)
- ✅ Different guest email can register for same role

**File**: `backend/tests/integration/api/public-events-register.integration.test.ts`

- Updated to reflect 1-role limit
- Tests idempotent behavior
- Tests error messaging

## Authenticated User Limits

For **authenticated users** (with accounts), limits are based on their role:

| User Role     | Limit        |
| ------------- | ------------ |
| Super Admin   | ♾️ Unlimited |
| Administrator | ♾️ Unlimited |
| Leader        | 5 roles      |
| Guest Expert  | 4 roles      |
| Participant   | 3 roles      |

See `docs/USER_ROLE_REGISTRATION_LIMIT_REPORT.md` for complete details.

## Workarounds for Multi-Role Guests

If a guest needs multiple roles:

1. **Create an Account**: Sign up for an account (becomes Participant with 3-role limit)
2. **Contact Organizer**: Request manual registration by event admin
3. **Role Migration**: Admin can convert guest registration to user registration

## Future Considerations

### Potential Enhancements

1. **Account Creation Flow Integration**

   - After 1st role registration, show "Create Account" button
   - Auto-migrate guest registration to user registration

2. **Per-Event Configuration**

   - Allow organizers to set custom guest limits (1-3 roles)
   - Event-specific guest multi-role permissions

3. **Guest Upgrade Path**

   - Seamless conversion from guest to authenticated user
   - Preserve existing registrations during upgrade

4. **Role Swapping**
   - Allow guests to swap roles (remove one, add another)
   - Maintain 1-role limit while providing flexibility

---

## Related Documentation

- `docs/USER_ROLE_REGISTRATION_LIMIT_REPORT.md` - Complete role-based limits
- `CHANGELOG.md` - Policy update history
- `backend/src/utils/roleRegistrationLimits.ts` - Implementation details
