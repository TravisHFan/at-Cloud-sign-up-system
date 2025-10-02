# Guest Registration Role Limit

Effective 2025-10-01, a single guest (identified by email) may register for up to **three (3)** active roles within the same event.

## Rationale

Some events benefit from allowing a guest to (for example) attend as a participant and also serve a supporting role (e.g., reader, helper). A strict single-role limit prevented legitimate multi-role participation.

## Enforcement

- Former unique partial index on `{ eventId, email, status: 'active' }` was removed.
- Application-layer validation now counts active `GuestRegistration` documents per `(eventId, email)` and rejects the 4th attempt.
- Constant: `GUEST_MAX_ROLES_PER_EVENT = 3` (see `backend/src/middleware/guestValidation.ts`).
- Error Message (backend & surfaced in UI): `This guest has reached the 3-role limit for this event.`

## Migration Note

Ensure the legacy index is dropped in production:

```
db.guestregistrations.dropIndex('uniq_active_guest_per_event')
```

(If the index name differs, run `db.guestregistrations.getIndexes()` to confirm.)

## Frontend Behavior

- Public event registration duplicate copy: "Already registered for this role" (still shown for per-role duplicates where total < 3).
- Guest invitation / registration form surfaces the 3-role limit message when the backend returns the limit error.

## Testing

- Middleware unit tests cover count-based validation logic.
- Model index test updated to reflect removal of uniqueness and allowance for multiple active documents.
- E2E guest signup rejection test updated to assert 3-role limit messaging.

## Future Considerations

- Add per-event configuration to vary the guest multi-role limit.
- Expose remaining role slots (e.g., "You may select 2 more roles") after first successful registration.
