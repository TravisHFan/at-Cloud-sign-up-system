# Phase 2: Test Organization Plan

## Overview

This document outlines the plan for restructuring EmailService tests to align with the new domain-driven architecture. We're moving from a single large EmailService test suite (65 files, ~62 in `infrastructure/`) to domain-specific test files that directly test domain services.

**Status**: Phase 1 COMPLETE ✅ | Phase 2 Planning COMPLETE ✅ | Implementation: NOT STARTED

---

## Current State Analysis

### Existing Test Structure

**Location**: `backend/tests/unit/services/infrastructure/`

**Test Files**: 62 EmailService test files covering:

- Main test file: `EmailService.test.ts` (1,036 lines)
- Specialized test files: 61 additional files testing specific edge cases, branches, and scenarios

**Total Test Count**: Part of 2,494 unit tests

**Additional Email Tests**:

- `tests/unit/services/emailService.*.test.ts` (3 files - lowercase)
- `tests/unit/controllers/emailNotificationController.test.ts`
- `tests/integration/api/email-notifications-api.integration.test.ts`

### Domain Services Structure

**Location**: `backend/src/services/email/domains/`

**Services** (8 total):

1. **AuthEmailService.ts** (250 lines, 8 methods)

   - sendVerificationEmail
   - sendPasswordResetEmail
   - sendPasswordChangeRequestEmail
   - sendPasswordResetSuccessEmail
   - sendWelcomeEmail
   - sendAccountDeactivationEmail
   - sendAccountReactivationEmail

2. **EventEmailService.ts** (1,320 lines, 11 methods)

   - sendEventNotificationEmailBulk
   - sendEventAutoUnpublishNotification
   - sendEventNotificationEmail
   - sendEventCreatedEmail
   - sendCoOrganizerAssignedEmail
   - sendEventReminderEmail
   - sendEventReminderEmailBulk
   - sendEventRoleAssignedEmail
   - sendEventRoleRemovedEmail
   - sendEventRoleMovedEmail
   - sendEventRoleAssignmentRejectedEmail

3. **RoleEmailService.ts** (1,400 lines, 10 methods)

   - sendPromotionNotificationToUser
   - sendPromotionNotificationToAdmins
   - sendDemotionNotificationToUser
   - sendDemotionNotificationToAdmins
   - sendAtCloudRoleChangeToUser
   - sendAtCloudRoleChangeToAdmins
   - sendNewLeaderSignupEmail
   - sendAtCloudRoleAssignedToAdmins
   - sendAtCloudRoleRemovedToAdmins
   - sendCoOrganizerAssignedEmail (duplicate from EventEmailService - needs resolution)

4. **GuestEmailService.ts** (650 lines, 3 methods)

   - sendGuestConfirmationEmail
   - sendGuestDeclineNotification
   - sendGuestRegistrationNotification

5. **UserEmailService.ts** (240 lines, 4 methods)

   - sendUserDeactivatedAlertToAdmin
   - sendUserReactivatedAlertToAdmin
   - sendUserDeletedAlertToAdmin
   - sendNewAtCloudLeaderSignupToAdmins

6. **PurchaseEmailService.ts** (80 lines, 1 method)

   - sendPurchaseConfirmationEmail

7. **PromoCodeEmailService.ts** (460 lines, 3 methods)

   - sendStaffPromoCodeEmail
   - sendPromoCodeDeactivatedEmail
   - sendPromoCodeReactivatedEmail

8. **UtilityEmailService.ts** (70 lines, 1 method)
   - sendGenericNotificationEmail

---

## Target Test Structure

### New Directory Layout

```
backend/tests/unit/services/email/domains/
├── AuthEmailService.test.ts
├── EventEmailService.test.ts
├── RoleEmailService.test.ts
├── GuestEmailService.test.ts
├── UserEmailService.test.ts
├── PurchaseEmailService.test.ts
├── PromoCodeEmailService.test.ts
└── UtilityEmailService.test.ts

backend/tests/unit/services/email/
├── EmailTransporter.test.ts (existing)
├── EmailDeduplication.test.ts (existing)
└── EmailHelpers.test.ts (existing)

backend/tests/unit/services/infrastructure/
├── EmailServiceFacade.test.ts (new - facade delegation tests)
└── [legacy files to be archived/removed]
```

### Test File Mapping Strategy

#### 1. AuthEmailService.test.ts

**Tests to migrate from**:

- `EmailService.test.ts` - sections covering verification, password reset, welcome emails
- Pattern match: `sendVerification`, `sendPasswordReset`, `sendWelcome`, `sendAccount`

**Coverage target**: 8 methods × ~5-10 test cases each = 40-80 tests

#### 2. EventEmailService.test.ts

**Tests to migrate from**:

- `EmailService.comprehensive.test.ts` - event notification sections
- `EmailService.eventCreated-*.test.ts` (multiple files)
- `EmailService.coOrganizer*.test.ts` (multiple files)
- `EmailService.reminder-*.test.ts` (multiple files)
- Pattern match: `sendEvent`, `sendCoOrganizer`, `sendReminder`, `Role`

**Coverage target**: 11 methods × ~10-15 test cases each = 110-165 tests

#### 3. RoleEmailService.test.ts

**Tests to migrate from**:

- `EmailService.promotion-*.test.ts` (multiple files)
- `EmailService.demotion-*.test.ts` (multiple files)
- `EmailService.atcloud-role-*.test.ts` (multiple files)
- `EmailService.admin-demotion-*.test.ts` (multiple files)
- `EmailService.newLeader*.test.ts`
- Pattern match: `Promotion`, `Demotion`, `AtCloud`, `NewLeader`

**Coverage target**: 10 methods × ~15-20 test cases each = 150-200 tests

#### 4. GuestEmailService.test.ts

**Tests to migrate from**:

- `EmailService.guest-*.test.ts` (multiple files)
- `emailService.guestConfirmation.*.test.ts`
- Pattern match: `guest`, `Guest`

**Coverage target**: 3 methods × ~10-15 test cases each = 30-45 tests

#### 5. UserEmailService.test.ts

**Tests to migrate from**:

- `EmailService.test.ts` - user admin alert sections
- Pattern match: `UserDeactivated`, `UserReactivated`, `UserDeleted`

**Coverage target**: 4 methods × ~8-12 test cases each = 32-48 tests

#### 6. PurchaseEmailService.test.ts

**Tests to migrate from**:

- `EmailService.test.ts` - purchase confirmation section
- Pattern match: `Purchase`

**Coverage target**: 1 method × ~10-15 test cases = 10-15 tests

#### 7. PromoCodeEmailService.test.ts

**Tests to migrate from**:

- `EmailService.test.ts` - promo code sections
- Pattern match: `PromoCode`, `Staff`

**Coverage target**: 3 methods × ~10-15 test cases each = 30-45 tests

#### 8. UtilityEmailService.test.ts

**Tests to migrate from**:

- `EmailService.test.ts` - generic notification section
- Pattern match: `Generic`

**Coverage target**: 1 method × ~8-10 test cases = 8-10 tests

---

## Testing Strategy Changes

### Current Approach (Phase 1)

```typescript
// Mock the entire EmailServiceFacade
vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendWelcomeEmail: vi.fn(),
    // ... all 39 methods
  },
}));

// Test calls the facade
await EmailService.sendWelcomeEmail("test@example.com", "Test User");
expect(EmailService.sendWelcomeEmail).toHaveBeenCalled();
```

**Problem**: Tests don't verify the actual business logic in domain services

### New Approach (Phase 2)

```typescript
// Import the domain service directly
import { AuthEmailService } from "../../../../src/services/email/domains/AuthEmailService";
import { EmailTransporter } from "../../../../src/services/email/EmailTransporter";

// Mock only the transport layer
vi.mock("../../../../src/services/email/EmailTransporter", () => ({
  EmailTransporter: {
    send: vi.fn().mockResolvedValue({ messageId: "test-id" }),
  },
}));

// Spy on the actual domain service method
const sendSpy = vi.spyOn(AuthEmailService, "sendWelcomeEmail");

// Test the real business logic
await AuthEmailService.sendWelcomeEmail("test@example.com", "Test User");

// Verify the domain service was called
expect(sendSpy).toHaveBeenCalledWith("test@example.com", "Test User");

// Verify the transport was called with correct email options
expect(EmailTransporter.send).toHaveBeenCalledWith(
  expect.objectContaining({
    to: "test@example.com",
    subject: expect.stringContaining("Welcome"),
  })
);
```

**Benefits**:

- Tests actual business logic in domain services
- Verifies email content generation
- Catches template/formatting bugs
- Only mocks external dependencies (SMTP transport)

---

## Migration Steps

### Step 1: Create Test Directory Structure

```bash
mkdir -p backend/tests/unit/services/email/domains
```

### Step 2: Create Template Test File

Create a standardized template that all domain test files will follow:

- Mock setup for EmailTransporter
- Test structure with describe blocks per method
- Common test cases: success, validation, error handling, edge cases

### Step 3: Migrate Tests Domain by Domain

**Priority Order** (based on complexity and test count):

1. AuthEmailService (simplest, good starting point)
2. UtilityEmailService (simplest)
3. PurchaseEmailService (simple)
4. GuestEmailService (medium complexity)
5. UserEmailService (medium complexity)
6. PromoCodeEmailService (medium complexity)
7. EventEmailService (high complexity, most methods)
8. RoleEmailService (high complexity, most edge cases)

**For Each Domain**:

1. Create new test file with template
2. Identify all relevant tests from old files
3. Copy/adapt tests to new structure
4. Update mocks to use spies on domain services
5. Run tests to verify they pass
6. Mark old test file for archival

### Step 4: Create EmailServiceFacade.test.ts

Test that the facade correctly delegates to domain services:

```typescript
describe("EmailServiceFacade", () => {
  it("should delegate sendWelcomeEmail to AuthEmailService", async () => {
    const spy = vi.spyOn(AuthEmailService, "sendWelcomeEmail");
    await EmailService.sendWelcomeEmail("test@example.com", "Test");
    expect(spy).toHaveBeenCalledWith("test@example.com", "Test");
  });
  // ... repeat for all 39 methods
});
```

### Step 5: Update Integration Tests

Ensure integration tests use real EmailServiceFacade and only mock SMTP transport:

- `email-notifications-api.integration.test.ts`: Update mocks
- Any controller integration tests: Verify they use real services

### Step 6: Archive Legacy Test Files

Move old test files to `backend/tests/unit/services/infrastructure/_archived/`:

- Keep for reference during migration
- Remove after Phase 2 validation
- Document any tests that weren't migrated (if any)

---

## Test Coverage Goals

### Unit Test Coverage Targets

- **Each domain service method**: 90%+ line coverage
- **Edge cases**: All error paths tested
- **Validation**: All input validation tested
- **Email content**: Subject lines, body content, attachments verified

### Integration Test Coverage

- **Full flow tests**: User registration → verification email → welcome email
- **Event flows**: Event creation → notifications → reminders
- **Role changes**: Promotion/demotion flows with notifications
- **Guest flows**: Invitation → confirmation → registration

---

## Naming Conventions

### Test File Names

```
[ServiceName].test.ts
```

Examples: `AuthEmailService.test.ts`, `EventEmailService.test.ts`

### Test Description Structure

```typescript
describe("AuthEmailService", () => {
  describe("sendVerificationEmail", () => {
    it("should send verification email with correct subject and content", async () => {
      // test
    });

    it("should include verification URL with token", async () => {
      // test
    });

    it("should handle missing name gracefully", async () => {
      // test
    });

    it("should throw error if email is invalid", async () => {
      // test
    });
  });

  describe("sendPasswordResetEmail", () => {
    // ...
  });
});
```

---

## Success Criteria

### Phase 2.1 Complete When:

- ✅ Test organization plan documented
- ✅ Directory structure defined
- ✅ Migration strategy agreed upon
- ✅ Test template created
- ✅ Coverage goals established

### Phase 2 Complete When:

- All 8 domain test files created
- All relevant tests migrated from legacy files
- EmailServiceFacade.test.ts created
- Integration tests updated
- All 2,494+ tests passing
- No decrease in coverage percentage
- Legacy test files archived
- Changes committed to git

---

## Risk Mitigation

### Potential Issues

1. **Test Duplication**: Some tests cover multiple domains

   - **Solution**: Keep tests in most relevant domain, add cross-reference comments

2. **Complex Mock Setup**: Some tests have intricate mock chains

   - **Solution**: Create test helpers/fixtures for common mock setups

3. **Coverage Gaps**: Some edge cases might be missed during migration

   - **Solution**: Run coverage reports before/after, ensure no decrease

4. **Breaking Changes**: Tests might fail after migration

   - **Solution**: Migrate incrementally, run full suite after each domain

5. **Time Estimate**: 62 test files is a lot to migrate
   - **Solution**: Prioritize by domain, can pause after each domain milestone

---

## Estimated Timeline

- **Phase 2.1** (Planning): COMPLETE ✅
- **Phase 2.2** (Implementation): 2-3 days
  - Day 1: AuthEmail, Utility, Purchase (3 simple domains)
  - Day 2: Guest, User, PromoCode (3 medium domains)
  - Day 3: Event, Role (2 complex domains) + EmailServiceFacade
- **Phase 2.3** (Spy refactoring): 1 day
- **Phase 2.4** (Integration tests): 1 day
- **Phase 2.5** (Validation): 0.5 day

**Total**: 4.5-5.5 days

---

## Next Steps

1. **Review this plan** with team/user
2. **Create test template** (standardized structure)
3. **Start with AuthEmailService** (simplest domain)
4. **Validate approach** with first domain before proceeding
5. **Continue incrementally** through remaining domains

---

## Notes

- Keep this document updated as we progress
- Document any deviations from the plan
- Track test count before/after to ensure completeness
- Celebrate small wins after each domain! 🎉
