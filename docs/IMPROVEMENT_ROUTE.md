# Improvement Route — Continuous Quality and Delivery

Last updated: 2025-09-02

Changelog

- 2025-09-02: Clean verify — Implemented newline rendering for role descriptions using CSS (whitespace-pre-line) across EventRoleSignup, CreateEvent, EventDetail, and EventPreview. Added a focused UI test with Router/Auth harness. Full repo green via root npm test. Backend (48/255) and frontend (87/279/2). Perf baselines stable (json≈5ms, xlsx≈8ms). Lint + type-check clean.
- 2025-09-02: Clean verify — Full repo green via root npm test. Backend (48 files, 255 tests) and frontend (85 files, 276 tests, 2 skipped). Perf baselines consistent (json≈8ms, xlsx≈9ms). Participant analytics no-toast behavior and Effective Communication Workshop role updates remain stable. Minor frontend test polish applied (avatar protections, SystemMessages highlight duration, hash-anchor markRead). Lint + type-check clean.
- 2025-09-01: Clean verify — Updated Effective Communication Workshop role set across backend/frontend (rename “Main Mentor”→“Opening Keynote Speaker”, “Co-coach”→“Evaluators”; added “Closing Keynote Speaker”, “Content Master”, “Meeting Timer”). Added backend and frontend tests to enforce templates. Suppressed Participant analytics error toasts (page-level Access Restricted only). Icons for Participant pages switched to shield/lock. Full repo green (backend 48/255; frontend 83/274/2). Perf baselines unchanged (json≈5–6ms, xlsx≈8–9ms).
- 2025-09-01: Participant visibility policy change — Participants can now see "Create Event" and "Analytics" in the sidebar. Create Event page shows a disabled overlay with professional notice; Analytics remains access restricted with a guidance line. Full repo green (backend 48/255; frontend 83/274/2). Perf baselines: json≈5ms, xlsx≈8ms.
- 2025-09-01: Clean verify — backend (48 files, 255 tests) and frontend (83 files, 274 tests, 2 skipped) green. Added SystemMessages a11y snapshot and highlight-duration tests; kept perf baselines (json≈4ms, xlsx≈9ms). Next: routing edge cases + another a11y snapshot.
- 2025-09-01: Logged clean verify — backend (48 files, 255 tests) and frontend (81 files, 272 tests, 2 skipped) green via root npm test. Added SystemMessages hash‑anchor scroll/read test; kept perf baselines stable (export_json_ms≈4–7, export_xlsx_ms≈9). Next: a11y snapshot + expand SystemMessages routing/highlight tests.
- 2025-09-01: Phase 5 progress — added bell dropdown system message navigation/read test; reran frontend and full repo suites: all green. Proceeding to a11y snapshot + SystemMessages hash handling tests.
- 2025-09-01: Phase 4 (Scheduler + locking safety, Option A) closed as Done. Added a frontend auth-gating test for Analytics page (restricts non-leaders/admins). Preparing Phase 5 uplift.
- 2025-08-31: Added admin-only manual trigger endpoint POST /api/system/scheduler/manual-trigger with integration tests (200, 401, 403). Option B declared not needed.
- 2025-08-31: Scheduler health endpoint now includes `schedulerEnabled` for ops visibility; added Render deployment notes in DEPLOYMENT_GUIDE.md. Full repo green.
- 2025-08-31: Updated EventReminderScheduler status tests to allow richer diagnostics from getStatus (assert isRunning only). Full repo green after change.
- 2025-08-31: Added optional CSV streaming mode for analytics export (format=csv&mode=rows) and a scheduler health endpoint at GET /api/system/scheduler. All backend integration tests pass.
- 2025-08-31: Verify sweep green (lint + type-check) across backend and frontend. Implemented next Phase 3 action: added seeded explain executionStats checks to track query counts (docs/keys examined, nReturned) alongside latency.
- 2025-08-31: Cleaned duplicate Mongoose compound index declarations (User {isActive,lastLogin}, Registration {eventId,status,createdAt}); eliminated warnings. Re-ran full backend (44 files, 246 tests) and frontend (73 files, 258 tests, 2 skipped) suites — all green. Perf baselines unchanged (export_json_ms≈6, export_xlsx_ms≈9).
- 2025-08-31: Added analytics indexes (User.weeklyChurch, Event.format, Registration.createdAt) and explain-plan checks; all backend tests passed.
- 2025-08-31: Added backend performance smoke tests for /api/analytics/export (json/xlsx) and recorded initial baselines.
- 2025-08-31: Phase 3 export hardening implemented (constraints, formats, error handling, meta); backend + frontend suites green. Added lastLogin index for analytics and an export integration test.
- 2025-08-31: Phase 2 completed. Frontend suite stabilized with global fetch stubs and socket mock fixes; full repo tests green locally.

This is a living plan to iteratively improve stability, performance, tests, and operations. Keep production behavior intact; prefer tests and configuration over code changes unless fixing real defects.

## Principles

- Don’t bend production to make tests pass; fix tests only when they misrepresent intended behavior.
- Use npm test to run suites (root orchestrates backend + frontend).
- Prefer fast, deterministic unit tests; gate integration/e2e thoughtfully.
- Remove dead code only when truly unreachable; document decisions.

## Quick commands

- Full suite (root):
  - npm test
- Lint + type-check (root):
  - npm run -s verify
- Backend only:
  - npm run -s test:backend
- Frontend only:
  - npm run -s test:frontend

Test DB for backend integration: mongodb://localhost:27017/atcloud-signup-test

---

## Phase 0 — Prep (same day)

Status: Done — 2025-08-30. Baseline green (lint/type-check, backend + frontend tests).

- Actions
  - Ensure local MongoDB is running for tests at the test URI above.
  - Confirm Node + dependencies are installed in root, backend, and frontend.
- Done when
  - Root “Repo verify (npm test)” runs consistently without flakes locally.
  - Root “Root verify (lint + type-check)” is green.

## Phase 1 — Local quality gates (Day 1–2)

Status: Done — 2025-08-30. CI removed; using local scripts and thresholds instead.

- Actions
  - Keep a minimal, disabled workflow in `.github/workflows/ci.yml` to avoid accidental triggers.
  - Enforce coverage thresholds locally via `scripts/check-coverage.mjs` after `npm test`.
    - Backend: lines/statements/functions ≥ 85%, branches ≥ 80%.
    - Frontend: lines/statements/functions ≥ 80%, branches ≥ 75%.
  - Continue using `npm run -s verify` before commits.
- Done when
  - Local verify and tests are green; coverage gates pass locally before pushing.

## Phase 2 — Test stabilization (Week 1)

Status: Done — 2025-08-31

- Achievements

  - Backend integration suite is green and repeatable locally (40 files, 236 tests passed).
  - Frontend suite is green locally (73 files, 258 passed, 2 skipped) with network/socket noise suppressed.
  - Global frontend test setup now includes:
    - Lightweight fetch stub for /api/auth/_ and /api/notifications/_ endpoints to prevent real network calls.
    - Default exposure of `authService` on `services/api` for tests using partial mocks.
    - Enhanced FakeSocket mock implementing `on`, `off`, `emit`, `connect`, `disconnect`, and `removeAllListeners` to satisfy cleanup paths.
  - Realtime tests updated to await UI updates, eliminating act() warnings.
  - Local guards in place (verify:local, check:no-only; targeted backend unit/integration scripts).

- Acceptance met
  - Suites are green across repeated runs; no `.only` present.
  - Frontend tests run without ECONNREFUSED errors or act() warnings.

Tip: before committing, run `npm run -s verify:local` to lint, type-check, and ensure no focused tests remain.

## Phase 3 — Analytics performance and correctness (Week 1–2)

Status: Done — 2025-08-31

- Achievements

  - Analytics export hardened and fully covered by tests:
    - Early format validation (400 on unsupported); consistent JSON/CSV/XLSX headers.
    - Default date window (~6 months) and row caps (soft cap + hard ceiling) with meta in responses.
    - Robust query execution under mocks; controller-level error propagation and logging for DB errors.
    - XLSX export includes Overview/Users/Events/Registrations worksheets.
  - Added Mongo index: User.lastLogin for engagement analytics.
  - New integration test: /api/analytics/export for JSON and XLSX with filters and caps.
  - Performance smoke tests added (json/xlsx) to capture response-time baselines.
  - Indexes added for analytics paths:
    - User.weeklyChurch (grouping/filtering)
    - Event.format (grouping/filtering)
    - Registration.createdAt (recent activity windows)
  - Explain-plan smoke checks validate index usage (IXSCAN present) on the above fields.
  - CSV streaming path for very large exports implemented (format=csv&mode=rows) with integration test.

  Performance baseline (local dev, macOS, Node 18+; vitest integration env):

  - export (json, defaults): ~6 ms (PERF_BASELINE export_json_ms=6)
  - export (xlsx, 30d range, maxRows=50): ~9 ms (PERF_BASELINE export_xlsx_ms=9)
    Notes:
  - Values are from a cold-ish run with minimal seeded data; expect variance across machines.
  - Budgets in tests are intentionally generous (2.5s json / 3s xlsx) to avoid flakiness; we will refine if needed.

- Next steps

  - DONE: Extend perf tests (seeded) to capture executionStats (totalDocsExamined/totalKeysExamined/nReturned) and ensure IXSCAN/no COLLSCAN; keep generous headroom to avoid flakes.
  - Consider CSV streaming for very large exports to reduce memory pressure.
  - Review and add any remaining/compound indexes for common analytics queries:
    - Event: createdAt, date, status, type, format
    - Registration: eventId, createdAt
    - User: createdAt, isActive, weeklyChurch (lastLogin already added)
  - Optionally extend perf tests with seeded datasets and capture query counts alongside latency.
  - Optionally track query plans (explain) and compare before/after index additions.

- Actions
  - Indexes for analytics queries:
    - User: createdAt, lastLogin, isActive, weeklyChurch
    - Event: createdAt, date, status, type, format
    - Registration: eventId, createdAt
  - Export safeguards:
    - Add soft row limit or required date-range for XLSX/CSV bulk exports.
    - Prefer CSV streaming for very large exports; document filters in README/TESTING.
  - Add a small performance check (seeded data) to assert bounded latency or query counts.
- Done when
  - P95 latency for analytics endpoints is stable under seeded load; exports complete within time bounds or require filters.
  - Acceptance met — 2025-08-31: Seeded perf tests stable with generous budgets; explain plans assert IXSCAN/no COLLSCAN; exports complete within budgets and offer CSV streaming for large datasets.

## Phase 4 — Scheduler and locking safety (Week 2)

Status: Done — 2025-09-01 (Option A only; Option B not needed)

- Actions

  - Decide locking strategy:
  - Option A (chosen): Enforce single instance (SINGLE_INSTANCE_ENFORCE=true, WEB_CONCURRENCY=1) and add a runtime guard so the scheduler only starts on the designated leader process.
  - Option B: Not needed. Deferred.
  - Health visibility: Scheduler health endpoint already added (GET /api/system/scheduler); consider surfacing lock diagnostics when Option B is enabled.

  Tiny task list (first pass)

  - A1: Implement runtime guard for Option A in app bootstrap (start scheduler only when SCHEDULER_ENABLED=true; default enabled in dev). Add a small unit test for the guard. Render: set SCHEDULER_ENABLED=true only on a Background Worker; keep it unset/false on the Web Service. [Done]
  - A2: Expose scheduler ops health field `schedulerEnabled` and test. [Done]
  - A3: Add admin-only manual trigger endpoint to run a one-off reminder pass; add tests for 200/401/403. [Done]
  - D1: Docs: add brief deployment notes (README/DEPLOYMENT_GUIDE) for Option A and env flags; include manual trigger usage. [Done]

- Done when
  - Option A: Only a single scheduler instance starts under the production profile (validated by logs/status) and unit test covers the guard; or
  - Option B: Two simulated processes cannot run processEventReminders concurrently (lock prevents overlap); scheduler status exposes lock diagnostics when enabled.

## Phase 5 — Frontend test uplift (Week 2)

Status: In Progress — 2025-09-01

- Actions
  - Add 5–8 high-value tests: auth gating, profile update success/validation, avatar upload protection happy/denied, a11y snapshot for a key page, system message link routing.
  - Keep tests isolated (jsdom, no real network); reuse existing mocks.
- Done when
  - Frontend coverage rises meaningfully (e.g., +3–5pp statements) and critical flows are protected.

## Phase 6 — Observability (Week 2–3)

- Actions
  - Standardize structured JSON logging with levels and request IDs in backend; keep test logs quiet for signal.
  - Add minimal metrics: requests by route/status, latency, error rates. Expose via logs or a minimal endpoint.
- Done when
  - Logs include request ID and level; basic metrics visible and reviewed in CI or dev.

## Phase 7 — Security sweep (Week 2–3)

- Actions
  - Validate security headers and CORS. Add CSP for production (opt out in dev) and confirm upload path controls.
  - Add .env.example without secrets; verify JWT secret sourcing in all envs.
- Done when
  - Security headers validated in a smoke run; no secrets committed; uploads behave as intended.

## Phase 8 — Docs and developer ergonomics (Week 3)

- Actions
  - Add TESTING.md: how to run unit/integration/e2e/coverage, DB requirements, timers, pitfalls, coverage tips.
  - Keep TEST_COVERAGE_ROADMAP.md updated after each milestone.
- Done when
  - New contributors can run the suite and understand conventions within 10 minutes.

## Phase 9 — Dead code hygiene (Ongoing)

- Actions
  - Use coverage to identify truly unreachable branches/files; remove only after review and with short ADR notes.
- Done when
  - Dead code steadily reduced without behavior changes; coverage stays stable or improves.

---

## Execution cadence and checkpoints

- Weekly
  - Monday: Review flakes locally; set phase targets for the week.
  - Midweek: Raise PRs for current phase; ensure local green.
  - Friday: Update TEST_COVERAGE_ROADMAP.md with coverage deltas and next targets.

## Risks and mitigations

- DB dependency in tests → Use local Mongo; gate integration by scope; keep unit tests fast.
- Export memory/latency spikes → Cap/require filters; stream CSV when large; document constraints.
- Concurrency with in-memory lock → Enforce single instance or move to distributed lock.
- ESLint version drift (frontend v9 vs backend v8) → Align rules where noise occurs; accept per-package configs otherwise.

## Ownership & tracking

- Assign an owner per phase in PR descriptions.
- Link PRs to this document and to TEST_COVERAGE_ROADMAP.md updates.
- Use GitHub Projects or issues to break phases into tasks; keep acceptance criteria aligned with the “Done when” bullets above.

## How to update this document

- Edit this file in-place for scope/criteria tweaks; add a changelog entry at the top when making material changes.
- Keep dates realistic; if a phase extends, note why and what changed.
