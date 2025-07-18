# Event System Extensibility Documentation

## Overview

The event creation system has been updated to support multiple event types with flexible configuration options. This document explains the new structure and how to extend it for future event types.

## ✅ IMPLEMENTED CHANGES

### 1. Optional Disclaimer Field

- **File**: `src/schemas/eventSchema.ts`
- **Change**: Made disclaimer field optional using `yup.string().optional()`
- **UI Update**: Removed red asterisk (\*) from disclaimer field label in `NewEvent.tsx`
- **Type Update**: Updated `EventData.disclaimer` to be optional (`disclaimer?: string`)
- **Status**: ✅ **FULLY IMPLEMENTED**

### 2. Dynamic Role Loading System

- **File**: `src/config/eventRoles.ts`
- **Added**: `getRolesByEventType()` helper function for dynamic role mapping
- **File**: `src/pages/NewEvent.tsx`
- **Implemented**: Dynamic role configuration based on selected event type
- **UI Enhancement**: Conditional role display with helpful messaging
- **Status**: ✅ **FULLY IMPLEMENTED**

## 🎯 HOW IT WORKS NOW

### Dynamic Role Loading

When a user selects an event type in the dropdown:

1. **Event Type Selection**: User selects from 5 available event types
2. **Automatic Role Loading**: System automatically loads appropriate roles using `getRolesByEventType()`
3. **UI Updates**: Role configuration section updates instantly with type-specific roles
4. **Visual Feedback**: Shows current event type in section header
5. **Helpful Messaging**: Displays guidance when no event type is selected

### Available Event Types with Roles

1. **Effective Communication Workshop Series** (9 roles)

   - Spiritual Covering, Tech Lead, Tech Assistant, Main Presenter, MC, Zoom Director, Zoom Co-host, Meeting Timer, Practice Group Leader

2. **Leadership Development Seminar** (4 roles)

   - Seminar Leader, Small Group Facilitator, Resource Coordinator, Tech Support

3. **Technical Skills Training** (4 roles)

   - Lead Instructor, Assistant Instructor, Lab Assistant, Equipment Manager

4. **Prayer and Fellowship Meeting** (2 roles)

   - Prayer Leader, Music Leader

5. **Bible Study Session** (2 roles)
   - Study Leader, Scripture Reader

## 🔧 TECHNICAL IMPLEMENTATION

### Key Components

1. **getRolesByEventType() Function**

   ```typescript
   export const getRolesByEventType = (
     eventTypeName: string
   ): Omit<EventRole, "id" | "currentSignups">[] => {
     switch (eventTypeName) {
       case "Effective Communication Workshop Series":
         return COMMUNICATION_WORKSHOP_ROLES;
       case "Leadership Development Seminar":
         return LEADERSHIP_SEMINAR_ROLES;
       // ... etc
     }
   };
   ```

2. **Dynamic Role Loading in NewEvent.tsx**

   ```typescript
   const selectedEventType = watch("type");
   const currentRoles = useMemo(() => {
     if (!selectedEventType) return [];
     return getRolesByEventType(selectedEventType);
   }, [selectedEventType]);
   ```

3. **Conditional UI Rendering**

   ```tsx
   {
     selectedEventType && currentRoles.length > 0 && (
       <div>
         <h3>Configure Event Roles for {selectedEventType}</h3>
         {/* Role configuration UI */}
       </div>
     );
   }
   ```

## ✅ USER EXPERIENCE IMPROVEMENTS

- **Instant Feedback**: Roles change immediately when event type is selected
- **Clear Context**: Shows which event type roles are being configured
- **Progressive Disclosure**: Only shows role configuration when needed
- **Helpful Guidance**: Provides clear instructions when no event type is selected
- **Type-Specific Roles**: Each event type has its own relevant role set

## 🚀 TESTING THE FEATURE

To test the dynamic role loading:

1. Open the "Create New Event" page
2. Initially, you'll see "Please select an event type..." message
3. Select "Effective Communication Workshop Series" → See 9 detailed roles
4. Switch to "Leadership Development Seminar" → See 4 leadership-focused roles
5. Switch to "Prayer and Fellowship Meeting" → See 2 simple roles
6. Each event type shows completely different, relevant roles instantly

## Changes Made

### 1. Optional Disclaimer Field

- **File**: `src/schemas/eventSchema.ts`
- **Change**: Made disclaimer field optional using `yup.string().optional()`
- **UI Update**: Removed red asterisk (\*) from disclaimer field label in `NewEvent.tsx`
- **Type Update**: Updated `EventData.disclaimer` to be optional (`disclaimer?: string`)

### 2. Extensible Event Types System

#### Event Types Configuration (`src/config/eventConstants.ts`)

```typescript
export const EVENT_TYPES = [
  {
    id: "communication-workshop",
    name: "Effective Communication Workshop Series",
    description: "Professional communication skills development workshop",
    requiresRoles: true,
    requiresDisclaimer: false,
    defaultRoles: "COMMUNICATION_WORKSHOP_ROLES",
  },
  // ... more event types
] as const;
```

#### Role Configurations (`src/config/eventRoles.ts`)

Added role configurations for all event types:

- `COMMUNICATION_WORKSHOP_ROLES` (existing)
- `LEADERSHIP_SEMINAR_ROLES` (new)
- `TECHNICAL_TRAINING_ROLES` (new)
- `PRAYER_MEETING_ROLES` (new)
- `BIBLE_STUDY_ROLES` (new)

## Event Type Properties

Each event type configuration includes:

- **`id`**: Unique identifier for the event type
- **`name`**: Display name shown in the dropdown
- **`description`**: Brief description of the event type
- **`requiresRoles`**: Boolean indicating if this event type needs role assignments
- **`requiresDisclaimer`**: Boolean indicating if disclaimer is typically needed
- **`defaultRoles`**: String reference to the default role configuration

## Future Extensibility

### Adding New Event Types

1. **Add Event Type Configuration**:

   ```typescript
   // In src/config/eventConstants.ts
   {
     id: "new-event-type",
     name: "New Event Type Name",
     description: "Description of the new event type",
     requiresRoles: true, // or false
     requiresDisclaimer: true, // or false
     defaultRoles: "NEW_EVENT_TYPE_ROLES",
   }
   ```

2. **Create Role Configuration** (if requiresRoles is true):

   ```typescript
   // In src/config/eventRoles.ts
   export const NEW_EVENT_TYPE_ROLES: Omit<
     EventRole,
     "id" | "currentSignups"
   >[] = [
     {
       name: "Role Name",
       description: "Role description",
       maxParticipants: 1,
     },
     // ... more roles
   ];
   ```

3. **Optional: Add Type-Specific Logic**:
   - Update `useEventForm.ts` for any special form handling
   - Update `NewEvent.tsx` for conditional field rendering
   - Update validation schema if needed

### Dynamic Field Requirements

The system can be extended to support dynamic field requirements based on event type:

```typescript
// Future implementation example
const selectedEventType = EVENT_TYPES.find(
  (type) => type.name === selectedTypeName
);
const shouldShowDisclaimer = selectedEventType?.requiresDisclaimer;
const shouldShowRoles = selectedEventType?.requiresRoles;
```

## Implementation Benefits

1. **Scalability**: Easy to add new event types without code changes
2. **Flexibility**: Each event type can have different requirements
3. **Maintainability**: Centralized configuration for all event types
4. **User Experience**: Clear indication of available event types
5. **Data Consistency**: Type-safe event type handling

## Current Event Types Available

1. **Effective Communication Workshop Series**

   - Complex role structure with 9 different roles
   - No disclaimer requirement
   - Full role assignment system

2. **Leadership Development Seminar**

   - 4 specialized leadership roles
   - Disclaimer typically required
   - Group facilitation focus

3. **Technical Skills Training**

   - 4 technical-focused roles
   - Disclaimer for equipment usage
   - Hands-on learning approach

4. **Prayer and Fellowship Meeting**

   - Simple 2-role structure
   - No disclaimer needed
   - Community-focused

5. **Bible Study Session**
   - Simple 2-role structure
   - No disclaimer needed
   - Educational focus

## Backend Integration Notes

When implementing the backend:

1. **Database Schema**: Ensure event type storage supports the new structure
2. **API Endpoints**: Update event creation endpoints to handle optional fields
3. **Validation**: Implement server-side validation that respects event type requirements
4. **Role Management**: Support dynamic role assignments based on event type
5. **Permissions**: Consider role-based permissions for event type creation

## Testing Considerations

1. **Form Validation**: Test optional disclaimer field behavior
2. **Event Type Selection**: Verify dropdown shows all available types
3. **Role Assignment**: Test role system for different event types
4. **Data Persistence**: Ensure optional fields are handled correctly
5. **Edge Cases**: Test behavior with and without disclaimer content

## Migration Notes

- Existing events with disclaimer content will continue to work
- New events can optionally include disclaimer
- All existing role configurations remain unchanged
- Frontend is fully backward compatible
