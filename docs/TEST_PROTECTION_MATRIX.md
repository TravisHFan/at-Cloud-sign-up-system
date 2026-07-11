# Test Protection Matrix

This matrix defines the product contracts the test suite must protect before
tests are consolidated or removed. A retained test should own at least one
contract below; line or branch coverage alone is not a reason to keep a test.

## Test tiers

| Tier | Owns | Must not own | Command |
| --- | --- | --- | --- |
| Unit | Pure logic, controller/service decisions, serializers, validation, email content | HTTP wiring, a real database, browser journeys | `npm run test:backend:unit` |
| HTTP contract | Express routing, middleware order, status codes, response shapes, headers | MongoDB state or external services | `npm run test:backend:http` |
| DB integration | Query behavior, persistence, indexes, concurrency, cross-model workflows | Browser rendering or performance budgets | `npm run test:backend:integration` |
| Browser E2E | Critical user journeys through a built/running application | Exhaustive branches already owned below the UI | `npm run test:e2e` |
| Performance | Explain plans, bounded query counts, seeded response-time budgets | Normal pull-request correctness | `npm run test:backend:perf` |

Unit and HTTP-contract tests are the fast pull-request tier. Database tests use
one isolated database per worker and clear data at file boundaries. Performance
tests are explicit so seeded workloads cannot slow normal correctness checks.

## Feature risk and retained protection

| Feature | Risk | Required contracts | Primary retained protection |
| --- | --- | --- | --- |
| Authentication | Critical | Registration/login/logout, refresh expiry, email verification, reset-token rejection, normalized usernames | Auth controller/service units; auth HTTP contracts; `auth-*` DB integration; browser sign-up/login journeys |
| Permissions | Critical | Role hierarchy, route middleware, event/program ownership, organizer scope, admin-only operations | Auth/authorization middleware contracts; role and access-control integration suites |
| Events | Critical | Create/update/publish, status transitions, pagination, roles, registration limits, recurrence and timezone behavior | Event controller/service units; event HTTP contracts; focused `events-*` and registration DB suites; event explain tests |
| Guests | High | Public registration, manage/decline token security, capacity, role moves, verified-user migration | Guest/public-event units; guest HTTP contracts; `guest-*`, `guests-*`, and public-registration DB suites |
| Programs | High | CRUD authorization, deterministic pagination, participants, program-event links | Program controller units and HTTP contracts; focused program DB suites; program explain test |
| Purchases | Critical | Checkout totals, ownership, idempotent session verification, free checkout, purchase history | Purchase controller/service units; purchase and event-purchase DB workflows; browser checkout smoke |
| Promo codes | Critical | Scope/owner validation, fixed and percentage math, usage limits, deletion/history | Promo model/controller units; promo validation and purchase DB workflows |
| Refunds | Critical | Authorization, Stripe result mapping, persisted status, inventory/access reversal, idempotency | Purchase/refund units; `purchases-refund` and webhook refund DB suites |
| Donations | Critical | One-time/recurring checkout, webhook idempotency, receipts, admin visibility | Donation service/webhook units; donation API/webhook/receipt DB suites |
| Notifications | High | Targeting, unread counts, deletion/read semantics, realtime deduplication, email fallbacks | Message/email/socket units; notification HTTP contracts; message/realtime DB suites |
| Uploads | High | Authentication, MIME/size limits, async cleanup, stable response shape | Upload middleware units and HTTP contracts; upload API integration |
| Analytics | Medium | Authorization, stable aggregates/exports, PII-safe operations data, indexes | Analytics controller units and HTTP contracts; focused aggregate DB suites; explain/performance tier |

## Critical pull-request journeys

Every pull request must protect these paths without skipped tests:

1. A user can sign up, verify/login, and reach an authenticated page.
2. An authorized organizer can create/publish an event and a participant or
   guest can register without exceeding capacity.
3. A user can start a paid or fully discounted purchase, and duplicate webhook
   delivery cannot duplicate fulfillment.
4. An authorized administrator can refund a completed purchase.
5. A donor can complete a one-time donation and retrieve a receipt.
6. A promo code cannot be used by the wrong owner, for the wrong event, beyond
   its usage limit, or to create a negative total.

## Pruning rules

- Keep one direct test for each decision branch and one integration test for
  each cross-component contract; remove facade copies that assert identical
  mocks and payloads.
- Prefer table-driven cases for roles, invalid values, and equivalent status
  mappings.
- A test that protects a compatibility facade is removed with that facade or
  rewritten against the owning controller.
- Expected failures silence their own logger/console call. Global setup must
  not hide unexpected errors.
- Real sleeps are allowed only in the performance tier. Unit, HTTP, and browser
  tests use fake timers or deterministic deferred promises.
- Critical financial and authorization tests may not use `.skip` or `.todo`.
