# Phase 5.1: EventDetail.tsx Analysis & Refactoring Plan

**File**: `frontend/src/pages/EventDetail.tsx`  
**Current Size**: 4,298 lines  
**Status**: Analysis Complete ✅ | Design In Progress 🔄

---

## Executive Summary

EventDetail.tsx is the largest frontend file (4,298 lines) containing a massive React component with extensive state management, business logic, UI rendering, and event handling. This file serves as the main event detail view with admin/organizer management capabilities.

**Key Challenges**:

- Single massive component (4,050+ lines in main function)
- 25+ state variables with useState
- 3+ useEffect hooks with complex logic
- 15+ event handler functions (50-200 lines each)
- Large JSX render section (2,000+ lines)
- Heavy coupling between business logic and UI

**Refactoring Goal**: Reduce to ~300-500 lines orchestration component using React best practices: custom hooks, sub-components, and focused responsibilities.

---

## File Structure Analysis

### 1. Imports & Type Definitions (Lines 1-243)

- **Size**: 243 lines
- **Content**:
  - 30+ import statements (React, router, services, components, utilities)
  - Type definitions for Backend entities (BackendUser, BackendRegistration, BackendRole, BackendEventLike)
  - Type definitions for Guest entities (GuestApiGuest, GuestDisplay)
  - Helper sub-components defined inline (PublishReadinessInline, PublishActionButton)

**Refactoring Opportunity**:

- Move type definitions to shared types file
- Extract inline helper components (PublishReadinessInline, PublishActionButton)

### 2. Helper Sub-Components (Lines 43-161)

- **PublishReadinessInline** (43-73): 30 lines - Publish validation status display
- **PublishActionButton** (85-161): 76 lines - Publish/unpublish action button with state management

**Refactoring Opportunity**: Extract to separate component files in `components/EventDetail/`

### 3. Main Component Declaration (Lines 245-527)

#### 3a. Hooks & Refs (Lines 246-262)

- Router hooks: useParams, useNavigate, useLocation
- Auth hook: useAuth
- Notification hook: useToastReplacement
- Avatar updates hook: useAvatarUpdates
- Refs: notificationRef, prevPublishRef, prevAutoReasonRef

#### 3b. State Declarations (Lines 263-367) - **105 lines**

**25+ state variables**:

- `event`: EventData | null - Main event data
- `publishing`: boolean - Publish action loading state
- `copyNotice`, `showShareModal`: UI state for modals
- `loading`: boolean - Initial load state
- `programNames`: Record<string, string> - Program label names
- `showAccessModal`, `blockedProgramId`, `blockedProgramName`, `checkingAccess`: Program access restriction state
- `guestsByRole`: Record<string, GuestDisplay[]> - Guest participants by role
- `managementMode`: boolean - Admin management mode toggle
- `draggedUserId`, `draggedGuestId`: Drag-and-drop state
- `showDeletionModal`: boolean - Event deletion modal
- `cancelConfirm`: Guest cancellation confirmation modal state
- `editGuest`: Guest edit modal state
- `resendLinkConfirm`: Resend manage link confirmation modal state
- `emailModal`: Email participants modal state (subject, body, filters, sending)
- `emailEditorRef`, `savedSelection`: Rich text editor state
- `editingGroup`, `topicDraft`: Workshop group topic editing state
- `nameCardModal`: Name card action modal state

**Refactoring Opportunity**: Group related states into custom hooks

- `useEventData()` - event, loading, publishing, programNames
- `useGuestManagement()` - guestsByRole, cancelConfirm, editGuest, resendLinkConfirm
- `useAdminActions()` - managementMode, draggedUserId, draggedGuestId, showDeletionModal
- `useEmailModal()` - emailModal state + emailEditorRef + savedSelection
- `useWorkshopGroups()` - editingGroup, topicDraft

#### 3c. Computed Values & Helper Functions (Lines 383-525) - **143 lines**

**Computed values**:

- `currentUserId`, `currentUserRole`: User identity
- `canNavigateToProfiles`: Permission check
- `isCurrentUserOrganizer`: Organizer status check
- `canDeleteEvent`: Delete permission check
- `isPassedEvent`: Event completion status
- `canManageSignups`: Signup management permission
- `userSignedUpRoles`, `maxRolesForUser`, `userDistinctRoleCount`, `hasReachedMaxRoles`, `isUserSignedUp`: Multi-role limit tracking (NEW POLICY 2025-10-10)

**Helper functions**:

- `isCurrentUserRegistered()`: Check user registration status
- `canViewZoomInfo()`: Zoom visibility permission
- `getProfileLink()`: Build user profile URL
- `handleNameCardClick()`: Name card interaction logic
- `isRoleAllowedForUser()`: Role permission check (currently always true)
- `getUserSignupRoles()`: Get user's registered roles

**Refactoring Opportunity**: Extract to utility functions or custom hooks

- Permission utilities: canNavigateToProfiles, canViewZoomInfo, canDeleteEvent, canManageSignups
- Role limit utilities: Already using getMaxRolesPerEvent, hasUnlimitedRoles from shared utils
- User registration utilities: isCurrentUserRegistered, getUserSignupRoles

### 4. useEffect Hooks (Lines 527-842) - **316 lines**

#### 4a. Fetch Event Data (Lines 527-710) - **184 lines**

**Purpose**: Fetch event, convert backend data, fetch guests, handle errors, subscribe to real-time updates
**Dependencies**: `[id, location.search, navigate]`

**Logic**:

1. Fetch event from eventService.getEvent(id)
2. Convert backend event structure to frontend EventData
3. Handle role registration data transformation (registrations vs currentSignups)
4. Fetch guest data via GuestApi.getEventGuests()
5. Group guests by role
6. Handle access restrictions (program-based)
7. Subscribe to WebSocket updates (socketService)
8. Auto-unpublish toast notifications on realtime events
9. Error handling with navigation fallback

**Complexity**: High - 184 lines of mixed data fetching, transformation, business logic, side effects

**Refactoring Opportunity**: Extract to custom hook `useEventData()`

- Returns: event, loading, error, refetch
- Encapsulates: fetching, transformation, WebSocket subscriptions, error handling

#### 4b. Fetch Program Names (Lines 712-749) - **38 lines**

**Purpose**: Fetch program names for display from program labels
**Dependencies**: `[event?.programLabels]`

**Logic**:

1. For each programId in event.programLabels
2. Fetch program details via programService.getById()
3. Build programNames mapping (id → name)
4. Cleanup socket subscription on unmount

**Refactoring Opportunity**: Integrate into `useEventData()` or create separate `useProgramNames(event?.programLabels)`

#### 4c. Check Program Access (Lines 751-842) - **92 lines**

**Purpose**: Check if user has access to restricted programs, block if needed
**Dependencies**: `[event, currentUser, navigate, notification]`

**Logic**:

1. Check event.programLabels for programs
2. For each program, fetch details and check:
   - Is program free? (always allow)
   - Has user purchased access via purchases/check API?
   - Is user a mentor in the program?
3. If access denied, show access restriction modal
4. Cleanup effect

**Refactoring Opportunity**: Extract to custom hook `useProgramAccess(event, currentUser)`

- Returns: checkingAccess, showAccessModal, blockedProgramId, blockedProgramName
- Encapsulates: access checks, purchase validation, modal state

### 5. Render Helper Functions (Lines 843-1456) - **614 lines**

#### 5a. renderGuestsForRole (Lines 843-925) - **83 lines**

**Purpose**: Render guest participant list for a role with admin actions
**Features**:

- Guest name cards with email/phone
- Edit guest button
- Cancel guest registration button
- Resend manage link button
- Drag-and-drop for role transfers (managementMode)

**Refactoring Opportunity**: Extract to `<GuestList>` component

#### 5b. Large inline JSX sections (Lines 926-1456) - **531 lines**

**Content**: Additional render helpers and complex JSX embedded in useEffect/handlers

**Refactoring Opportunity**: Extract to UI sub-components

### 6. Event Handler Functions (Lines 1458-2233) - **776 lines**

#### 6a. handleDownloadCalendar (Lines 1458-1486) - **29 lines**

**Purpose**: Generate and download ICS calendar file for event

#### 6b. handleRoleSignup (Lines 1487-1644) - **158 lines**

**Purpose**: Sign up user for a role with validation
**Logic**:

- Multi-role limit checks (NEW POLICY 2025-10-10)
- API call to eventService.signUpForRole()
- Optimistic UI update
- Success/error notifications
- Role transfer handling (if already in another role)

#### 6c. startEditTopic, cancelEditTopic, saveTopic (Lines 1599-1644) - **46 lines**

**Purpose**: Workshop group topic editing (A-F groups)

#### 6d. handleRoleCancel (Lines 1646-1725) - **80 lines**

**Purpose**: Cancel user registration for a role
**Logic**:

- API call to eventService.cancelSignup()
- Optimistic UI update
- Success/error notifications

#### 6e. handleManagementCancel (Lines 1727-1816) - **90 lines**

**Purpose**: Admin/organizer cancel another user's registration
**Logic**:

- Permission check
- API call to eventService.cancelUserSignup()
- Refetch event data
- Success/error notifications

#### 6f. handleDragStart, handleGuestDragStart, handleDragEnd, handleDragOver, handleDrop (Lines 1818-2010) - **193 lines**

**Purpose**: Drag-and-drop role transfers for users and guests
**Logic**:

- Track dragged user/guest
- Validate drop target (different role, capacity available)
- API call to eventService.moveUserToRole() or GuestApi.moveGuestToRole()
- Refetch event data
- Success/error notifications

#### 6g. handleExportSignups (Lines 2012-2078) - **67 lines**

**Purpose**: Export event signups to Excel (XLSX)
**Logic**:

- Build Excel workbook with user and guest data
- One sheet per role
- Download as file

#### 6h. handleDeleteEvent (Lines 2080-2143) - **64 lines**

**Purpose**: Delete event permanently
**Logic**:

- API call to eventService.deleteEvent()
- Navigate to dashboard
- Success/error notifications

#### 6i. handleCancelEvent (Lines 2145-2233) - **89 lines**

**Purpose**: Cancel event (change status to cancelled)
**Logic**:

- API call to eventService.updateEvent() with status: 'cancelled'
- Update local state
- Success/error notifications

**Refactoring Opportunity**: Group handlers into logical modules

- `useSignupHandlers()` - handleRoleSignup, handleRoleCancel, handleManagementCancel
- `useDragDropHandlers()` - handleDragStart, handleGuestDragStart, handleDragEnd, handleDragOver, handleDrop
- `useEventActions()` - handleDownloadCalendar, handleExportSignups, handleDeleteEvent, handleCancelEvent
- `useWorkshopGroupHandlers()` - startEditTopic, cancelEditTopic, saveTopic

### 7. Loading & Error States (Lines 2234-2260) - **27 lines**

**Purpose**: Early returns for loading and not found states

### 8. Main Render Section (Lines 2261-4298) - **2,038 lines**

**Purpose**: Massive JSX tree rendering all UI components

**Major UI Sections**:

1. Event header with actions (edit, delete, cancel, export, email, publish)
2. Flyer carousel (if flyerUrls exist)
3. Event details grid (date, time, location, format, organizer, etc.)
4. Program labels badges
5. Publish status box with PublishActionButton and PublishReadinessInline
6. Pricing information (if paid event)
7. Workshop group topics (A-F groups with edit capability)
8. Event roles accordion (expand/collapse per role)
   - Role header (name, description, capacity, public status)
   - Signed-up users list with name cards
   - Guest participants list (via renderGuestsForRole)
   - Sign-up button (EventRoleSignup component)
9. Modals (15+ modal components):
   - EventDeletionModal
   - Event cancellation confirmation
   - Share modal (ShareModal)
   - Email participants modal (large inline implementation)
   - Guest edit modal (GuestEditModal)
   - Guest cancellation confirmation (ConfirmationModal)
   - Resend manage link confirmation (ConfirmationModal)
   - Name card action modal (NameCardActionModal)
   - Program access restriction modal (ConfirmationModal)

**Refactoring Opportunity**: Break into sub-components

- `<EventHeader>` - Title, actions bar, flyer carousel
- `<EventDetailsGrid>` - Event information fields
- `<PublishStatusCard>` - Publish button + readiness + share
- `<PricingCard>` - Pricing information display
- `<WorkshopGroupsSection>` - Workshop topics with edit capability
- `<EventRolesAccordion>` - All roles with signups (could further break down per role)
- `<EventModals>` - All modal components grouped

---

## Dependency Analysis

### External Dependencies (Services)

- `eventService` - Event CRUD + signup/cancel operations
- `programService` - Program details + access checks
- `purchaseService` - Purchase validation
- `GuestApi` - Guest CRUD operations
- `socketService` - WebSocket real-time updates
- `apiFetch` - Generic API calls

### React Hooks Used

- `useState` - 25+ state variables
- `useEffect` - 3 major effects (event fetch, program names, program access)
- `useRef` - 3 refs (notification, prev publish state, email editor)
- `useParams` - Route parameter (event ID)
- `useNavigate` - Programmatic navigation
- `useLocation` - Location state/search params
- `useAuth` - Current user context
- `useToastReplacement` - Notification system
- `useAvatarUpdates` - Real-time avatar updates (separate hook)
- `usePublishReadiness` - Publish validation (custom hook)

### Component Dependencies

- `Multiline` - Multiline text display
- `EventRoleSignup` - Role signup button component
- `FlyerCarousel` - Image carousel for event flyers
- `Icon` - Icon component
- `EventDeletionModal` - Event deletion confirmation
- `ConfirmationModal` - Generic confirmation dialog
- `GuestEditModal` - Guest information editing
- `NameCardActionModal` - User profile actions
- `EditButton` - Styled edit button
- `ShareModal` - Event sharing dialog
- `PublishGateBanner` - Publish readiness banner (not visible in render, may be unused?)

---

## Refactoring Strategy: Recommended Approach

### Phase 5.1a: Extract Custom Hooks (Isolate Business Logic)

**Objective**: Move state management and business logic out of component into focused custom hooks.

**Custom Hooks to Create** (in `frontend/src/hooks/`):

1. **useEventData(eventId: string)** - ~200 lines

   - Encapsulates: event fetching, loading, error handling, WebSocket subscriptions, guest fetching, program names
   - Returns: `{ event, loading, error, refetch, guestsByRole, programNames, publishing, setPublishing }`
   - Extracted from: Lines 527-749 (useEffect hooks)

2. **useProgramAccess(event, currentUser)** - ~100 lines

   - Encapsulates: program access checks, purchase validation, mentor checks, modal state
   - Returns: `{ checkingAccess, showAccessModal, blockedProgramId, blockedProgramName, setShowAccessModal, handleAccessCheck }`
   - Extracted from: Lines 751-842 (useEffect hook)

3. **useEventPermissions(event, currentUser)** - ~80 lines

   - Encapsulates: all permission checks (canDelete, canManage, canEdit, canViewZoom, isOrganizer, isRegistered)
   - Returns: `{ isCurrentUserOrganizer, canDeleteEvent, canManageSignups, canViewZoomInfo, isCurrentUserRegistered, canNavigateToProfiles }`
   - Extracted from: Lines 383-525 (computed values + helper functions)

4. **useRoleLimits(event, currentUser)** - ~40 lines

   - Encapsulates: multi-role limit tracking (NEW POLICY 2025-10-10)
   - Returns: `{ userSignedUpRoles, maxRolesForUser, userDistinctRoleCount, hasReachedMaxRoles, isUserSignedUp }`
   - Extracted from: Lines 496-525

5. **useSignupHandlers(event, setEvent, notification)** - ~250 lines

   - Encapsulates: signup, cancel, management cancel handlers
   - Returns: `{ handleRoleSignup, handleRoleCancel, handleManagementCancel }`
   - Extracted from: Lines 1487-1816

6. **useDragDropHandlers(event, setEvent, notification)** - ~200 lines

   - Encapsulates: drag-and-drop role transfer logic
   - Returns: `{ draggedUserId, draggedGuestId, handleDragStart, handleGuestDragStart, handleDragEnd, handleDragOver, handleDrop }`
   - Extracted from: Lines 1818-2010 + state variables

7. **useEventActions(event, notification, navigate)** - ~180 lines

   - Encapsulates: download calendar, export signups, delete event, cancel event
   - Returns: `{ handleDownloadCalendar, handleExportSignups, handleDeleteEvent, handleCancelEvent }`
   - Extracted from: Lines 1458-2233 (minus signup/drag-drop handlers)

8. **useWorkshopGroups(event, setEvent, notification)** - ~60 lines

   - Encapsulates: workshop group topic editing
   - Returns: `{ editingGroup, topicDraft, startEditTopic, cancelEditTopic, saveTopic }`
   - Extracted from: Lines 1599-1644 + state variables

9. **useEmailModal()** - ~150 lines

   - Encapsulates: email participants modal state and rich text editor logic
   - Returns: `{ emailModal, emailEditorRef, savedSelection, applyEditorCommand, openEmailModal, closeEmailModal, sendEmail }`
   - Extracted from: Lines 300-363 (state + editor logic) + email handler logic

10. **useGuestModals()** - ~50 lines
    - Encapsulates: guest management modal states
    - Returns: `{ cancelConfirm, setCancelConfirm, editGuest, setEditGuest, resendLinkConfirm, setResendLinkConfirm }`
    - Extracted from: Lines 284-298 (state variables)

**Total Hook Extraction**: ~1,360 lines of logic moved out of component

### Phase 5.1b: Extract Sub-Components (UI Modularity)

**Objective**: Break down 2,038-line render section into focused, reusable components.

**Components to Create** (in `frontend/src/components/EventDetail/`):

1. **PublishReadinessInline.tsx** - 30 lines

   - Already defined inline, just move to separate file
   - Props: `{ event }`

2. **PublishActionButton.tsx** - 80 lines

   - Already defined inline, just move to separate file + use hooks
   - Props: `{ event, setEvent, notification }`

3. **EventHeader.tsx** - ~200 lines

   - Event title, back button, action buttons bar (edit, delete, cancel, export, email, share)
   - Props: `{ event, canDeleteEvent, canManageSignups, onEdit, onDelete, onCancel, onExport, onEmail, onShare }`

4. **FlyerDisplay.tsx** - ~50 lines

   - Flyer carousel wrapper (if flyerUrls exist)
   - Props: `{ flyerUrl, secondaryFlyerUrl }`

5. **EventDetailsGrid.tsx** - ~400 lines

   - All event information fields (date, time, location, format, organizer, etc.)
   - Program labels badges
   - Zoom info (if canViewZoomInfo)
   - Props: `{ event, programNames, canViewZoomInfo }`

6. **PublishStatusCard.tsx** - ~100 lines

   - Publish status box with PublishActionButton and PublishReadinessInline
   - Share button
   - Props: `{ event, setEvent, notification, onShare }`

7. **PricingCard.tsx** - ~80 lines

   - Pricing information display (if paid event)
   - Props: `{ event }`

8. **WorkshopGroupsSection.tsx** - ~200 lines

   - Workshop topics A-F with edit capability
   - Props: `{ event, editingGroup, topicDraft, canEditWorkshopGroup, startEditTopic, cancelEditTopic, saveTopic }`

9. **EventRolesAccordion.tsx** - ~600 lines

   - All roles with expand/collapse
   - Per role: header, signed-up users, guests, signup button
   - Could further decompose into EventRole.tsx sub-component
   - Props: `{ event, guestsByRole, userSignedUpRoles, hasReachedMaxRoles, managementMode, canManageSignups, permissions, handlers, renderGuestsForRole }`

10. **RoleParticipantsList.tsx** - ~150 lines

    - User name cards for a role
    - Props: `{ role, event, managementMode, canManageSignups, onNameCardClick, onCancelSignup, onDragStart, onDragEnd, onDragOver, onDrop }`

11. **GuestList.tsx** - ~120 lines

    - Guest participant list (extracted from renderGuestsForRole)
    - Props: `{ roleId, guests, managementMode, canManageSignups, onEdit, onCancel, onResendLink, onDragStart, onDrop }`

12. **EventModals.tsx** - ~300 lines
    - All 15+ modals grouped in one component for cleaner separation
    - Props: All modal states + handlers

**Total Component Extraction**: ~2,310 lines of UI moved to sub-components (with some expansion for prop interfaces)

### Phase 5.1c: Main EventDetail.tsx (Orchestration Layer)

**Final Structure** (~400-500 lines):

```typescript
export default function EventDetail() {
  // Router hooks
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const notification = useToastReplacement();

  // Custom hooks (business logic extraction)
  const {
    event,
    loading,
    error,
    refetch,
    guestsByRole,
    programNames,
    publishing,
    setPublishing,
  } = useEventData(id);
  const {
    checkingAccess,
    showAccessModal,
    blockedProgramId,
    blockedProgramName,
    setShowAccessModal,
  } = useProgramAccess(event, currentUser);
  const permissions = useEventPermissions(event, currentUser);
  const roleLimits = useRoleLimits(event, currentUser);
  const signupHandlers = useSignupHandlers(event, refetch, notification);
  const dragDropHandlers = useDragDropHandlers(event, refetch, notification);
  const eventActions = useEventActions(event, notification, navigate);
  const workshopGroups = useWorkshopGroups(event, refetch, notification);
  const emailModal = useEmailModal();
  const guestModals = useGuestModals();

  // UI state (minimal)
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const [managementMode, setManagementMode] = useState(false);
  const [nameCardModal, setNameCardModal] = useState({
    isOpen: false,
    userId: "",
    userName: "",
    userRole: "",
  });

  // Loading state
  if (loading) return <LoadingSpinner />;
  if (!event) return <EventNotFound />;

  // Main render
  return (
    <div className="container mx-auto px-4 py-6">
      <EventHeader
        event={event}
        canDeleteEvent={permissions.canDeleteEvent}
        canManageSignups={permissions.canManageSignups}
        onEdit={() => navigate(`/events/${event.id}/edit`)}
        onDelete={() => setShowDeletionModal(true)}
        onCancel={eventActions.handleCancelEvent}
        onExport={eventActions.handleExportSignups}
        onEmail={emailModal.openEmailModal}
        onShare={() => setShowShareModal(true)}
      />

      <FlyerDisplay
        flyerUrl={event.flyerUrl}
        secondaryFlyerUrl={event.secondaryFlyerUrl}
      />

      <EventDetailsGrid
        event={event}
        programNames={programNames}
        canViewZoomInfo={permissions.canViewZoomInfo}
      />

      <PublishStatusCard
        event={event}
        setEvent={refetch}
        notification={notification}
        onShare={() => setShowShareModal(true)}
      />

      {event.pricing && <PricingCard event={event} />}

      {event.type === "workshop" && (
        <WorkshopGroupsSection
          event={event}
          editingGroup={workshopGroups.editingGroup}
          topicDraft={workshopGroups.topicDraft}
          canEditWorkshopGroup={permissions.canManageSignups}
          startEditTopic={workshopGroups.startEditTopic}
          cancelEditTopic={workshopGroups.cancelEditTopic}
          saveTopic={workshopGroups.saveTopic}
        />
      )}

      <EventRolesAccordion
        event={event}
        guestsByRole={guestsByRole}
        userSignedUpRoles={roleLimits.userSignedUpRoles}
        hasReachedMaxRoles={roleLimits.hasReachedMaxRoles}
        managementMode={managementMode}
        canManageSignups={permissions.canManageSignups}
        permissions={permissions}
        signupHandlers={signupHandlers}
        dragDropHandlers={dragDropHandlers}
        onNameCardClick={(userId, userName, userRole) =>
          setNameCardModal({ isOpen: true, userId, userName, userRole })
        }
      />

      <EventModals
        event={event}
        showDeletionModal={showDeletionModal}
        setShowDeletionModal={setShowDeletionModal}
        showShareModal={showShareModal}
        setShowShareModal={setShowShareModal}
        emailModal={emailModal}
        guestModals={guestModals}
        nameCardModal={nameCardModal}
        setNameCardModal={setNameCardModal}
        showAccessModal={showAccessModal}
        setShowAccessModal={setShowAccessModal}
        blockedProgramName={blockedProgramName}
        eventActions={eventActions}
        notification={notification}
      />
    </div>
  );
}
```

**Main Component Breakdown**:

- **Hooks**: ~50 lines (all business logic delegated to custom hooks)
- **UI State**: ~20 lines (only UI-specific state like modal visibility)
- **Early Returns**: ~10 lines (loading, not found)
- **Render**: ~320 lines (clean composition of sub-components with props passing)
- **Total**: ~400 lines

---

## Expected Impact

### Before Refactoring

- **EventDetail.tsx**: 4,298 lines (single massive component)
- **Maintainability**: Very low (hard to navigate, test, debug)
- **Testability**: Very low (integration tests only, hard to isolate logic)
- **Reusability**: Zero (everything coupled in one file)

### After Refactoring

- **EventDetail.tsx**: ~400 lines (clean orchestration)
- **Custom Hooks**: 10 files, ~1,360 lines total (isolated, testable business logic)
- **Sub-Components**: 12 files, ~2,310 lines total (reusable, testable UI modules)
- **Total Lines**: ~4,070 lines across 23 files (modest decrease, massive maintainability gain)
- **Maintainability**: High (focused files, clear responsibilities)
- **Testability**: High (can unit test hooks and components independently)
- **Reusability**: High (components and hooks can be reused across app)

### File Distribution

```
frontend/src/
├── pages/
│   └── EventDetail.tsx (400 lines) ← orchestration
├── hooks/
│   ├── useEventData.ts (200 lines)
│   ├── useProgramAccess.ts (100 lines)
│   ├── useEventPermissions.ts (80 lines)
│   ├── useRoleLimits.ts (40 lines)
│   ├── useSignupHandlers.ts (250 lines)
│   ├── useDragDropHandlers.ts (200 lines)
│   ├── useEventActions.ts (180 lines)
│   ├── useWorkshopGroups.ts (60 lines)
│   ├── useEmailModal.ts (150 lines)
│   └── useGuestModals.ts (50 lines)
└── components/
    └── EventDetail/
        ├── PublishReadinessInline.tsx (30 lines)
        ├── PublishActionButton.tsx (80 lines)
        ├── EventHeader.tsx (200 lines)
        ├── FlyerDisplay.tsx (50 lines)
        ├── EventDetailsGrid.tsx (400 lines)
        ├── PublishStatusCard.tsx (100 lines)
        ├── PricingCard.tsx (80 lines)
        ├── WorkshopGroupsSection.tsx (200 lines)
        ├── EventRolesAccordion.tsx (600 lines)
        ├── RoleParticipantsList.tsx (150 lines)
        ├── GuestList.tsx (120 lines)
        └── EventModals.tsx (300 lines)
```

---

## Execution Plan

### Step 1: Create Custom Hooks (Phase 5.1a)

**Order**: Simple → Complex

1. `useRoleLimits` (simplest, no API calls)
2. `useEventPermissions` (computed values only)
3. `useGuestModals` (just state grouping)
4. `useProgramAccess` (medium complexity, API calls)
5. `useWorkshopGroups` (state + handlers)
6. `useEmailModal` (state + editor logic)
7. `useEventData` (complex, fetching + WebSocket)
8. `useSignupHandlers` (API calls + state updates)
9. `useDragDropHandlers` (drag-drop logic)
10. `useEventActions` (multiple API operations)

**Testing**: After each hook extraction, run frontend tests to ensure no regressions.

### Step 2: Extract Sub-Components (Phase 5.1b)

**Order**: Simple → Complex

1. `PublishReadinessInline` (already separated, just move file)
2. `PublishActionButton` (already separated, just move + use hook)
3. `FlyerDisplay` (simple wrapper)
4. `PricingCard` (simple display)
5. `EventHeader` (medium complexity)
6. `EventDetailsGrid` (medium complexity)
7. `PublishStatusCard` (uses PublishActionButton + PublishReadinessInline)
8. `WorkshopGroupsSection` (uses workshop hooks)
9. `GuestList` (extracted from renderGuestsForRole)
10. `RoleParticipantsList` (user name cards)
11. `EventRolesAccordion` (complex, uses multiple sub-components)
12. `EventModals` (grouping all modals)

**Testing**: After each component extraction, verify UI rendering and interactions work correctly.

### Step 3: Refactor Main EventDetail.tsx (Phase 5.1c)

1. Replace inline logic with custom hook calls
2. Replace large JSX sections with sub-component compositions
3. Clean up imports (remove unused imports from extractions)
4. Verify prop passing to all sub-components
5. Test all user flows end-to-end

### Step 4: Integration Testing (Phase 5.1d)

1. Run full frontend test suite: `npm run test:frontend`
2. Manual browser testing of all scenarios:
   - View event as public user
   - Sign up for roles (with multi-role limit enforcement)
   - Cancel registrations
   - Admin/organizer management mode
   - Drag-and-drop role transfers
   - Workshop group topic editing
   - Email participants
   - Export signups
   - Delete/cancel event
   - Publish/unpublish event
3. Debug any failures (likely prop passing issues, context misconfig)

---

## Risk Assessment

### High Risk Areas

1. **WebSocket subscription logic** in useEventData - Complex cleanup, easy to create memory leaks
2. **Drag-and-drop state management** - Tricky state synchronization between user/guest drags
3. **Email modal rich text editor** - Caret positioning and selection preservation logic fragile
4. **Multi-role limit enforcement** - NEW POLICY (2025-10-10), ensure limits work correctly after extraction

### Medium Risk Areas

1. **Program access checks** - Complex conditional logic with multiple API calls
2. **Modal state synchronization** - Many modals sharing event/guest data, ensure consistency
3. **Optimistic UI updates** - Several handlers update local state before API confirmation

### Low Risk Areas

1. **Permission computations** - Pure functions, easy to extract and test
2. **Event details display** - Presentational only, no complex logic
3. **Flyer carousel** - Existing component, just pass props

### Mitigation Strategy

- Extract in small increments with testing after each step
- Start with low-risk, simple extractions to build confidence
- Use exact code copy methodology from backend refactoring (proven successful in Phases 3-4)
- Add TypeScript type guards where needed for prop passing
- Maintain existing test coverage throughout refactoring

---

## Success Criteria

1. ✅ EventDetail.tsx reduced to ~400-500 lines (from 4,298)
2. ✅ 10 custom hooks created with clear responsibilities
3. ✅ 12 sub-components created with focused UI concerns
4. ✅ All frontend tests passing (632/632 maintained)
5. ✅ Manual testing confirms all features working:
   - Event viewing and details display
   - User signup/cancel with multi-role limits
   - Admin/organizer management actions
   - Drag-and-drop role transfers
   - Workshop group editing
   - Email participants
   - Export signups
   - Event deletion/cancellation
   - Publish/unpublish with validation
6. ✅ No console errors or warnings
7. ✅ TypeScript compilation successful
8. ✅ Code committed with comprehensive documentation

---

**Next Step**: Begin Phase 5.1a - Extract first custom hook (useRoleLimits) as proof of concept.
