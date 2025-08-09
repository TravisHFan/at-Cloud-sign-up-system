# 🧪 Last Updated: August 9, 2025 (unit coverage snapshot)

## Quick status

- Unit run: all tests green (latest: 1,870 tests)
- Coverage (v8, unit): 92.79% statements, 88.59% branches, 94.68% funcs, 92.79% lines

Recent wins

- auth.ts ≈98% S / ≈95% B
- NotificationErrorHandler.ts ≈93% S / ≈94% B
- monitor.ts 100% across; system.ts 100% branches (minor lines 19–26 pending)
- rateLimiting.ts 99.28% S / 95.83% B (added skip-branch tests)
- upload.ts 100% across

Current branch hotspots

- emailService.ts (infrastructure) — 77.00% branches (statements 98.79%)
- autoEmailNotificationService.ts — 78.20% branches (statements 95.90%)
- TrioNotificationService.ts — 72.41% branches (statements 92.29%)
- emailRecipientUtils.ts — 77.14% branches (statements 98.36%)

## Short-term sprint (next 1–2 hours)

- EmailService.ts (infrastructure) — raise branches 77.00% → ≥85%
  - Uncovered lines: 654–661, 1014–1023, 1036–1044
  - Actions:
    - Add pinpoint tests to hit HTML/CSS variant paths and any env-guarded branches around these clusters.
    - Keep NODE_ENV=test; spy on sendEmail to assert subject/text markers for each branch.
    - Retain existing regression for demotion-to-admins impact/priority and demotion-to-user context.
- AutoEmailNotificationService — raise branches 78.20% → ≥85%
  - Uncovered lines: 128–133, 164–169, 374–376, 457, 499–505, 567–568
  - Actions:
    - Cover admin recipient resolution fallbacks and early-return conditions.
    - Exercise inner catch vs outer catch; verify metrics/logging via spies.
    - Use rejection simulation and targeted stubs (avoid long timers) to cover Promise.race branches deterministically.
- TrioNotificationService — raise branches 72.41% → ≥85%
  - Target lines: 304–308, 311, 336–340, 366–371, 379–380, 384–385, 409–410, 425–431
  - Actions:
    - Craft minimal inputs to traverse the else/edge branches; assert transaction behavior and metrics updates.
- Utils: emailRecipientUtils — bump branches 77.14% → ≥90%
  - Nudge tests to toggle flags around 82–84 and 105–106; assert selected recipients.

Expected: +0.3–0.7% branch bump, plus stronger regression safety on edge paths.

### Run notes (avoiding “skipped” suites)

- If you see output like “1 passed | many skipped”, you likely ran a filtered test or have a focused test (.only) somewhere.
- Run full unit suite: backend → npm run -s test:unit
- Run coverage: backend → npm run -s test:coverage
- If still skipped, search for focus flags: grep -R "\.only(" backend/tests

### Next sprint checklist

- [ ] EmailService: cover 654–661, 1014–1023, 1036–1044
- [ ] AutoEmailNotificationService: cover 128–133, 164–169, 374–376, 457, 499–505, 567–568
- [ ] TrioNotificationService: cover 304–308, 311, 336–340, 366–371, 379–380, 384–385, 409–410, 425–431
- [ ] emailRecipientUtils: exercise 82–84 and 105–106 branches
- [ ] Re-run coverage and log deltas above

## Near-term (1–2 days)

- Round out infra services (emailService env/backoff paths) and close utils gaps
- TrioTransaction remaining branch paths to 85%+ branches
- Optional: imageCompression remaining branch to 100%

## Quality gates

- Keep all tests green, no prod changes for testability
- Prefer isolated unit tests with deterministic mocks
- Use coverage to spot dead code; remove only when truly unreachable
