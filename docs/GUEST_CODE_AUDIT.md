# Guest Feature Audit and Cleanup Plan

Date: 2025-08-27
Scope: Backend and Frontend code paths related to guest registration, management, migration, counts, capacity, privacy, and UI copy.

Status at a glance

- Tests: Full backend and frontend suites passing via npm test.
- Env note: Test DB is localhost:27017/atcloud-signup-test.

## Overview

Guest functionality spans anonymous event sign-up, lifecycle emails, admin/organizer management, realtime updates, and post-signup self-service via manage links. Since the last audit, we:

- Centralized guest-related copy and privacy logic on the frontend and cleanly separated “inviter” vs “self-registration” flows.
- Introduced CapacityService to standardize occupancy and capacity logic, refactored guest endpoints to use it, and added unit tests.
- Adopted CapacityService in RegistrationQueryService.getRoleAvailability while preserving response shape; eventController retains legacy user-only checks per strict tests.
- Centralized realtime payload types per app (backend/src/types/realtime.ts and frontend/src/types/realtime.ts); repo-root shared/realtime.ts deprecated.
- Introduced EventSnapshotBuilder and refactored guestController and eventController call sites to use it; added focused unit tests.

## Inventory (by area)

- Backend

  - Controllers: GuestController (register/update/cancel/get by id/token, list event guests, move between roles), GuestMigrationController, EventController (user sign-up/move/assign; capacity checks remain user-only under locks)
  - Services: CapacityService (users/guests occupancy with includeGuests option), RegistrationQueryService (availability uses CapacityService), GuestMigrationService, EmailService (guest templates), DataIntegrityService (validations), MaintenanceScheduler
  - Routes: routes/guests.ts, routes/events.ts (move-guest), routes/guestMigration.ts
  - Models: GuestRegistration, Registration, Event
  - Realtime: SocketService emits typed updates for guest_registration, guest_updated, guest_cancellation, guest_moved; consumers updated accordingly.
  - Scripts: scripts/maintenance/purgeCancelledGuestRegistrations.ts

- Frontend
  - Pages: GuestRegistration, GuestConfirmation, guest views accessible via GuestSidebar, EventDetail updates via typed socket events
  - Components: GuestEventSignup, GuestRegistrationForm, EventRoleSignup
  - Utilities/Constants: utils/guestPrivacy.ts (centralized predicates), constants/guestCopy.ts (centralized copy)
  - Services: Generic API clients (Auth/Events/Notifications/System Messages) used across guest flows
  - Tests: Broad unit/integration/e2e coverage for privacy, realtime, capacity, copy, and navigation

## What changed since the previous audit

Done

- Frontend copy separation: Introduced a perspective prop ("self" | "inviter") and a showLimitations flag; restored self-registration copy to original tone; standardized first-person copy for self-registration.
- Centralization: Added constants/guestCopy.ts and utils/guestPrivacy.ts; refactored components to consume them; tests green.
- CapacityService: Implemented getRoleOccupancy(eventId, roleId, { includeGuests? }) and isRoleFull; robust numeric parsing and safe eventId casting; includeGuests defaults to true and supports user-only parity when needed.
- Guest endpoints: registerGuest and moveGuestBetweenRoles now use CapacityService for capacity checks; behavior preserved; tests green.
- Read model adoption: RegistrationQueryService.getRoleAvailability now uses CapacityService; return shape unchanged; tests green.
- Tests: Added unit tests for CapacityService including includeGuests=false behavior.
- Event snapshots: Added EventSnapshotBuilder; controllers now compose registration/guest snapshots via the builder; unit tests added.
- Realtime typing: Backend/frontend now import types from their local types/realtime modules; frontend relaxed EventUpdate.data to any and added safe casts at usage sites to satisfy type-check while we converge on stricter discriminated unions.

Deferred or unchanged

- EventController: Retains legacy, user-only count checks under application-level locks to satisfy strict test expectations (error precedence and status codes).
- Email templates: Not yet unified; shared partials/snapshot helpers still pending.
- Event snapshot builder: Extracted and adopted in controllers; further reuse in migration/emails planned.
- Guest API client wrapper (frontend): Still using generic clients; typed wrapper remains a nice-to-have.

## Findings and opportunities (updated)

1. Capacity/count logic duplication

- Current state: Centralized via CapacityService; guest endpoints and getRoleAvailability adopted. EventController intentionally left on user-only counts. CapacityService now supports includeGuests=false to enable parity where required.
- Next: Evaluate safe adoption in additional read-only services (e.g., selected query endpoints) without altering outputs. Keep EventController as-is unless explicitly migrating to user+guest semantics.

2. Event snapshot reuse

- Opportunity: Extract EventSnapshotBuilder for consistent fields (title/date/location/roleName/desc). Reuse in GuestMigrationService and email composition.

3. Realtime payload typing

- Current state: Per-app realtime type modules exist; SocketService (backend) and socketService (frontend) use them. Frontend uses any for EventUpdate.data pending stricter discriminated unions.
- Next: Evolve towards a discriminated union keyed by updateType; incrementally tighten types per update, update handlers, and add schema tests.

4. Email templates consolidation

- Opportunity: Introduce shared partials (event block, guest identity), unify subject builders, and ensure text-only fallbacks are consistent.

5. Validation layering

- Opportunity: Move rate-limit and uniqueness checks fully into dedicated middleware (guestValidation.ts), keeping GuestController thin and focused on side effects and orchestration.

6. Manage token lifecycle

- Opportunity: Centralize generation/extension/invalidation in a ManageTokenService; verify TTL index on manageTokenExpires and document it at the model top. Consider reducing cleanup script surface if TTL fully covers it.

7. Frontend counts and dedupe

- Current state: Role availability now depends on a backend path using CapacityService in RegistrationQueryService for combined counts.
- Opportunity: Ensure cards/lists rely on backend-provided counts to avoid local recomputation; document whether counts include guests.

8. Types and DTOs

- Opportunity: Generate shared types from OpenAPI or define explicit GuestRegistrationDTO and realtime payload schemas; apply across clients and tests.

9. Logging consistency

- Opportunity: Adopt structured logging with consistent prefixes for guest operations to improve observability.

10. Dead/remnant code checks

- Action: Confirmed repo-root shared/realtime.ts is unused; file now carries a deprecation stub and will be removed after a grace period. Reconfirm usage of purgeCancelledGuestRegistrations.ts once TTL is enforced; prune unused GuestSidebar links if any; ensure docs reflect that the limitations prompt is self-registration only (already enforced in code).

## Security & data integrity

- Ensure GuestRegistration public projection excludes PII appropriately; preserve admin vs non-admin views (tests already cover).
- Normalize email/phone before persistence and reuse shared validators.
- Indexes: Confirm per-event/role uniqueness for guest identity where required and TTL on manageTokenExpires; add compound indexes for common queries.

## Testing recommendations (incremental)

- CapacityService: Already has unit tests; add integration coverage for includeGuests=false where a controller explicitly requires user-only semantics.
- Manage link flows: Add tests for resend/rotation and expired token actions.
- Snapshot builder: Add unit tests when extracted to lock fields/format.
- Realtime schema: Add compact schema tests to enforce consistent payload shapes.

## Proposed cleanup plan (prioritized)

Short-term (S)

- Keep EventController logic unchanged; document rationale in code.
- Adopt CapacityService in additional read-only query paths where safe, with parity tests.
- Verify/manageTokenExpires TTL index and document at model header.
- Remove shared/realtime.ts after confirming no external imports; keep deprecation stub for one release cycle.
- Add 2-3 small schema tests for realtime payload shapes per updateType.

Medium (M)

- Move rate limit and uniqueness checks to middleware; slim GuestController.
- Extract EventSnapshotBuilder; start using in migration and email templates.
- Define and enforce typed realtime payloads; centralize emitters via a narrow SocketEmitter facade.
- Introduce a small guest-specific frontend API wrapper with typed methods.

Long-term (L)

- Generate shared types from OpenAPI for guest endpoints; adopt across frontend and tests.
- Consolidate email composition with partials and helpers; use snapshot-based subjects.
- Consider decomposing GuestController into narrower responsibilities as the system grows.

## Rollout and risk

- Favor behavior-preserving refactors; rely on the comprehensive suites; run npm test per repo standards.
- Add targeted unit tests around extracted utilities before switching all call sites.

## Ownership and tracking

- File issues for each item with S/M/L labels and link to tests.
- Track coverage deltas; maintain or improve coverage in each step per repository goals.

---

This audit reflects the current guest feature architecture, the refactors already completed (copy/privacy centralization and CapacityService adoption), and a pragmatic, staged plan for the remaining opportunities.
