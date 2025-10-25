# Route Coverage Analysis for Task 7

**Created:** 2025-01-16  
**Purpose:** Systematic mapping of routes in `routes/index.ts` to existing integration tests

## Routes Mounted in `routes/index.ts`

| Route Path                 | Router Module                 | Test File(s)                                                                                 | Status      |
| -------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------- | ----------- |
| `/auth`                    | authRoutes                    | ✅ `auth-api.test.ts`, `auth-username.test.ts`                                               | **Covered** |
| `/users`                   | userRoutes                    | ✅ `users-api.test.ts`                                                                       | **Covered** |
| `/events`                  | eventRoutes                   | ✅ `events-api.test.ts` + 40+ event test files                                               | **Covered** |
| `/events/*`                | guestRoutes                   | ✅ `guests-api.integration.test.ts` + 15+ guest tests                                        | **Covered** |
| `/notifications`           | notificationRoutes            | ✅ `notifications-*.test.ts` files                                                           | **Covered** |
| `/email-notifications`     | emailNotificationRouter       | ❓ NOT FOUND                                                                                 | **MISSING** |
| `/analytics`               | analyticsRoutes               | ✅ `analytics-api.integration.test.ts` + export tests                                        | **Covered** |
| `/search`                  | searchRoutes                  | ✅ `search-api.integration.test.ts`                                                          | **Covered** |
| `/system`                  | systemRoutes                  | ✅ `system-health.integration.test.ts`, `system-metrics.integration.test.ts`                 | **Covered** |
| `/monitor`                 | monitorRoutes                 | ⚠️ Only health/metrics, not full monitor routes                                              | **PARTIAL** |
| `/guest-migration`         | guestMigrationRoutes          | ✅ `guest-migration.integration.test.ts`                                                     | **Covered** |
| `/feedback`                | feedbackRoutes                | ✅ `feedback.integration.test.ts`                                                            | **Covered** |
| `/uploads`                 | uploadsRoutes                 | ❓ NOT FOUND                                                                                 | **MISSING** |
| `/role-assignments/reject` | roleAssignmentRejectionRoutes | ✅ `role-assignment-rejection.integration.test.ts`                                           | **Covered** |
| `/programs`                | programRoutes                 | ✅ `programs-*.integration.test.ts` (5+ files)                                               | **Covered** |
| `/audit-logs`              | auditLogRoutes                | ❓ NOT FOUND                                                                                 | **MISSING** |
| `/public`                  | publicEventsRoutes            | ✅ `public-events-*.integration.test.ts` (15+ files)                                         | **Covered** |
| `/public/short-links`      | shortLinkRoutes               | ✅ `short-links*.integration.test.ts` (7 files)                                              | **Covered** |
| `/roles-templates`         | rolesTemplatesRoutes          | ✅ `roles-templates.integration.test.ts`                                                     | **Covered** |
| `/purchases`               | purchaseRoutes                | ✅ `purchases-api.integration.test.ts` + variants                                            | **Covered** |
| `/admin/purchases`         | adminPurchaseRoutes           | ✅ `admin-income-history.integration.test.ts`                                                | **Covered** |
| `/webhooks`                | webhookRoutes                 | ✅ `webhooks-purchase.integration.test.ts`, `webhooks-stripe-middleware.integration.test.ts` | **Covered** |
| `/promo-codes`             | promoCodeRoutes               | ✅ `promoCodes.integration.test.ts`, `promoCodes-extended.integration.test.ts`               | **Covered** |

## Health Check Endpoints (from routes/index.ts)

| Endpoint      | Handler      | Test File                              | Status      |
| ------------- | ------------ | -------------------------------------- | ----------- |
| `GET /health` | Health check | ✅ `system-health.integration.test.ts` | **Covered** |
| `GET /`       | API info     | ❓ NOT FOUND                           | **MISSING** |

## Summary

### Coverage Statistics

- **Total routes mounted:** 22+
- **Fully covered:** 19 routes
- **Partially covered:** 1 route (`/monitor`)
- **Missing coverage:** 4 items
  1. `/email-notifications` - Email notification router
  2. `/uploads` - Upload routes
  3. `/audit-logs` - Audit log routes
  4. `GET /` - API info endpoint

### Tests to Create for Task 7

#### 1. Email Notifications Route Tests

**File:** `backend/tests/integration/api/email-notifications-api.integration.test.ts`
**Routes to test:**

- Determine actual endpoints from `backend/src/routes/emailNotifications.ts`
- Test email notification CRUD operations
- Test authentication/authorization
- Test error handling

#### 2. Uploads Route Tests

**File:** `backend/tests/integration/api/uploads-api.integration.test.ts`
**Routes to test:**

- Determine actual endpoints from `backend/src/routes/uploads.ts`
- Test file upload endpoints
- Test authentication/authorization
- Test file validation
- Test error handling (invalid files, size limits, etc.)

#### 3. Audit Logs Route Tests

**File:** `backend/tests/integration/api/audit-logs-api.integration.test.ts`
**Routes to test:**

- Determine actual endpoints from `backend/src/routes/auditLogs.ts`
- Test audit log retrieval
- Test filtering and pagination
- Test authorization (likely admin-only)
- Test error handling

#### 4. API Info Endpoint Test

**File:** `backend/tests/integration/api/api-info.integration.test.ts`
**Route to test:**

- `GET /` - API information endpoint
- Verify response structure
- Check endpoint documentation format
- Validate returned endpoint list

#### 5. Monitor Routes (Enhancement)

**File:** `backend/tests/integration/api/monitor-api.integration.test.ts`
**Enhancement needed:**

- Current tests only cover health/metrics
- Check what other monitor endpoints exist
- Add comprehensive tests for all monitor routes
- Test authentication requirements
- Test monitoring data accuracy

## Next Steps

1. ✅ Analyze route files to understand exact endpoint structure
2. ⏳ Create integration tests for missing routes
3. ⏳ Enhance monitor route coverage
4. ⏳ Run all integration tests to verify
5. ⏳ Document new tests in this file
6. ⏳ Update REFACTORING_BASELINE.md with new test counts

## Investigation Commands

```bash
# Find email notification routes
grep -r "router\." backend/src/routes/emailNotifications.ts

# Find upload routes
grep -r "router\." backend/src/routes/uploads.ts

# Find audit log routes
grep -r "router\." backend/src/routes/auditLogs.ts

# Find monitor routes (beyond health/metrics)
grep -r "router\." backend/src/routes/monitor.ts
```

## Notes

- Most routes have **excellent** integration test coverage
- Missing tests are for utility/admin routes rather than core features
- Monitor routes may already be adequately covered by system-health/system-metrics tests
- API info endpoint (`GET /`) is likely a simple metadata endpoint
