# 🎯 Guest Participation Roadmap

## 📌 Status at a Glance (2025-08-18)

- Backend core: Done (models, validation, endpoints, capacity-first incl. users+guests, admin-guarded list)
- Frontend core flow: Done (routes, form, landing, confirmation, links from Login/Home, role-level invite)
- Role selection fallback (no roleId): In progress — implemented now
- EventDetail shows guests distinctly: Not started
- Emails (guest confirm, organizer notify, reminder): Not started
- Tests: Unit/integration passing; E2E guest journey pending

Quick links:

- Public routes: /guest, /guest/register/:id, /guest/confirmation
- Admin-only: GET /api/events/:eventId/guests

Tip: Use npm test for the monorepo test suite.

---

## 📋 Project Overview

### **🎯 Goal**

Enable guest users to register for events without creating full accounts, reducing registration friction while maintaining necessary ministry oversight and data collection.

### **🔗 Core Requirements**

- **Minimal Data Collection**: Full Name, Gender, Email, Phone
- **Single Event Access**: Guests can only register for one event at a time
- **No Account Creation**: No password, username, or email verification required
- **Ministry Compliance**: Collect essential contact information for pastoral care
- **Audit Trail**: Track guest registrations for administrative purposes

---

## 🏗️ Technical Architecture

### **📊 Database Design**

#### **New Collection: `guestregistrations`**

```typescript
interface IGuestRegistration extends Document {
  // Event Association
  eventId: ObjectId;
  roleId: string;

  // Guest Information
  fullName: string; // "John Smith"
  gender: "male" | "female";
  email: string;
  phone: string;

  // Registration Metadata
  registrationDate: Date;
  ipAddress?: string; // For audit trail
  userAgent?: string; // For audit trail
  status: "active" | "cancelled";
  notes?: string; // Optional notes from guest

  // Event Snapshot (for historical reference)
  eventSnapshot: {
    title: string;
    date: Date;
    location: string;
    roleName: string;
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

#### **Integration with Existing Registration System**

- **Capacity Management**: Include guest registrations in role capacity counts
- **Event Display**: Show guests in event participant lists (limited info)
- **Analytics**: Include guest data in event statistics

---

## 🔧 Backend Implementation

### **Phase 1: Data Models & Validation**

#### **1.1 Guest Registration Model**

```typescript
// File: backend/src/models/GuestRegistration.ts
- Schema definition with validation
- Indexes for performance (eventId, email, status)
- Methods for data transformation and audit
```

#### **1.2 Validation Schemas**

```typescript
// File: backend/src/middleware/guestValidation.ts
- Guest registration validation rules
- Email format validation
- Phone number validation
- Name length limits
```

### **Phase 2: API Endpoints**

#### **2.1 Guest Registration Endpoint**

```typescript
// POST /api/events/:eventId/guest-signup
- Validate guest data
- Check role capacity (including existing guests)
- Create guest registration
- Send confirmation email
- Emit WebSocket update
```

#### **2.2 Guest Management Endpoints**

```typescript
// GET /api/events/:eventId/guests (Admin only)
// DELETE /api/guest-registrations/:id (Admin + Self via email)
// PUT /api/guest-registrations/:id (Self-edit via email link)
```

### **Phase 3: Integration Points**

#### **3.1 Event Controller Updates**

- **Capacity Checking**: Include guest count in role availability
- **Event Display**: Merge guest data with user registrations
- **Analytics**: Include guests in signup statistics

#### **3.2 Email Service Integration**

- **Guest Confirmation Email**: Registration confirmation with event details
- **Guest Management Email**: Links for self-cancellation and updates
- **Organizer Notifications**: Alert organizers of guest registrations

---

## 🎨 Frontend Implementation

### ✅ Implementation Progress (as of 2025-08-18)

- Added guest entry points and routes:
  - Login footer: "Join as Guest" link to `/dashboard/upcoming?guest=1`
  - Public routes: `/guest` (landing), `/guest/register/:id`, `/guest/confirmation`
  - Event role card: "Invite a guest to this role" link to guest registration with roleId
- Implemented components/pages:
  - `frontend/src/components/guest/GuestRegistrationForm.tsx`
  - `frontend/src/components/events/GuestEventSignup.tsx`
  - `frontend/src/pages/GuestLanding.tsx`
  - `frontend/src/pages/GuestRegistration.tsx`
  - `frontend/src/pages/GuestConfirmation.tsx`
- Tests:
  - `GuestRegistrationForm.test.tsx` updated and passing
- Next UI steps:
  - Show guest participants in EventDetail with distinct styling
  - Add e2e happy path covering guest signup and confirmation

### ✅ Backend Progress Updates

- Capacity check now includes both user registrations and guest registrations when determining role fullness.
- Secured admin-only listing of event guests:
  - GET `/api/events/:eventId/guests` now requires authentication and Admin role.
  - Route wired with `authenticate` and `requireAdmin` middleware.

### Phase 1: Login Flow Enhancement

#### **1.1 Login Page Updates**

```typescript
// File: frontend/src/pages/Login.tsx
- Add "Join as Guest" button
- Clean, prominent placement
- Clear messaging about guest limitations
```

#### **1.2 Guest Registration Form**

```typescript
// File: frontend/src/components/guest/GuestRegistrationForm.tsx
- Simple 4-field form (Name, Gender, Email, Phone)
- Validation and error handling
- Event context display
- Terms acceptance for guest registration
```

### Phase 2: Event Detail Integration

#### **2.1 Guest Signup Flow**

```typescript
// File: frontend/src/components/events/GuestEventSignup.tsx
- Guest-specific signup component
- Role selection for guests
- Limited feature messaging
- Confirmation and next steps
```

#### **2.2 Event Display Updates**

```typescript
// Updates to EventDetail.tsx and EventRoleSignup.tsx
- Show guest participants (limited info)
- Guest-friendly capacity indicators
- Clear distinction between users and guests
```

### Phase 3: Guest Experience Features

#### **3.1 Guest Confirmation Page**

```typescript
// File: frontend/src/pages/GuestConfirmation.tsx
- Registration success message
- Event details recap
- Contact information for questions
- Instructions for event day
```

#### **3.2 Guest Self-Service (via Email Links)**

```typescript
// File: frontend/src/pages/GuestManagement.tsx
- Cancel registration
- Update contact information
- View event details
```

#### **3.3 Guest Navigation & Exit Strategy**

```typescript
// File: frontend/src/components/guest/GuestNavigation.tsx
- Sidebar "Exit Guest Registration" button
- Header user profile modifications for guests
- Guest-specific dropdown menu options
- Multi-user device support
```

**Sidebar Implementation:**

```typescript
// File: frontend/src/components/layout/Sidebar.tsx
// Add guest exit button to sidebar navigation
const GuestSidebarButton = () => (
  <button onClick={exitGuestMode} className="sidebar-button guest-exit-button">
    <LogoutIcon />
    Exit Guest Registration
  </button>
);
```

**Header User Profile for Guests:**

```typescript
// File: frontend/src/components/layout/Header.tsx
const GuestUserProfile = ({ guestData }) => {
  return (
    <div className="user-profile-section">
      {/* No bell notification icon for guests */}

      {/* Guest name card */}
      <div className="guest-name-card">
        <img
          src={
            guestData.gender === "male"
              ? "/default-avatar-male.jpg"
              : "/default-avatar-female.jpg"
          }
          alt="Guest Avatar"
          className="avatar-image"
        />
        <div className="guest-info">
          <span className="guest-name">{guestData.fullName}</span>
          <span className="guest-phone">{guestData.phone}</span>
        </div>
      </div>

      {/* Guest dropdown menu */}
      <DropdownMenu>
        <DropdownItem onClick={() => navigate("/signup")}>Sign Up</DropdownItem>
        <DropdownItem onClick={exitGuestMode}>
          Exit Guest Registration
        </DropdownItem>
      </DropdownMenu>
    </div>
  );
};
```

**Exit Button Implementation:**

```typescript
const exitGuestMode = () => {
  // Clear temporary guest data
  localStorage.removeItem("guestFormData");
  sessionStorage.clear();

  // Clear navigation state
  window.history.replaceState({}, "", "/");

  // Redirect with success message
  navigate("/login", {
    state: { message: "Thanks for registering as a guest!" },
  });
};

// Context-aware button labels
const getExitButtonLabel = (guestState) => {
  if (guestState.hasCompletedRegistration) {
    return "Registration Complete - Return to Login";
  }
  return "Exit Guest Registration";
};
```

**Guest UI Specifications:**

**Sidebar:**

- **Exit Button**: "Exit Guest Registration" with logout icon
- **Button Styling**: Standard sidebar button styling
- **Placement**: Bottom of sidebar navigation

**Dashboard Header:**

- **No Bell Icon**: Hide notification bell for guest users
- **Avatar**: Default gender-linked avatar (male/female based on registration)
- **Name Display**: Guest's full name (primary text)
- **Phone Display**: Guest's phone number (secondary text, replaces auth level)
- **Dropdown Options**:
  - "Sign Up" → Navigate to user registration
  - "Exit Guest Registration" → Same function as sidebar button

**Conditional Rendering:**

```typescript
// Header component logic
const renderUserProfile = () => {
  if (userType === "guest") {
    return <GuestUserProfile guestData={guestData} />;
  }
  return <AuthenticatedUserProfile userData={userData} />;
};

// Show bell icon only for authenticated users
const showBellIcon = userType !== "guest";
```

---

## 📧 Email Integration

### **Guest Email Templates**

#### **1. Registration Confirmation**

```
Subject: ✅ You're registered for [Event Name]
- Welcome message
- Event details (date, time, location)
- What to bring/prepare
- Cancellation link
- Contact information
```

#### **2. Event Reminder (24h before)**

```
Subject: 📅 Tomorrow: [Event Name]
- Friendly reminder
- Event logistics
- Last-minute preparations
- Contact for questions
```

#### **3. Organizer Notification**

```
Subject: 👤 New Guest Registration: [Event Name]
- Guest name and contact info
- Registration timestamp
- Role signed up for
- Link to event management
```

---

## 🔐 Security & Privacy

### **Data Protection**

- **Minimal Data Collection**: Only essential fields
- **Email Validation**: Basic format checking (no verification required)
- **IP Address Logging**: For audit and abuse prevention
- **Self-Service Links**: Secure tokens for guest management

### **Spam Prevention**

- **Rate Limiting**: Limit guest registrations per IP/email
- **Event Limits**: One active guest registration per email
- **Admin Oversight**: Tools to manage and review guest registrations

### **Privacy Compliance**

- **Clear Messaging**: Explain data usage on guest registration
- **Self-Deletion**: Guests can cancel their own registrations
- **Data Retention**: Automatic cleanup of old guest registrations

---

## 🧪 Testing Strategy

### **Backend Testing**

```typescript
// Unit Tests
- GuestRegistration model validation
- Guest registration API endpoints
- Capacity calculation with guests
- Email service integration

// Integration Tests
- Full guest registration flow
- Event display with guests
- Guest management operations
- WebSocket updates for guest actions
```

### **Frontend Testing**

```typescript
// Component Tests
- GuestRegistrationForm validation
- Login page guest button
- Event display with guests
- Guest confirmation flow

// E2E Tests
- Complete guest registration journey
- Guest cancellation flow
- Organizer view of guest registrations
- Mobile responsiveness
```

---

## 🚀 Roadmap & Checklists

This section tracks progress with actionable checklists. Keep it current as we ship.

### Phase 1: Backend Foundation (Week 1)

- [x] Create GuestRegistration model
- [x] Implement guest validation middleware
- [x] Create guest registration API endpoint
- [x] Update capacity calculation logic
- [ ] Create email templates for guests

### Phase 2: Frontend Integration (Week 2)

- [x] Add guest option to login page
- [x] Create guest registration form
- [x] Implement guest confirmation flow
- [x] Add "Join as Guest" button on Home
- [x] Wire public routes (/guest, /guest/register/:id, /guest/confirmation)
- [x] Role-level "Invite a guest" CTA
- [x] Role selection fallback when roleId is absent (GuestRegistration)
- [ ] Update event detail pages to show guests (limited info, distinct style)
- [ ] Add guest management features (self-cancel/update via email link)

### Phase 3: Testing & Polish (Week 3)

- [ ] Comprehensive testing (unit + integration + E2E)
- [ ] Performance optimization
- [ ] Email template refinement
- [ ] Admin tools for guest management
- [ ] Documentation updates
  > Note: Capacity-first rule — Guest registration capacity must be evaluated before rate-limiting and uniqueness checks to ensure deterministic 400 responses when full. This ordering is validated by unit and integration tests and should be preserved across related flows.

### Phase 4: Deployment & Monitoring (Week 4)

- [ ] Production deployment
- [ ] Monitor guest registration metrics
- [ ] Gather user feedback
- [ ] Performance monitoring
- [ ] Bug fixes and improvements

---

## 📊 Success Metrics

### **Primary KPIs**

- **Registration Conversion Rate**: % of visitors who complete guest signup
- **Time to Registration**: Average time from landing to completed signup
- **Guest Retention**: % of guests who attend their registered events
- **Support Ticket Reduction**: Decrease in registration-related support requests

### **Secondary Metrics**

- **Guest-to-Member Conversion**: % of guests who create full accounts later
- **Event Capacity Utilization**: Better filling of event slots
- **User Satisfaction**: Feedback on simplified registration process
- **Admin Efficiency**: Time saved on registration management

---

## 🎯 Key Success Factors

### **User Experience**

- **Simplicity First**: Minimize fields and steps
- **Clear Communication**: Explain what guests can and cannot do
- **Professional Appearance**: Maintain ministry context and trust
- **Mobile Optimization**: Ensure great mobile experience

### **Technical Excellence**

- **Performance**: Fast loading and responsive forms
- **Reliability**: Robust error handling and validation
- **Integration**: Seamless integration with existing system
- **Scalability**: Handle increased registration volume

### **Ministry Effectiveness**

- **Contact Collection**: Ensure essential information is captured
- **Follow-up Capability**: Enable meaningful post-event engagement
- **Administrative Control**: Provide tools for oversight and management
- **Community Building**: Create pathways for deeper involvement

---

## ⚠️ Risk Mitigation

### **Technical Risks**

- **Data Integrity**: Thorough testing of capacity calculations
- **Email Delivery**: Backup notification methods
- **Performance Impact**: Load testing with guest registrations
- **Security Vulnerabilities**: Input validation and rate limiting

### **Business Risks**

- **Spam Registrations**: Monitoring and admin tools
- **No-Show Rates**: Clear communication and reminders
- **Data Quality**: Validation and cleaning procedures
- **User Confusion**: Clear documentation and support

---

## 📝 Implementation Checklist

### **Pre-Development**

- [ ] Review and approve this blueprint
- [ ] Set up development branch: `feature/guest-participation`
- [ ] Prepare test data and scenarios
- [ ] Design email templates

### **Development Readiness**

- [ ] Backend and frontend servers running
- [ ] Development environment configured
- [ ] Testing frameworks ready
- [ ] Code review process established

### **Quality Assurance**

- [ ] Test plan documented
- [ ] Performance benchmarks established
- [ ] Security review scheduled
- [ ] User acceptance criteria defined

---

## 🔄 Guest-to-User Migration Feature

### **📋 Feature Overview**

**Goal**: Enable seamless conversion of guest registrations to full user accounts while preserving all event history and participation data.

**Business Value**:

- Reduces barrier to full community membership
- Preserves user investment in event participation
- Improves data quality and user engagement analytics
- Supports natural progression from casual to committed participation

### **🎯 Recommended Implementation: Migration on Signup**

**Strategy**: Automatic detection during user account creation with clear migration choice.

#### **Migration Workflow**

```typescript
1. User creates account with email "john@example.com"
2. System detects existing guest registrations for this email
3. Display: "We found 3 previous event registrations. Link them to your account?"
4. User reviews event list and confirms migration
5. System converts guest registrations to user registrations
6. Update all event participant lists automatically
7. Send confirmation email with unified account summary
```

### **🗄️ Enhanced Database Design**

#### **Migration Tracking Fields**

```typescript
interface IGuestRegistration extends Document {
  // ... existing fields ...

  // Migration Support
  migratedToUserId?: ObjectId; // Track successful migrations
  migrationDate?: Date; // When migration occurred
  migrationStatus: "pending" | "completed" | "declined";
}
```

#### **Migration Log Collection**

```typescript
interface IMigrationLog extends Document {
  fromEmail: string;
  toUserId: ObjectId;
  migratedRegistrations: ObjectId[]; // Guest registration IDs
  migrationDate: Date;
  migrationSource: "signup" | "manual" | "admin";
  success: boolean;
  errorMessage?: string;
}
```

### **🔧 Technical Implementation**

#### **Backend Components**

**1. Migration Detection Service**

```typescript
// File: backend/src/services/GuestMigrationService.ts
-detectGuestRegistrationsByEmail() -
  validateMigrationEligibility() -
  performGuestToUserMigration() -
  rollbackMigration(); // For error recovery
```

**2. Migration API Endpoints**

```typescript
// GET /api/auth/check-guest-registrations/:email
// POST /api/auth/migrate-guest-registrations
// GET /api/users/:userId/migration-history
```

**3. User Registration Enhancement**

```typescript
// Update authController.register() to:
- Check for guest registrations by email
- Offer migration during signup process
- Handle migration acceptance/decline
```

#### **Frontend Components**

**1. Migration Detection UI**

```typescript
// File: frontend/src/components/auth/GuestMigrationPrompt.tsx
- Display found guest registrations
- Event list with dates and roles
- Clear migration benefits explanation
- Accept/Decline migration options
```

**2. Registration Flow Updates**

```typescript
// Update Signup.tsx to:
- Check for guest registrations after email entry
- Show migration prompt before final registration
- Handle migration confirmation flow
```

**3. User Dashboard Enhancement**

```typescript
// Add migration history section to user profile
- Show migrated events with "Originally registered as guest" labels
- Migration date and source tracking
```

### **📊 Data Preservation Strategy**

#### **What Transfers Seamlessly**

- ✅ Event registrations and role assignments
- ✅ Registration dates and timestamps
- ✅ Contact information (email, phone)
- ✅ Event participation history
- ✅ Registration status (active/cancelled)

#### **Data Mapping Process**

```typescript
const migrationMapping = {
  // Guest → User field mapping
  fullName: "Split into firstName + lastName",
  email: "Direct transfer to user.email",
  phone: "Direct transfer to user.phone",
  gender: "Direct transfer to user.gender",

  // Registration conversion
  guestRegistration: "Convert to standard Registration record",
  eventSnapshot: "Preserve for historical reference",
  registrationDate: "Maintain original timestamp",
};
```

### **🛡️ Migration Safeguards**

#### **Data Integrity Protection**

- **Validation**: Ensure no duplicate registrations after migration
- **Rollback Capability**: Ability to reverse migration if issues occur
- **Audit Trail**: Complete logging of all migration operations
- **Conflict Resolution**: Handle edge cases (duplicate roles, capacity issues)

#### **User Experience Protection**

- **Clear Communication**: Explain what happens during migration
- **Opt-in Only**: Users must explicitly choose to migrate
- **Review Before Confirm**: Show exactly what will be migrated
- **Support Recovery**: Admin tools to fix migration issues

### **🧪 Testing Strategy for Migration**

#### **Unit Tests**

```typescript
- Migration detection logic
- Data mapping accuracy
- Rollback functionality
- Validation rules
```

#### **Integration Tests**

```typescript
- Complete migration workflow
- Event capacity recalculation
- Email notification flow
- WebSocket updates for migrated events
```

#### **Edge Case Testing**

```typescript
- Multiple guest registrations for same event/role
- Migration with cancelled guest registrations
- User already has registration for same event
- Migration failure recovery
```

### **📈 Migration Success Metrics**

#### **Primary KPIs**

- **Migration Adoption Rate**: % of eligible users who choose to migrate
- **Migration Success Rate**: % of migrations completed without errors
- **User Satisfaction**: Post-migration user feedback scores
- **Data Integrity**: Accuracy of migrated data vs original guest data

#### **Secondary Metrics**

- **Support Ticket Reduction**: Fewer "lost registration" support requests
- **User Engagement**: Increased activity after migration
- **Community Growth**: Guest-to-member conversion rates
- **System Performance**: Migration impact on system performance

### **🚀 Migration Implementation Timeline**

#### **Phase 1: Core Migration Logic (Week 5)**

- [ ] Create GuestMigrationService
- [ ] Implement migration detection and data mapping
- [ ] Create migration API endpoints
- [ ] Add migration tracking to database

#### **Phase 2: User Interface (Week 6)**

- [ ] Build migration prompt component
- [ ] Update signup flow with migration detection
- [ ] Create migration history dashboard
- [ ] Implement migration confirmation flow

#### **Phase 3: Testing & Refinement (Week 7)**

- [ ] Comprehensive testing of migration scenarios
- [ ] Edge case handling and error recovery
- [ ] Performance optimization
- [ ] User experience testing and refinement

#### **Phase 4: Deployment & Monitoring (Week 8)**

- [ ] Production deployment of migration feature
- [ ] Monitor migration success rates
- [ ] User feedback collection
- [ ] Performance and error monitoring

### **💡 Implementation Notes**

#### **Best Practices**

- **Atomic Operations**: Ensure migration is all-or-nothing
- **Progressive Enhancement**: Migration works even if some features fail
- **User Control**: Always let users choose what to migrate
- **Transparency**: Clear logging and audit trails

#### **Potential Challenges**

- **Data Conflicts**: Handle duplicate registrations gracefully
- **Performance**: Optimize for users with many guest registrations
- **User Confusion**: Clear messaging about what migration means
- **Support Burden**: Tools for admins to help users with migration issues

---

**🎉 This blueprint serves as our roadmap for implementing a successful guest participation feature that balances simplicity, security, and ministry effectiveness, with a clear pathway for guests to become full community members while preserving their participation history.**
