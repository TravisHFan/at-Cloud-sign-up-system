# 🧪 Last Updated: August 9, 2025 (unit coverage snapshot)

## Quick status

- Unit run: all tests green (latest: 1,899 tests)
- Coverage (v8, unit): 93.18% statements, 89.57% branches, 95.07% funcs, 93.18% lines

Recent wins

- auth.ts ≈98% S / ≈95% B
- NotificationErrorHandler.ts ≈95.7% S / ≈95.2% B (added recovery/circuit-breaker edge coverage)
- autoEmailNotificationService.ts now 100% statements / 86.66% branches (added @Cloud removed mix-result case and outer-catch invalid input)
- TrioNotificationService.ts now ≈99.6% S / ≈91.9% B (websocket-all-fail rollback, rollback-disabled, unknown-template retry, remaining template mappings)
- emailRecipientUtils.ts branches up: 77.14% → 95.12% (covered organizerDetails undefined, createdBy plain object fallback, empty co-organizers, userByEmail hit, getUserById not-found, snapshot name defaults, mixed participants incl. legacy filtered-out)
- monitor.ts 100% across; system.ts 100% branches (minor lines 19–26 pending)
- rateLimiting.ts 99.28% S / 95.83% B (added skip-branch tests)
- upload.ts 100% across

Current branch hotspots

- emailService.ts (infrastructure) — 78.60% branches (statements 100.00%)
- autoEmailNotificationService.ts — 86.66% branches (statements 100.00%)
- CacheService.ts — 80.72–84.33% branches (statements ≈92.6–94.41%)
- TrioTransaction.ts — 81.81% branches (statements 95.80%)

## Short-term sprint (next 1–2 hours)

- EmailService.ts (infrastructure) — raise branches 78.60% → ≥85%
  - Status: promotion/demotion user flows well covered; remaining variants are low ROI. Park unless needed for a milestone.
- AutoEmailNotificationService — target achieved (≥85% branches)
  - Status: 100% statements / 86.66% branches. Only pursue >90% if needed.
- TrioNotificationService — target achieved (≥85% branches)
  - Status: 99.64% statements / 91.89% branches.
- Utils: emailRecipientUtils — bump branches 87.50% → ≥90%
  - Actions: add 1–2 micro-tests to cover remaining uncovered lines (ref: report lines: 88, 98, 209, 297–298). Candidate cases:
    - getUserById returns null (not found) path
    - getEventParticipants with legacy populated user passing flags and valid email, plus entry without any valid data → returns single legacy user

Expected vs actual: branch +0.62% (≈88.95% → 89.57%) with all suites stable.

### Run notes (avoiding “skipped” suites)

- If you see output like “1 passed | many skipped”, you likely ran a filtered test or have a focused test (.only) somewhere.
- Run full unit suite: backend → npm run -s test:unit
- Run coverage: backend → npm run -s test:coverage
- If still skipped, search for focus flags: grep -R "\.only(" backend/tests

### Next sprint checklist

- [x] EmailService: cover 654–661, 1014–1023, 1036–1044 (promotion Leader/Admin/default; demotion-to-user Leader/default, reason/no-reason)
- [x] AutoEmailNotificationService: increase branches to ≥85% and cover @Cloud early-return and mixed admin email results
- [x] TrioNotificationService: cover 304–308, 311, 336–340, 366–371, 379–380, 384–385, 409–410, 425–431
- [x] emailRecipientUtils: raise branches ≥90% (now 95.12%; covered getUserById not-found, array role input, snapshot defaults, and legacy populate path)
- [x] Re-run coverage and log deltas above

Next targets

- [ ] CacheService.ts: raise branches ≥85% by covering cache-miss/multi-key branches and error paths around 584–604
- [ ] TrioTransaction.ts: raise branches ≥85% by adding tests for already-completed addOperation guard, and rollback error aggregation at 249–252/270–272

## Near-term (1–2 days)

- Round out infra services (emailService env/backoff paths) and close utils gaps
- TrioTransaction remaining branch paths to 85%+ branches
- Optional: imageCompression remaining branch to 100%

## Quality gates

- Keep all tests green, no prod changes for testability
- Prefer isolated unit tests with deterministic mocks
- Use coverage to spot dead code; remove only when truly unreachable

## Files added (unit tests) — purpose

- backend/tests/unit/services/infrastructure/EmailService.promotion-to-user.coverage.test.ts — cover promotion Leader/Admin/default content branches.
- backend/tests/unit/services/infrastructure/EmailService.demotion-to-user.more-branches.test.ts — cover demotion-to-user Leader/default themes and reason block presence/absence.
- backend/tests/unit/services/infrastructure/autoEmailNotificationService.more-cases.test.ts — cover demotion user-email catch, admin-recipient rejection catch, promotion with zero admin recipients, @Cloud removed mixed results (fulfilled true + false), non-fallback author fields, and outer-catch invalid input.
