# 🧪 Last Updated: August 10, 2025 (unit coverage snapshot)

## Quick status

- Unit run: all tests green (latest: 1,974 tests)
- Coverage (v8, unit): 95.75% statements, 92.02% branches, 96.64% funcs, 95.75% lines

Recent wins

- auth.ts ≈98% S / ≈95% B
- NotificationErrorHandler.ts ≈93.5% S / ≈93.6% B (recovery/circuit-breaker edge coverage)
- autoEmailNotificationService.ts 100% statements / 86.66% branches
- TrioNotificationService.ts ≈99.6% S / ≈91.9% B (websocket-all-fail rollback, rollback-disabled, unknown-template retry, template mappings)
- emailRecipientUtils.ts branches 95.12% (organizerDetails undefined, createdBy variants, empty co-organizers, userByEmail hit, getUserById not-found, snapshot name defaults, legacy filtered-out)
- CacheService.ts 95.02% S / 92.13% B (added getOrSet error path, cache-after-fetch failure warning, critical health, metrics-disabled, eviction early-return)
- TrioTransaction.ts 98.5% S / 92.15% B (rollback-after-commit guard, add-after-rollback guard, ongoing duration, summary error inclusion, history limit/trimming)
- Controller uplifts:
  - eventController.ts 91.30% branches (93.05% statements) — covered background co‑organizer notification Promise.all then-paths in create/update; added getUserEvents stats/dedup/snapshot‑fallback and deleteEvent cache‑invalidations
  - unifiedMessageController.ts 86.46% branches (85.88% statements)
- Message.ts 99.63% S / 96.77% B (state normalization, inactivation/expiration, Map vs object userStates, moderation flags)
- monitor.ts 100% across; system.ts 100% branches
- rateLimiting.ts 99.28% S / 95.83% B; upload.ts 100% across

Current branch hotspots

- emailService.ts (infrastructure) — 83.87% branches (statements 100.00%)
- unifiedMessageController.ts — 86.46% branches (85.88% statements)
- eventController.ts — 91.30% branches (93.05% statements)
- models/Registration.ts — 96.66% branches (statements 100.00%)

## Short-term sprint (next 1–2 hours)

- Controller uplift: eventController.ts — met ≥88% B and exceeded ≥88% S. Remaining micro-edges are narrow (select guards and rare catch logs). We’ve now covered combined filters, sort variants, pagination last/next flags, countDocuments/ResponseBuilder error paths, getUserEvents 500, removeUserFromRole/moveUserBetweenRoles outer-catch 500s, signUpForEvent outer-catch timeout (400) and unknown error (500), unauthenticated 401s for getUserEvents/getCreatedEvents, and background co‑organizer notifications .then paths in create/update.
- Controller uplift: unifiedMessageController.ts — ACHIEVED ≥85% B. Recently added error-path tests: markBellNotificationAsRead save throws; markAllBellNotificationsAsRead save throws; removeBellNotification findById/save throws; getUnreadCounts 500.
- Optional infra: emailService.ts — selectively cover template fallback and provider error mapping, plus timeout branches, aiming toward ≥85% B.
- Model uplift achieved: Message.ts now 99.63% S / 96.77% B.

Expected outcome: We’re now at 91.88% branches; another +0.2–0.5pp is realistic by polishing remaining controller micro-edges. Infra remains stable.

### Run notes (avoiding “skipped” suites)

- If you see output like “1 passed | many skipped”, you likely ran a filtered test or have a focused test (.only) somewhere.
- Run full unit suite: backend → npm run -s test:unit
- Run unit coverage: backend → npm run -s test:coverage:unit
- If still skipped, search for focus flags: grep -R "\.only(" backend/tests

### Next sprint checklist

- [x] EmailService: cover promotion/demotion major branches (done earlier)
- [x] AutoEmailNotificationService: ≥85% branches (done)
- [x] TrioNotificationService: more branches (done)
- [x] emailRecipientUtils: ≥90% branches (now 95.12%)
- [x] CacheService: ≥85% branches (now 92.13%)
- [x] TrioTransaction: ≥85% branches (now 92.15%)
- [x] Re-run coverage and log deltas above
- [x] eventController.ts: add tests for remaining error/edge branches (target ≥88% B, ≥88% S) — reached 88.35% B / 92.11% S
- [x] eventController.ts: add tests for remaining error/edge branches (target ≥88% B, ≥88% S) — now 91.30% B / 93.05% S
- [x] unifiedMessageController.ts: remaining error branches (target ≥85% B) — now 86.46% B
- [x] Message.ts model: state transitions and edge cases (now 99.63% S)

Next targets

- [ ] eventController.ts: raise branches and statements as above
- [x] unifiedMessageController.ts: raise branches ≥85% (done)
- [x] Registration.ts model: statements/branches uplift (now 100% S / 96.66% B)
- [ ] Optional: emailRecipientUtils tiny residuals (lines 88, 98) if trivial

## Near-term (1–2 days)

- Round out infra services (emailService env/backoff paths) and close utils gaps
- Controllers and models (Message, Registration) statement uplift via focused tests
- Optional: imageCompression remaining branch to 100%

## Quality gates

- Keep all tests green, no prod changes for testability
- Prefer isolated unit tests with deterministic mocks
- Use coverage to spot dead code; remove only when truly unreachable

## Path to an industrial‑standard test suite (step‑by‑step)

Principles we’ll enforce

- Don’t bend production to make tests pass; fix tests only if they violated intended design
- Study code first; author tests that describe behavior and expected outcomes
- Know the scripts: unit, integration, e2e, coverage

Phase 1 — Unit coverage polish (now → +1 week)

- Controllers: eventController (≥88% B/≥88% S), unifiedMessageController (≥85% B)
- Models: Message.ts statements ≥85%; add tests for expire/inactivate, state normalization, moderation flags
- Infrastructure: emailService.ts branches ≥85% via template/error/timeout branches
- Utilities: close tiny residuals only when they add real value

Phase 2 — Integration tests (selective, fast)

- Harness: start Express app with route modules, inject mocked models/services (no real Mongo)
- Cover 6–10 high‑value paths end‑to‑end within the app boundary:
  - Events: GET /events (combined filters/pagination), POST /events (happy + validation fail), GET /events/:id (404 and success)
  - Messaging: GET /messages (userStates Map/object), mark/read/delete flows (assert cache invalidations)
  - Auth/core: a protected route happy + denied
- Verify payload shape, status codes, and side‑effects (spies on CachePatterns, ResponseBuilderService)

Phase 3 — E2E flows (thin, critical paths)

- Supertest against built app with minimal seed fixtures (mocked models)
- Flows:
  - Auth sign‑in → access protected route
  - Event lifecycle: create → list with filters/pagination → get by id → observe status update side‑effects
  - Messaging lifecycle: create targeted → bell notifications unread count → mark as read/remove
- Keep E2E count small, deterministic, and fast; avoid real network/DB

Phase 4 — CI gates and thresholds

- Add CI steps: lint, type‑check, unit, integration, coverage summary
- Set initial coverage thresholds (global): S 92% / B 90% / F 95% / L 92%
- Raise gradually as hotspots improve: target S 95% / B 93% / F 97% / L 95%
- Fail PRs on test failures; block merges on threshold regressions

Phase 5 — Fixtures, factories, and flake control

- Introduce simple factories/builders for Events, Users, Registrations for reuse
- Standardize fake timers for retry/timeout tests; ban real sleeps
- Centralize common mocks (CachePatterns, ResponseBuilderService) in test utils
- Document Map vs object userStates patterns and provide helpers

Phase 6 — Documentation and maintenance

- Add TESTING.md: how to run unit/integration/e2e/coverage, mocking conventions, timers, and debugging tips
- Maintain TEST_COVERAGE_ROADMAP.md with updated targets and deltas after each milestone
- Use coverage to identify dead code; remove only when confirmed unreachable in production paths

Milestones and acceptance criteria

- M1 (Controllers + Models): eventController ≥88% B, unifiedMessageController ≥85% B, Message.ts ≥85% S
- M2 (Integration thin‑slice): 6–10 integration tests green, cover the listed routes, run < 10s locally
- M3 (E2E thin‑slice): 3–5 critical flows green and stable; no flakes across 3 consecutive CI runs
- M4 (Gates): CI thresholds enforced at S 92 / B 90 / F 95 / L 92; plan to raise after M3

## Files added (unit tests) — purpose

- backend/tests/unit/services/infrastructure/EmailService.promotion-to-user.coverage.test.ts — cover promotion Leader/Admin/default content branches.
- backend/tests/unit/services/infrastructure/EmailService.demotion-to-user.more-branches.test.ts — cover demotion-to-user Leader/default themes and reason block presence/absence.
- backend/tests/unit/services/infrastructure/autoEmailNotificationService.more-cases.test.ts — cover demotion user-email catch, admin-recipient rejection catch, promotion with zero admin recipients, @Cloud removed mixed results (fulfilled true + false), non-fallback author fields, and outer-catch invalid input.

New in this sprint:

- backend/tests/unit/services/infrastructure/CacheService.test.ts — added error-path and health metrics tests (get() error treated as miss, post-fetch cache failure warning, metrics disabled, critical health, eviction early-return).
- backend/tests/unit/services/notifications/TrioTransaction.test.ts — added guards and manager history tests (rollback-after-commit, add-after-rollback, ongoing duration, summary error, history limit/trimming).
- backend/tests/unit/controllers/eventController.test.ts — added signUpForEvent outer-catch timeout (400) and unknown error (500); added unauthenticated 401 and DB error 500 tests for getUserEvents/getCreatedEvents; plus two micro-tests covering background Promise.all .then aggregation for co‑organizer notifications in createEvent and updateEvent.
- backend/tests/unit/models/Registration.getEventStats.test.ts — unit test for static aggregation result processing (totals and per-role mapping).
- backend/tests/unit/services/infrastructure/EmailService.reminder-branches.test.ts — covers Online/Hybrid/In‑person branches in sendEventReminderEmail (HTML/text formatting assertions).

Additional in this sprint (branch uplifts):

- backend/tests/unit/models/Registration.getEventStats.defaults.test.ts — covers default zeros for missing statuses and per-role activeCount default.
- backend/tests/unit/models/Registration.methods.test.ts — exercises updateNotes, changeRole (audit + save), and confirmAttendance error path.
- backend/tests/unit/models/Registration.presave.test.ts — asserts pre-save audit entry on first save without DB connection.
- backend/tests/unit/services/infrastructure/EmailService.sendEmail.branches.test.ts — covers test-env short-circuit, jsonTransport development path, and error catch path.
- backend/tests/unit/services/infrastructure/EmailService.eventCreated-branches.test.ts — covers zoomLink conditional section in event-created template.
- backend/tests/unit/services/infrastructure/EmailService.demotion-critical-branches.test.ts — covers Critical impact branch (Security Review button) and reason-dependent oversight list item.
- backend/tests/unit/services/infrastructure/EmailService.coOrganizerNameFallback.test.ts — ensures co-organizer assignment email formats names without undefined/double-space artifacts when first/last are missing.
- backend/tests/unit/services/infrastructure/EmailService.demotion-no-critical-branch.test.ts — verifies non-Critical demotion path omits the Security Review button.
- backend/tests/unit/services/infrastructure/EmailService.role-change-admin-url-branch.test.ts — verifies FRONTEND_URL fallback vs custom URLs in role change email links.

Added just now:

- backend/tests/unit/services/infrastructure/EmailService.role-change-to-admins-url-branch.test.ts — admin role-change email links: default localhost vs custom FRONTEND_URL.
- backend/tests/unit/services/infrastructure/EmailService.role-removed-to-admins-url-branch.test.ts — admin role-removed email link uses custom FRONTEND_URL branch.
- backend/tests/unit/services/infrastructure/EmailService.new-leader-signup-name-fallback.test.ts — leaderName fallback when first/last missing; subject formatting; asserts ADMIN_DASHBOARD_URL placeholders present in HTML buttons.

Additional just now:

- backend/tests/unit/services/infrastructure/EmailService.role-removed-to-admins-url-branch.test.ts — adds default localhost fallback branch coverage.
- backend/tests/unit/services/infrastructure/EmailService.role-assigned-to-admins-url-branch.test.ts — covers default localhost and custom FRONTEND_URL branches for admin assignment email.

Updated in this sprint:

- backend/tests/unit/controllers/eventController.test.ts — added two micro-tests to close filter/sort gaps:
  - maxParticipants-only filter sets totalSlots $lte correctly
  - default ascending date sort when sort params are omitted
  - new error-paths: getUserEvents database error → 500; removeUserFromRole save failure → 500; moveUserBetweenRoles non-capacity error → 500
  - outer-catch polish: signUpForEvent timeout → 400; unknown error → 500
  - auth polish: 401 unauthenticated coverage for getUserEvents/getCreatedEvents
  - background polish: create/update co‑organizer notifications Promise.all .then paths now exercised
  - getUserEvents stats/dedup/snapshot‑fallback, endTime vs time classification; deleteEvent cache invalidations for cascade and non‑cascade paths

Coverage delta (since previous snapshot):

- Overall: -0.02pp statements (95.77 → 95.75), +0.10pp branches (91.71 → 91.81), +0.00pp funcs (96.64 → 96.64), -0.02pp lines (95.77 → 95.75)
- emailService.ts: branch uplift 78.72% → 80.31% from added demotion-critical and name-fallback tests
- eventController.ts: unchanged at 91.30% branches, 93.05% statements
- Registration.ts: unchanged at 100% S / 96.66% B

New coverage delta (latest run):

- Overall: +0.02pp statements (95.75 → 95.77), +0.07pp branches (91.81 → 91.88), +0.00pp funcs (96.64 → 96.64), +0.02pp lines (95.75 → 95.77)
- emailService.ts: branch uplift 80.31% → 81.18% from added non-Critical demotion and FRONTEND_URL link tests

Latest coverage delta (unit run):

- Overall: -0.02pp statements (95.77 → 95.75), +0.07pp branches (91.88 → 91.95), +0.00pp funcs (96.64 → 96.64), -0.02pp lines (95.77 → 95.75)
- emailService.ts: branch uplift 81.18% → 82.79% from three admin/new-leader micro-tests added now

Newest coverage delta (unit run):

- Overall: +0.00pp statements (95.75 → 95.75), +0.07pp branches (91.95 → 92.02), +0.00pp funcs (96.64 → 96.64), +0.00pp lines (95.75 → 95.75)
- emailService.ts: branch uplift 82.79% → 83.87% from admin URL tests (role-assigned default/custom and role-removed default)
- eventController.ts: unchanged at 91.30% branches / 93.05% statements
