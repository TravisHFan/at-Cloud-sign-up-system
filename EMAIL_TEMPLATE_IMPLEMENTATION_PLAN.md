# Email Template Implementation Plan

## 📋 Current Status Analysis

### ✅ Already Implemented Email Methods

- `sendEmail()` - Core email sending functionality
- `sendVerificationEmail()` - Account verification emails
- `sendPasswordResetEmail()` - Password reset emails
- `sendEventNotificationEmail()` - Event notification emails
- `sendWelcomeEmail()` - Welcome emails for new users
- `sendEventCreatedEmail()` - **NEW EVENT CREATION** (✅ Complete with HTML template)
- `sendPromotionNotificationToUser()` - **PATTERN 1** (✅ Complete with HTML template)

### ❌ Missing Email Methods (Need Implementation)

1. ~~`sendPromotionNotificationToUser()` - User promotion notification~~ ✅ **COMPLETED**
2. ~~`sendPromotionNotificationToAdmins()` - Admin notification of user promotion~~ ✅ **COMPLETED**
3. ~~`sendDemotionNotificationToUser()` - User demotion notification~~ ✅ **COMPLETED**
4. ~~`sendDemotionNotificationToAdmins()` - Admin notification of user demotion~~ ✅ **COMPLETED**
5. ~~`sendAtCloudRoleChangeEmail()` - Ministry role changes~~ ✅ **COMPLETED & TESTED**
6. ~~`sendNewLeaderSignupEmail()` - New leader notifications to admins~~ ✅ **COMPLETED & TESTED**
7. ~~`sendCoOrganizerAssignedEmail()` - Co-organizer assignment notifications~~ ✅ **COMPLETED & TESTED**
8. `sendEventReminderEmail()` - Event reminder notifications

**Total: 1 email method remaining** (7/8 completed - 87.5% COMPLETE! 🚀)

---

## 🎯 Implementation Plan

### Phase 1: System Authorization Change Email Templates (4 Patterns)

**File**: `/backend/src/services/infrastructure/emailService.ts`

#### Role Hierarchy (Highest to Lowest):

1. **Super Admin** - Full system control
2. **Administrator** - System management
3. **Leader** - Ministry leadership
4. **Participant** - Basic member

#### The 4 Email Patterns Required:

##### Pattern 1: Promotion Notification to Promoted User ✅ COMPLETED

```typescript
static async sendPromotionNotificationToUser(
  email: string,
  userData: {
    firstName: string;
    lastName: string;
    oldRole: string;
    newRole: string;
  },
  changedBy: {
    firstName: string;
    lastName: string;
    role: string;
  }
): Promise<boolean>
```

**Key Features:** ✅ IMPLEMENTED

- ✅ Congratulatory tone celebrating the promotion
- ✅ Highlight new responsibilities and permissions
- ✅ Welcome to new role messaging
- ✅ Link to dashboard to explore new capabilities
- ✅ Encourage spiritual growth and service
- ✅ Role-specific welcome content and icons
- ✅ Biblical verse inclusion
- ✅ Mobile-responsive design

##### Pattern 2: Promotion Notification to Super Admin & Administrator

```typescript
static async sendPromotionNotificationToAdmins(
  adminEmail: string,
  adminName: string,
  userData: {
    firstName: string;
    lastName: string;
    email: string;
    oldRole: string;
    newRole: string;
  },
  changedBy: {
    firstName: string;
    lastName: string;
    role: string;
  }
): Promise<boolean>
```

**Key Features:**

- Professional administrative notification
- Include user details and role change summary
- Show who performed the promotion
- Link to user management dashboard
- Action needed indicators (if any)

##### Pattern 3: Demotion Notification to Demoted User

```typescript
static async sendDemotionNotificationToUser(
  email: string,
  userData: {
    firstName: string;
    lastName: string;
    oldRole: string;
    newRole: string;
  },
  changedBy: {
    firstName: string;
    lastName: string;
    role: string;
  },
  reason?: string
): Promise<boolean>
```

**Key Features:**

- Sensitive, respectful tone
- Explain role change professionally
- Provide support and guidance
- Optional reason field for transparency
- Encourage continued participation
- Contact information for questions

##### Pattern 4: Demotion Notification to Super Admin & Administrator

```typescript
static async sendDemotionNotificationToAdmins(
  adminEmail: string,
  adminName: string,
  userData: {
    firstName: string;
    lastName: string;
    email: string;
    oldRole: string;
    newRole: string;
  },
  changedBy: {
    firstName: string;
    lastName: string;
    role: string;
  },
  reason?: string
): Promise<boolean>
```

**Key Features:**

- Administrative record notification
- Include user details and demotion summary
- Show who performed the demotion and reason
- Link to user management dashboard
- Follow-up action indicators

---

### Phase 2: AtCloud Ministry Role Change Email Template

**File**: `/backend/src/services/infrastructure/emailService.ts`

#### Method Signature:

```typescript
static async sendAtCloudRoleChangeEmail(
  email: string,
  userData: {
    firstName: string;
    lastName: string;
    email: string;
    oldRoleInAtCloud: string;
    newRoleInAtCloud: string;
  }
): Promise<boolean>
```

#### Key Features:

- Ministry-focused notification design
- Highlight spiritual leadership responsibility
- Include ministry-specific guidance
- Connect to ministry dashboard/resources

---

### Phase 3: New Leader Signup Notification (Admin Alert)

**File**: `/backend/src/services/infrastructure/emailService.ts`

#### Method Signature:

```typescript
static async sendNewLeaderSignupEmail(
  adminEmail: string,
  newLeaderData: {
    firstName: string;
    lastName: string;
    email: string;
    roleInAtCloud: string;
    signupDate: string;
  }
): Promise<boolean>
```

#### Key Features:

- Admin notification about new leader registration
- Include new leader's ministry role
- Quick action buttons (approve/review)
- Link to admin dashboard for leader management

---

### Phase 4: Co-Organizer Assignment Notification

**File**: `/backend/src/services/infrastructure/emailService.ts`

#### Method Signature:

```typescript
static async sendCoOrganizerAssignedEmail(
  coOrganizerEmail: string,
  assignedUser: {
    firstName: string;
    lastName: string;
  },
  eventData: {
    title: string;
    date: string;
    time: string;
    location: string;
  },
  assignedBy: {
    firstName: string;
    lastName: string;
  }
): Promise<boolean>
```

#### Key Features:

- Welcome the co-organizer to the event team
- Show event details and responsibilities
- Include organizer contact information
- Link to event management dashboard

---

### Phase 5: Event Reminder Email Template

**File**: `/backend/src/services/infrastructure/emailService.ts`

#### Method Signature:

```typescript
static async sendEventReminderEmail(
  email: string,
  userName: string,
  eventData: {
    title: string;
    date: string;
    time: string;
    location: string;
    zoomLink?: string;
    format: string;
  },
  reminderType: '1h' | '24h' | '1week'
): Promise<boolean>
```

#### Key Features:

- Time-sensitive reminder design
- Show countdown/urgency
- Include all event details
- Quick access to join links or location info
- Calendar integration (add to calendar button)

---

## 🔧 Implementation Steps for Each Phase

### Step 1: Add Email Method to EmailService

1. Open `/backend/src/services/infrastructure/emailService.ts`
2. Add the new static method with proper TypeScript interfaces
3. Create HTML template with professional styling
4. Add text fallback version
5. Use existing `sendEmail()` method for actual sending

### Step 2: Update Controller to Use Real Email Methods

1. Open `/backend/src/controllers/emailNotificationController.ts`
2. **Add role change detection logic:**
   ```typescript
   // Determine if it's promotion or demotion
   const isPromotion = RoleUtils.isHigherRole(
     userData.newRole,
     userData.oldRole
   );
   ```
3. **Replace placeholder with smart email routing:**

   ```typescript
   if (isPromotion) {
     // Send promotion notification to user
     await EmailService.sendPromotionNotificationToUser(
       userData.email,
       userData,
       changedBy
     );

     // Send promotion notification to all admins
     const admins =
       await EmailRecipientUtils.getSystemAuthorizationChangeRecipients(
         userData._id
       );
     await Promise.all(
       admins.map((admin) =>
         EmailService.sendPromotionNotificationToAdmins(
           admin.email,
           admin.name,
           userData,
           changedBy
         )
       )
     );
   } else {
     // Send demotion notification to user
     await EmailService.sendDemotionNotificationToUser(
       userData.email,
       userData,
       changedBy,
       reason
     );

     // Send demotion notification to all admins
     const admins =
       await EmailRecipientUtils.getSystemAuthorizationChangeRecipients(
         userData._id
       );
     await Promise.all(
       admins.map((admin) =>
         EmailService.sendDemotionNotificationToAdmins(
           admin.email,
           admin.name,
           userData,
           changedBy,
           reason
         )
       )
     );
   }
   ```

4. Handle email sending errors gracefully
5. Update response to show actual recipient count (user + admins)

### Step 3: Update Tests

1. Update unit tests to mock the new EmailService methods
2. Verify controller integration works correctly
3. Test error handling scenarios

### Step 4: Integration Testing

1. Test with real email credentials in development
2. Verify HTML rendering in email clients
3. Test all email links and buttons work correctly

---

## 📊 Priority Order

### High Priority (Complete First)

1. **System Authorization Change Emails (4 Templates)** - Critical for user role management
   - 1a. Promotion notification to promoted user
   - 1b. Promotion notification to admins
   - 1c. Demotion notification to demoted user
   - 1d. Demotion notification to admins
2. **Event Reminder Email** - High user engagement feature

### Medium Priority

3. **AtCloud Role Change Email** - Important for ministry leadership
4. **Co-Organizer Assignment Email** - Event management feature

### Lower Priority

5. **New Leader Signup Email** - Admin notification, less frequent

---

## 🎨 Design Guidelines

### Email Template Standards

- **Consistent Branding**: Use @Cloud Ministry colors and fonts
- **Mobile Responsive**: All templates must work on mobile devices
- **Professional Tone**: Maintain ministry-appropriate language
- **Clear CTAs**: Every email should have clear action buttons
- **Accessibility**: High contrast, readable fonts, alt text for images

### HTML Structure Template

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Email Title - @Cloud Ministry</title>
    <style>
      /* Consistent styles */
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><!-- @Cloud branding --></div>
      <div class="content"><!-- Main content --></div>
      <div class="footer"><!-- Standard footer --></div>
    </div>
  </body>
</html>
```

---

## 🧪 Testing Strategy

### Unit Tests

- Mock EmailService methods in controller tests
- Verify correct parameters passed to email methods
- Test error handling and fallback behavior

### Integration Tests

- Test with real email service in development
- Verify email delivery and formatting
- Test with different user roles and permissions

### Manual Testing Checklist

- [ ] Email renders correctly in Gmail
- [ ] Email renders correctly in Outlook
- [ ] All links work correctly
- [ ] Mobile responsiveness verified
- [ ] Text fallback version readable
- [ ] Unsubscribe links work (if applicable)

---

## 🚀 Estimated Timeline

### Week 1: Foundation (Phase 1-2)

- System Authorization Change Email Template
- AtCloud Role Change Email Template
- Update controllers to use real methods

### Week 2: User-Facing Features (Phase 3-4)

- New Leader Signup Email Template
- Co-Organizer Assignment Email Template
- Integration testing

### Week 3: Engagement Features (Phase 5)

- Event Reminder Email Template
- Advanced features (calendar integration)
- Final testing and optimization

---

## 📁 Files to Modify

### Primary Implementation

- `/backend/src/services/infrastructure/emailService.ts` - Add 8 new email methods
- `/backend/src/utils/roleUtils.ts` - Add promotion/demotion detection methods ✅

### Controller Updates

- `/backend/src/controllers/emailNotificationController.ts` - Replace placeholders

### Test Updates

- `/backend/tests/unit/routes/emailNotifications.test.ts` - Update mocks
- `/backend/tests/unit/controllers/emailNotificationController.test.ts` - New tests

### Documentation

- Update API documentation for email notification endpoints
- Add email template documentation

---

## ✅ Success Criteria

### Functional Requirements

- [ ] All 8 email templates implemented and working (4 for system auth + 4 others)
- [ ] Smart promotion/demotion detection using RoleUtils
- [ ] Professional HTML design matching @Cloud branding
- [ ] Mobile-responsive email layouts
- [ ] All controller placeholders replaced with real functionality
- [ ] Comprehensive error handling
- [ ] Proper recipient routing (user + admins for role changes)

### Technical Requirements

- [ ] TypeScript interfaces properly defined
- [ ] All tests passing with 100% coverage
- [ ] Email delivery working in development and production
- [ ] Performance optimized (parallel email sending)

### User Experience Requirements

- [ ] Clear, actionable email content
- [ ] Consistent branding across all templates
- [ ] Easy-to-understand notifications
- [ ] Working links and call-to-action buttons

This plan provides a clear roadmap to complete the email notification system with professional, branded email templates!
