# 🧪 Last Updated: August 9, 2025 (unit coverage snapshot)

## Quick status

- Unit run: all tests green (latest: 1,908 tests)
- Coverage (v8, unit): 93.28% statements, 90.11% branches, 95.27% funcs, 93.28% lines

Recent wins

- auth.ts ≈98% S / ≈95% B
- NotificationErrorHandler.ts ≈93.5% S / ≈93.6% B (recovery/circuit-breaker edge coverage)
- autoEmailNotificationService.ts 100% statements / 86.66% branches
- TrioNotificationService.ts ≈99.6% S / ≈91.9% B (websocket-all-fail rollback, rollback-disabled, unknown-template retry, template mappings)
- emailRecipientUtils.ts branches 95.12% (organizerDetails undefined, createdBy variants, empty co-organizers, userByEmail hit, getUserById not-found, snapshot name defaults, legacy filtered-out)
- CacheService.ts 95.02% S / 92.13% B (added getOrSet error path, cache-after-fetch failure warning, critical health, metrics-disabled, eviction early-return)
- TrioTransaction.ts 98.5% S / 92.15% B (rollback-after-commit guard, add-after-rollback guard, ongoing duration, summary error inclusion, history limit/trimming)
- monitor.ts 100% across; system.ts 100% branches
- rateLimiting.ts 99.28% S / 95.83% B; upload.ts 100% across

Current branch hotspots

- emailService.ts (infrastructure) — 78.60% branches (statements 100.00%)
- unifiedMessageController.ts — 73.94% branches (statements 89.11%)
- eventController.ts — 81.49% branches (statements 80.55%)
- models/Message.ts — 75.63% statements

## Short-term sprint (next 1–2 hours)

- Controller uplift: eventController.ts — add targeted tests for error paths and edge filters to push branches ≥88% and statements ≥88%.
- Controller uplift: unifiedMessageController.ts — close remaining branch gaps around pagination/filters.
- Optional infra: emailService.ts — still 78.60% branches; keep parked unless milestone requires ≥85%.

Expected outcome: +0.5–1.0% branches overall with controller/model focus; infra remains stable.

### Run notes (avoiding “skipped” suites)

- If you see output like “1 passed | many skipped”, you likely ran a filtered test or have a focused test (.only) somewhere.
- Run full unit suite: backend → npm run -s test:unit
- Run coverage: backend → npm run -s test:coverage
- If still skipped, search for focus flags: grep -R "\.only(" backend/tests

### Next sprint checklist

- [x] EmailService: cover promotion/demotion major branches (done earlier)
- [x] AutoEmailNotificationService: ≥85% branches (done)
- [x] TrioNotificationService: more branches (done)
- [x] emailRecipientUtils: ≥90% branches (now 95.12%)
- [x] CacheService: ≥85% branches (now 92.13%)
- [x] TrioTransaction: ≥85% branches (now 92.15%)
- [x] Re-run coverage and log deltas above
- [ ] eventController.ts: add tests for remaining error/edge branches
- [ ] unifiedMessageController.ts: pagination/filter branches

Next targets

- [ ] eventController.ts: raise branches and statements as above
- [ ] unifiedMessageController.ts: raise branches ≥85%
- [ ] Optional: emailRecipientUtils tiny residuals (lines 88, 98) if trivial

## Near-term (1–2 days)

- Round out infra services (emailService env/backoff paths) and close utils gaps
- Controllers and models (Message, Registration) statement uplift via focused tests
- Optional: imageCompression remaining branch to 100%

## Quality gates

- Keep all tests green, no prod changes for testability
- Prefer isolated unit tests with deterministic mocks
- Use coverage to spot dead code; remove only when truly unreachable

## Files added (unit tests) — purpose

- backend/tests/unit/services/infrastructure/EmailService.promotion-to-user.coverage.test.ts — cover promotion Leader/Admin/default content branches.
- backend/tests/unit/services/infrastructure/EmailService.demotion-to-user.more-branches.test.ts — cover demotion-to-user Leader/default themes and reason block presence/absence.
- backend/tests/unit/services/infrastructure/autoEmailNotificationService.more-cases.test.ts — cover demotion user-email catch, admin-recipient rejection catch, promotion with zero admin recipients, @Cloud removed mixed results (fulfilled true + false), non-fallback author fields, and outer-catch invalid input.

New in this sprint:

- backend/tests/unit/services/infrastructure/CacheService.test.ts — added error-path and health metrics tests (get() error treated as miss, post-fetch cache failure warning, metrics disabled, critical health, eviction early-return).
- backend/tests/unit/services/notifications/TrioTransaction.test.ts — added guards and manager history tests (rollback-after-commit, add-after-rollback, ongoing duration, summary error, history limit/trimming).
