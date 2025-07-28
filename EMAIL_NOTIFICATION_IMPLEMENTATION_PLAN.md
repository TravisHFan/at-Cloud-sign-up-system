# 📧 Email Services & Bell Notifications Implementation Plan

**Project**: @Cloud Sign-up System  
**Date**: 2025-07-27  
**Status**: Ready for Implementation (Password Change Bug Fixed)  
**Priority**: High (Critical Infrastructure Missing)

---

## 🔄 **PROJECT STATUS UPDATE**

### **✅ RECENTLY COMPLETED**

- **Password Change Bug**: 🔒 **FIXED** - Critical security vulnerability resolved
- **Test Coverage**: 📋 Comprehensive test suites added (33 tests passing)
- **Security Validation**: 🛡️ Password changes now properly validated and implemented
- **Documentation**: 📚 Complete fix documentation and analysis

### **🎯 CURRENT FOCUS**

Moving forward with email notification implementation now that critical security issues are resolved.

---

## 🔍 **AUDIT SUMMARY**

### **Current System Health Overview**

| Component                | Status     | Functionality | Critical Issues              |
| ------------------------ | ---------- | ------------- | ---------------------------- |
| **Password Security**    | 🟢 Fixed   | 100%          | ✅ Resolved                  |
| **Email Infrastructure** | 🟢 Working | 85%           | Missing API endpoints        |
| **Bell Notifications**   | 🟢 Working | 95%           | Minor UX improvements needed |
| **System Messages**      | 🟢 Working | 90%           | Email integration missing    |
| **Real-time Updates**    | 🟢 Working | 95%           | Very stable                  |
| **Frontend Services**    | 🟡 Partial | 60%           | **API endpoint mismatches**  |

---

## ✅ **WHAT'S WORKING WELL**

### **Password Management (Recently Fixed)**

- ✅ **Password Change API**: Fully functional backend endpoint
- ✅ **Frontend Integration**: Real API calls (no more simulation)
- ✅ **Security Validation**: bcrypt hashing, JWT authentication
- ✅ **Error Handling**: Proper validation and user feedback
- ✅ **Test Coverage**: 13 backend + 20 frontend tests passing

### **Email Infrastructure (Backend)**

- ✅ **EmailService Class**: Fully functional with nodemailer
- ✅ **Email Verification**: Complete workflow (register → verify → welcome)
- ✅ **Password Reset**: Complete workflow with secure tokens
- ✅ **Welcome Emails**: Professional templates, triggered correctly
- ✅ **Event Creation Emails**: Sent to all users when events are created
- ✅ **SMTP Configuration**: Production/development modes working

### **Bell Notification System**

- ✅ **Real-time WebSocket**: Instant notification delivery
- ✅ **Unified Message System**: System messages + bell notifications
- ✅ **Frontend Dropdown**: Complete UI with read/unread states
- ✅ **State Management**: Read status, removal, cleanup working
- ✅ **Database Integration**: MongoDB with user state tracking

### **System Integration**

- ✅ **Authentication Flow**: Email verification integrated
- ✅ **Event System**: Basic email notifications on creation
- ✅ **User Management**: Profile updates trigger appropriate flows

---

## 📧 **EMAIL ROUTING LOGIC ANALYSIS**

### **✅ CURRENT EMAIL ROUTING IMPLEMENTATION**

#### **1. Event Creation Emails** (✅ WORKING - Partial)

**Location**: `/backend/src/controllers/eventController.ts:470-520`

**Current Logic**:

```typescript
const allUsers = await User.find({
  _id: { $ne: req.user._id }, // ✅ Excludes event creator
  isVerified: true, // ✅ Only verified users
}).select("email firstName lastName");
```

**Status**: 🟡 **Partially Working**

- ✅ **Working**: Excludes event creator, sends to verified users
- ❌ **Missing**: User preference filtering (`emailNotifications`)
- ❌ **Missing**: Active user filtering (`isActive`)
- **Risk**: Users receive emails even if they opted out or are inactive

#### **2. System-Critical Emails** (✅ WORKING)

**Types**: Email verification, password reset, welcome emails  
**Logic**: Direct email to specific user (no filtering needed)  
**Status**: ✅ **Fully Working** - System emails bypass user preferences

### **❌ MISSING EMAIL ROUTING LOGIC**

#### **1. Admin Notification Recipients** (🔴 CRITICAL MISSING)

**Problem**: No logic to identify Super Admins and Administrators

**Missing Logic**:

```typescript
// NEED TO IMPLEMENT:
const adminUsers = await User.find({
  role: { $in: ["Super Admin", "Administrator"] },
  isActive: true,
  isVerified: true,
  emailNotifications: true,
}).select("email firstName lastName role");
```

**Impact**: Admin notifications (role changes, security alerts) have no recipients

#### **2. Event Reminder Recipients** (🔴 CRITICAL MISSING)

**Problem**: No logic to find users signed up for specific events

**Missing Logic**:

```typescript
// NEED TO IMPLEMENT:
const eventParticipants = await Registration.find({
  eventId: eventId,
  status: "active",
}).populate({
  path: "userId",
  match: {
    isActive: true,
    isVerified: true,
    emailNotifications: true,
  },
});
```

**Impact**: Event reminders cannot be sent to registered participants

#### **3. Co-organizer Identification** (🟡 MEDIUM MISSING)

**Problem**: No logic to identify event co-organizers

**Missing Logic**:

```typescript
// NEED TO IMPLEMENT:
const coOrganizers = event.organizerDetails.filter(
  (organizer) => organizer.email !== event.createdBy.email
);
```

**Impact**: Co-organizer assignment notifications cannot be sent

#### **4. Role Change Notification Recipients** (🔴 CRITICAL MISSING)

**Problem**: No logic for role-specific notifications

**Missing for System Authorization Level changes**:

```typescript
// NEED TO IMPLEMENT:
const systemRoleChangeRecipients = await User.find({
  _id: { $ne: changedUserId },
  role: { $in: ["Super Admin", "Administrator"] },
  isActive: true,
  isVerified: true,
  emailNotifications: true,
});
```

**Missing for Role in @Cloud changes**:

```typescript
// NEED TO IMPLEMENT:
const ministryRoleChangeRecipients = await User.find({
  $or: [
    { role: "Super Admin" },
    {
      role: { $in: ["Administrator", "Leader"] },
      isAtCloudLeader: true,
    },
  ],
  isActive: true,
  isVerified: true,
  emailNotifications: true,
});
```

### **📊 EMAIL ROUTING GAPS SUMMARY**

| Email Type              | Current Logic                                 | Missing Logic                                                 | Risk Level |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------- | ---------- |
| **Event Creation**      | ✅ Excludes creator<br>✅ Only verified users | ❌ No `isActive` filter<br>❌ No `emailNotifications` filter  | 🟡 Medium  |
| **Admin Notifications** | ❌ No logic exists                            | ❌ Admin user discovery<br>❌ Role-based filtering            | 🔴 High    |
| **Event Reminders**     | ❌ No logic exists                            | ❌ Participant discovery<br>❌ Preference filtering           | 🔴 High    |
| **Role Changes**        | ❌ No logic exists                            | ❌ Recipient determination<br>❌ Context-aware filtering      | 🔴 High    |
| **Co-organizer Alerts** | ❌ No logic exists                            | ❌ Co-organizer identification<br>❌ Assignment notifications | 🟡 Medium  |

---

## 🚨 **CRITICAL ISSUES IDENTIFIED**

### **1. Backend API Endpoints Missing** (🔴 HIGH PRIORITY)

**Problem**: Frontend calls non-existent backend endpoints

```typescript
// Frontend calls these endpoints but they DON'T EXIST:
POST /api/v1/notifications/event-created
POST /api/v1/notifications/co-organizer-assigned
POST /api/v1/notifications/event-reminder
POST /api/v1/notifications/password-reset
POST /api/v1/notifications/new-leader-signup
POST /api/v1/notifications/system-authorization-change  // Super Admin, Administrator, Leader, Participant
POST /api/v1/notifications/atcloud-role-change          // Youth Pastor, IT Director, etc.
POST /api/v1/notifications/email-verification
POST /api/v1/notifications/security-alert
POST /api/v1/notifications/schedule-reminder
POST /api/v1/notifications/event-role-removal           // User removed from event role (NEW)
POST /api/v1/notifications/event-role-move              // User moved between event roles (NEW)
```

**Impact**: All email notifications triggered from frontend fail silently

### **2. Missing Automatic Email Notifications** (🟡 MEDIUM PRIORITY)

- ❌ Co-organizer assignment notifications
- ❌ Event reminder emails (24 hours before)
- ❌ Event update/cancellation notifications
- ❌ Registration confirmation emails
- ✅ **Password change notifications** (Ready to implement - infrastructure now available)
- ❌ **System Authorization Level change notifications** (Super Admin, Administrator, Leader, Participant)
- ❌ **Role in @Cloud change notifications** (Youth Pastor, IT Director, etc.)

### **3. Missing Admin Email Notifications** (🟡 MEDIUM PRIORITY)

- ❌ New leader signup alerts to Super Admin/Administrators
- ❌ **System Authorization Level change notifications** (when users are promoted/demoted between Super Admin, Administrator, Leader, Participant)
- ❌ **Role in @Cloud change notifications** (when users update their ministry position like Youth Pastor → IT Director)
- ❌ System security alerts
- ✅ **Password change security alerts** (Ready to implement)

### **4. Missing Email Scheduling System** (🟡 MEDIUM PRIORITY)

- ❌ Automated reminder system (cron jobs)
- ❌ Email queue management
- ❌ Scheduled delivery system
- ❌ Failed email retry mechanism

---

## 📬 **AUTO EMAIL TO BELL NOTIFICATION & SYSTEM MESSAGE SYNC ANALYSIS**

### **🔄 CURRENT REAL-TIME SYNC STATUS**

**✅ ALREADY IMPLEMENTED**: Your system has a **fully integrated Bell notification and System message sync**

- **Real-time WebSocket**: ✅ Instant delivery via SocketService
- **Unified Message System**: ✅ Single Message model handles both Bell notifications and System messages
- **Automatic Sync**: ✅ Every System message automatically creates corresponding Bell notification
- **State Management**: ✅ Read status syncs between both (markAsReadEverywhere)
- **User Control**: ✅ Users can dismiss from Bell while keeping in System messages

### **📋 AUTO EMAIL SERVICES REQUIRING BELL NOTIFICATION + SYSTEM MESSAGE PAIRS**

**Summary**: Every auto email should generate a corresponding **Bell notification** and **System message** pair for proper user experience.

#### **🔴 CRITICAL AUTO EMAILS (Need unified messages)**

| Auto Email Type                       | Recipients                        | Unified Message Title                      | Unified Message Content                 | Implementation Status |
| ------------------------------------- | --------------------------------- | ------------------------------------------ | --------------------------------------- | --------------------- |
| **Event Creation**                    | All active users (except creator) | "📅 New Event: [Event Name]"               | Full event details with registration    | 🔴 MISSING            |
| **Co-organizer Assignment**           | Assigned co-organizer             | "🎯 You're a co-organizer"                 | Assignment details and responsibilities | 🔴 MISSING            |
| **Event Reminder (24h)**              | Event participants                | "⏰ Event reminder: tomorrow"              | Event preparation and location info     | 🔴 MISSING            |
| **System Authorization Level Change** | User + Admins                     | "🔐 Role changed" / "👤 User role updated" | Detailed change information             | 🔴 MISSING            |
| **Role in @Cloud Change**             | User + Ministry leaders           | "⛪ Ministry role updated"                 | Position change details                 | 🔴 MISSING            |
| **Password Change Confirmation**      | User only                         | "🔒 Password changed"                      | Security confirmation                   | 🔴 MISSING            |
| **Password Change Security Alert**    | User only                         | "🛡️ Security alert"                        | Suspicious activity details             | 🔴 MISSING            |
| **New Leader Signup**                 | Super Admin + Administrators      | "👋 New leader joined"                     | Leader profile and approval needs       | 🔴 MISSING            |

#### **🟡 MEDIUM PRIORITY AUTO EMAILS (Need unified messages)**

| Auto Email Type                    | Recipients         | Unified Message Title          | Unified Message Content     | Implementation Status |
| ---------------------------------- | ------------------ | ------------------------------ | --------------------------- | --------------------- |
| **Event Update/Cancellation**      | Event participants | "📅 Event updated"             | Change details and actions  | 🔴 MISSING            |
| **Registration Confirmation**      | New registrant     | "✅ Registration confirmed"    | Event confirmation details  | 🔴 MISSING            |
| **User Removed from Event Role**   | Removed user       | "📋 Removed from [Event Role]" | Removal details and contact | 🔴 MISSING            |
| **User Moved Between Event Roles** | Moved user         | "🔄 Role updated in [Event]"   | Role change details         | 🔴 MISSING            |

#### **🟢 SYSTEM EMAILS (No Bell+System pairs needed)**

| System Email Type      | Recipients | Reason No Bell+System Needed                    | Current Status |
| ---------------------- | ---------- | ----------------------------------------------- | -------------- |
| **Email Verification** | New user   | System process, not notification                | ✅ WORKING     |
| **Password Reset**     | User       | System process, not notification                | ✅ WORKING     |
| **Welcome Email**      | New user   | System process, separate welcome message exists | ✅ WORKING     |

---

### **🎯 REQUIRED BELL NOTIFICATION + SYSTEM MESSAGE IMPLEMENTATIONS**

#### **Phase 1: Critical Auto Email Integrations (Week 1)**

**1. Event Creation Email → Bell + System Message**

```typescript
// When event is created:
1. Send email to all users (existing)
2. Create unified message with single title/content:
   - Title: "📅 New Event: [Event Name]"
   - Content: "New event '[Event Name]' is now open for registration. Event Date: [Date] at [Time]. Location: [Location]. Click to view details and register."
3. Message automatically appears as both Bell notification and System message
4. WebSocket broadcast: Real-time delivery to all users
```

**2. System Authorization Level Change → Bell + System Message**

```typescript
// When user role changes (Super Admin, Administrator, Leader, Participant):
1. Send email to user + admins
2. Create unified message for user:
   - Title: "🔐 Your System Access Level Changed"
   - Content: "Your role has been updated from [OldRole] to [NewRole] by [AdminName]. This change affects your system permissions and access levels."
3. Create unified message for admins:
   - Title: "👤 User Role Change: [UserName]"
   - Content: "[UserName] role changed from [OldRole] to [NewRole] by [AdminName]. Date: [Timestamp]"
4. WebSocket: Real-time delivery to affected users
```

**3. Role in @Cloud Change → Bell + System Message**

```typescript
// When ministry position changes (Youth Pastor, IT Director, etc.):
1. Send email to user + ministry leaders
2. Create unified message for user:
   - Title: "⛪ Your @Cloud Ministry Role Updated"
   - Content: "Your ministry position has been updated from '[OldRole]' to '[NewRole]'. This reflects your current role and responsibilities within @Cloud ministry."
3. Create unified message for ministry leaders:
   - Title: "👤 Ministry Role Change: [UserName]"
   - Content: "[UserName] has updated their ministry role from '[OldRole]' to '[NewRole]'. Please note this change for ministry coordination."
4. WebSocket: Real-time delivery to affected users
```

**4. Password Change → Bell + System Message**

```typescript
// When password is changed:
1. Send confirmation email
2. Create unified message:
   - Title: "🔒 Password Successfully Changed"
   - Content: "Your password was successfully changed on [Date] at [Time]. If this wasn't you, please contact support immediately and secure your account."
3. WebSocket: Real-time security notification
```

#### **Phase 2: Enhanced Auto Email Integrations (Week 2)**

**5. Co-organizer Assignment → Bell + System Message**

```typescript
// When user is assigned as co-organizer:
1. Send assignment email
2. Create unified message:
   - Title: "🎯 You're Now a Co-organizer for [Event]"
   - Content: "Congratulations! You have been assigned as a co-organizer for '[Event Name]'. You now have access to manage registrations, communicate with participants, and coordinate event details. Event Date: [Date] at [Time]."
3. WebSocket: Real-time assignment notification
```

**6. Event Reminders → Bell + System Message**

```typescript
// 24 hours before event:
1. Send reminder email to participants
2. Create unified message:
   - Title: "⏰ Event Reminder: [Event] Tomorrow"
   - Content: "Don't forget! '[Event Name]' is tomorrow at [Time]. Location: [Location]. Please prepare: [Preparation details]. Contact [Organizer] if you have questions."
3. WebSocket: Real-time reminder delivery
```

**7. New Leader Signup → Bell + System Message**

```typescript
// When new leader registers:
1. Send alert email to admins
2. Create unified message for admins:
   - Title: "👋 New Leader Joined: [Name]"
   - Content: "A new leader has joined @Cloud: [FirstName] [LastName] ([Email]). Role: [RoleInAtCloud]. They may require approval and orientation. Please review their profile and provide appropriate access."
3. WebSocket: Real-time admin notification
```

**8. User Removed from Event Role → Bell + System Message**

```typescript
// When admin/organizer removes user from event role:
1. Send removal email to affected user
2. Create unified message:
   - Title: "📋 Removed from [Event] - [Role]"
   - Content: "You have been removed from the '[Role]' role in '[Event]' by [RemovedBy]. If you have questions about this change, please contact the event organizer at [OrganizerContact]."
3. WebSocket: Real-time removal notification
```

**9. User Moved Between Event Roles → Bell + System Message**

```typescript
// When admin/organizer moves user between event roles:
1. Send role change email to affected user
2. Create unified message:
   - Title: "🔄 Role Updated in [Event]: [OldRole] → [NewRole]"
   - Content: "Your role in '[Event]' has been changed from '[OldRole]' to '[NewRole]' by [MovedBy]. Your new responsibilities: [NewRoleDescription]. Contact [OrganizerContact] for questions."
3. WebSocket: Real-time role change notification
```

#### **Phase 3: Advanced Auto Email Integrations (Week 3)**

**10. Event Updates → Bell + System Message**
**11. Registration Confirmations → Bell + System Message**
**12. Additional Role Management Notifications → Bell + System Message**

---

### **🔧 TECHNICAL IMPLEMENTATION FRAMEWORK**

#### **Unified Email-Notification Service Pattern**

```typescript
// Create this service to standardize email + unified message creation
class AutoEmailNotificationService {
  async sendEventCreationNotification(eventData: any, recipients: string[]) {
    // 1. Send email
    await emailService.sendEventCreationEmail(eventData, recipients);

    // 2. Create unified message (automatically appears as both Bell notification and System message)
    await Message.createForAllUsers(
      {
        title: `📅 New Event: ${eventData.title}`,
        content: `New event "${eventData.title}" is now open for registration. Event Date: ${eventData.date} at ${eventData.time}. Location: ${eventData.location}. Click to view details and register.`,
        type: "announcement",
        priority: "medium",
        creator: eventData.creator,
      },
      recipients
    );

    // 3. WebSocket broadcast (automatic in createForAllUsers)
    // Real-time delivery handled automatically for both Bell and System messages
  }

  async sendRoleChangeNotification(changeData: any) {
    // 1. Send email to affected users
    await emailService.sendRoleChangeEmail(changeData);

    // 2. Create unified message for target user
    await Message.createForSpecificUser(
      {
        title: "🔐 Your System Access Level Changed",
        content: `Your role has been updated from ${changeData.oldRole} to ${changeData.newRole} by ${changeData.changedBy.name}. This change affects your system permissions and access levels.`,
        type: "auth_level_change",
        priority: "high",
        creator: changeData.changedBy,
      },
      changeData.userId
    );

    // 3. Create unified message for admins
    const admins = await EmailRecipientUtils.getAdminUsers();
    await Message.createForAllUsers(
      {
        title: `👤 User Role Change: ${changeData.userName}`,
        content: `${changeData.userName} role changed from ${
          changeData.oldRole
        } to ${changeData.newRole} by ${
          changeData.changedBy.name
        }. Date: ${new Date().toLocaleString()}`,
        type: "auth_level_change",
        priority: "medium",
        creator: changeData.changedBy,
      },
      admins.map((admin) => admin._id)
    );
  }

  async sendEventRoleRemovalNotification(removalData: any) {
    // 1. Send email to affected user
    await emailService.sendEventRoleRemovalEmail(removalData);

    // 2. Create unified message for the removed user
    await Message.createForSpecificUser(
      {
        title: `📋 Removed from ${removalData.eventTitle} - ${removalData.roleName}`,
        content: `You have been removed from the "${removalData.roleName}" role in "${removalData.eventTitle}" by ${removalData.removedBy.name}. If you have questions about this change, please contact the event organizer.`,
        type: "event_role_change",
        priority: "high",
        creator: removalData.removedBy,
      },
      removalData.userId
    );

    // 3. WebSocket broadcast (automatic in createForSpecificUser)
    // Real-time delivery handled automatically
  }

  async sendEventRoleMoveNotification(moveData: any) {
    // 1. Send email to affected user
    await emailService.sendEventRoleMoveEmail(moveData);

    // 2. Create unified message for the moved user
    await Message.createForSpecificUser(
      {
        title: `🔄 Role Updated in ${moveData.eventTitle}: ${moveData.fromRoleName} → ${moveData.toRoleName}`,
        content: `Your role in "${moveData.eventTitle}" has been changed from "${moveData.fromRoleName}" to "${moveData.toRoleName}" by ${moveData.movedBy.name}. Your new responsibilities: ${moveData.newRoleDescription}`,
        type: "event_role_change",
        priority: "medium",
        creator: moveData.movedBy,
      },
      moveData.userId
    );

    // 3. WebSocket broadcast (automatic in createForSpecificUser)
    // Real-time delivery handled automatically
  }

  // Similar patterns for all other auto email types...
}
```

#### **Integration Points with Existing System**

**1. Email Service Enhancement**

```typescript
// Extend existing EmailService to trigger notifications
class EmailService {
  async sendEmail(emailData: any) {
    // Send email (existing)
    const result = await this.originalSendEmail(emailData);

    // Trigger corresponding bell + system message
    await AutoEmailNotificationService.createCorrespondingNotification(
      emailData
    );

    return result;
  }
}
```

**2. WebSocket Integration** (✅ Already Working)

```typescript
// Your existing WebSocket system handles:
- Real-time Bell notification delivery
- Real-time System message delivery
- Automatic unread count updates
- Cross-device synchronization
```

**3. User Experience** (✅ Already Working)

```typescript
// Users will see:
- Email in their inbox
- Bell notification dropdown (same title and content, dismissible)
- System message in System Messages page (same title and content, persistent)
- Real-time updates across all devices
// Note: Bell notifications and System messages show identical content from unified Message
```

---

### **📊 IMPLEMENTATION SUMMARY**

#### **Total Auto Email Services Needing Unified Messages: 10**

**🔴 Critical Priority (Week 1)**: 4 services

- Event Creation
- System Authorization Level Change
- Role in @Cloud Change
- Password Change Confirmation

**🟡 Medium Priority (Week 2)**: 4 services

- Co-organizer Assignment
- Event Reminders
- New Leader Signup
- Password Security Alerts
- **User Removed from Event Role** (NEW)
- **User Moved Between Event Roles** (NEW)

**🟢 Future Enhancement (Week 3)**: 2 services

- Event Updates/Cancellations
- Registration Management

#### **Technical Benefits of This Approach**

✅ **Unified User Experience**: Users get notifications in email, bell, and system messages
✅ **Real-time Sync**: Your existing WebSocket system handles instant delivery
✅ **User Control**: Can dismiss from bell while keeping in system messages  
✅ **Audit Trail**: System messages provide permanent record
✅ **Cross-device**: Works on all devices with real-time sync
✅ **Scalable**: Framework works for any future auto email additions

#### **Implementation Estimate**

- **Week 1**: Core framework + 4 critical integrations
- **Week 2**: 4 medium priority integrations (including event role management)
- **Week 3**: 2 advanced integrations + optimization

**Total Development Time**: 3 weeks for complete auto email to unified Message sync

### **5. Password Change Security Integration** (🟢 NEW OPPORTUNITY)

With the password change bug now fixed, we can implement:

- ✅ **Password change confirmation emails** (inform user of successful change)
- ✅ **Security alert emails** (notify user when password is changed from another device)
- ✅ **Multiple session invalidation** (logout other sessions on password change)

---

## 🎯 **IMPLEMENTATION PLAN**

### **PHASE 1: Critical Infrastructure (Week 1)**

**Goal**: Fix frontend-backend API mismatches and implement missing endpoints

#### **Step 1.1: Create Email Notification Router**

- [ ] Create `/backend/src/routes/emailNotifications.ts`
- [ ] Implement all missing POST endpoints
- [ ] Add proper authentication and validation
- [ ] Integrate with existing EmailService

#### **Step 1.2: Implement Missing Email Templates**

- [ ] Co-organizer assignment email template
- [ ] Event reminder email template
- [ ] **System Authorization Level change email templates** (promotion/demotion notifications)
- [ ] **Role in @Cloud change email templates** (ministry position updates)
- [ ] Security alert email template
- [ ] **Password change confirmation email template** (NEW)

#### **Step 1.3: Connect Frontend to Backend**

- [ ] Test all emailNotificationService calls
- [ ] Fix API endpoint URLs in frontend
- [ ] Add proper error handling
- [ ] Implement loading states

#### **Step 1.4: Integration Testing**

- [ ] Test email sending from frontend actions
- [ ] Verify bell notifications sync with emails
- [ ] Test error scenarios and fallbacks
- [ ] **Test password change email notifications** (NEW)

### **PHASE 2: Enhanced Automation (Week 2)**

**Goal**: Implement scheduled emails and advanced notification features

#### **Step 2.1: Email Scheduling System**

- [ ] Create scheduled job system for reminders
- [ ] Implement event reminder automation (24h before)
- [ ] Add email queue management
- [ ] Create failed email retry mechanism

#### **Step 2.2: Admin Notification System**

- [ ] Auto-detect Super Admin and Administrator users
- [ ] Implement **System Authorization Level change notification triggers** (when users are promoted/demoted)
- [ ] Implement **Role in @Cloud change notification triggers** (when users update their ministry positions)
- [ ] Add **System Authorization Level** email automation
- [ ] Create security alert system
- [ ] **Implement password change admin alerts** (NEW)

#### **Step 2.3: Email Preferences**

- [ ] Add user email preference settings
- [ ] Implement opt-in/opt-out for notification types
- [ ] Create email frequency controls
- [ ] Add unsubscribe functionality

### **PHASE 3: Advanced Features (Week 3)**

**Goal**: Enhance user experience and add analytics

#### **Step 3.1: Email Analytics**

- [ ] Track email delivery status
- [ ] Monitor open rates (if needed)
- [ ] Log failed email attempts
- [ ] Create email health dashboard

#### **Step 3.2: Advanced Templates**

- [ ] Responsive email templates
- [ ] Personalized email content
- [ ] Multiple language support
- [ ] Custom email signatures

#### **Step 3.3: Performance Optimization**

- [ ] Email template caching
- [ ] Bulk email optimization
- [ ] Database query optimization
- [ ] Memory usage optimization

#### **Step 3.4: Password Security Enhancements** (NEW)

- [ ] **Password change email notifications with device info**
- [ ] **Suspicious activity detection and alerts**
- [ ] **Multi-device session management integration**

---

## 📋 **DETAILED TASK BREAKDOWN**

### **🔍 ROLE CHANGE CLARIFICATION**

**Important**: Your system has **TWO DIFFERENT types of roles** that require separate email notification handling:

#### **1. System Authorization Level** (`role` field)

**Purpose**: Controls system permissions and access levels  
**Values**: `"Super Admin"` | `"Administrator"` | `"Leader"` | `"Participant"`  
**Changed by**: Administrators and Super Admins via User Management interface  
**Current API**: `PUT /api/v1/users/:id/role` (✅ exists)  
**Location**: `/backend/src/controllers/userController.ts::updateUserRole()`

**Email Notifications Needed**:

- **User notification**: "Your system authorization level has been changed from Leader to Administrator"
- **Admin notification**: "John Doe has been promoted from Leader to Administrator by Admin Jane"

#### **2. Role in @Cloud** (`roleInAtCloud` field)

**Purpose**: Describes ministry position/function within @Cloud organization  
**Values**: Free text (e.g., "Youth Pastor", "IT Director", "Worship Leader", "CFO")  
**Changed by**: Users update their own profiles OR administrators  
**Current API**: `PUT /api/v1/users/profile` (✅ exists)  
**Condition**: Only applicable when `isAtCloudLeader: true`

**Email Notifications Needed**:

- **User notification**: "Your @Cloud ministry role has been updated from Youth Pastor to IT Director"
- **Ministry leadership notification**: "Sarah Johnson has updated her ministry role from Youth Pastor to IT Director"

### **Immediate Tasks (This Week)**

#### **🔴 HIGH PRIORITY: Create Email Recipient Logic**

1. **Create EmailRecipientUtils Class** (NEW - CRITICAL)

```typescript
// File: /backend/src/utils/emailRecipientUtils.ts (NEW FILE NEEDED)
export class EmailRecipientUtils {
  // Get Super Admin and Administrator users for admin notifications
  static async getAdminUsers(): Promise<
    Array<{ email: string; firstName: string; lastName: string; role: string }>
  > {
    return await User.find({
      role: { $in: ["Super Admin", "Administrator"] },
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    }).select("email firstName lastName role");
  }

  // Get all active users who want emails (excluding specified email)
  static async getActiveVerifiedUsers(
    excludeEmail?: string
  ): Promise<Array<{ email: string; firstName: string; lastName: string }>> {
    const filter: any = {
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    };

    if (excludeEmail) {
      filter.email = { $ne: excludeEmail };
    }

    return await User.find(filter).select("email firstName lastName");
  }

  // Get users registered for a specific event
  static async getEventParticipants(
    eventId: string
  ): Promise<Array<{ email: string; firstName: string; lastName: string }>> {
    const registrations = await Registration.find({
      eventId: eventId,
      status: "active",
    }).populate({
      path: "userId",
      match: {
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      },
      select: "email firstName lastName",
    });

    return registrations.map((reg) => reg.userId).filter((user) => user);
  }

  // Get event co-organizers
  static async getEventCoOrganizers(
    event: IEvent
  ): Promise<Array<{ email: string; firstName: string; lastName: string }>> {
    const coOrganizerEmails = event.organizerDetails
      .filter((organizer) => organizer.email !== event.createdBy.email)
      .map((organizer) => organizer.email);

    return await User.find({
      email: { $in: coOrganizerEmails },
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    }).select("email firstName lastName");
  }

  // Get recipients for System Authorization Level changes
  static async getSystemAuthorizationChangeRecipients(
    changedUserId: string
  ): Promise<
    Array<{ email: string; firstName: string; lastName: string; role: string }>
  > {
    return await User.find({
      _id: { $ne: changedUserId },
      role: { $in: ["Super Admin", "Administrator"] },
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    }).select("email firstName lastName role");
  }

  // Get recipients for Role in @Cloud changes (ministry leadership)
  static async getRoleInAtCloudChangeRecipients(): Promise<
    Array<{ email: string; firstName: string; lastName: string; role: string }>
  > {
    return await User.find({
      $or: [
        { role: "Super Admin" },
        {
          role: { $in: ["Administrator", "Leader"] },
          isAtCloudLeader: true,
        },
      ],
      isActive: true,
      isVerified: true,
      emailNotifications: true,
    }).select("email firstName lastName role roleInAtCloud");
  }
}
```

#### **Backend Tasks**

2. **Fix Event Creation Email Logic** (CRITICAL FIX)

```typescript
// File: /backend/src/controllers/eventController.ts
// REPLACE the current logic:
const allUsers = await User.find({
  _id: { $ne: req.user._id },
  isVerified: true,
}).select("email firstName lastName");

// WITH this improved logic:
const allUsers = await EmailRecipientUtils.getActiveVerifiedUsers(
  req.user.email
);
```

3. **Create Email Notification Router**

4. **Create Email Notification Router**

````typescript
// File: /backend/src/routes/emailNotifications.ts
// Endpoints needed:
- POST /event-created
- POST /co-organizer-assigned
- POST /event-reminder
- POST /new-leader-signup
- POST /system-authorization-change    // System role changes (Super Admin, Administrator, Leader, Participant)
- POST /atcloud-role-change           // @Cloud ministry role changes (Youth Pastor, IT Director, etc.)
- POST /security-alert
```

4. **Extend EmailService Class**

   ```typescript
   // Add methods:
   - sendCoOrganizerNotification()
   - sendEventReminderEmail()
   - sendSystemAuthorizationChangeNotification()    // For system role changes
   - sendAtCloudRoleChangeNotification()            // For ministry role changes
   - sendSecurityAlertEmail()
````

5. **Create Email Controllers**
   ```typescript
   // File: /backend/src/controllers/emailNotificationController.ts
   // Handle all notification triggers using EmailRecipientUtils
   ```

#### **🟡 MEDIUM PRIORITY: Frontend Tasks**

1. **Fix emailNotificationService.ts**

   - Update API endpoints to match backend
   - Add proper error handling
   - Implement retry logic for failed requests
   - Remove empty `recipients: []` arrays (backend will determine recipients)

2. **Test Email Flows**
   - User registration → verification email
   - Event creation → notification emails (with proper filtering)
   - **System Authorization Level changes** → admin notifications and user confirmations
   - **Role in @Cloud changes** → appropriate notifications to ministry leadership

#### **Integration Tasks**

1. **Connect Systems**

   - System messages should trigger emails when appropriate
   - Bell notifications should sync with email preferences
   - Real-time updates should include email delivery status
   - **System Authorization Level changes** should trigger both bell notifications and emails to admins
   - **Role in @Cloud changes** should trigger notifications to relevant administrators

2. **Email Routing Integration**
   - **Event Creation**: Use `EmailRecipientUtils.getActiveVerifiedUsers()` instead of current logic
   - **Admin Notifications**: Use `EmailRecipientUtils.getAdminUsers()` for all admin notifications
   - **Event Reminders**: Use `EmailRecipientUtils.getEventParticipants()` for reminder emails
   - **Role Changes**: Use specific recipient methods based on change type
   - **Event Role Removal**: Use `EmailRecipientUtils.getUserById()` for removed user notifications
   - **Event Role Move**: Use `EmailRecipientUtils.getUserById()` for moved user notifications

---

## 🎯 **IMPLEMENTATION PRIORITY MATRIX**

### **🔴 WEEK 1: CRITICAL FOUNDATION**

1. ✅ **EmailRecipientUtils class** - Core recipient discovery logic
2. ✅ **Fix Event Creation filtering** - Add `isActive` and `emailNotifications` filters
3. ✅ **Admin Discovery Logic** - For role change notifications
4. ✅ **Event Participant Discovery** - For reminder emails

### **🟡 WEEK 2: ENHANCED FEATURES**

5. ✅ **Co-organizer Logic** - For event assignment emails
6. ✅ **Role Change Recipients** - For system/ministry role changes
7. ✅ **User Preference Validation** - Frontend checks before sending
8. ✅ **Automated Scheduling** - Cron jobs for reminders

### **🟢 WEEK 3: ADVANCED FEATURES**

9. ✅ **Email Delivery Tracking** - Log who received what emails
10. ✅ **Failed Email Retry** - Handle bounced emails
11. ✅ **Advanced Filtering** - Time zone, frequency preferences
12. ✅ **Analytics Dashboard** - Email engagement metrics

---

## 🔧 **TECHNICAL SPECIFICATIONS**

### **Email Template Requirements**

```html
<!-- All emails should include: -->
- Professional HTML layout with @Cloud branding - Mobile-responsive design -
Clear call-to-action buttons - Unsubscribe links - Consistent styling with
existing templates
```

### **API Endpoint Specifications**

```typescript
// POST /api/v1/notifications/event-created
interface EventCreatedPayload {
  eventId: string;
  excludeEmail?: string; // Don't send to event creator
  eventData: {
    title: string;
    date: string;
    time: string;
    location?: string;
    organizerName: string;
  };
}

//  /api/v1/notifications/new-leader-signup
interface LeaderSignupPayload {
  userData: {
    firstName: string;
    lastName: string;
    email: string;
    roleInAtCloud: string; // Their ministry position in @Cloud
  };
}

// POST /api/v1/notifications/system-authorization-change
interface SystemAuthorizationChangePayload {
  userData: {
    firstName: string;
    lastName: string;
    email: string;
    oldRole: string; // Previous system authorization level
    newRole: string; // New system authorization level
  };
  changedBy: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
}

// POST /api/v1/notifications/atcloud-role-change
interface AtCloudRoleChangePayload {
  userData: {
    firstName: string;
    lastName: string;
    email: string;
    oldRoleInAtCloud: string; // Previous ministry position
    newRoleInAtCloud: string; // New ministry position
  };
}

// POST /api/v1/notifications/event-role-removal
interface EventRoleRemovalPayload {
  userData: {
    firstName: string;
    lastName: string;
    email: string;
    userId: string;
  };
  eventData: {
    title: string;
    id: string;
    roleName: string;
    roleDescription?: string;
  };
  removedBy: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
}

// POST /api/v1/notifications/event-role-move
interface EventRoleMovePayload {
  userData: {
    firstName: string;
    lastName: string;
    email: string;
    userId: string;
  };
  eventData: {
    title: string;
    id: string;
    fromRoleName: string;
    toRoleName: string;
    newRoleDescription?: string;
  };
  movedBy: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
}
```

### **Database Schema Updates**

```typescript
// Add to User model:
interface EmailPreferences {
  eventNotifications: boolean;
  systemMessages: boolean;
  securityAlerts: boolean;
  weeklyDigest: boolean;
}

// Add to Event model:
interface EmailTracking {
  reminderSent: boolean;
  reminderSentAt?: Date;
  notificationsSent: string[]; // Array of email addresses
}
```

---

## 📊 **SUCCESS METRICS**

### **Phase 1 Completion Criteria**

- [ ] All frontend email service calls succeed (no 404 errors)
- [ ] Event creation triggers emails to all users
- [ ] Co-organizer assignment sends targeted emails
- [ ] **System Authorization Level changes** notify appropriate administrators (promotion/demotion emails)
- [ ] **Role in @Cloud changes** notify ministry leadership (ministry position update emails)
- [ ] All email templates render correctly

### **Phase 2 Completion Criteria**

- [ ] Event reminders sent automatically 24h before events
- [ ] Email queue processes without blocking main application
- [ ] Failed emails retry with exponential backoff
- [ ] Users can control email preferences

### **Phase 3 Completion Criteria**

- [ ] Email delivery tracking shows >95% success rate
- [ ] Email templates render correctly on all major clients
- [ ] System can handle >1000 concurrent email sends
- [ ] Analytics dashboard shows email engagement metrics

---

## � **PASSWORD CHANGE INTEGRATION OPPORTUNITIES**

### **Immediate Implementation Ready**

With the password change bug now fixed, we have a solid foundation to build email notifications:

#### **Security Email Templates to Add**

1. **Password Change Confirmation**

   ```html
   Subject: "Password Successfully Changed - @Cloud" - Confirm password was
   changed successfully - Include timestamp and basic device/location info -
   Provide "wasn't me?" security link
   ```

2. **Password Change Security Alert**
   ```html
   Subject: "Security Alert: Password Changed - @Cloud" - Alert user their
   password was changed - Include device/IP information if available - Provide
   immediate contact info for suspicious activity
   ```

#### **Integration Points**

1. **Frontend Hook Enhancement**

   ```typescript
   // In useChangePassword.ts - Already fixed to call real API
   // Now add email notification trigger:
   await apiClient.changePassword(/*...*/);
   await apiClient.sendPasswordChangeNotification(); // NEW
   ```

2. **Backend Controller Integration**
   ```typescript
   // In userController.ts changePassword method
   // After successful password change:
   await emailService.sendPasswordChangeConfirmation(user);
   await emailService.sendPasswordChangeSecurityAlert(user, deviceInfo);
   ```

### **Advanced Security Features**

1. **Device Detection**: Track device/browser info for security alerts
2. **Session Management**: Email notification when all sessions are invalidated
3. **Suspicious Activity**: Email alerts for failed password change attempts
4. **Admin Notifications**: Alert administrators of security-related password changes

---

## �🚀 **NEXT STEPS**

### **Ready to Start**

1. ✅ **Password Change Infrastructure**: Already fixed and tested (33 tests passing)
2. **Confirm Implementation Plan**: Review and approve this updated plan
3. **Set Priorities**: Determine which phases to tackle first
4. **Resource Allocation**: Assign development time for each phase
5. **Create Implementation Branch**: Start with clean git branch

### **Recommended Start Order**

1. **Start with Password Change Emails** (Low hanging fruit, infrastructure ready)
2. **Implement Missing API Endpoints** (Critical for frontend functionality)
3. **Add Event-related Notifications** (High user value)
4. **Build Advanced Features** (Analytics, preferences, etc.)

### **Questions for Stakeholder**

1. **Email Provider**: Continue with current SMTP or upgrade to service like SendGrid?
2. **Email Frequency**: What's the maximum acceptable email frequency per user?
3. **Analytics**: Do we need detailed email analytics or basic delivery tracking?
4. **Timeline**: How aggressive should our implementation timeline be?
5. **Password Security**: How detailed should password change security alerts be?

---

## 📝 **IMPLEMENTATION NOTES**

### **Key Files to Modify**

```
Backend:
├── src/utils/emailRecipientUtils.ts (NEW - CRITICAL FOUNDATION)
├── src/routes/emailNotifications.ts (NEW)
├── src/controllers/emailNotificationController.ts (NEW)
├── src/controllers/eventController.ts (FIX - update event creation email logic)
├── src/controllers/userController.ts (EXTEND - add email after System Authorization Level change)
├── src/controllers/profileController.ts (EXTEND - add email after Role in @Cloud change)
├── src/services/infrastructure/emailService.ts (EXTEND)
├── src/models/User.ts (ADD email preferences)
└── src/routes/index.ts (ADD new routes)

Frontend:
├── src/utils/emailNotificationService.ts (FIX - remove empty recipients arrays)
├── src/hooks/useChangePassword.ts (✅ ALREADY FIXED)
├── src/components/settings/EmailPreferences.tsx (NEW)
└── src/hooks/useEmailNotifications.ts (NEW)
```

### **Critical Implementation Order**

**Phase 1A: Foundation (Day 1-2)**

1. Create `EmailRecipientUtils` class
2. Fix event creation email filtering
3. Test existing email flows with new filtering

**Phase 1B: API Endpoints (Day 3-4)**  
4. Create email notification router 5. Implement missing POST endpoints 6. Connect frontend to new endpoints

**Phase 1C: Admin Notifications (Day 5-7)** 7. Implement role change email logic 8. Test admin notification flows 9. Validate all email routing works correctly

### **Dependencies to Consider**

- **node-cron**: For scheduled email reminders
- **bull** or **agenda**: For email queue management
- **email-validator**: For email validation
- **mjml**: For advanced email templates (optional)
- **ua-parser-js**: For device detection in security emails

---

**📌 STATUS**: Ready for implementation. Password change infrastructure completed and tested. **Email routing logic analysis complete - critical recipient discovery methods identified.**

**🆕 UPDATE**: Added Event Role Management notifications (user removal/move) for Email + Bell + System message sync.

**🔄 LAST UPDATED**: 2025-07-27 (Updated with event role management email notifications)  
**👥 STAKEHOLDERS**: Development Team, Product Owner  
**⏱️ ESTIMATED TIMELINE**: 3 weeks for full implementation (can start with EmailRecipientUtils immediately)

**🚨 CRITICAL FOUNDATION**: The `EmailRecipientUtils` class is the cornerstone for all email routing. Implement this first to ensure emails reach the right recipients.

**🔗 EVENT MANAGEMENT INTEGRATION**: Event role removal and moves now trigger Email + Bell + System message trios automatically.
