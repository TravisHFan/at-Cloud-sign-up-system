# Codebase Audit: Refactoring & Reuse Opportunities

**Date**: November 4, 2025  
**Scope**: Post-Giant File Refactoring Project  
**Status**: 20/20 giant files complete, now auditing remaining large files

---

## Executive Summary

After successfully completing the Giant File Refactoring Project (40,829 → 4,383 lines, 89.3% reduction), this audit identifies **remaining opportunities for refactoring and code reuse** across the codebase.

**Key Findings**:

- 🔴 **4 High-Priority Files** (800-1,430 lines) requiring immediate attention
- 🟡 **8 Medium-Priority Files** (650-800 lines) with extraction opportunities
- 🟢 **Pattern Replication** across email services and event controllers
- ♻️ **Code Duplication** in event-related UI components

**Estimated Impact**: 5,000+ lines can be reduced through strategic refactoring

---

## 🔴 HIGH PRIORITY: Large Files Requiring Refactoring

### 1. RoleEmailService.ts (1,430 lines) ⚠️ HIGHEST PRIORITY

**Location**: `backend/src/services/email/domains/RoleEmailService.ts`

**Current State**:

- 12 static methods for role-related emails
- Heavy duplication of email template structure
- Each method has similar pattern: build HTML → send email
- 1,430 lines with repetitive HTML generation code

**Issues**:

- ❌ Massive HTML strings embedded in TypeScript code
- ❌ Duplicate email template patterns across 12 methods
- ❌ No template reuse or composition
- ❌ Hard to maintain styling consistency
- ❌ Testing requires mocking entire email HTML

**Refactoring Opportunities**:

#### Option A: Template-Based Approach (Recommended)

**Extract email templates to separate files:**

```
backend/src/services/email/templates/
  ├── role/
  │   ├── promotion-to-user.hbs      (Handlebars template)
  │   ├── promotion-to-admins.hbs
  │   ├── demotion-to-user.hbs
  │   ├── demotion-to-admins.hbs
  │   ├── atcloud-role-change-user.hbs
  │   ├── atcloud-role-change-admins.hbs
  │   ├── new-leader-signup.hbs
  │   ├── co-organizer-assigned.hbs
  │   └── role-assigned-removed-admins.hbs
  └── shared/
      ├── header.hbs
      ├── footer.hbs
      └── styles.hbs
```

**Refactored Service Structure**:

```typescript
// RoleEmailService.ts (reduced to ~300-400 lines)
export class RoleEmailService {
  private static templateEngine = new EmailTemplateEngine();

  static async sendPromotionNotificationToUser(email, userData, changedBy) {
    const html = await this.templateEngine.render("role/promotion-to-user", {
      userName: `${userData.firstName} ${userData.lastName}`,
      adminName: `${changedBy.firstName} ${changedBy.lastName}`,
      oldRole: userData.oldRole,
      newRole: userData.newRole,
      roleContent: this.getRoleWelcomeContent(userData.newRole),
    });

    return this.sendEmail({ to: email, subject: "...", html });
  }

  private static getRoleWelcomeContent(role: string) {
    // Centralized role content lookup (~50 lines)
  }
}
```

**Benefits**:

- ✅ Reduce from 1,430 → ~400 lines (72% reduction)
- ✅ Separate concerns: templates vs. business logic
- ✅ Easy to update email styling globally
- ✅ Reusable template components (header, footer)
- ✅ Easier to test (mock template engine, not HTML)
- ✅ Non-developers can edit templates

**Estimated Effort**: 2-3 days
**Impact**: High - affects 12 email notification flows

---

#### Option B: HTML Builder Pattern

**Create composable email HTML builders:**

```typescript
// EmailBuilder.ts (new utility)
class EmailBuilder {
  private sections: string[] = [];

  addHeader(title: string, subtitle?: string): this {
    this.sections.push(EmailTemplates.header(title, subtitle));
    return this;
  }

  addWelcomeMessage(content: WelcomeContent): this {
    this.sections.push(EmailTemplates.welcomeMessage(content));
    return this;
  }

  addRoleInfo(oldRole: string, newRole: string): this {
    this.sections.push(EmailTemplates.roleInfo(oldRole, newRole));
    return this;
  }

  build(): string {
    return EmailTemplates.wrap(this.sections.join(''));
  }
}

// Usage in RoleEmailService
static async sendPromotionNotificationToUser(...) {
  const html = new EmailBuilder()
    .addHeader('Congratulations on Your Promotion!')
    .addRoleInfo(userData.oldRole, userData.newRole)
    .addWelcomeMessage(this.getRoleWelcomeContent(userData.newRole))
    .addFooter()
    .build();

  return this.sendEmail({ to: email, subject: '...', html });
}
```

**Benefits**:

- ✅ Reduce from 1,430 → ~600 lines (58% reduction)
- ✅ Type-safe HTML composition
- ✅ Reusable email sections
- ✅ Stays in TypeScript (no new template language)
- ✅ Easier testing with section mocks

**Estimated Effort**: 1-2 days
**Impact**: High - affects 12 email notification flows

---

### 2. EventEmailService.ts (1,249 lines) ⚠️ HIGH PRIORITY

**Location**: `backend/src/services/email/domains/EventEmailService.ts`

**Current State**:

- Similar issues to RoleEmailService
- 15+ static methods for event-related emails
- Repetitive HTML template generation

**Refactoring Strategy**: Apply same template-based approach as RoleEmailService

**Estimated Reduction**: 1,249 → ~450 lines (64% reduction)

---

### 3. EventRoleSignup.tsx (1,055 lines) ⚠️ HIGH PRIORITY

**Location**: `frontend/src/components/events/EventRoleSignup.tsx`

**Current State**:

- Complex component handling role signups, guest invitations, drag-drop
- Contains inline `RoleAgendaEditor` component (100+ lines)
- Multiple modal management states
- Guest contact visibility logic
- Workshop-specific privacy logic

**Structure Analysis**:

```typescript
Lines 1-100:   Imports + RoleAgendaEditor component (inline)
Lines 100-200: EventRoleSignupProps interface + state management
Lines 200-400: Event handlers (signup, cancel, drag-drop, modals)
Lines 400-600: Guest invitation logic + API calls
Lines 600-800: JSX render (role card, participants, guests)
Lines 800-1055: Modals (name card, notification prompt, guest invite)
```

**Issues**:

- ❌ Component handles too many responsibilities
- ❌ RoleAgendaEditor should be separate component
- ❌ Guest invitation logic tightly coupled
- ❌ Modal management scattered across component
- ❌ Difficult to test individual features

**Refactoring Opportunities**:

#### Extract Components (Recommended)

```
frontend/src/components/events/
  ├── EventRoleSignup.tsx (main orchestrator, ~300 lines)
  ├── RoleAgendaEditor.tsx (inline editor, ~120 lines)
  ├── RoleParticipantList.tsx (user + guest list, ~200 lines)
  ├── RoleSignupActions.tsx (signup/cancel buttons, ~150 lines)
  └── GuestInvitationModal.tsx (guest invite flow, ~200 lines)

frontend/src/hooks/
  └── useRoleSignup.ts (signup/cancel/drag-drop logic, ~150 lines)
```

**Refactored Structure**:

```typescript
// EventRoleSignup.tsx (reduced to ~300 lines)
export default function EventRoleSignup(props) {
  const {
    handleSignup,
    handleCancel,
    handleDragStart,
    handleDrop,
    // ... other handlers
  } = useRoleSignup(props);

  return (
    <div className="role-card">
      <RoleHeader role={role} />
      <RoleAgendaEditor role={role} eventId={eventId} />
      <RoleParticipantList
        participants={role.participants}
        guests={guestsByRole[role.id]}
        onDragStart={handleDragStart}
        onDrop={handleDrop}
      />
      <RoleSignupActions
        role={role}
        onSignup={handleSignup}
        onCancel={handleCancel}
      />
      <GuestInvitationModal
        isOpen={guestInviteOpen}
        role={role}
        onClose={() => setGuestInviteOpen(false)}
      />
    </div>
  );
}
```

**Benefits**:

- ✅ Reduce from 1,055 → ~300 lines (72% reduction)
- ✅ Separate concerns: UI vs. business logic
- ✅ Reusable components (RoleAgendaEditor, RoleParticipantList)
- ✅ Easier testing (test hook and components separately)
- ✅ Follows established orchestrator pattern

**Estimated Effort**: 2-3 days
**Impact**: High - used in EventDetail.tsx (888 lines) and multiple tests

---

### 4. StaffCodeCreator.tsx (907 lines) ⚠️ HIGH PRIORITY

**Location**: `frontend/src/components/admin/promo-codes/StaffCodeCreator.tsx`

**Current State**:

- Complex form with multiple modes (personal, general)
- Program selection, expiration date handling
- User selection modal integration
- Heavy state management

**Structure Analysis**:

```typescript
Lines 1-50:   Imports + TypeScript interfaces
Lines 50-100: State management (10+ useState hooks)
Lines 100-300: Form handlers + validation logic
Lines 300-500: API calls + error handling
Lines 500-700: JSX render (form fields, conditional sections)
Lines 700-907: Success modal + result display
```

**Refactoring Opportunities**:

#### Extract Form Components + Hook

```
frontend/src/components/admin/promo-codes/
  ├── StaffCodeCreator.tsx (orchestrator, ~200 lines)
  ├── PersonalCodeForm.tsx (personal code fields, ~150 lines)
  ├── GeneralCodeForm.tsx (general code fields, ~120 lines)
  ├── ProgramSelector.tsx (program selection, ~100 lines)
  ├── ExpirationPicker.tsx (expiration date, ~80 lines)
  └── CodeCreationResult.tsx (success display, ~120 lines)

frontend/src/hooks/
  └── useStaffCodeCreation.ts (API logic, ~150 lines)
```

**Benefits**:

- ✅ Reduce from 907 → ~200 lines (78% reduction)
- ✅ Reusable components (ProgramSelector, ExpirationPicker can be used elsewhere)
- ✅ Cleaner separation: UI vs. business logic
- ✅ Easier testing

**Estimated Effort**: 2 days
**Impact**: Medium - only used in AdminPromoCodes.tsx

---

## 🟡 MEDIUM PRIORITY: Files with Extraction Opportunities

### 5. useEventData.ts (854 lines)

**Location**: `frontend/src/hooks/useEventData.ts`

**Current State**: Complex hook handling event fetching, WebSocket sync, guest mapping

**Refactoring**:

- Extract WebSocket logic to separate hook: `useEventWebSocket.ts` (~200 lines)
- Extract guest mapping logic: `useGuestMapping.ts` (~150 lines)
- Main hook becomes orchestrator: ~400 lines

**Estimated Reduction**: 854 → 400 lines (53% reduction)

---

### 6. CreateEvent.tsx (800 lines)

**Location**: `frontend/src/pages/CreateEvent.tsx`

**Current State**: Already improved from Phase 5.2, but still has inline role management

**Refactoring**: Extract role template selection to `RoleTemplateSelector.tsx`

**Estimated Reduction**: 800 → 600 lines (25% reduction)

---

### 7. EventRolesSection.tsx (789 lines)

**Location**: `frontend/src/components/EventDetail/EventRolesSection.tsx`

**Current State**: Complex section with role cards, drag-drop, management mode

**Refactoring**:

- Extract management mode UI to `RoleManagementControls.tsx` (~150 lines)
- Extract role card list to `RoleCardList.tsx` (~200 lines)

**Estimated Reduction**: 789 → 450 lines (43% reduction)

---

### 8. PublicEvent.tsx (777 lines)

**Location**: `frontend/src/pages/PublicEvent.tsx`

**Current State**: Public event display + guest registration form

**Refactoring**:

- Extract registration form to `PublicRegistrationForm.tsx` (~250 lines)
- Extract event details to reusable component (may share with EventDetail)

**Estimated Reduction**: 777 → 450 lines (42% reduction)

---

### 9. SystemMonitor.tsx (759 lines)

**Location**: `frontend/src/pages/SystemMonitor.tsx`

**Current State**: System monitoring dashboard with stats, health checks, rate limiting

**Refactoring**:

- Extract monitoring cards to separate components (~300 lines)
- Extract rate limiting controls to `RateLimitingControls.tsx` (~100 lines)

**Estimated Reduction**: 759 → 400 lines (47% reduction)

---

### 10. BasicEventFields.tsx (750 lines)

**Location**: `frontend/src/components/EditEvent/BasicEventFields.tsx`

**Current State**: Large form component with many field types

**Refactoring**:

- Already fairly well-organized
- Consider extracting date/time section to `EventDateTimeFields.tsx` (~150 lines)

**Estimated Reduction**: 750 → 600 lines (20% reduction)

---

### 11. useRealtimeEventUpdates.ts (659 lines)

**Location**: `frontend/src/hooks/useRealtimeEventUpdates.ts`

**Current State**: Complex WebSocket hook with multiple event types

**Refactoring**:

- Extract event type handlers to separate file: `eventUpdateHandlers.ts` (~250 lines)
- Use strategy pattern for different update types

**Estimated Reduction**: 659 → 400 lines (39% reduction)

---

### 12. RoleManagement.tsx (661 lines)

**Location**: `frontend/src/components/EditEvent/RoleManagement.tsx`

**Current State**: Role CRUD operations for event editing

**Refactoring**:

- Extract role form to `RoleForm.tsx` (~200 lines)
- Extract role list to `RoleList.tsx` (~150 lines)

**Estimated Reduction**: 661 → 350 lines (47% reduction)

---

## ♻️ CODE REUSE OPPORTUNITIES

### Pattern 1: Email Service Duplication

**Issue**: All email domain services have identical `sendEmail()` wrapper

**Files Affected**:

- `RoleEmailService.ts` (1,430 lines)
- `EventEmailService.ts` (1,249 lines)
- `GuestEmailService.ts` (681 lines)
- `PromoCodeEmailService.ts` (471 lines)
- `AuthEmailService.ts` (~300 lines)
- `UserEmailService.ts` (~250 lines)

**Current Pattern** (repeated 6 times):

```typescript
private static async sendEmail(options: EmailOptions): Promise<boolean> {
  const { EmailService } = await import("../../infrastructure/EmailServiceFacade");
  return EmailService.sendEmail(options);
}
```

**Solution**: Create base class

```typescript
// BaseEmailService.ts (new file)
export abstract class BaseEmailService {
  protected static async sendEmail(options: EmailOptions): Promise<boolean> {
    const { EmailService } = await import("../../infrastructure/EmailServiceFacade");
    return EmailService.sendEmail(options);
  }

  protected static formatDateTimeRange(
    date: string,
    startTime: string,
    endTime?: string,
    endDate?: string,
    timeZone?: string
  ): string {
    return EmailHelpers.formatDateTimeRange(date, startTime, endTime, endDate, timeZone);
  }
}

// Usage
export class RoleEmailService extends BaseEmailService {
  // No need to redefine sendEmail()
  static async sendPromotionNotificationToUser(...) {
    // Just use this.sendEmail()
  }
}
```

**Benefits**:

- ✅ Remove ~100 lines of duplication (20 lines × 6 services = 120 lines)
- ✅ Centralize email sending logic
- ✅ Easier to add cross-cutting concerns (logging, retry logic)

---

### Pattern 2: Event Controller Duplication

**Issue**: Event controllers share similar patterns for validation, error handling, response building

**Files Affected**:

- `UpdateController.ts` (1,297 lines)
- `CreationController.ts` (1,240 lines)
- `RegistrationController.ts` (1,200 lines)

**Common Patterns**:

- Request validation
- Permission checks
- Error handling with ResponseBuilderService
- Logging patterns

**Solution**: Create shared utilities

```typescript
// EventControllerHelpers.ts (new file)
export class EventControllerHelpers {
  static validateEventRequest(req: Request): ValidationResult {
    // Shared validation logic
  }

  static checkEventPermissions(
    event: Event,
    user: User,
    action: string
  ): boolean {
    // Shared permission logic
  }

  static buildErrorResponse(error: Error, context: string): Response {
    // Shared error response building
  }
}
```

**Estimated Impact**: Reduce each controller by ~100-150 lines

---

### Pattern 3: Form Field Components

**Issue**: Duplicate form field patterns across Create/Edit components

**Files with Similar Patterns**:

- `CreateEvent.tsx` (800 lines)
- `EditEvent.tsx` (651 lines)
- `BasicEventFields.tsx` (750 lines)
- `CreateNewProgram.tsx` (262 lines)
- `EditProgram.tsx` (657 lines)

**Opportunity**: Create reusable form field library

```
frontend/src/components/forms/
  ├── FormField.tsx (wrapper with label, error, help text)
  ├── TextField.tsx
  ├── TextAreaField.tsx
  ├── SelectField.tsx
  ├── DateField.tsx
  ├── TimeField.tsx
  └── CheckboxField.tsx
```

**Benefits**:

- ✅ Consistent form styling
- ✅ Reduce duplication across forms
- ✅ Easier to add form features (validation, accessibility)

---

## 📊 ESTIMATED IMPACT SUMMARY

### High Priority Refactoring

| File                 | Current   | Target    | Reduction | Effort        |
| -------------------- | --------- | --------- | --------- | ------------- |
| RoleEmailService.ts  | 1,430     | 400       | 72%       | 2-3 days      |
| EventEmailService.ts | 1,249     | 450       | 64%       | 2-3 days      |
| EventRoleSignup.tsx  | 1,055     | 300       | 72%       | 2-3 days      |
| StaffCodeCreator.tsx | 907       | 200       | 78%       | 2 days        |
| **Subtotal**         | **4,641** | **1,350** | **71%**   | **8-11 days** |

### Medium Priority Refactoring

| File                       | Current   | Target    | Reduction | Effort        |
| -------------------------- | --------- | --------- | --------- | ------------- |
| useEventData.ts            | 854       | 400       | 53%       | 1 day         |
| CreateEvent.tsx            | 800       | 600       | 25%       | 1 day         |
| EventRolesSection.tsx      | 789       | 450       | 43%       | 1-2 days      |
| PublicEvent.tsx            | 777       | 450       | 42%       | 1-2 days      |
| SystemMonitor.tsx          | 759       | 400       | 47%       | 1-2 days      |
| BasicEventFields.tsx       | 750       | 600       | 20%       | 0.5 day       |
| useRealtimeEventUpdates.ts | 659       | 400       | 39%       | 1 day         |
| RoleManagement.tsx         | 661       | 350       | 47%       | 1 day         |
| **Subtotal**               | **6,049** | **3,650** | **40%**   | **8-11 days** |

### Code Reuse Opportunities

| Pattern                  | Files Affected | Savings          | Effort           |
| ------------------------ | -------------- | ---------------- | ---------------- |
| Email Service Base Class | 6 files        | ~120 lines       | 0.5 day          |
| Event Controller Helpers | 3 files        | ~400 lines       | 1 day            |
| Form Field Library       | 5+ files       | ~500 lines       | 2-3 days         |
| **Subtotal**             | **14 files**   | **~1,020 lines** | **3.5-4.5 days** |

---

## 🎯 RECOMMENDED PHASED APPROACH

### Phase 1: Quick Wins (1-2 weeks)

**Focus**: Code reuse patterns - low risk, high value

1. Create `BaseEmailService` class (0.5 day)
2. Refactor all email services to extend base (1 day)
3. Extract `EventControllerHelpers` utilities (1 day)
4. Create reusable form field components (2-3 days)

**Expected Impact**: ~1,500 lines reduced, foundation for future work

---

### Phase 2: High-Priority Components (2-3 weeks)

**Focus**: Large frontend components

1. **EventRoleSignup.tsx** (2-3 days)

   - Extract RoleAgendaEditor, RoleParticipantList, GuestInvitationModal
   - Create useRoleSignup hook
   - Test thoroughly (used in multiple places)

2. **StaffCodeCreator.tsx** (2 days)
   - Extract form components
   - Create useStaffCodeCreation hook
   - Simpler than EventRoleSignup (only used in one place)

**Expected Impact**: ~1,700 lines reduced, improved maintainability

---

### Phase 3: Email Service Templates (2-3 weeks)

**Focus**: Backend email services

1. **Setup template engine** (1 day)

   - Choose Handlebars or similar
   - Create template directory structure
   - Add template rendering to build process

2. **RoleEmailService.ts** (2-3 days)

   - Extract 9 email templates
   - Refactor service to use templates
   - Test all email flows thoroughly

3. **EventEmailService.ts** (2-3 days)
   - Extract 15 email templates
   - Refactor service to use templates
   - Test all email flows thoroughly

**Expected Impact**: ~2,200 lines reduced, easier email maintenance

---

### Phase 4: Medium-Priority Components (2-3 weeks)

**Focus**: Remaining large files

1. Extract hooks: useEventData, useRealtimeEventUpdates
2. Refactor pages: PublicEvent, SystemMonitor, CreateEvent
3. Refactor components: EventRolesSection, RoleManagement, BasicEventFields

**Expected Impact**: ~2,400 lines reduced, complete refactoring coverage

---

## ✅ SUCCESS CRITERIA

### Code Quality Metrics

- [ ] No files exceed 800 lines (current threshold: 1,430 lines)
- [ ] All email services use template engine
- [ ] 80%+ code reuse for form fields
- [ ] All hooks < 500 lines
- [ ] All page components < 600 lines

### Testing Metrics

- [ ] Maintain 100% test pass rate (3,249/3,249)
- [ ] Zero regressions in existing functionality
- [ ] Add tests for extracted components/hooks

### Maintainability Metrics

- [ ] Email templates editable without code changes
- [ ] Form fields reusable across 5+ components
- [ ] Clear separation of concerns (UI, logic, data)

---

## 🚀 NEXT STEPS

### Immediate Actions (This Week)

1. **Review this audit** with team
2. **Prioritize phases** based on team capacity
3. **Create detailed plan** for Phase 1 (quick wins)
4. **Set up tracking** for refactoring progress

### Long-Term Strategy

1. **Establish coding standards** to prevent future giant files
2. **Create component library** documentation
3. **Regular audits** (quarterly) to catch accumulation early
4. **Knowledge sharing** sessions on refactoring patterns

---

## 📚 REFERENCES

- [GIANT_FILE_REFACTORING_MASTER_PLAN.md](./GIANT_FILE_REFACTORING_MASTER_PLAN.md) - Completed project
- [REFACTORING_COMPLETION_SUMMARY.md](./REFACTORING_COMPLETION_SUMMARY.md) - Project achievements
- [PHASE_7.3_EVENTDETAIL_ASSESSMENT.md](./PHASE_7.3_EVENTDETAIL_ASSESSMENT.md) - Optimal state example

---

**Audit Complete** ✅  
**Estimated Total Impact**: 5,000+ lines reduced (47% reduction across audited files)  
**Estimated Total Effort**: 20-30 working days  
**ROI**: High - improved maintainability, reduced technical debt, easier onboarding
