# Changelog

## Unreleased

- Backend unit test asserts both `guest_updated` and `guest_moved` are emitted.
- Frontend adds a realtime test for the `guest_moved` notification.

- Sign themselves up for any role (subject only to capacity, duplicate prevention, event status)
- Invite any user to any role
- Assign users to roles without prior whitelist restrictions

### Fix: Unable to Remove Event Flyer in Edit Event

Previously, clearing the flyer URL in the Edit Event form and saving did not remove the existing flyer. The frontend omitted `flyerUrl` (sending `undefined`), so the backend preserved the stored value. There was also no explicit handling for `null` as a removal signal.

Changes:

- Backend (`eventController` update handler): Added normalization to treat `""` or `null` for `flyerUrl` as a removal request (coerced to `undefined` so the field is unset).
- Frontend (`EditEvent.tsx`): Submission logic now sends an explicit empty string (`""`) when the user clears a previously existing flyer, ensuring the backend receives a removal signal.
- Tests: Added integration test `events-flyerUrl-removal.integration.test.ts` covering three cases:
  - Create with flyer → update with `flyerUrl: ""` → removed
  - Create with flyer → update with `flyerUrl: null` → removed
  - Create with flyer → update without `flyerUrl` in payload → preserved

Outcome: Users can now reliably remove an event flyer from the Edit Event page.

Follow-ups (not yet implemented):

- Optional physical file deletion for orphaned uploads (needs tracking of whether flyer paths reference shared assets).
- UI affordance: Add a dedicated "Remove Flyer" button with confirm tooltip rather than relying on manual input clearing.

### Enhancement: Explicit Flyer Removal UI & Program Parity

- Frontend: Added "Remove" button beside flyer inputs in both Edit Event and Edit Program forms. Button clears the field and triggers submission of `flyerUrl: ""` when an original flyer existed.
- Backend: Existing normalization logic already supports removal; no further change required.
- Tests: Added frontend test `flyerRemoval.test.tsx` to assert `flyerUrl: ""` is sent after removal in the Edit Event form. (Program test can be added similarly if needed.)

Result: Flyer removal is now an intentional, visible action across events and programs.

Refinement: Implementation updated to send `null` (instead of `""`) for removal to simplify backend normalization and avoid any edge cases with future client-side empty string trimming.

### Fix: Public Event Share Modal Empty Short Link

Public event pages previously rendered an empty short link in the Share modal because the public event payload omitted the underlying event's ObjectId. The frontend `useShortLink` hook early-returned on a falsy `eventId`, so no ensure/create request was sent.

Changes:

- Backend: Added `id` (stringified ObjectId) to the public event serializer payload.
- Frontend: Extended `PublicEventData` interface with `id` and passed it to `ShareModal` (`PublicEvent.tsx`).
- Tests: Updated `public-events-get.integration.test.ts` to assert `data.id` exists and matches a 24-hex Mongo ObjectId pattern.

Outcome: Share modal now correctly auto-loads / creates a short link for public events.

### Policy Update: Reinstated Per-Event Role Cap (3)

After initial removal of all per-user role count limits (universal multi‑role participation), we introduced a balanced cap of **up to 3 roles per user per event** while retaining universal role visibility and eligibility. This guards against edge cases where a single user could occupy many critical roles (capacity hoarding / degraded collaboration clarity) while still enabling flexible multi-involvement (e.g. Speaker + Moderator + Tech Support).

Implementation Highlights:

- Backend: `eventController.signUpForEvent` now counts existing registrations for the (user,event) pair; a 4th distinct role attempt returns HTTP 400 with message `Role limit reached for this event (maximum 3 roles per user).` Count check occurs before lock acquisition to short‑circuit quickly.
- Tests: Added `participant-three-role-cap.integration.test.ts` (3 successful signups, 4th rejected). Updated existing multi‑role test to ensure it still passes under the new ceiling.
- Frontend: Introduced constant `maxRolesForUser = 3` in `EventDetail` and simplified reach-limit messaging (removed previous "unlimited" logic). Adjusted component tests replacing `Infinity` sentinels.
- Auth / Permissions: No change to universal visibility; permission requirements for event creation unchanged. Integration tests force `isVerified=true` and explicitly elevate admin test user roles to avoid email verification / default-role blockers.

Operational / Migration Notes:

- No data migration required; existing events & registrations remain valid. Users already holding >3 roles (if any from brief unlimited window) will not be auto-trimmed—additional role signups are simply blocked until they drop below the cap.
- Monitoring: If future events require higher limits (e.g. production + backup roles), consider promoting the cap to a configurable per-event override with an absolute safety ceiling.

Testing / Coverage:

- Integration coverage now asserts both open multi-role behavior (within 3) and enforcement boundary at 4.
- Frontend tests updated to reflect deterministic cap value (search for usages of `maxRolesForUser`).

Developer Guidance:

- When adding new role-based signup pathways (e.g. bulk assignment or role cloning), ensure they respect the same counting rule (`<= 3`). Centralization via a helper may be warranted if additional entrypoints grow.
