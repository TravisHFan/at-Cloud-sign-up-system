# Phase 6.3: SystemMessages.tsx Refactoring Plan

## Executive Summary

**Target File:** `frontend/src/pages/SystemMessages.tsx`  
**Current Size:** 1,464 lines  
**Estimated Final Size:** ~650-750 lines  
**Target Reduction:** 45-50% (700-800 lines removed)

## Current Architecture Analysis

### File Structure

1. **Lines 1-75**: Imports and type definitions (TimingMeta, RoleInviteMetadata, type guards)
2. **Lines 77-150**: Component initialization (state, hooks, pagination logic)
3. **Lines 150-280**: useEffects (4 total: loadPage, reload on change, avatar updates, WebSocket)
4. **Lines 280-630**: Handler functions (13 functions total)
5. **Lines 630-985**: Message list rendering (header, stats, pagination, messages)
6. **Lines 985-1450**: Create message modal (large 465-line modal form)
7. **Lines 1450-1465**: Delete/Alert modals

### Complexity Metrics

- **State Variables**: 11 (showCreateForm, formData, deleteConfirmation, alertModal, pagedMessages, totalPages, totalCount, currentPage, loading, sendDropdownOpen, avatarUpdateCounter)
- **useEffects**: 4 (page load, message reload, avatar updates, WebSocket connection)
- **Handler Functions**: 13 functions
- **Message Filtering**: Complex role-based logic (auth_level_change, user_management, event_role_change)
- **Create Modal**: 465 lines with extensive form validation and dropdown menu

## Extraction Targets

### 1. MessageListItem Component (~350 lines)

**Lines to Extract:** 730-985 (message card rendering within map)

**Responsibilities:**

- Individual message card display
- Header with type icon, title, date, priority badge
- Delete button and unread indicator
- Content rendering with role invite metadata parsing
- Event time localization for role invites
- CTA buttons (View Event, See Role Details, Decline Invitation)
- Creator information section with avatar and name card
- Read timestamp and type badge

**Props Interface:**

```typescript
interface MessageListItemProps {
  message: SystemMessage;
  currentUser: User | null;
  canNavigateToProfiles: boolean;
  onMessageClick: (messageId: string) => void;
  onDeleteMessage: (e: React.MouseEvent, messageId: string) => void;
  onNameCardClick: (userId: string) => void;
  getTypeIcon: (type: string, message?: { title?: string }) => JSX.Element;
  getTypeColor: (type: string, message?: { title?: string }) => string;
  getPriorityColor: (priority: string) => string;
  formatDate: (dateString: string) => string;
}
```

**Dependencies:**

- `formatViewerLocalDateTime` util
- `readRoleInviteMetadata` helper
- Icon component
- Existing utility functions passed as props

**Estimated Reduction:** 255 lines in SystemMessages.tsx (component definition stays in list)

---

### 2. CreateMessageModal Component (~465 lines)

**Lines to Extract:** 985-1450 (entire create modal section)

**Responsibilities:**

- Modal backdrop and container
- Form with title input (5-200 chars) and content textarea (5-3500 chars)
- Include creator checkbox with current user profile display
- Type selector (announcement, maintenance, update, warning)
- Priority selector (low, medium, high)
- Recipient dropdown menu with 5 options:
  - Send to All
  - Send to Admins (Super Admin + Administrator)
  - Send to @Cloud co-workers (Super Admin + Administrator + Leader)
  - Send to Guest Experts
  - Send to Participants
- Form validation with character count displays
- Action buttons (Cancel, Clear Form, Send with dropdown)

**Props Interface:**

```typescript
interface CreateMessageModalProps {
  isOpen: boolean;
  currentUser: User | null;
  onClose: () => void;
  onSendMessage: (targetRoles?: string[]) => Promise<void>;
  onNameCardClick: (userId: string) => void;
}
```

**Internal State:**

- formData (title, content, type, priority, includeCreator)
- sendDropdownOpen

**Estimated Reduction:** 420 lines in SystemMessages.tsx

---

### 3. MessageTypeHelpers Hook/Utils (~100 lines)

**Lines to Extract:** Type icon, type color, priority color functions

**Responsibilities:**

- `getTypeIcon(type, message)` - Returns icon/SVG for message type
- `getTypeColor(type, message)` - Returns color class for message type
- `getPriorityColor(priority)` - Returns color class for priority

**Export as:**

```typescript
// Option A: Custom hook
export function useMessageTypeHelpers() {
  const getTypeIcon = useCallback((type: string, message?: { title?: string }) => { ... }, []);
  const getTypeColor = useCallback((type: string, message?: { title?: string }) => { ... }, []);
  const getPriorityColor = useCallback((priority: string) => { ... }, []);

  return { getTypeIcon, getTypeColor, getPriorityColor };
}

// Option B: Plain utilities (RECOMMENDED - simpler, no unnecessary hooks)
export const messageTypeHelpers = {
  getTypeIcon(type: string, message?: { title?: string }): JSX.Element { ... },
  getTypeColor(type: string, message?: { title?: string }): string { ... },
  getPriorityColor(priority: string): string { ... },
};
```

**Estimated Reduction:** 90 lines in SystemMessages.tsx

---

### 4. MessageListHeader Component (~60 lines)

**Lines to Extract:** 630-690 (header section)

**Responsibilities:**

- Page title with icon
- Description text
- Create button (role-gated: Super Admin, Administrator, Leader)

**Props Interface:**

```typescript
interface MessageListHeaderProps {
  hasCreatePermission: boolean;
  onCreateClick: () => void;
}
```

**Estimated Reduction:** 50 lines in SystemMessages.tsx

---

## Refactoring Sequence

### Phase 6.3.1: Extract MessageTypeHelpers

1. Create `/frontend/src/utils/messageTypeHelpers.ts`
2. Move `getTypeIcon`, `getTypeColor`, `getPriorityColor` functions
3. Export as plain utilities object
4. Import in SystemMessages.tsx
5. Update all references to use `messageTypeHelpers.getTypeIcon()` etc.
6. **Verify:** 0 TypeScript errors, all tests passing

### Phase 6.3.2: Extract MessageListHeader

1. Create `/frontend/src/components/SystemMessages/MessageListHeader.tsx`
2. Move header section (lines 630-690)
3. Pass `hasCreatePermission` and `onCreateClick` as props
4. Import in SystemMessages.tsx and replace inline JSX
5. **Verify:** 0 TypeScript errors, all tests passing

### Phase 6.3.3: Extract CreateMessageModal

1. Create `/frontend/src/components/SystemMessages/CreateMessageModal.tsx`
2. Move entire modal (lines 985-1450)
3. Internalize formData state and sendDropdownOpen
4. Pass handlers as props (onSendMessage, onClose)
5. Move constants (TITLE_MIN, TITLE_MAX, etc.) into component
6. Move helper functions (handleInputChange, handleClearForm, getRecipientDisplayText) into component
7. Import in SystemMessages.tsx
8. **Verify:** 0 TypeScript errors, all tests passing

### Phase 6.3.4: Extract MessageListItem

1. Create `/frontend/src/components/SystemMessages/MessageListItem.tsx`
2. Move message card JSX from map function (lines 730-985)
3. Import all utility functions and types
4. Keep message metadata parsing logic (readRoleInviteMetadata, formatViewerLocalDateTime)
5. Pass all handlers as props
6. Update SystemMessages.tsx map to use component
7. **Verify:** 0 TypeScript errors, all tests passing

### Phase 6.3.5: Final Verification

1. Run `npm run verify` (lint + type-check)
2. Run `npm test` (all test suites)
3. Verify 0 errors in all Phase 6.3 files
4. Calculate final line counts and reduction percentage
5. Update documentation

## Expected Results

### Line Count Reductions

| File               | Before | After | Reduction | %   |
| ------------------ | ------ | ----- | --------- | --- |
| SystemMessages.tsx | 1,464  | ~700  | ~764      | 52% |

### New Files Created

1. `/frontend/src/utils/messageTypeHelpers.ts` (~100 lines)
2. `/frontend/src/components/SystemMessages/MessageListHeader.tsx` (~60 lines)
3. `/frontend/src/components/SystemMessages/CreateMessageModal.tsx` (~490 lines)
4. `/frontend/src/components/SystemMessages/MessageListItem.tsx` (~370 lines)

**Total extracted:** ~1,020 lines  
**Net reduction in SystemMessages.tsx:** ~764 lines (some lines for imports/integration)

### SystemMessages.tsx Final Structure (~700 lines)

```typescript
// Imports (~30 lines)
import { MessageListHeader } from "../components/SystemMessages/MessageListHeader";
import { MessageListItem } from "../components/SystemMessages/MessageListItem";
import { CreateMessageModal } from "../components/SystemMessages/CreateMessageModal";
import { messageTypeHelpers } from "../utils/messageTypeHelpers";

// Type definitions and guards (~75 lines) - Keep in main file as they're specific to this page
type TimingMeta = { ... };
type RoleInviteMetadata = { ... };
function isRecord, isTimingMeta, readRoleInviteMetadata - Keep these as they're used by child components

// Component (~595 lines)
export default function SystemMessages() {
  // State and hooks (~80 lines)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState({ ... });
  // ... all existing state

  // Pagination logic (~80 lines) - Keep, complex interdependency
  const loadPage = useCallback(async (page: number) => { ... }, []);

  // useEffects (~80 lines) - Keep, component lifecycle
  useEffect(() => loadPage(1), [loadPage]);
  useEffect(() => { /* reload on systemMessages change */ }, [systemMessages]);
  useEffect(() => { /* avatar updates */ }, [avatarUpdateCounter]);
  useEffect(() => { /* WebSocket connection */ }, []);

  // Filtered messages (~50 lines) - Keep, complex role-based filtering
  const filteredSystemMessages = useMemo(() => { ... }, [pagedMessages, currentUser]);

  // URL hash navigation (~50 lines) - Keep, page-specific logic
  useEffect(() => { /* scroll to message from hash */ }, [location.hash]);

  // Handler functions (~150 lines) - Keep, coordinate between components and state
  const handleMessageClick = (messageId: string) => { ... };
  const handleDeleteMessage = (e: React.MouseEvent, messageId: string) => { ... };
  const handleSendMessage = async (targetRoles?: string[]) => { ... };
  const formatDate = (dateString: string) => { ... };
  // ... other handlers

  // Render (~100 lines)
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <MessageListHeader
        hasCreatePermission={hasRole("Super Admin") || hasRole("Administrator") || hasRole("Leader")}
        onCreateClick={() => setShowCreateForm(true)}
      />

      {/* Stats - inline, only 15 lines */}
      {totalCount > 0 && ( ... )}

      {/* Pagination - inline, uses existing component */}
      {totalPages > 1 && <Pagination ... />}

      {/* Messages List */}
      <div className="space-y-4">
        {loading ? ( ... ) : filteredSystemMessages.length === 0 ? ( ... ) : (
          filteredSystemMessages.map((message) => (
            <MessageListItem
              key={message.id}
              message={message}
              currentUser={currentUser}
              canNavigateToProfiles={canNavigateToProfiles}
              onMessageClick={handleMessageClick}
              onDeleteMessage={handleDeleteMessage}
              onNameCardClick={handleNameCardClick}
              getTypeIcon={messageTypeHelpers.getTypeIcon}
              getTypeColor={messageTypeHelpers.getTypeColor}
              getPriorityColor={messageTypeHelpers.getPriorityColor}
              formatDate={formatDate}
            />
          ))
        )}
      </div>

      {/* Bottom Pagination - inline */}
      {totalPages > 1 && <Pagination ... />}

      <CreateMessageModal
        isOpen={showCreateForm}
        currentUser={currentUser}
        onClose={handleCancel}
        onSendMessage={handleSendMessage}
        onNameCardClick={handleNameCardClick}
      />

      {/* Delete/Alert modals - inline, only 30 lines total */}
      <ConfirmationModal ... />
      <AlertModal ... />
    </div>
  );
}
```

## Quality Gates

- ✅ Zero TypeScript errors in all Phase 6.3 files
- ✅ All existing tests passing (820/821 minimum, 99.9%)
- ✅ Zero new lint errors introduced
- ✅ Components follow existing naming conventions
- ✅ Props are properly typed with interfaces
- ✅ File structure matches Phase 6.1 and 6.2 patterns

## Risk Assessment

### Low Risk

- ✅ MessageTypeHelpers extraction (pure utility functions, no state)
- ✅ MessageListHeader extraction (simple presentational component)

### Medium Risk

- ⚠️ CreateMessageModal extraction (large, complex form with validation)
  - **Mitigation:** Extract as single unit, keep all form logic together
  - **Mitigation:** Internalize all form state (formData, sendDropdownOpen)
  - **Mitigation:** Pass only high-level handlers (onSendMessage, onClose)

### Medium-High Risk

- ⚠️ MessageListItem extraction (complex metadata parsing, multiple conditionals)
  - **Mitigation:** Keep type guard helpers in main file, pass as utils
  - **Mitigation:** Pass all utility functions as props rather than duplicating
  - **Mitigation:** Thoroughly test role invite messages with timing metadata

## Success Criteria

1. SystemMessages.tsx reduced to ~700 lines (50% reduction from 1,464)
2. All extracted components have clear, single responsibilities
3. No logic duplication between components
4. Zero TypeScript errors across all files
5. All tests passing (99.9% minimum)
6. Improved code maintainability and readability

## Timeline

- Phase 6.3.1 (MessageTypeHelpers): 15 minutes
- Phase 6.3.2 (MessageListHeader): 15 minutes
- Phase 6.3.3 (CreateMessageModal): 45 minutes (largest, most complex)
- Phase 6.3.4 (MessageListItem): 30 minutes
- Phase 6.3.5 (Final verification): 15 minutes
- **Total estimated time:** 2 hours

---

**Plan Status:** Ready for execution  
**Next Step:** Begin Phase 6.3.1 - Extract MessageTypeHelpers
