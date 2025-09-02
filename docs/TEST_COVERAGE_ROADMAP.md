# 🧪 Last Updated: September 2, 2025 (full suite snapshot)

## 2025-09-02 — Full repo green; participant analytics + workshop roles stable

- Full repo tests: PASS (npm test). Backend integration passed (48 files, 255 tests). Frontend passed (85 files, 276 tests, 2 skipped).
- Perf baselines (from run output): export_json_ms ≈ 8; export_xlsx_ms ≈ 9.
- Rate limiting emergency-disable path: integration test passed; the earlier transient HTTP parse error did not reproduce.
- Frontend: minor manual edits to three tests for stability/readability (profile avatar protections, SystemMessages hash-highlight duration, SystemMessages hash-anchor markRead). Suites remain deterministic.
- Quality gates: PASS (root verify: lint + type-check clean).

## 2025-09-01 — Workshop roles update + participant analytics no-toast; full repo green

- Full repo tests: PASS (npm test). Backend integration passed (48 files, 255 tests). Frontend passed (83 files, 274 tests, 2 skipped).
- Effective Communication Workshop roles updated across backend and frontend templates:
  - Renamed: “Main Mentor” → “Opening Keynote Speaker”; “Co-coach” → “Evaluators”.
  - Added: “Closing Keynote Speaker”, “Content Master”, “Meeting Timer” (each max 1).
- Tests added:
  - Backend: tests/unit/config/eventTemplates.workshop.test.ts.
  - Frontend: src/test/config/workshopRoles.updated.test.ts.
- Participant UX: suppressed unauthorized analytics error toasts for Participants; page shows Access Restricted message only.
  - Frontend test: src/test/auth/analytics.no-toast.participant.test.tsx ensures { enabled: false, suppressAuthErrors: true } and no toast.
- Icons: replaced Participant-facing warning icons with shield/lock variants.
- Perf baselines unchanged: export_json_ms ≈ 5–6; export_xlsx_ms ≈ 8–9.

## 2025-09-01 — Participant visibility (Create Event + Analytics) enabled; full repo green

- Full repo tests: PASS (npm test). Backend integration passed (48 files, 255 tests). Frontend passed (83 files, 274 tests, 2 skipped).
- Visibility changes (frontend):
  - Sidebar/routes allow Participants to navigate to Create Event and Analytics.
  - RecurringEventConfig: shows an access overlay and disables controls for Participants.
  - Analytics: continues to show Access Restricted with a guidance line for Participants.
- Tests: suites remained green without adjustments; consider adding overlay-specific assertions (disabled controls, notice text) as a follow-up.
- Perf baselines (this run):
  - export_json_ms ≈ 5
  - export_xlsx_ms ≈ 8
- Next: add overlay tests for Create Event gating and assert guidance line on Analytics.

## 2025-09-01 — SystemMessages a11y + highlight-duration tests; full repo green

- Full repo tests: PASS (npm test). Backend integration passed (48 files, 255 tests). Frontend passed (83 files, 274 tests, 2 skipped).
- New tests (frontend):
  - SystemMessages.a11y.snapshot verifies page heading and accessible CTA link.
  - SystemMessages.hash-highlight.duration validates temporary highlight classes are applied then removed after ~2s without flakes.
- Stabilization: used a scoped scrollIntoView polyfill where needed and avoided fake timers where they caused hangs; real timers + waitFor ensured deterministic behavior.
- Perf baselines unchanged in this run:
  - export_json_ms ≈ 4 (seeded default)
  - export_xlsx_ms ≈ 9 (seeded, 30d window)
- Ops visibility unchanged: schedulerEnabled echoed in GET /api/system/health; scheduler endpoints tested.
- Next: cover routing edge cases (non-existent hash id; ensure no re-trigger after hash clear) and add a11y snapshots for one more key page.

## 2025-09-01 — SystemMessages hash-anchor scroll/read test; full repo green

- Full repo tests: PASS (npm test). Backend integration passed (48 files, 255 tests). Frontend passed (81 files, 272 tests, 2 skipped).
- New test: SystemMessages.hash-anchor.markRead ensures URL hash (#<id>) scrolls into view, marks the message as read, applies a brief highlight, and clears the hash to avoid re-trigger.
  - Stabilization: added a local scrollIntoView polyfill in the test and wrapped the render in AuthProvider to satisfy modal dependencies.
- Perf baselines unchanged or slightly better in this run:
  - export_json_ms ≈ 4 (seeded, json default)
  - export_xlsx_ms ≈ 9 (seeded, ranged + row cap)
- Ops endpoints remain verified (schedulerEnabled echoed in GET /api/system/health and status in GET /api/system/scheduler; admin-only POST /api/system/scheduler/manual-trigger).
- Next tiny wins: lightweight a11y snapshot for a key page and broaden SystemMessages routing/highlight duration tests.

## 2025-09-01 — Frontend bell dropdown link test added; full repo green

- Full repo tests: PASS (root npm test). Backend integration passed (48 files, 255 tests). Frontend passed (80 files, 271 tests, 2 skipped).
- New test: EnhancedNotificationDropdown system message click marks as read and navigates to /dashboard/system-messages#<id>.
  - Stabilization: mocked useNavigate before import and clicked the correct clickable container; assertions awaited asynchronously.
- Perf baselines unchanged (export_json_ms ≈ 6–7, export_xlsx_ms ≈ 9).
- Next: lightweight a11y snapshot for a key page and SystemMessages hash/scroll handling tests.

## 2025-09-01 — Phase 4 closed (Option A), frontend auth-gating test added

- Full repo tests: PASS (root npm test). Backend integration suites and frontend unit/integration remained green.
- Phase 4 (Scheduler + locking safety) marked Done with Option A only:
  - Env guard and unit test, schedulerEnabled surfaced in /api/system/scheduler, admin-only manual trigger POST /api/system/scheduler/manual-trigger with 200/401/403 tests, docs updated.
- Frontend uplift started (Phase 5 prep):
  - Added Analytics page auth-gating test asserting non-privileged users see the Access Restricted message.
- Next: expand frontend coverage on protected routes and profile flows; keep using npm test at root.

# 🧪 Last Updated: September 1, 2025 (full suite snapshot)

## 2025-08-31 — Full repo green + stable analytics perf baselines

- Backend integration: 44 files, 246 tests passed; no Mongoose duplicate-index warnings after cleanup (User {isActive,lastLogin}, Registration {eventId,status,createdAt}).
- Frontend: 73 files, 258 tests passed, 2 skipped; realtime and profile flows stable under jsdom with socket/fetch stubs.
- Perf smoke baselines (local): export_json_ms ≈ 6, export_xlsx_ms ≈ 9 (unchanged from prior run).
- Quality gates: PASS (root npm test, verify: lint + type-check green across backend and frontend).

Small follow-up

- Adjusted unit tests for EventReminderScheduler.getStatus to assert only isRunning, accommodating extended status fields (uptime, lastRunAt, lastProcessedCount, runs, lastErrorAt). Integration endpoint test already validated the richer payload.

Analytics explain/perf uplift (today)

- Explain-plan tests hardened to ensure live DB connection and index sync; added seeded executionStats checks to watch totalDocsExamined/totalKeysExamined/nReturned on key queries (Users weeklyChurch, Events status/format/date, Registrations recent activity). We assert IXSCAN and guard against COLLSCAN.
- Added CSV streaming path (analytics export: format=csv&mode=rows) with integration test; introduced a scheduler health endpoint (GET /api/system/scheduler) and a basic integration test.

Next small deltas

- Extend seeded perf tests to capture query counts alongside latency for analytics export.
- Consider CSV streaming path for very large exports; keep generous budgets to avoid flakes.
- Monitor for any index drift; confirm explain plans keep IXSCAN on weeklyChurch/format/createdAt and compound paths.

## 2025-08-18 — Guest registration capacity precedence fix (suite-stable)

- Full pipeline green (backend unit + integration, frontend): all tests passed.
- Root cause: rate-limit check returned 429 before capacity evaluation in suite runs, masking intended 400 when role is full.
- Fix: moved role capacity check to occur before rate-limit and uniqueness checks; retained defensive guards to avoid 500s from mocks.
- Outcome: deterministic 400 on capacity-full paths across single and full-suite runs; no behavior regressions elsewhere.

What to do next (guest feature track):

- Frontend Guest UI Phase 1 scaffolding:
  - Add API client methods for guest signup and event guests.
  - Build minimal GuestRegistrationForm and GuestEventSignup shell components (wire later).
- Backend polish (fast wins):
  - Add organizer email template stubs for guests (non-blocking).
  - Integrate guest counts in event stats display where applicable.

Quality gates: PASS

- Typecheck: unchanged
- Tests: backend + frontend PASS
- Note: keep capacity-first ordering as a design rule for related flows.

## 2025-08-10 — RegistrationQueryService + TrioTransaction micro-tests (tiny uplift)

- Unit run: 125 files; 2,090 tests passed in ~9.5s.
- Coverage snapshot (v8): 96.13% statements, 94.49% branches, 97.23% funcs, 96.13% lines.
- New tests added (deterministic, no prod changes):
  - backend/tests/unit/services/RegistrationQueryService.more-branches.test.ts
    - getEventSignupCounts: empty aggregate → zeros per role and totals.
    - getUserSignupInfo: Administrator role → maxAllowedSignups 3; canSignupForMore true.
  - backend/tests/unit/services/notifications/TrioTransaction.more-branches.test.ts
    - getSummary while pending: Duration shows “ongoing”; Types list covers multiple operations.
    - isSuccessful after rollback: remains false; summary reflects rolled_back.
- Notable deltas (selected):
  - RegistrationQueryService.ts Branch: 94.44% (↑) — uncovered region narrower (189–200).
  - TrioTransaction.ts Branch: 96.29% — summary/ongoing paths exercised; remaining: 93–96, 303.
  - Overall Branch: 94.49% (from ~94.34%).

Next micro-targets (low risk):

- EventReminderScheduler.ts (91.89% branches):
  - Add a tiny test that triggers sendEventReminderTrio ok path with details to assert the details log line, and one failing response path (already have) plus network catch (covered). Consider explicit test for start() idempotency (covered) and stop() when not running (covered) — focus remaining uncovered lines 32, 54, 68, 113–118.
- CacheService.ts (94.62% branches):
  - If needed, exercise one of the residual emit/log lines around cleanup to close 597–604.

Quality gates: PASS (unit only)

- Typecheck: unchanged
- Unit tests: PASS (125/125 files, 2,090 tests)
- Coverage (unit): S 96.13 / B 94.49 / F 97.23 / L 96.13

## 2025-08-10 — CacheService branch polish: timers, warmCache, health thresholds

- Full unit suite green: 2,086 tests passed in ~9.1s; 123 files.
- Coverage snapshot (v8): 96.13% statements, 94.34% branches, 97.23% funcs, 96.13% lines.
- What we added just now (deterministic, no prod changes):
  - CacheService.more-branches tests to cover:
    - LRU eviction event emission (eviction listener assertions).
    - TTL expiry miss reason 'expired' using fake timers and system time advance.
    - Zero-TTL early return (no set emission, nothing stored).
    - warmCache emits a 'cache-warming' cleanup event and stores entries.
    - Auto cleanup timer: expired entries cleaned and 'expired' cleanup event emitted (fresh instance under fake timers).
    - getHealthInfo warning (30–50%) and critical (<30%) hit-rate thresholds with >10 requests.
    - CachePatterns invalidation helpers: listings, search, and all-user caches; plus specific event/user invalidations.
- Notable deltas (folder: backend/src/services/infrastructure):
  - CacheService.ts Branch: 93.54% (minor uptick), Stmts: 96.07%.
  - Overall Branch: 94.34% (≈ +0.0x pp vs prior run), Stmts steady at 96.13%.

Next quick wins (micro-tests):

- CacheService.ts — close a few residual lines by exercising less-traveled paths:
  - Ensure eviction emit path executes under instrumentation (assert payload shape again on a minimal cache to hit emit lines).
  - A tiny probe for stopCleanupTimer via shutdown on a timer-active instance (already executed implicitly; add explicit assertion if needed).
- TrioTransaction.ts (92.15% branches):
  - Commit-after-rollback guard; rollback with no-ops; summary formatting for mixed errors. Add 2–3 focused tests.
- EventReminderScheduler.ts (91.89% branches):
  - No upcoming reminder path; zero-delay immediate path; cancellation catch logs.
- RegistrationQueryService.ts (91.17% branches):
  - Not-found variants and aggregation empty results.
- SocketService.ts (91.89% branches):
  - Emit failures for specific event names; disconnect guard.

Quality gates (current): PASS

- Build/Typecheck: unchanged
- Unit tests: PASS (123/123 files, 2,086 tests)
- Coverage: S 96.13 / B 94.34 / F 97.23 / L 96.13
- No production code changes in this sprint

## 2025-08-10 — NotificationErrorHandler trim branch covered; config at 100%

- Full unit suite green: 2,074 tests passed in ~8.9s.
- Coverage snapshot (v8): 96.10% statements, 94.30% branches, 96.83% funcs, 96.10% lines.
- Highlights:
  - notificationConfig.ts: 100% across (validation bounds, update history, rollback paths).
  - NotificationErrorHandler.ts: 100% statements / 98.57% branches — recovery history trimming path exercised and verified.
  - EmailService: remains 100% across (transporter selection, templates, and URL fallbacks fully covered).

Hotspots to nudge next (low-risk micro-tests):

- CacheService.ts — 92.13% branches:
  - getOrSet stale-after-read early return; eviction when metrics disabled; multi-key delete partial failures.
- TrioTransaction.ts — 92.15% branches:
  - commit-after-rollback guard; rollback with no-ops list; summary edge formatting for mixed errors.
- EventReminderScheduler.ts — 91.89% branches:
  - scheduleNext when no upcoming reminders; immediate execution path with zero delay; catch logs on cancel.
- RegistrationQueryService.ts — 91.17% branches:
  - not-found variants for getUserSignupInfo/getUserRoleInEvent; aggregation empty-results path.
- SocketService.ts — 91.89% branches:
  - emit failures for specific event names; disconnect guard when socket absent.

Quick status (refreshed):

- Unit run: all tests green (2,074 tests)
- Coverage (unit): 96.10% S, 94.30% B, 96.83% F, 96.10% L

## 2025-08-10 — EmailService branch polish (transporter + critical demotion link)

- Added targeted unit tests to cover EmailService transporter configuration branches and a Critical-impact admin demotion path:
  - `tests/unit/services/infrastructure/EmailService.transport.config.test.ts`
  - `tests/unit/services/infrastructure/EmailService.additional-branches.test.ts`
- Fixed a failing assertion by passing the correct parameter order and data shape to `sendDemotionNotificationToAdmins`, ensuring the Critical branch renders the Security Review link.
- Verified full unit suite: 99 files, 2035 tests passing. Coverage snapshot: 95.90% statements, 93.16% branches (EmailService ~90.47% branches).

Next small wins queued for EmailService branch coverage:

- Exercise remaining demotion impact branches: High (Admin → Participant) and Medium (Admin → Leader, Leader → Participant).
- Hit conditional blocks around event-created zoom link and text alternatives (592–616) with explicit true/false cases already mostly covered; recheck gaps.
- Cover AtCloud role-change user/admin functions for URL/text fallbacks (1462–1463, 1551–1552) and the co-organizer assignment edge (around 1726).

Note: No production code changes—tests only. Keep using deterministic mocks for nodemailer and env-based branches.

## Quick status

- Unit run: all tests green (latest: 2,030 tests)
- Coverage (v8, unit): 95.88% statements, 93.12% branches, 96.64% funcs, 95.88% lines

Recent wins

- auth.ts ≈98% S / ≈95% B
- NotificationErrorHandler.ts ≈93.5% S / ≈93.6% B (recovery/circuit-breaker edge coverage)
- autoEmailNotificationService.ts 100% statements / 100% branches
- TrioNotificationService.ts ≈99.6% S / ≈91.9% B (websocket-all-fail rollback, rollback-disabled, unknown-template retry, template mappings)
- emailRecipientUtils.ts branches 95.12% (organizerDetails undefined, createdBy variants, empty co-organizers, userByEmail hit, getUserById not-found, snapshot name defaults, legacy filtered-out)
- CacheService.ts 95.02% S / 92.13% B (added getOrSet error path, cache-after-fetch failure warning, critical health, metrics-disabled, eviction early-return)
- TrioTransaction.ts 98.5% S / 92.15% B (rollback-after-commit guard, add-after-rollback guard, ongoing duration, summary error inclusion, history limit/trimming)
- Controller uplifts:
  - eventController.ts 91.30% branches (93.05% statements) — covered background co‑organizer notification Promise.all then-paths in create/update; added getUserEvents stats/dedup/snapshot‑fallback and deleteEvent cache‑invalidations
  - unifiedMessageController.ts 90.78% branches (88.37% statements)
- Message.ts 99.63% S / 96.77% B (state normalization, inactivation/expiration, Map vs object userStates, moderation flags)
- monitor.ts 100% across; system.ts 100% branches
- rateLimiting.ts 99.28% S / 95.83% B; upload.ts 100% across

New realtime coverage added (this session):

- backend integration: event edit emits targeted system_message_update to participants resolved by email (email-to-ID fallback) and unread count updates
- frontend unit: bell notifications are derived from system_message_update events in NotificationContext

Current branch hotspots

- emailService.ts (infrastructure) — 90.47% branches (statements 100.00%)
- unifiedMessageController.ts — 90.78% branches (88.37% statements)
- eventController.ts — 91.30% branches (93.05% statements)
- models/Registration.ts — 96.66% branches (statements 100.00%)

Closed hotspot

- autoEmailNotificationService.ts — now 100% branches (statements 100.00%)

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

## Conventions update — isolated route tests (JSON responses)

For tiny in-memory Express apps used in isolated route tests, prefer `res.json(...)` for JSON responses and set only `Content-Disposition` when a filename is needed. Keep explicit `Content-Type` for CSV/XLSX. This avoids Supertest framing/parsing issues and keeps tests robust. See `backend/ROUTE_TEST_ARCHITECTURE_FIX.md` for details and examples.

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

Newly added in this run:

- backend/tests/unit/services/infrastructure/EmailService.demotion-user-url-branch.test.ts — user demotion email FRONTEND_URL fallback (dashboard) default vs custom.
- backend/tests/unit/services/infrastructure/EmailService.demotion-admins-url-branch.test.ts — admin demotion notification FRONTEND_URL fallback default vs custom.
- backend/tests/unit/services/infrastructure/EmailService.new-atcloud-leader-signup-admins-url-branch.test.ts — new @Cloud co-worker signup admin email FRONTEND_URL fallback default vs custom.

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

Freshest coverage delta (unit run):

- Overall: +0.26pp branches (92.02 → 92.28), statements/functions/lines unchanged.
- emailService.ts: branch uplift 83.87% → 87.23% from added URL fallback tests (demotion-to-user, demotion-to-admins, new @Cloud co-worker signup to admins).
- eventController.ts: unchanged at 91.30% branches / 93.05% statements

Newest coverage delta (unit run — EmailService ≥90%):

- Overall: -0.01pp statements (95.75 → 95.74), +0.15pp branches (92.28 → 92.43), +0.00pp funcs (96.64 → 96.64), -0.01pp lines (95.75 → 95.74)
- emailService.ts: branch uplift 87.23% → 90.47% from additional URL-fallback and template edge-case coverage (promotion/demotion user/admin links, event/welcome dashboards, eventCreated no-zoomLink)
- Infrastructure services (folder): branches improved (previous ~88.61% → 89.87%)

Latest coverage delta (unit run — 2,000 tests):

- Overall: statements 95.88% (+0.14pp), branches 92.67% (+0.24pp), funcs 96.64% (=), lines 95.88% (+0.14pp)
- autoEmailNotificationService.ts: branches 86.81% (+0.15pp) via new micro-tests
  - promotion: user email timeout with zero admin recipients → emailsSent 0; messages created
  - promotion: admin recipients fetch throws → only user email counted; flow continues
  - @Cloud: email-sending getAdminUsers throws; admin message creation still succeeds
- unifiedMessageController.ts: branches now 90.78% (+4.32pp from earlier in doc)

Newest coverage delta (unit run — 2,002 tests):

- Overall: +0.02pp statements (95.88 → 95.90), +0.08pp branches (92.67 → 92.75), funcs unchanged (96.64), +0.02pp lines (95.88 → 95.90)
- autoEmailNotificationService.ts: branches now 86.66% (remaining uncovered lines focus: 72, 107, 130, 166, 240–259, 353, 432, 443, 454, 463, 478)
- Infrastructure folder: branches 90.41%
- Controllers and models: no material change vs prior snapshot; unifiedMessageController.ts remains 90.78% branches

Targeted next micro-tests for the remaining gaps (low risk):

- autoEmailNotificationService.sendRoleChangeNotification: exercise the else-branch email error logs by forcing Promise.race to reject for an admin email (demotion path) while user email succeeds (assert emailsSent increments only for user).
- autoEmailNotificationService.sendAtCloudRoleChangeNotification: simulate empty adminRecipients so both emailsSent and messagesCreated remain 0; and a separate case where User.find returns [] to drive createAtCloudRoleChangeAdminMessage’s early return.
- autoEmailNotificationService.createAtCloudRoleChangeAdminMessage: force User.find to throw to hit the catch log path (return null), then ensure sendAtCloudRoleChangeNotification still returns success:true with emailsSent>0 and messagesCreated 0.

Latest coverage delta (unit run — 2,011 tests):

- Overall: statements 95.88% (=), branches 92.72% (+0.05pp vs 92.67), funcs 96.64% (=), lines 95.88% (=)
- autoEmailNotificationService.ts: branches now 88.42% (+1.33pp vs 87.09%); remaining uncovered lines called out by v8: 72, 107, 130, 166, 259, 353, 432, 443, 454, 463, 478
- Infrastructure folder: branches 90.48% (+0.29pp)
- Tests: 2,011 (+3)

New in this run (micro-tests just added):

- autoEmailNotificationService.more-cases.test.ts
  - Demotion user message: omits Context when reason is absent (reason=false branch)
  - Demotion admin message: omits Reason when reason is absent (reason=false branch)
  - @Cloud assigned: unified message creation throws → emailsSent counted, messagesCreated 0 (catch path)

Next precise test ideas to close remaining lines:

1. Promotion user inner catch: make sendPromotionNotificationToUser reject (not timeout) to hit early catch (targets ~72).
2. Promotion admins outer catch: make getSystemAuthorizationChangeRecipients throw (if not already covered by demotion variant) to hit ~107.
3. @Cloud admin author mapping: assert author fields (username/avatar/gender/role/authLevel) to ensure those lines execute (~432, 443, 454, 463, 478).

## Latest snapshot (Aug 10, 14:51)

- Unit run: 97 files, 2,030 tests passed in ~8.4s
- Coverage: 95.88% S, 93.12% B, 96.64% F, 95.88% L
- autoEmailNotificationService.ts: 100% S / 100% B (all branches covered)
- New micro-tests added:
  - promotion: admin message content includes Reason when reason is provided (covers admin-message reason suffix)
  - promotion: user message author mapping includes username, avatar, provided gender and role/authLevel
  - promotion: admin message author mapping uses username, avatar, gender fallback 'male', role/authLevel from changedBy
  - @Cloud assigned: admin email rejects with a string to hit inner catch fallback (error?.message || error)

Next quick wins:

- emailService.ts: inch branches above 90.47% by covering a couple of provider error-map or url fallback micro-branches if any remain.
- Controllers polish: eventController.ts and unifiedMessageController.ts tiny remaining guards/catches to gain a few branch points.
- Re-run unit coverage and log deltas above.
