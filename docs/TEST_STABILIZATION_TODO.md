# Test Stabilization TODO

This checklist is for the analytics export and gender contract changes. Keep every validation run targeted: do not run the full backend, frontend, or root test suite unless we explicitly decide it is worth the time.

## Current Product Contracts

- Analytics export defaults to all-time data, using the same source of truth as the dashboard. Date filters only apply when `from` or `to` is supplied.
- Analytics export row caps default to `25000`, with the same hard cap for oversized `maxRows` values.
- Guest registration gender is optional and has no default. Blank guest gender should be omitted instead of coerced to `"male"`.
- Auth registration for real user accounts requires `gender` and only accepts `"male"` or `"female"`.
- Guest-to-user migration should not require the guest record to contain gender; the target user profile already owns the required account gender.

## Guardrails

- Use `rg` and file inspection first.
- Prefer fixing shared fixtures and factories before touching many individual tests.
- Run one test file at a time, or a small explicit list only when the files share the same setup and failure mode.
- Avoid root `npm test`, backend `npm test`, frontend `npm test`, backend `npm run test:unit`, and backend `npm run test:integration` during this stabilization pass.
- For backend unit tests, prefer `cd backend && npx vitest run <file> --testTimeout=60000`.
- For backend integration tests, prefer `cd backend && VITEST_SCOPE=integration npx vitest run <file> --testTimeout=60000`.
- If local MongoDB only responds on `localhost`, set `MONGODB_TEST_URI=mongodb://localhost:27017/atcloud-signup-test`.
- For frontend tests, prefer `cd frontend && npx vitest run <file> --testTimeout=60000`.

## Findings So Far

- Pure backend unit tests were paying global MongoDB cleanup cost even when no DB connection was used. The global teardown now skips DB cleanup for non-DB runs unless `TEST_DB_CLEANUP=1` or an active Mongoose connection exists.
- The shared integration DB helper forced IPv4 with `family: 4` and defaulted to `127.0.0.1`; this fails on machines where MongoDB is reachable through `localhost` but not IPv4 loopback. The helper now defaults to `localhost` and only sets `family` when `MONGODB_TEST_FAMILY=4` or `MONGODB_TEST_FAMILY=6`.
- In this Codex session, the targeted integration file can reach MongoDB after the helper fix, but Supertest still attempts app requests through ephemeral `127.0.0.1` ports and fails with `EADDRNOTAVAIL`. Treat integration verification here as environment-blocked until loopback IPv4 is available or the harness is adapted.

## Phase 1: Contract Inventory And Fixtures

- [x] Create a dedicated fix branch.
- [x] Add this stabilization checklist.
- [x] Inventory stale analytics export expectations around default date scope, metadata, and row caps.
- [x] Inventory guest gender tests and fixtures that assume gender always exists or defaults to `"male"`.
- [x] Inventory auth registration tests and fixtures that create public registration payloads without gender.
- [x] Update the first shared test user factory so normal registered users include realistic profile fields.
- [x] Continue updating local user helpers in touched integration files.
- [x] Keep direct model edge-case tests explicit when they intentionally exercise optional model fields.

## Phase 2: Backend Unit Clusters

- [x] Analytics export controller tests:
  - `backend/tests/unit/controllers/analytics/ExportAnalyticsController.test.ts`
  - `backend/tests/unit/controllers/analytics/ExportAnalyticsController.comprehensive.test.ts`
  - `backend/tests/unit/controllers/analytics/ExportAnalyticsController.programs-donations.test.ts`
- [x] Guest validation/model tests:
  - `backend/tests/unit/middleware/guestValidation.test.ts`
  - `backend/tests/unit/middleware/guestValidation.middleware.test.ts`
  - `backend/tests/unit/models/GuestRegistration.test.ts`
- [x] Auth registration validation tests:
  - `backend/tests/unit/controllers/auth/RegistrationController.test.ts`
  - `backend/tests/unit/controllers/authController.test.ts`
  - `backend/tests/unit/middleware/validation.registration.test.ts`
  - `backend/tests/unit/middleware/validationRules.test.ts`
- [x] Guest migration service tests:
  - `backend/tests/unit/services/GuestMigrationService.perform.test.ts`

## Phase 3: Backend Integration Clusters

- [ ] Analytics API/export integration:
  - `backend/tests/integration/api/analytics-api.integration.test.ts`
  - `backend/tests/integration/api/analytics-export.integration.test.ts`
  - `backend/tests/integration/api/analytics-export-csv-rows.integration.test.ts`
- [ ] Guest registration integration:
  - `backend/tests/integration/api/guests-api.integration.test.ts`
  - `backend/tests/integration/api/public-events-register.integration.test.ts`
  - `backend/tests/integration/api/public-end-to-end-flow.integration.test.ts`
- [ ] Auth registration integration:
  - `backend/tests/integration/api/auth-api.test.ts`
  - `backend/tests/integration/middleware/validation.integration.test.ts`
- [ ] Guest migration integration:
  - `backend/tests/integration/api/guest-migration.integration.test.ts`
  - `backend/tests/integration/api/guest-auto-migrate-on-verify.integration.test.ts`

## Phase 4: Frontend Unit Clusters

- [x] Guest registration form:
  - `frontend/src/test/components/GuestRegistrationForm.test.tsx`
- [ ] Auth/profile schema tests:
  - `frontend/src/test/schemas/profileSchema.test.ts`
  - profile form tests found by `rg -n "gender" frontend/src/test`
- [ ] Analytics export UI tests found by `rg -n "export|analytics" frontend/src/test`

## Phase 5: Speed Modernization

- [ ] Split backend unit setup from integration DB setup so pure unit files do not pay DB setup/teardown cost.
- [x] Skip global DB cleanup for pure unit runs that never opened Mongoose.
- [ ] Move DB cleanup into explicit integration helpers instead of global teardown where possible.
- [ ] Add small test-data builders for auth users, guests, analytics events, and exports.
- [ ] Replace repeated API registration setup with helper functions where the test does not need to exercise registration itself.
- [ ] Mark heavyweight integration/performance tests with clear scripts so day-to-day stabilization can skip them.
- [ ] Keep Vitest file targeting documented in package scripts or docs so future fixes do not accidentally run everything.

## Completion Criteria

- Targeted files for each touched cluster pass independently.
- Export test data reconciles with dashboard counts under the same source and scope.
- Guest records can omit gender without defaulting to `"male"`.
- Public auth registration still rejects missing, blank, or invalid user gender.
- No broad suite run was triggered during stabilization unless explicitly approved.
