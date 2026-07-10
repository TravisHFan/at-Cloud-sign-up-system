---
applyTo: "**"
---

# Running the Test Suite

## How to run the integration tests only:

cd "/Users/dr.hunter/CS Projects/at-Cloud-sign-up-system/backend" && npm run -s test:integration

## How to run a specific integration test file: use "tests/integration/api/public-events-register.integration.test.ts" as a example:

Way 1:
npm run test:integration:one tests/integration/api/public-events-register.integration.test.ts

Way 2:
cd "/Users/dr.hunter/CS Projects/at-Cloud-sign-up-system/backend" && VITEST_SCOPE=integration npx vitest run tests/integration/api/public-events-register.integration.test.ts --reporter=verbose

## How to run a specific unit test file: use "tests/unit/services/PromoCodeEmailService.test.ts" as an example:

cd "/Users/dr.hunter/CS Projects/at-Cloud-sign-up-system/backend" && npm run test:backend:single -- PromoCodeEmailService

# Test Suite Principles

## Our ultimate purpose

We aim to build a **comprehensive, industrial-standard test suite**—covering **unit, integration, and end-to-end (E2E)** levels—with **near-100% coverage**. This strong foundation lets us safely remove deprecated or remnant code and confidently build new features. (Unit = smallest pieces; integration = modules working together; E2E = full system paths.)

> Note: Coverage is a tool to reveal untested areas; quality still matters more than the number. Use high coverage **to inform**, not to game.

---

## On dead / remnant code

In a fast-evolving codebase, it’s common to accumulate **orphaned, deprecated, duplicated, or remnant** code blocks as design/logic shifts.
We will **leverage the test suite and steadily increasing coverage** to pinpoint such **dead code**. After confirming that a segment is truly unused/unreachable, **remove it** to keep the codebase lean and clear. (Coverage data and code review are effective ways to surface dead code.)

---
