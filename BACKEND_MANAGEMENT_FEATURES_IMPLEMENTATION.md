# Backend Management Features Implementation Plan

## 🔍 **Comprehensive Codebase Audit Summary**

### **Current State Analysis**

#### **Frontend Implementation Status** ✅ **COMPLETED**

The frontend has fully implemented the management features in the `EventDetail.tsx` page:

1. **Management Mode Toggle**:

   - `managementMode` state controls the view mode
   - Only authorized users (Super Admin, Event Organizers) can access management mode
   - Management mode is disabled for passed events

2. **Remove User Feature** ✅ **Frontend Complete**:

   - `handleManagementCancel()` function handles user removal from roles
   - UI shows "Remove" button for each registered user in management mode
   - Currently uses simulated API call (`setTimeout` for 1000ms)
   - Updates local state optimistically
   - Shows success/failure notifications with undo functionality

3. **Drag & Drop Feature** ✅ **Frontend Complete**:
   - Full drag and drop implementation with HTML5 Drag API
   - `handleDragStart()`, `handleDragEnd()`, `handleDragOver()`, `handleDrop()` functions
   - Visual feedback during drag operations (blue highlighting, drop zones)
   - Validation for role capacity before dropping
   - Currently uses simulated API call (`setTimeout` for 500ms)
   - Updates local state optimistically

#### **Backend Implementation Status** ❌ **MISSING**

**Current Backend Capabilities**:

- ✅ User self-signup: `POST /events/:id/signup`
- ✅ User self-cancel: `POST /events/:id/cancel`
- ✅ Event CRUD operations with proper authorization
- ✅ Event model has `removeUserFromRole()` and `moveUserBetweenRoles()` methods
- ✅ Registration model supports audit trails with actions like `admin_removed`, `moved_between_roles`

**Missing Backend Features**:

- ❌ Admin/Organizer remove user from role endpoint
- ❌ Admin/Organizer move user between roles endpoint
- ❌ Proper authorization middleware for management operations
- ❌ Registration audit trail integration for admin actions

### **Database Architecture** ✅ **Ready for Implementation**

#### **Event Model** (MongoDB Collection: `events`)

```typescript
interface IEvent {
  roles: IEventRole[]; // Array of event roles
  // Other event fields...
}

interface IEventRole {
  id: string; // UUID for role
  name: string; // Role name
  description: string; // Role description
  maxParticipants: number; // Maximum allowed participants
  currentSignups: IEventParticipant[]; // Current registered participants
}

interface IEventParticipant {
  userId: ObjectId; // Reference to User
  username: string; // User's username
  firstName?: string; // User's first name
  lastName?: string; // User's last name
  systemAuthorizationLevel?: string; // User's role (Super Admin, etc.)
  roleInAtCloud?: string; // User's ministry role
  avatar?: string; // User's avatar URL
  gender?: "male" | "female"; // User's gender
  notes?: string; // Signup notes
}
```

**Available Methods**:

- ✅ `event.removeUserFromRole(userId, roleId)` - Removes user from specific role
- ✅ `event.moveUserBetweenRoles(userId, fromRoleId, toRoleId)` - Moves user between roles

#### **Registration Model** (MongoDB Collection: `registrations`)

```typescript
interface IRegistration {
  userId: ObjectId; // User being registered
  eventId: ObjectId; // Event being registered for
  roleId: string; // Specific role within event
  status: RegistrationStatus; // active, waitlisted, no_show, attended
  registeredBy: ObjectId; // Who registered this user (self or admin)
  actionHistory: ActionHistoryEntry[]; // Audit trail
  // Other fields...
}

type RegistrationAction =
  | "registered"
  | "role_changed"
  | "moved_between_roles"
  | "updated_notes"
  | "admin_removed"
  | "admin_added";
```

**Database Status**:

- 📊 **atcloud-signup**: 4 events, 26 registrations, 9 users
- ✅ All models are properly configured for the new features

### **Authorization System** ✅ **Ready**

**Current Permission Structure**:

- **Super Admin**: Full access to all events
- **Event Organizers**: Access to events they created or are listed as organizers
- **Validation**: `authorizeEventAccess` middleware checks permissions

## 🎯 **Implementation Plan**

### **Phase 1: Backend API Endpoints** (Priority: HIGH)

#### **Step 1.1: Add Management Routes**

Add these routes to `backend/src/routes/events.ts`:

```typescript
// Event management routes (after existing authenticated routes)
router.post(
  "/:id/manage/remove-user",
  validateObjectId,
  handleValidationErrors,
  authorizeEventManagement, // New middleware
  EventController.removeUserFromRole
);

router.post(
  "/:id/manage/move-user",
  validateObjectId,
  handleValidationErrors,
  authorizeEventManagement, // New middleware
  EventController.moveUserBetweenRoles
);
```

#### **Step 1.2: Create Authorization Middleware**

Create `authorizeEventManagement` middleware in `backend/src/middleware/auth.ts`:

```typescript
export const authorizeEventManagement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Check if user is Super Admin or Event Organizer
  // Similar logic to existing authorizeEventAccess
};
```

#### **Step 1.3: Implement Controller Methods**

Add methods to `backend/src/controllers/eventController.ts`:

```typescript
// Remove user from role (for admins/organizers)
static async removeUserFromRole(req: Request, res: Response): Promise<void> {
  // Validate request
  // Check permissions
  // START TRANSACTION
  // 1. Remove user from event role (events collection)
  // 2. Delete registration record (registrations collection)
  // COMMIT TRANSACTION
  // Emit WebSocket event for real-time updates
  // Return updated event
}

// Move user between roles (for admins/organizers)
static async moveUserBetweenRoles(req: Request, res: Response): Promise<void> {
  // Validate request
  // Check permissions
  // Validate target role capacity
  // START TRANSACTION
  // 1. Move user between roles (events collection)
  // 2. Update registration roleId (registrations collection)
  // COMMIT TRANSACTION
  // Emit WebSocket event for real-time updates
  // Return updated event
}
```

### **WebSocket Integration** ✅ **Already Implemented**

**Current WebSocket Status**:

- ✅ **SocketService**: Fully implemented with authentication
- ✅ **Frontend Integration**: Real-time notifications and system messages
- ✅ **User Management**: User online status, room management
- ✅ **Event Emission**: Methods for broadcasting updates

**WebSocket-Transaction Compatibility**: ✅ **SAFE**

- **Sequence**: Transaction → Commit → WebSocket Emit
- **Failure Handling**: If transaction fails, no WebSocket events are emitted
- **Real-time Safety**: Only successful operations trigger real-time updates

**New WebSocket Events Needed**:

```typescript
// Add to SocketService - Comprehensive Event Updates
emitEventUpdate(eventId: string, updateType: string, data: any): void {
  this.io.emit('event_update', {
    eventId,
    updateType, // 'user_removed' | 'user_moved' | 'user_signed_up' | 'user_cancelled' | 'role_full' | 'role_available'
    data,
    timestamp: new Date().toISOString()
  });
}

// Targeted updates for specific event participants
emitEventRoomUpdate(eventId: string, updateType: string, data: any): void {
  this.io.to(`event:${eventId}`).emit('event_room_update', {
    updateType,
    data,
    timestamp: new Date().toISOString()
  });
}
```

**Frontend WebSocket Integration**:

```typescript
// EventDetail.tsx should listen for real-time event updates
useEffect(() => {
  if (socket && event?.id) {
    // Join event-specific room
    socket.emit("join_event_room", event.id);

    // Listen for real-time updates
    socket.on("event_update", handleEventUpdate);
    socket.on("event_room_update", handleEventRoomUpdate);

    return () => {
      socket.emit("leave_event_room", event.id);
      socket.off("event_update");
      socket.off("event_room_update");
    };
  }
}, [socket, event?.id]);
```

### **Phase 2: Frontend API Integration** (Priority: HIGH)

#### **Step 2.1: Add API Service Methods**

Update `frontend/src/services/api.ts`:

```typescript
// Add to eventService object
removeUserFromRole: (eventId: string, userId: string, roleId: string) =>
  apiClient.removeUserFromRole(eventId, userId, roleId),

moveUserBetweenRoles: (
  eventId: string,
  userId: string,
  fromRoleId: string,
  toRoleId: string
) => apiClient.moveUserBetweenRoles(eventId, userId, fromRoleId, toRoleId),
```

#### **Step 2.2: Update EventDetail Component**

Replace simulated API calls in `frontend/src/pages/EventDetail.tsx`:

```typescript
// Replace handleManagementCancel function
const handleManagementCancel = async (roleId: string, userId: string) => {
  try {
    const updatedEvent = await eventService.removeUserFromRole(
      event.id,
      userId,
      roleId
    );
    // Update local state with real API response
  } catch (error) {
    // Handle error
  }
};

// Replace handleDrop function
const handleDrop = async (e: React.DragEvent, toRoleId: string) => {
  try {
    const { userId, fromRoleId } = JSON.parse(
      e.dataTransfer.getData("text/plain")
    );

    const updatedEvent = await eventService.moveUserBetweenRoles(
      event.id,
      userId,
      fromRoleId,
      toRoleId
    );
    // Update local state with real API response
  } catch (error) {
    // Handle error
  }
};
```

### **Phase 3: Testing & Validation** (Priority: MEDIUM)

#### **Step 3.1: Backend Unit Tests**

Create tests in `backend/tests/integration/events/`:

```typescript
// Test event management features
describe("Event Management", () => {
  it("should allow organizer to remove user from role");
  it("should allow organizer to move user between roles");
  it("should prevent unauthorized users from managing events");
  it("should validate role capacity when moving users");
  it("should maintain audit trail for management actions");

  // NEW: Concurrency and Race Condition Tests
  it("should prevent race condition when 2 users signup for 1 remaining slot");
  it("should handle concurrent management operations safely");
  it("should emit correct WebSocket events for all operations");
  it("should maintain data consistency under high concurrent load");
  it("should rollback failed transactions without partial updates");
});
```

#### **Step 3.2: Frontend Integration Tests**

Update existing frontend tests to cover management mode functionality.

### **Phase 4: Enhanced Features** (Priority: LOW)

#### **Step 4.1: Bulk Operations**

- Bulk user removal
- Bulk user role assignment

#### **Step 4.2: Advanced Audit Trail**

- Detailed change history
- Manager action notifications

#### **Step 4.3: Real-time Updates** ✅ **APPROVED FOR IMPLEMENTATION**

- **WebSocket integration for ALL event operations**:
  - Live updates when users are moved/removed (management operations)
  - Real-time signup updates when users register/cancel
  - Live capacity updates showing available slots
  - Instant role status changes (full/available)
- **Race Condition Protection**: Transaction-based concurrency control
- **Universal Event Monitoring**: All users viewing event see real-time changes

## 🚨 **Critical Implementation Notes**

### **Authorization Requirements**

- **Event Organizers**: Users listed in `event.organizerDetails` or `event.createdBy`
- **Super Admins**: Always have management access
- **Validation**: Must verify user has permission before allowing management operations

### **Data Integrity**

- **Registration Records**:
  - **Remove Operation**: Delete the registration record entirely (Option A - Simplicity)
  - **Move Operation**: Update the existing registration record's `roleId` (Option A - Simplicity)
- **Transaction Safety**: ALL event operations must use MongoDB transactions to ensure both collections are updated atomically
  - **Event Signup**: Existing signup process needs transaction protection
  - **Event Cancel**: Existing cancel process needs transaction protection
  - **Management Remove**: New remove operation with transaction protection
  - **Management Move**: New move operation with transaction protection
- **Race Condition Protection**:
  - **Concurrent Signup Prevention**: Use transactions with role capacity validation
  - **Write Conflict Detection**: Prevent simultaneous operations on same role
  - **Optimistic Locking**: Version-based conflict resolution for high-concurrency scenarios
- **Audit Trail**: All management actions must be logged with `performedBy` field
- **Event Statistics**: Ensure `signedUp` and `totalSlots` are recalculated after changes

### **Error Handling**

- **Role Capacity**: Prevent moving users to full roles
- **User Validation**: Ensure user exists and is currently in source role
- **Event Status**: Only allow management for upcoming/ongoing events

### **Frontend State Management**

- **Optimistic Updates**: Update local state immediately for better UX
- **Error Recovery**: Revert changes and show error if API call fails
- **Real-time Sync**: Consider implementing periodic refresh or WebSocket updates

## 📋 **Implementation Checklist**

### **Backend Tasks**

- [ ] **Transaction Protection**: Retrofit existing signup/cancel endpoints with transactions
- [ ] Create `authorizeEventManagement` middleware
- [ ] Add management routes to events router
- [ ] Implement `removeUserFromRole` controller method with transaction + WebSocket
- [ ] Implement `moveUserBetweenRoles` controller method with transaction + WebSocket
- [ ] **Race Condition Protection**: Add concurrency control to all event operations
- [ ] **WebSocket Events**: Implement real-time event updates for all operations
- [ ] Add request validation schemas
- [ ] Update registration audit trail logic
- [ ] Write unit and integration tests including concurrency scenarios

### **Frontend Tasks**

- [ ] Add API service methods for management operations
- [ ] Replace simulated API calls in EventDetail component
- [ ] **Real-time Integration**: Add WebSocket listeners for live event updates
- [ ] **Event Room Management**: Implement join/leave event rooms for targeted updates
- [ ] Enhance error handling and user feedback
- [ ] Update TypeScript interfaces
- [ ] Test management functionality end-to-end including real-time scenarios

### **Documentation Tasks**

- [ ] Update API documentation with new endpoints
- [ ] Document management feature usage
- [ ] Update deployment guide if needed

## 🔄 **Risk Mitigation**

### **Data Safety**

- **Backup Strategy**: Ensure database backups before deployment
- **Rollback Plan**: Be prepared to revert changes if issues arise
- **Testing**: Thoroughly test in development environment first

### **User Experience**

- **Permission Clarity**: Clearly indicate who can access management mode
- **Feedback**: Provide clear success/error messages for all operations
- **Undo Functionality**: Consider adding undo capabilities for critical operations

### **Performance**

- **Database Queries**: Optimize queries for event retrieval with large participant lists
- **Frontend Rendering**: Ensure drag and drop remains responsive with many participants

## 🎯 **Success Criteria**

1. **✅ Authorized users can remove participants from event roles**
2. **✅ Authorized users can move participants between event roles**
3. **✅ All management actions are properly audited**
4. **✅ Unauthorized users cannot access management features**
5. **✅ Event integrity is maintained after management operations**
6. **✅ User experience remains smooth and intuitive**
7. **✅ Real-time updates work for ALL event operations (signup, cancel, remove, move)**
8. **✅ Race conditions are prevented - no double-booking of single-capacity roles**
9. **✅ All event operations are transaction-protected for data consistency**
10. **✅ WebSocket events provide instant feedback to all users viewing the event**

---

## 🔥 **Critical Implementation Priority**

**PHASE 1A: Transaction Retrofit** (URGENT)

- Existing `signUpForEvent` and `cancelSignup` endpoints need immediate transaction protection
- Race condition vulnerability exists in current signup process

**PHASE 1B: Management Endpoints** (HIGH)

- New remove/move endpoints with full transaction + WebSocket integration

**PHASE 1C: Real-time Integration** (HIGH)

- WebSocket events for all event operations
- Frontend listeners for live updates

**📝 Note**: The frontend implementation is already complete and working with simulated API calls. The primary focus should be on implementing the backend endpoints with transaction safety and real-time capabilities.
