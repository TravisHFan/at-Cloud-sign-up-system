# Test Coverage Audit & Improvement Plan

> Historical snapshot from November 2025. Its file inventory and metrics are
> intentionally preserved for context but are no longer current. See
> [CODEBASE_OPTIMIZATION_TODO.md](./CODEBASE_OPTIMIZATION_TODO.md) for the final
> July 2026 results and [TEST_PROTECTION_MATRIX.md](./TEST_PROTECTION_MATRIX.md)
> for the active protection model.

**Date:** 2025-11-07  
**Purpose:** Comprehensive analysis of test coverage status and systematic plan to achieve near-100% coverage

---

## Executive Summary

### Current Status

- **Backend Test Files:** 305 test files
- **Frontend Test Files:** 173 test files
- **Total Test Files:** 478 test files

### Coverage Metrics (Latest Run)

#### Frontend Coverage (from coverage-summary.json)

- **Lines:** 57.12% (36,490 / 63,872)
- **Statements:** 57.12% (36,490 / 63,872)
- **Functions:** 41.04% (589 / 1,435)
- **Branches:** 67.94% (3,336 / 4,910)

#### Backend Coverage (Thresholds from vitest.config.ts)

- **Target Lines:** 85%
- **Target Statements:** 85%
- **Target Functions:** 85%
- **Target Branches:** 80%

### Key Findings

1. ✅ **Strong foundation:** 478 test files with good unit and integration coverage in critical areas
2. ⚠️ **Frontend coverage gaps:** Only 57% line coverage, 41% function coverage
3. ⚠️ **Missing controller tests:** Several key controllers lack unit tests
4. ⚠️ **Missing service tests:** Some services completely untested
5. ⚠️ **Integration gaps:** 4 route groups identified with missing/incomplete integration tests

---

## Backend Test Coverage Analysis

### Controllers Coverage Status

#### ✅ Controllers WITH Unit Tests

1. `analyticsController.ts` ✅
2. `authController.ts` ✅
3. `emailNotificationController.ts` ✅
4. `eventController.ts` ✅ (+ mentorCircle, timezoneBatchStatus, updateWorkshopGroupTopic variants)
5. `guestController.ts` ✅ (+ moveGuestBetweenRoles variant)
6. `ProfileController.ts` ✅
7. `roleAssignmentRejectionController.ts` ✅ (rejectionNotification variant)
8. `searchController.ts` ✅
9. `unifiedMessageController.ts` ✅ (+ event-role-change-targetUserId, markAllBellRead variants)
10. `UserAdminController.ts` ✅
11. `UserAnalyticsController.ts` ✅

#### ❌ Controllers WITHOUT Unit Tests (Critical Priority)

1. **`auditLogController.ts`** - Admin audit log functionality
2. **`feedbackController.ts`** - User feedback system
3. **`guestMigrationController.ts`** - Guest migration logic
4. **`programController.ts`** - Program CRUD operations
5. **`promoCodeController.ts`** - Promo code management
6. **`publicEventController.ts`** - Public event listing/registration
7. **`purchaseController.ts`** - Purchase/payment processing
8. **`rolesTemplateController.ts`** - Role template management
9. **`shortLinkController.ts`** - Short link generation/redirection
10. **`userController.ts`** - User CRUD and profile management
11. **`webhookController.ts`** - Webhook handling (Stripe, etc.)

#### 📝 Special Cases

- `registrationController.ts` - Has unit tests but no corresponding controller file in src/controllers (likely folder-based organization)
- Multiple controller folders exist: `auth/`, `event/`, `guest/`, `message/`, `profile/`, `programs/`, `promoCodes/`, `publicEvent/`, `purchase/`, `emailNotifications/`, `analytics/`

### Services Coverage Status

#### ✅ Services WITH Unit Tests

1. `CapacityService.ts` ✅
2. `CorrelatedLogger.ts` ✅ (+ fromRequest, helpers, levels-and-errors variants)
3. `DataIntegrityService.ts` ✅
4. `ErrorHandlingService.ts` ✅
5. `EventReminderScheduler.ts` ✅ (+ fetch, more-branches variants)
6. `EventSnapshotBuilder.ts` ✅
7. `GuestMigrationService.ts` ✅ (+ perform, scaffold variants)
8. `ICSBuilder.ts` ✅
9. `ImageCompressionService.ts` ✅
10. `LockService.ts` ✅
11. `LoggerService.ts` ✅
12. `MaintenanceScheduler.ts` ✅ (auditLogs variant)
13. `MessageCleanupService.ts` ✅
14. `RegistrationQueryService.ts` ✅ (+ more-branches variant)
15. `RejectionMetricsService.ts` ✅
16. `ResponseBuilderService.ts` ✅ (+ branch-polish, clean, guests-included variants)
17. `SchedulerService.ts` ✅ (simple variant)
18. `ShortLinkService.ts` ✅
19. `stripeService.ts` ✅
20. `UserDeletionService.ts` ✅
21. `ValidationService.ts` ✅

#### ❌ Services WITHOUT Unit Tests (Priority)

1. **`domainEvents.ts`** - Event-driven architecture core
2. **`EventCascadeService.ts`** - Event cascading updates
3. **`PrometheusMetricsService.ts`** - Metrics collection
4. **`promoCodeCleanupService.ts`** - Promo code cleanup jobs
5. **`PublicAbuseMetricsService.ts`** - Abuse detection/metrics
6. **`PublicEventsListCache.ts`** - Cache management for public events
7. **`RateLimiterService.ts`** - Rate limiting functionality
8. **`ShortLinkMetricsService.ts`** - Short link analytics
9. **`ThreadSafeEventService.ts`** - Thread-safe event operations

#### 📂 Service Folders to Audit

- `email/` - Email-related services (some tests exist: emailService.guestConfirmation, emailService.roleAssignment)
- `emailTemplates/` - Email template rendering
- `event/` - Event-related services
- `infrastructure/` - Infrastructure services (RequestMonitorService has emergency test)
- `notifications/` - Notification services

### Integration Test Coverage (Route-Based)

Based on `ROUTE_COVERAGE_ANALYSIS.md`:

#### ✅ Routes WITH Integration Tests

1. `/auth` ✅
2. `/users` ✅
3. `/events` ✅ (40+ test files)
4. `/events/*` (guest routes) ✅ (15+ guest tests)
5. `/notifications` ✅
6. `/analytics` ✅
7. `/search` ✅
8. `/system` ✅
9. `/guest-migration` ✅
10. `/feedback` ✅
11. `/role-assignments/reject` ✅
12. `/programs` ✅ (5+ files)
13. `/public` ✅ (15+ files)
14. `/public/short-links` ✅ (7 files)
15. `/roles-templates` ✅
16. `/purchases` ✅
17. `/admin/purchases` ✅
18. `/webhooks` ✅
19. `/promo-codes` ✅
20. `GET /health` ✅

#### ❌ Routes WITHOUT/INCOMPLETE Integration Tests

1. **`/email-notifications`** - Email notification management API
2. **`/uploads`** - File upload endpoints
3. **`/audit-logs`** - Audit log retrieval API
4. **`GET /`** - Root API info endpoint
5. **`/monitor`** ⚠️ - Partial coverage (only health/metrics, not full monitor routes)

---

## Frontend Test Coverage Analysis

### Coverage by Component Type

#### Pages (58 total)

**High Coverage:**

- `AdminPromoCodes.tsx` ✅ (2 test files)
- `Analytics.tsx` ✅ (5+ variant tests)
- `AssignmentRejection.tsx` ✅
- `CreateEvent.tsx` ✅ (templates.fallback test)
- `EditEvent.tsx` ✅ (roles test)
- `EditProgram.tsx` ✅ (pricing-confirmation test)
- `EnrollProgram.tsx` ✅
- `EventDetail.tsx` ✅ (7+ variant tests)
- `Events.tsx` ✅ (default-sorting test)
- `SystemMessages.tsx` ✅ (3 localtime variant tests)

**Minimal/No Coverage:**

- `AuditLogs.tsx` ❌
- `ChangePassword.tsx` ❌
- `CheckEmail.tsx` ❌
- `CompletePasswordChange.tsx` ❌
- `ConfigureRolesTemplates.tsx` ❌
- `CreateNewProgram.tsx` ❌
- `CreateRolesTemplate.tsx` ❌
- `Dashboard.tsx` ❌
- `EditRolesTemplate.tsx` ❌
- `EmailVerification.tsx` ❌
- `Feedback.tsx` ❌
- `GetInvolved.tsx` ❌
- `GuestConfirmation.tsx` ❌
- `GuestDecline.tsx` ❌
- `GuestLanding.tsx` ❌
- `GuestManage.tsx` ❌
- `GuestRegistration.tsx` ❌
- `Home.tsx` ❌
- `IncomeHistory.tsx` ❌
- `Login.tsx` ❌
- `Management.tsx` ❌
- `MyEvents.tsx` ❌
- `NotFound.tsx` ❌
- `Profile.tsx` ❌
- `Programs.tsx` ❌
- `PublicEvent.tsx` ❌
- `Register.tsx` ❌
- `ResetPassword.tsx` ❌
- `Unauthorized.tsx` ❌
- And others...

#### Components (141 total)

**Well-Tested Components (based on coverage data):**

- `Icon.tsx` - 100% coverage ✅
- `SessionExpiredModal.tsx` - 100% coverage ✅
- `GuestEditModal.tsx` - 100% coverage ✅
- `Multiline.tsx` - 100% coverage ✅
- `EditButton.tsx` - 100% coverage ✅
- `OrganizerSelection.tsx` - 94.87% coverage ✅
- `EventStatsCards.tsx` - 92.78% coverage ✅
- `MinistryStatsCard.tsx` - 91.47% coverage ✅
- `Pagination.tsx` - 92.96% coverage ✅
- `ProtectedRoute.tsx` - 90.69% coverage ✅

**Low Coverage Components (Priority):**

- `App.tsx` - 0% coverage ❌
- `Footer.tsx` - 0% coverage ❌
- `GuestEventSignup.tsx` - 0% coverage ❌
- `MentorsPicker.tsx` - 0% coverage ❌
- `ConfirmPasswordField.tsx` - 0% coverage ❌
- `NotificationDropdown.tsx` - 9.09% coverage ⚠️
- `GettingStartedSection.tsx` - 8.16% coverage ⚠️
- `WelcomeHeader.tsx` - 10.52% coverage ⚠️
- `EventDeletionModal.tsx` - 15.06% coverage ⚠️
- `NotificationPromptModal.tsx` - 17.07% coverage ⚠️
- `TemplateSelectorModal.tsx` - 31.96% coverage ⚠️
- `FlyerCarousel.tsx` - 33.07% coverage ⚠️

#### Hooks (45 total)

- `useUserPermissions` - Has guest-expert test ✅
- `useUserData` - Has fetchAll test ✅
- `useLogin` - Has redirect and general tests ✅
- `useRoleValidation` - Has test ✅
- Most other hooks need coverage audit

---

## Prioritized Test Implementation Plan

### Phase 1: Critical Backend Controllers (Week 1-2)

**Goal:** Test controllers that handle core business logic and data mutations

1. ✅ **`userController.ts`** - User CRUD, profile management
   - Priority: CRITICAL
   - Reason: Core user operations, authentication dependency
2. ✅ **`webhookController.ts`** - Payment webhooks, external integrations
   - Priority: CRITICAL
   - Reason: Payment processing, financial integrity
3. ✅ **`purchaseController.ts`** - Purchase/payment flows

   - Priority: CRITICAL
   - Reason: Revenue operations, payment processing

4. ✅ **`programController.ts`** - Program CRUD

   - Priority: HIGH
   - Reason: Core content management

5. ✅ **`promoCodeController.ts`** - Promo code management
   - Priority: HIGH
   - Reason: Discount/pricing logic, financial impact

### Phase 2: Critical Backend Services (Week 3-4)

**Goal:** Test services that support critical controllers

1. ✅ **`RateLimiterService.ts`** - Rate limiting

   - Priority: CRITICAL
   - Reason: Security, DOS protection

2. ✅ **`PublicEventsListCache.ts`** - Cache management

   - Priority: HIGH
   - Reason: Performance, public-facing

3. ✅ **`EventCascadeService.ts`** - Event cascading updates

   - Priority: HIGH
   - Reason: Data integrity across related entities

4. ✅ **`domainEvents.ts`** - Event-driven architecture

   - Priority: HIGH
   - Reason: Core architectural component

5. ✅ **`PrometheusMetricsService.ts`** - Metrics
   - Priority: MEDIUM
   - Reason: Observability, monitoring

### Phase 3: Missing Integration Tests (Week 5)

**Goal:** Complete route coverage for all API endpoints

1. ✅ **`/email-notifications` routes**

   - File: `backend/tests/integration/api/email-notifications-api.integration.test.ts`
   - Test CRUD operations, auth, error handling

2. ✅ **`/uploads` routes**

   - File: `backend/tests/integration/api/uploads-api.integration.test.ts`
   - Test file upload, validation, size limits, auth

3. ✅ **`/audit-logs` routes**

   - File: `backend/tests/integration/api/audit-logs-api.integration.test.ts`
   - Test retrieval, filtering, pagination, admin auth

4. ✅ **Root API info endpoint (`GET /`)**

   - File: `backend/tests/integration/api/api-info.integration.test.ts`
   - Test response structure, documentation format

5. ✅ **`/monitor` routes (enhancement)**
   - File: `backend/tests/integration/api/monitor-api.integration.test.ts`
   - Expand beyond health/metrics to all monitor endpoints

### Phase 4: Frontend Critical Pages (Week 6-7)

**Goal:** Test user-facing pages with critical functionality

1. ✅ **`Login.tsx`**

   - Priority: CRITICAL
   - Test auth flows, validation, error states

2. ✅ **`Register.tsx`**

   - Priority: CRITICAL
   - Test registration flow, validation, success/error

3. ✅ **`Dashboard.tsx`**

   - Priority: HIGH
   - Test data display, loading states, permissions

4. ✅ **`Profile.tsx`**

   - Priority: HIGH
   - Test profile editing, avatar upload, validation

5. ✅ **`GuestRegistration.tsx`**

   - Priority: HIGH
   - Test public registration flow, form validation

6. ✅ **`GuestConfirmation.tsx`**

   - Priority: HIGH
   - Test confirmation actions, error states

7. ✅ **`PublicEvent.tsx`**
   - Priority: HIGH
   - Test public event display, registration CTA

### Phase 5: Frontend Low-Coverage Components (Week 8-9)

**Goal:** Increase component coverage from 57% to 80%+

1. ✅ **`App.tsx`** - 0% → 80%+

   - Test routing, layout rendering, protected routes

2. ✅ **`GuestEventSignup.tsx`** - 0% → 80%+

   - Test signup form, validation, submission

3. ✅ **`MentorsPicker.tsx`** - 0% → 80%+

   - Test selection UI, search, validation

4. ✅ **`NotificationDropdown.tsx`** - 9% → 80%+

   - Test notification display, actions, realtime updates

5. ✅ **`EventDeletionModal.tsx`** - 15% → 80%+

   - Test confirmation flow, cascading effects display

6. ✅ **`NotificationPromptModal.tsx`** - 17% → 80%+
   - Test permission prompts, user actions

### Phase 6: Frontend Hooks & Utilities (Week 10)

**Goal:** Test custom hooks and utility functions

1. ✅ **Audit all hooks in `src/hooks/`**

   - Identify untested hooks
   - Create test files for each

2. ✅ **Test utility functions**
   - Date/time utilities
   - Formatting utilities
   - Validation utilities
   - API client utilities

### Phase 7: Edge Cases & Branch Coverage (Week 11-12)

**Goal:** Increase branch coverage to 85%+

1. ✅ **Backend branch coverage**

   - Audit existing tests for uncovered branches
   - Add tests for error paths, edge cases
   - Focus on conditionals in high-value code

2. ✅ **Frontend branch coverage**
   - Test conditional rendering paths
   - Test error boundaries
   - Test permission/role-based UI variations

### Phase 8: E2E Critical Paths (Week 13-14)

**Goal:** Add E2E tests for critical user journeys

1. ✅ **User registration → event creation → guest signup**

   - Full happy path E2E test

2. ✅ **Payment flow E2E**

   - Program enrollment → payment → confirmation

3. ✅ **Admin workflows**
   - User management, audit logs, analytics

---

## Success Metrics

### Target Coverage Thresholds

#### Backend

- **Lines:** 85% → **90%**
- **Statements:** 85% → **90%**
- **Functions:** 85% → **90%**
- **Branches:** 80% → **85%**

#### Frontend

- **Lines:** 57% → **85%**
- **Statements:** 57% → **85%**
- **Functions:** 41% → **80%**
- **Branches:** 68% → **80%**

### Quality Metrics

- ✅ All controllers have unit tests
- ✅ All services have unit tests
- ✅ All routes have integration tests
- ✅ All critical pages have component tests
- ✅ All custom hooks have tests
- ✅ No `.only` or `.skip` in committed tests
- ✅ All tests pass on CI/CD

---

## Test Coverage Commands

### Run All Tests

```bash
# Root
npm test

# Backend only
npm run test:backend

# Frontend only
npm run test:frontend
```

### Run with Coverage

```bash
# Backend with coverage
cd backend && npm run test:coverage

# Frontend with coverage
cd frontend && npm run test:coverage
```

### Run Specific Test Files

```bash
# Backend integration test
cd backend && npm run test:integration:one tests/integration/api/uploads-api.integration.test.ts

# Backend unit test
cd backend && npx vitest run tests/unit/controllers/userController.test.ts

# Frontend test
cd frontend && npx vitest run src/test/pages/Login.test.tsx
```

---

## Notes & Conventions

- Follow conventions in `.github/instructions/test.instructions.md`
- Use test database: `localhost:27017/atcloud-signup-test`
- Integration tests should clean up after themselves
- Mock external services (Stripe, email) in unit tests
- Use realistic test data that matches production patterns
- Test both happy paths and error conditions
- Include edge cases (null/undefined, empty arrays, boundary values)

---

## Dead Code Identification Strategy

As coverage increases, we'll identify:

1. **Unreachable code** - Functions/branches never executed in tests
2. **Deprecated code** - Old implementations still in codebase
3. **Duplicate logic** - Similar functionality in multiple places

**Process:**

1. Achieve 85%+ coverage
2. Run coverage reports to identify 0% covered code
3. Investigate: Is it dead code or missing tests?
4. If dead → Remove it
5. If needed → Add tests

This aligns with our ultimate purpose: **"leverage the test suite and steadily increasing coverage to pinpoint dead code"**

---

_This audit provides a clear, actionable roadmap to achieve near-100% test coverage while identifying and removing dead code._
