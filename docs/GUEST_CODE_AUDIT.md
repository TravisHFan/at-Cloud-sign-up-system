# Guest Feature Audit and Cleanup Plan

Date: 2025-08-25
Scope: Backend and Frontend code paths related to guest registration, management, migration, counts, and UI.

## Overview

Guest functionality spans anonymous event sign-up, lifecycle emails, admin/organizer management, realtime updates, and post-signup self-service via manage links. Recent work added clearer copy and separated inviter vs self flows on the frontend, plus explicit `guest_moved` realtime semantics on the backend.

## Inventory (by area)

- Backend

  - Controllers: `GuestController` (register/update/cancel/get by id/token, list event guests, move between roles), `GuestMigrationController`
  - Services: `GuestMigrationService`, `EmailService` (guest templates), `RegistrationQueryService` (guest counts), `DataIntegrityService` (guest counts validation), `MaintenanceScheduler` (purge expired guest tokens)
  - Routes: `routes/guests.ts`, `routes/events.ts` (move-guest), `routes/guestMigration.ts`
  - Models: `GuestRegistration` (referenced broadly)
  - Realtime: `socketService.emitEventUpdate` with events `guest_registration`, `guest_updated`, `guest_cancellation`, `guest_moved`
  - Scripts: `scripts/maintenance/purgeCancelledGuestRegistrations.ts`

- Frontend
  - Pages: `GuestRegistration`, `GuestConfirmation`, guest dashboard pages (see `GuestSidebar` links)
  - Components: `GuestEventSignup`, `GuestRegistrationForm`, `EventRoleSignup` (guest counts, in-slot guests)
  - Layouts: `GuestSidebar`
  - Services: API calls embedded in generic clients (Auth/Events/Notifications/System Messages); guest-specific client wrappers are minimal
  - Tests: Strong coverage across unit/integration/e2e including privacy, realtime, capacity, copy, navigation

## Findings and opportunities

1. Capacity/count logic duplicated

- Where: `GuestController.registerGuest`, `GuestController.moveGuestBetweenRoles`, `RegistrationQueryService`, `DataIntegrityService`.
- Symptom: Similar logic to combine user registration counts + guest counts and compare with capacity.
- Risk: Drift between implementations; harder to change business rules.
- Action: Extract a `CapacityService` with a single `getRoleOccupancy(eventId, roleId)` and `isRoleFull(occupancy)` consumed by controllers/services.

2. Event snapshot building duplicated

- Where: `GuestMigrationService` builds snapshots (title/date/location/roleName/desc); similar enrichment may happen elsewhere when emitting events/emails.
- Action: Extract `EventSnapshotBuilder` utility for consistent snapshot fields; reuse in migration and email builders.

3. Realtime payload shape inconsistency potential

- Events: `guest_registration`, `guest_updated`, `guest_cancellation`, `guest_moved` carry overlapping but not guaranteed identical fields.
- Action: Define a typed union for guest update payloads in backend, centralize emitters to ensure consistent `eventId`, `roleId`, `guestName` and optional `fromRoleId/toRoleId`.

4. Email templates fragmentation

- Where: `EmailService.sendGuestConfirmationEmail`, `sendGuestRegistrationNotification`, role-removed/moved emails.
- Action: Introduce shared partials for event blocks and guest identity; parameterize templates; ensure text fallbacks are uniform. Consider moving subject line composition to a helper.

5. Rate limit and uniqueness checks coupling

- Where: `GuestController.registerGuest` calls `validateGuestRateLimit` and `validateGuestUniqueness` directly; route-level middleware partially applied.
- Action: Move all request preconditions to middleware (`guestValidation.ts`) and keep controller lean; controllers should assume validated input/state.

6. Manage token lifecycle consolidation

- Where: token generation on save, resend-manage-link, TTL/cleanup in `MaintenanceScheduler` and model statics.
- Action: Centralize in `ManageTokenService` (generate, extend, invalidate, TTL index verification); ensure model has TTL index on `manageTokenExpires` to reduce manual cleanup.

7. Guest counts in role cards (frontend) vs backend-calculated

- `EventRoleSignup` displays guest counts and navigates to guest registration.
- Action: Prefer backend-provided counts in event payload to avoid re-query; ensure shape documents that `includes guests` is accurate and dedupes any local recompute.

8. Privacy predicate duplication (frontend)

- `EventRoleSignup` computes whether to show guest contact based on viewer and event type; privacy tests exist.
- Action: Extract `guestPrivacy.ts` utility used by components and tests to keep consistent rules.

9. Copy and labeling centralization

- Recent fix added a `perspective` prop to forms to separate inviter vs self flows.
- Action: Centralize copy strings in a small constants module (or i18n) to avoid selector brittleness in tests and future wording changes.

10. Types and DTO consistency

- Frontend types for guest payloads are inferred/ad-hoc.
- Action: Generate types from backend OpenAPI swagger (already includes guest migration) or define `GuestRegistrationDTO` and event update payload types in a shared schema; enforce in clients and tests.

11. Logging consistency

- Mixed `console.error`/`console.warn` message styles in controllers.
- Action: Use a logger with consistent prefixes and structured metadata for guest operations.

12. Dead code/remnants candidates

- Script: `purgeCancelledGuestRegistrations.ts` may be redundant if cancellations are soft-deleted or if a TTL is used; verify usage frequency and keep if needed.
- Frontend: Ensure guest dashboard routes actually exist for all `GuestSidebar` links; remove or hide if not in use.
- Docs: Ensure any old references to “guest self-registration limitations prompt” align with the current behavior (shown only on self-registration).

## Security & data integrity

- Ensure `toPublicJSON()` on `GuestRegistration` excludes PII where needed; tests cover admin vs non-admin views—keep them green when refactoring.
- Validate normalization for phone/email before persistence; centralize in model or service.
- Confirm indexes: email uniqueness per event role (for guest), TTL on `manageTokenExpires`, and helpful compound indexes for frequent queries.

## Testing recommendations

- Add tests for:
  - Manage link resend flows when a previous token exists (rotation semantics already partially covered—add explicit rotation vs reuse behavior).
  - Expired token update/cancel attempts.
  - Capacity boundary conditions exercised via the new `CapacityService` (unit + integration), including guests-only, users-only, and mixed counts.
  - Snapshot builder unit tests to lock in fields/formats.
  - Realtime payload typing (schema test) to ensure consistent shape across events.

## Proposed cleanup plan (prioritized)

Short-term (S)

- Extract `guestPrivacy.ts` frontend util and switch existing components/tests to use it.
- Centralize frontend copy for Guest flows in a small constants module; update selectors in tests to use data-testid where needed.
- Create backend `CapacityService` with existing logic moved from `GuestController.registerGuest` and `moveGuestBetweenRoles`; wire both to it (no behavior change).
- Add/verify TTL index on `manageTokenExpires`; document in model file header.

Medium (M)

- Move rate limit and uniqueness checks fully into `guestValidation` middleware; slim down `GuestController`.
- Extract `EventSnapshotBuilder` and update `GuestMigrationService` to use it; align email templates to consume the same snapshot.
- Define typed payload schema for guest realtime events and centralize emission.
- Add guest-specific API client wrapper in frontend (typed methods for signup, manage, event guests) and consolidate ad-hoc calls.

Long-term (L)

- Generate shared TypeScript types from OpenAPI for guest endpoints; adopt across frontend.
- Consider splitting `GuestController` into smaller controllers/services by responsibility (signup, manage, admin ops) to reduce surface.
- Unify email composition via template partials and helper functions; add snapshot-based subjects.

## Risk & rollout notes

- Favor pure refactors with unchanged behavior; rely on the existing comprehensive tests. Stage changes (S → M → L) and run `npm test` per repo standards.
- Add targeted unit tests around any extracted utilities before swapping call sites.

## Ownership and follow-up

- Create GitHub issues for each item with size labels (S/M/L) and link to relevant tests.
- Track coverage deltas to ensure refactors keep or improve coverage, per repo goals.

---

This audit summarizes the guest feature surface, highlights duplication and cleanup targets, and proposes a pragmatic refactor plan aligned with the project’s strong test suite.
