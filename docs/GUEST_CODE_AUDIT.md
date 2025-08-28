# Guest Feature Audit and Cleanup Plan

Date: 2025-08-26
Scope: Backend and Frontend code paths related to guest registration, management, migration, counts, capacity, privacy, and UI copy.

Status at a glance

- Tests: Full backend and frontend suites passing via npm test.
- Env note: Test DB is localhost:27017/atcloud-signup-test.
- Realtime: Frontend discriminated unions now cover guest*\*, user*\*, workshop_topic_updated, role_full, role_available; focused unit tests added and passing. The all‑updateTypes contract test is now order‑agnostic.

## Overview

Guest functionality spans anonymous event sign-up, lifecycle emails, admin/organizer management, realtime updates, and post-signup self-service via manage links. Since the last audit, we:

- Centralized guest-related copy and privacy logic on the frontend and cleanly separated “inviter” vs “self-registration” flows.
- Introduced CapacityService to standardize occupancy and capacity logic, refactored guest endpoints to use it, and added unit tests.
- Adopted CapacityService in RegistrationQueryService.getRoleAvailability while preserving response shape; eventController retains legacy user-only checks per strict tests.
- Centralized realtime payload types per app (backend/src/types/realtime.ts and frontend/src/types/realtime.ts); repo-root shared/realtime.ts deprecated (stub remains, slated for removal).
- Introduced EventSnapshotBuilder and refactored guestController and eventController call sites to use it; added focused unit tests.
- Consolidated guest validation middleware and ensured token-route 404 precedence; tests updated and passing.
- Tightened frontend realtime typing: extended discriminated union to user\_\* and workshop_topic_updated, refactored EventDetail handlers/notifications accordingly, and added focused unit tests.

## Inventory (by area)

- Backend

  - Controllers: GuestController (register/update/cancel/get by id/token, list event guests, move between roles), GuestMigrationController, EventController (user sign-up/move/assign; capacity checks remain user-only under locks)
  - Services: CapacityService (users/guests occupancy with includeGuests option), RegistrationQueryService (availability uses CapacityService), GuestMigrationService, EmailService (guest templates), DataIntegrityService (validations), MaintenanceScheduler
  - Routes: routes/guests.ts, routes/events.ts (move-guest), routes/guestMigration.ts
  - Models: GuestRegistration, Registration, Event
  - Realtime: SocketService emits typed updates for guest_registration, guest_updated, guest_cancellation, guest_moved, user_assigned, role_full/available, workshop_topic_updated; consumers updated accordingly.
  - Scripts: scripts/maintenance/purgeCancelledGuestRegistrations.ts

- Frontend
  - Pages: GuestRegistration, GuestConfirmation, guest views accessible via GuestSidebar, EventDetail updates via typed socket events
  - Components: GuestEventSignup, GuestRegistrationForm, EventRoleSignup
  - Utilities/Constants: utils/guestPrivacy.ts (centralized predicates), constants/guestCopy.ts (centralized copy)
  - Services: GuestApi typed wrapper over the generic apiClient for guest endpoints; plus generic API clients (Auth/Events/Notifications/System Messages) used across flows
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
- Realtime typing: Implemented a discriminated union on the frontend for guest*\*, user*\*, and workshop_topic_updated; EventDetail uses typed branches (notifications + optional inline snapshots) for immediate UI feedback; unit tests cover these paths.
- Middleware consolidation: Guest validation centralized; token-route 404 precedence confirmed to avoid route shadowing; suite green.
- Frontend tests: Added small unit tests for user\_\* and workshop_topic_updated typed branches; all tests pass.

Deferred or unchanged

- EventController: Retains legacy, user-only count checks under application-level locks to satisfy strict test expectations (error precedence and status codes).
- Email templates: Not yet unified; shared partials/snapshot helpers still pending.
- Event snapshot builder: Extracted and adopted in controllers; further reuse in migration/emails planned. Policy: include minimal, non‑sensitive fields only; FE may apply and still refetch for privacy.
- Guest API client wrapper (frontend): Present as GuestApi (typed wrapper built on apiClient).

## Findings and opportunities (updated)

1. Capacity/count logic duplication

- Current state: Centralized via CapacityService; guest endpoints and getRoleAvailability adopted. EventController intentionally left on user-only counts. CapacityService now supports includeGuests=false to enable parity where required.
- Next: Evaluate safe adoption in additional read-only services (e.g., selected query endpoints) without altering outputs. Keep EventController as-is unless explicitly migrating to user+guest semantics.

2. Event snapshot reuse

- Opportunity: Extract EventSnapshotBuilder for consistent fields (title/date/location/roleName/desc). Reuse in GuestMigrationService and email composition.

3. Realtime payload typing

- Current state: Per-app realtime type modules exist; frontend now uses a discriminated union covering guest*\*, user*\*, and workshop_topic_updated with a safe fallback for unknown types.
- Next: Extend the union to remaining update types (if any), add compact schema tests to lock payload shapes, and align backend emitters/comments to the typed contract.

4. Email templates consolidation

- Opportunity: Introduce shared partials (event block, guest identity), unify subject builders, and ensure text-only fallbacks are consistent.

5. Validation layering

- Opportunity: Move rate-limit and uniqueness checks fully into dedicated middleware (guestValidation.ts), keeping GuestController thin and focused on side effects and orchestration.

6. Manage token lifecycle

- Current state: By design, there is no TTL index on manageTokenExpires; we keep the registration document and only invalidate the token fields. A MaintenanceScheduler periodically calls purgeExpiredManageTokens() to unset manageToken fields. Tests do not yet cover the scheduler path.
- Opportunity: Centralize generation/extension/invalidation in a small ManageTokenService; add unit/integration coverage for the purge path; ensure the scheduler is started once on app boot.

7. Frontend counts and dedupe

- Current state: Role availability now depends on a backend path using CapacityService in RegistrationQueryService for combined counts.
- Opportunity: Ensure cards/lists rely on backend-provided counts to avoid local recomputation; document whether counts include guests.

8. Types and DTOs

- Opportunity: Generate shared types from OpenAPI or define explicit GuestRegistrationDTO and realtime payload schemas; apply across clients and tests.

9. Logging consistency

- Opportunity: Adopt structured logging with consistent prefixes for guest operations to improve observability.

10. Dead/remnant code checks

- Action: Confirmed repo-root shared/realtime.ts is unused; file now carries a deprecation stub and will be removed after a grace period. The purgeCancelledGuestRegistrations.ts script remains valid alongside the no‑TTL token policy; prune unused GuestSidebar links if any; ensure docs reflect that the limitations prompt is self-registration only (already enforced in code).

## Security & data integrity

- Ensure GuestRegistration public projection excludes PII appropriately; preserve admin vs non-admin views (tests already cover).
- Normalize email/phone before persistence and reuse shared validators.
- Indexes: Confirm per-event uniqueness policy for guest identity (business rule is one active guest registration per event, irrespective of role). Add a compound unique index to enforce this at the DB level (eventId + email + status: "active") via a partialFilterExpression. Keep no TTL on manageTokenExpires; compound indexes for common queries already exist.

### Concurrency lock contract (guest flows)

- The application-level lock key for guest operations is unified to serialize competing actions per role:
  - Signup and move share: `guest-signup:${eventId}:${roleId}` where roleId is the destination role for the operation.
  - Guest signup uses the roleId being registered into.
- Implementation note: Our lock is in-memory by design (single-instance). Deployment must ensure a single backend process (no cluster/multiple replicas). A health endpoint exposes lock implementation and inferred worker count; see deployment checklist for env flags.
  - Guest move uses the toRoleId (target role) to ensure capacity checks and writes serialize with signups to that same role.
  - This contract is validated by integration tests: concurrent signup race, concurrent move race, and signup-vs-move race. One succeeds; others receive a friendly 400 (full capacity) without overflows.

## Testing recommendations (incremental)

- CapacityService: Already has unit tests; add integration coverage for includeGuests=false where a controller explicitly requires user-only semantics.
- Manage link flows: Add tests for resend/rotation and expired token actions.
- Snapshot builder: Add unit tests when extracted to lock fields/format.
- Realtime schema: Add compact schema tests to enforce consistent payload shapes.

## Proposed cleanup plan (prioritized)

Short-term (S)

- Keep EventController logic unchanged; document rationale in code.
- Adopt CapacityService in additional read-only query paths where safe, with parity tests.
- Enforce guest per-event uniqueness at DB level: add a compound unique index (eventId + email) with partialFilterExpression: { status: "active" }; add tests to confirm duplicate prevention and friendly error mapping.
- Maintain no‑TTL policy for manageTokenExpires; keep MaintenanceScheduler purge job. Add unit/integration tests covering purgeExpiredManageTokens and scheduler invocation.
- Remove shared/realtime.ts after confirming no external imports; keep deprecation stub for one release cycle (then delete).
- Add 2-3 small schema tests for realtime payload shapes per updateType.
- Add tests for manage link flows: resend (token rotation), updateByToken (rotation on success), and cancelByToken (404 on expired/invalid token).

Medium (M)

- Wire rate-limit and per-event uniqueness checks as dedicated middleware on the guest-signup route (currently invoked inside the controller). Keep GuestController focused on orchestration and side-effects.
- Reuse EventSnapshotBuilder inside GuestMigrationService and email composition to unify snapshot fields.
- Define and enforce typed realtime payloads end-to-end; centralize emitters via a small SocketEmitter facade.
- Extend the GuestApi wrapper with explicit DTO types for responses where missing; gradually adopt across UI surfaces.

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

## Recent delta

- Frontend: Made the all‑updateTypes contract test order‑agnostic to prevent brittle index assertions.
- Backend: Added unit tests to preserve inline event snapshots for user_moved, guest_moved, and user_assigned; added minimal payload parity test for role_available (alongside role_full).
