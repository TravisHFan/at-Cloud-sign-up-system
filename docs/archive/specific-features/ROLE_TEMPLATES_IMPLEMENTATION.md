# Role Templates Feature - Implementation Summary

**Feature**: Editable Event Type Role Templates with Database Persistence

**Date**: 2025-10-09

---

## Overview

This feature replaces hardcoded event role templates with a fully editable system that persists templates in a MongoDB database. Users with appropriate permissions can create, edit, and delete role templates for different event types through a dedicated UI.

---

## Requirements Summary

1. **Database Persistence**: Role templates stored in `rolestemplates` collection
2. **CRUD Operations**: Full Create, Read, Update, Delete functionality
3. **Permission System**:
   - Create: Super Admin, Administrator, Leader
   - Edit/Delete: Super Admin, Administrator, Creator (template owner)
4. **Template Selection Logic**:
   - 1 template per event type: Auto-apply when creating new events
   - 2+ templates: Show dropdown selector with confirmation
5. **Non-Breaking**: Existing events are not affected by template changes

---

## Backend Implementation

### 1. Database Model

**File**: `backend/src/models/RolesTemplate.ts`

**Schema**:

```typescript
{
  templateName: String (required, max 100 chars)
  eventType: String (required, indexed)
  roles: Array<{
    name: String (required)
    description: String (required)
    maxParticipants: Number (required, min 1)
    openToPublic: Boolean (optional)
    agenda: String (optional)
    startTime: String (optional, HH:MM format)
    endTime: String (optional, HH:MM format)
  }>
  createdBy: ObjectId (ref User, indexed)
  timestamps: true (createdAt, updatedAt)
}
```

**Indexes**:

- `eventType` (ascending)
- `createdBy` (ascending)

### 2. Controller

**File**: `backend/src/controllers/rolesTemplateController.ts`

**Methods**:

- `getAllTemplates`: GET all templates, grouped by event type
- `getTemplatesByEventType`: GET templates for specific event type
- `getTemplateById`: GET single template by ID
- `createTemplate`: POST new template (requires Super Admin/Admin/Leader)
- `updateTemplate`: PUT update existing template (requires Super Admin/Admin/Creator)
- `deleteTemplate`: DELETE template (requires Super Admin/Admin/Creator)

**Permission Logic**:

- Uses `hasPermission` utility for role checks
- Creator comparison: `template.createdBy.toString() === String(user._id)`
- Returns 403 for unauthorized operations

### 3. Routes

**File**: `backend/src/routes/rolesTemplates.ts`

**Endpoints**:

- `GET /api/roles-templates` - Get all templates (grouped)
- `GET /api/roles-templates/event-type/:eventType` - Get templates by type
- `GET /api/roles-templates/:id` - Get single template
- `POST /api/roles-templates` - Create new template
- `PUT /api/roles-templates/:id` - Update template
- `DELETE /api/roles-templates/:id` - Delete template

All routes protected with `authenticate` middleware.

### 4. Migration Script

**File**: `backend/src/scripts/migrate-role-templates.ts`

**Purpose**: One-time migration to convert hardcoded templates to database records

**Process**:

1. Finds first Super Admin user as creator
2. Creates "Default [EventType] Template" for each event type
3. Uses hardcoded templates from `backend/src/config/eventTemplates.ts`
4. Skips if template already exists (safe to re-run)

**Usage**:

```bash
cd backend
npx ts-node src/scripts/migrate-role-templates.ts
```

---

## Frontend Implementation

### 1. Types

**File**: `frontend/src/types/rolesTemplate.ts`

**Interfaces**:

- `TemplateRole`: Individual role within a template
- `RolesTemplate`: Complete template document
- `CreateTemplatePayload`: Data for creating new template
- `UpdateTemplatePayload`: Data for updating template
- `GroupedTemplates`: Templates grouped by event type

### 2. API Service

**File**: `frontend/src/services/api.ts`

**New Methods**:

- `getAllRolesTemplates()`: Fetch all templates
- `getRolesTemplatesByEventType(eventType)`: Fetch by type
- `getRolesTemplateById(id)`: Fetch single template
- `createRolesTemplate(payload)`: Create new template
- `updateRolesTemplate(id, payload)`: Update template
- `deleteRolesTemplate(id)`: Delete template

**Export**: `rolesTemplateService` object for easy imports

### 3. Components

#### RoleEditor Component

**File**: `frontend/src/components/RoleEditor.tsx`

**Purpose**: Reusable component for editing role arrays

**Features**:

- Add/remove roles
- Reorder roles (move up/down)
- Edit all role fields (name, description, maxParticipants, etc.)
- Optional fields: agenda, time range, openToPublic
- Validation and error display

**Props**:

- `roles: TemplateRole[]`
- `onChange: (roles: TemplateRole[]) => void`
- `disabled?: boolean`

### 4. Pages

#### Configure Roles Templates

**File**: `frontend/src/pages/ConfigureRolesTemplates.tsx`

**Purpose**: Main management dashboard for role templates

**Features**:

- Two-tier list: Event types → Templates
- "New Template" button per event type (if user has permission)
- Edit/Delete buttons per template (if user has permission)
- Delete confirmation modal
- Loading states and error handling

**Permissions**:

- Create: `canCreate()` checks Super Admin/Admin/Leader
- Edit/Delete: `canEdit(template)` checks Super Admin/Admin/Creator

**Route**: `/dashboard/configure-roles-templates`

#### Create Roles Template

**File**: `frontend/src/pages/CreateRolesTemplate.tsx`

**Purpose**: Create new role template

**Features**:

- Template name input
- Event type selector (pre-filled from query param)
- RoleEditor integration
- Validation (template name required, at least 1 role)
- Success/error notifications
- Navigates to configuration page on success

**Route**: `/dashboard/create-roles-template`

#### Edit Roles Template

**File**: `frontend/src/pages/EditRolesTemplate.tsx`

**Purpose**: Edit existing role template

**Features**:

- Loads template by ID from URL
- Read-only event type display
- Shows creator info and timestamps
- RoleEditor integration
- Validation (same as create)
- Success/error notifications
- Navigates back to configuration page on success

**Route**: `/dashboard/edit-roles-template/:id`

### 5. Event Creation Integration

#### CreateEvent Page

**File**: `frontend/src/pages/CreateEvent.tsx`

**Changes**:

1. **New State Variables** (lines 483-502):

   - `dbTemplates`: Database templates grouped by event type
   - `selectedTemplateId`: Currently selected template ID
   - `showTemplateSelector`: Whether to show template selector UI
   - `templateConfirmed`: Whether template selection is confirmed

2. **Enhanced Template Loading** (lines 790-853):

   - Loads both hardcoded and database templates
   - Auto-applies single template on initial load
   - Shows selector for multiple templates
   - Falls back to hardcoded if no database templates

3. **Event Type Change Handler** (lines 897-946):

   - Responds to event type changes
   - Auto-applies if 1 template available
   - Shows selector if 2+ templates available
   - Prevents changes after template confirmed
   - Falls back to hardcoded templates

4. **Template Selector UI** (lines 1810-1893):
   - Dropdown for template selection (when 2+ templates)
   - "Confirm Template" button
   - "Configure Templates" button (navigation)
   - Success indicator after confirmation
   - Preserves all optional fields (agenda, time range, openToPublic)

**Logic Flow**:

```
Event Type Selected
  ↓
Check Database Templates
  ↓
If 1 template → Auto-apply to form
If 2+ templates → Show dropdown selector
If 0 templates → Fall back to hardcoded
  ↓
User confirms selection (if needed)
  ↓
Template locked (cannot change)
```

#### EditEvent Page

**File**: `frontend/src/pages/EditEvent.tsx`

**Changes**:

1. **Configure Templates Link** (lines 1514-1537):
   - Blue info box with "Configure Templates" button
   - Navigates to template management page
   - Simple UI (no template selection - editing existing event)

**Rationale**: Existing events keep their current roles. Template management is for future events only.

### 6. Routes

**File**: `frontend/src/App.tsx`

**New Routes**:

```tsx
<Route
  path="/dashboard/configure-roles-templates"
  element={
    <ProtectedRoute
      allowedRoles={["Super Admin", "Administrator", "Leader"]}
    >
      <ConfigureRolesTemplates />
    </ProtectedRoute>
  }
/>
<Route
  path="/dashboard/create-roles-template"
  element={
    <ProtectedRoute
      allowedRoles={["Super Admin", "Administrator", "Leader"]}
    >
      <CreateRolesTemplate />
    </ProtectedRoute>
  }
/>
<Route
  path="/dashboard/edit-roles-template/:id"
  element={
    <ProtectedRoute
      allowedRoles={["Super Admin", "Administrator", "Leader"]}
    >
      <EditRolesTemplate />
    </ProtectedRoute>
  }
/>
```

---

## Permission Matrix

| Action                  | Super Admin | Administrator | Leader | Creator | Others |
| ----------------------- | ----------- | ------------- | ------ | ------- | ------ |
| View Templates          | ✅          | ✅            | ✅     | ✅      | ✅     |
| Create Template         | ✅          | ✅            | ✅     | ❌      | ❌     |
| Edit Own Template       | ✅          | ✅            | ✅     | ✅      | ❌     |
| Edit Others' Template   | ✅          | ✅            | ❌     | ❌      | ❌     |
| Delete Own Template     | ✅          | ✅            | ✅     | ✅      | ❌     |
| Delete Others' Template | ✅          | ✅            | ❌     | ❌      | ❌     |

**Note**: "Creator" = user who created the specific template

---

## Testing Strategy

### Unit Tests

**Backend**:

- [ ] RolesTemplate model validation
- [ ] Permission logic in controller methods
- [ ] Template creation with valid/invalid data
- [ ] Template update ownership checks
- [ ] Template deletion authorization

**Frontend**:

- [ ] RoleEditor component interactions
- [ ] Template form validation
- [ ] Permission-based UI rendering
- [ ] Template selector logic

### Integration Tests

**Backend**:

- [ ] POST /api/roles-templates (authorized/unauthorized)
- [ ] GET /api/roles-templates (all, by event type, by ID)
- [ ] PUT /api/roles-templates/:id (owner/admin/unauthorized)
- [ ] DELETE /api/roles-templates/:id (owner/admin/unauthorized)
- [ ] Template application in event creation

**Frontend**:

- [ ] Navigate to configuration page
- [ ] Create new template flow
- [ ] Edit template flow
- [ ] Delete template with confirmation
- [ ] Template selection in CreateEvent (1 template)
- [ ] Template selection in CreateEvent (multiple templates)

### E2E Tests

- [ ] Super Admin creates template for all event types
- [ ] Leader creates template and edits their own
- [ ] Leader attempts to edit another user's template (should fail)
- [ ] Create event with single template (auto-apply)
- [ ] Create event with multiple templates (selector UI)
- [ ] Delete template with confirmation modal

---

## Deployment Checklist

### Pre-Deployment

- [x] All code compiled without errors
- [x] TypeScript types properly defined
- [x] Permission checks implemented (backend + frontend)
- [x] Delete confirmation modal functional
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Run full test suite (`npm test`)
- [ ] Verify linting passes (`npm run verify`)

### Deployment Steps

1. **Database Migration**:

   ```bash
   cd backend
   npx ts-node src/scripts/migrate-role-templates.ts
   ```

   - Verify templates created in database
   - Check that each event type has a default template

2. **Backend Deployment**:

   - Deploy backend with new routes and controller
   - Verify API endpoints accessible
   - Test authentication middleware

3. **Frontend Deployment**:

   - Build frontend: `npm run build`
   - Deploy static assets
   - Verify routes accessible
   - Test protected routes redirect correctly

4. **Post-Deployment Verification**:
   - [ ] Log in as Super Admin, create a template
   - [ ] Log in as Leader, create and edit own template
   - [ ] Create new event with 1 template (auto-applies)
   - [ ] Create new event with 2+ templates (selector shown)
   - [ ] Edit existing event (no template selector)
   - [ ] Delete template (confirmation modal appears)
   - [ ] Verify existing events unaffected

---

## Future Enhancements

1. **Template Versioning**: Track template changes over time
2. **Template Duplication**: "Duplicate Template" button for quick copying
3. **Bulk Operations**: Delete multiple templates at once
4. **Template Preview**: Show template roles before applying
5. **Template Usage Statistics**: Show how many events use each template
6. **Template Categories/Tags**: Organize templates with custom tags
7. **Template Import/Export**: Export templates as JSON, import from file

---

## Known Limitations

1. **No Template History**: Changes to templates are permanent, no undo
2. **No Template Sharing**: Templates are per-user, cannot share across organizations
3. **No Template Validation**: Limited validation on role field combinations
4. **Existing Events**: Changing templates doesn't affect existing events (by design)

---

## Files Modified/Created

### Backend

- ✅ Created: `backend/src/models/RolesTemplate.ts`
- ✅ Created: `backend/src/controllers/rolesTemplateController.ts`
- ✅ Created: `backend/src/routes/rolesTemplates.ts`
- ✅ Created: `backend/src/scripts/migrate-role-templates.ts`
- ✅ Modified: `backend/src/routes/index.ts` (added rolesTemplates route)

### Frontend

- ✅ Created: `frontend/src/types/rolesTemplate.ts`
- ✅ Created: `frontend/src/components/RoleEditor.tsx`
- ✅ Created: `frontend/src/pages/ConfigureRolesTemplates.tsx`
- ✅ Created: `frontend/src/pages/CreateRolesTemplate.tsx`
- ✅ Created: `frontend/src/pages/EditRolesTemplate.tsx`
- ✅ Modified: `frontend/src/services/api.ts` (added 6 methods)
- ✅ Modified: `frontend/src/App.tsx` (added 3 routes)
- ✅ Modified: `frontend/src/pages/CreateEvent.tsx` (template selection)
- ✅ Modified: `frontend/src/pages/EditEvent.tsx` (configure link)

### Documentation

- ✅ Created: `docs/ROLE_TEMPLATES_IMPLEMENTATION.md` (this file)

---

## Troubleshooting

### Issue: Templates not loading in CreateEvent

**Solution**: Check that migration script ran successfully. Verify templates exist in database:

```javascript
db.rolestemplates.find({}).pretty();
```

### Issue: Permission denied when creating template

**Solution**: Check user role. Only Super Admin, Administrator, and Leader can create templates. Verify JWT token contains correct role.

### Issue: Cannot edit/delete template

**Solution**:

1. Check if user is Super Admin/Administrator (can edit any)
2. Check if user is template creator (can edit own)
3. Verify `createdBy` field in database matches user ID

### Issue: Template selector not showing

**Solution**:

1. Verify event type has 2+ templates in database
2. Check browser console for API errors
3. Verify `dbTemplates` state populated correctly
4. Check `showTemplateSelector` state is true

---

## Contact

For questions or issues with this feature, contact the development team or refer to the main project README.

---

**Status**: ✅ Implementation Complete (Pending Tests)

**Last Updated**: 2025-10-09
