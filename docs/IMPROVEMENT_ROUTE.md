# Improvement Route — Continuous Quality and Delivery

Last updated: 2025-08-31

Changelog

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

Status: In progress — 2025-08-31

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

  Performance baseline (local dev, macOS, Node 18+; vitest integration env):

  - export (json, defaults): ~6 ms (PERF_BASELINE export_json_ms=6)
  - export (xlsx, 30d range, maxRows=50): ~9 ms (PERF_BASELINE export_xlsx_ms=9)
    Notes:
  - Values are from a cold-ish run with minimal seeded data; expect variance across machines.
  - Budgets in tests are intentionally generous (2.5s json / 3s xlsx) to avoid flakiness; we will refine if needed.

- Next steps

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

## Phase 4 — Scheduler and locking safety (Week 2)

- Actions
  - Decide locking strategy:
    - Enforce single instance: SINGLE_INSTANCE_ENFORCE=true and WEB_CONCURRENCY=1; or
    - Replace with a distributed lock (e.g., Mongo-based) for EventReminderScheduler and critical sections.
  - Add lightweight scheduler health reporting (last run timestamp, active flag) via logs or an endpoint.
- Done when
  - Production profile cannot start multiple workers with in-memory lock; scheduler state is observable.

## Phase 5 — Frontend test uplift (Week 2)

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
