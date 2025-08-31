# Improvement Route — Continuous Quality and Delivery

Last updated: 2025-08-30

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

## Phase 1 — CI and quality gates (Day 1–2)

Status: Done — 2025-08-30. CI added with coverage gates and artifacts.

- Actions
  - Add CI workflow with jobs: backend-unit, backend-integration (starts Mongo service), frontend-tests.
  - Publish coverage artifacts for each job.
  - Enforce initial coverage thresholds and fail PR on regression.
    - Backend: lines/statements/functions ≥ 85%, branches ≥ 80%.
    - Frontend: lines/statements/functions ≥ 80%, branches ≥ 75%.
- Done when
  - CI runs on PRs and main; failing tests or threshold dips block merge. (Achieved)

## Phase 2 — Test stabilization (Week 1)

- Actions
  - Cache E2E: fix remaining failing cases or migrate them to HTTP-level integration tests (avoid deep Mongoose method-chain mocking).
  - Keep scope flags: default PRs run unit; run integration on labeled PRs or nightly.
- Done when
  - Cache service/integration/E2E suites green locally and in CI; no focused tests (.only) present; repeatable across runs.

## Phase 3 — Analytics performance and correctness (Week 1–2)

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
  - Monday: CI stability and flake review; set phase targets for the week.
  - Midweek: Raise PRs for current phase; ensure green CI.
  - Friday: Update TEST_COVERAGE_ROADMAP.md with coverage deltas and next targets.

## Risks and mitigations

- DB dependency in tests → Start Mongo in CI; gate integration by scope; keep unit tests fast.
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
