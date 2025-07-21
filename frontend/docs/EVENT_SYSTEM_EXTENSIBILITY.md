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

# Event System Documentation

## Overview

The event creation system supports the **Effective Communication Workshop Series** event type. The system has been simplified to focus on this single event type with its comprehensive role configuration.

## ✅ IMPLEMENTED CHANGES

### 1. Event Type Simplification

- **Status**: ✅ **COMPLETED**
- **Change**: System now supports only "Effective Communication Workshop Series"
- **Reason**: Focused approach for better user experience and system maintenance
- **Files Updated**:
  - `src/config/eventConstants.ts` - Reduced to single event type
  - `src/config/eventRoles.ts` - Removed unused role configurations
  - Event categories simplified to core essentials

### 2. Optional Disclaimer Field

- **File**: `src/schemas/eventSchema.ts`
- **Change**: Made disclaimer field optional using `yup.string().optional()`
- **UI Update**: Removed red asterisk (\*) from disclaimer field label in `NewEvent.tsx`
- **Type Update**: Updated `EventData.disclaimer` to be optional (`disclaimer?: string`)
- **Status**: ✅ **FULLY IMPLEMENTED**

### 3. Dynamic Role Loading System

- **File**: `src/config/eventRoles.ts`
- **Added**: `getRolesByEventType()` helper function for dynamic role mapping
- **File**: `src/pages/NewEvent.tsx`
- **Implemented**: Role configuration for Communication Workshop events
- **UI Enhancement**: Role display with clear organization
- **Status**: ✅ **FULLY IMPLEMENTED**

## 🎯 CURRENT SYSTEM

### Supported Event Type

**Effective Communication Workshop Series**

- **Duration**: 2 hours
- **Max Participants**: 50
- **Default Location**: Conference Room A
- **Category**: Professional Development
- **Roles Available**: 14 specialized communication workshop roles

### Available Roles for Communication Workshop

1. **Spiritual Covering** - Provides spiritual oversight and prayer support (Max: 1)
2. **Tech Lead** - Primary technical coordinator managing all AV systems (Max: 1)
3. **Tech Assistant** - Supports tech lead with equipment and troubleshooting (Max: 2)
4. **Main Presenter** - Primary workshop facilitator and content expert (Max: 1)
5. **MC (Master of Ceremonies)** - Event host managing flow and introductions (Max: 1)
6. **Zoom Director** - Manages online participants and virtual engagement (Max: 1)
7. **Zoom Co-host** - Assists with online platform management (Max: 2)
8. **Meeting Timer** - Keeps sessions on schedule and manages time allocation (Max: 1)
9. **Practice Group Leader** - Facilitates small group exercises and discussions (Max: 4)
10. **Registration Assistant** - Manages participant check-in and materials (Max: 2)
11. **Materials Coordinator** - Organizes and distributes workshop resources (Max: 1)
12. **Feedback Coordinator** - Collects and manages participant feedback (Max: 1)
13. **Break Coordinator** - Manages refreshments and networking time (Max: 1)
14. **Follow-up Coordinator** - Handles post-workshop communication (Max: 1)

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
       default:
         return COMMUNICATION_WORKSHOP_ROLES; // Default fallback
     }
   };
   ```

2. **Simplified Event Configuration**

   ```typescript
   export const EVENT_TYPES: EventTypeConfig[] = [
     {
       id: "communication-workshop",
       name: "Effective Communication Workshop Series",
       description:
         "Interactive workshop series focused on developing effective communication skills",
       duration: "2 hours",
       maxParticipants: 50,
       defaultLocation: "Conference Room A",
       category: "Professional Development",
     },
   ];
   ```

3. **Role Configuration in NewEvent.tsx**

   ```typescript
   const selectedEventType = watch("type");
   const currentRoles = useMemo(() => {
     if (!selectedEventType) return [];
     return getRolesByEventType(selectedEventType);
   }, [selectedEventType]);
   ```

## ✅ USER EXPERIENCE IMPROVEMENTS

### Simplified Interface

- **Single Event Type**: Users no longer need to choose between multiple event types
- **Focused Experience**: Clear, dedicated interface for Communication Workshop events
- **Reduced Complexity**: Streamlined form with relevant fields only
- **Better Performance**: Faster loading with reduced configuration options

### Enhanced Role Management

- **Comprehensive Role Set**: 14 specialized roles covering all workshop aspects
- **Clear Descriptions**: Each role has detailed description of responsibilities
- **Appropriate Limits**: Maximum participant limits prevent over-assignment
- **Organized Structure**: Roles grouped by function (technical, content, support)

## 🚀 SYSTEM VERIFICATION

To verify the simplified event system:

1. Open the "Create New Event" page
2. Event type dropdown now shows only "Effective Communication Workshop Series"
3. Role configuration automatically displays the 14 communication workshop roles
4. All roles are properly configured with descriptions and participant limits
5. Form validation and submission work seamlessly with the single event type

## System Architecture

### Simplified Configuration

The system now uses a focused approach with:

- **Single Event Type**: Only "Effective Communication Workshop Series" is supported
- **Dedicated Roles**: 14 specialized roles designed for communication workshops
- **Streamlined Categories**: Reduced categories to essential ones
- **Optimized Performance**: Faster loading with simplified configuration

### File Structure

- `src/config/eventConstants.ts` - Contains single event type configuration
- `src/config/eventRoles.ts` - Contains communication workshop roles only
- `src/docs/EVENT_SYSTEM_EXTENSIBILITY.md` - Updated documentation

## Benefits of Simplification

1. **Improved User Experience**: No confusion with multiple event types
2. **Better Maintainability**: Easier to maintain and update single event type
3. **Focused Development**: All improvements focused on communication workshops
4. **Reduced Complexity**: Simpler codebase and testing requirements
5. **Better Performance**: Faster loading and fewer configuration options

## Future Considerations

If additional event types are needed in the future, the system can be extended by:

1. Adding new event type configurations to `eventConstants.ts`
2. Creating role configurations in `eventRoles.ts`
3. Updating the `getRolesByEventType()` function
4. Testing the new configurations

However, the current simplified approach provides a focused, efficient solution for the primary use case of communication workshops.

## Migration Notes

- Existing events with disclaimer content will continue to work
- New events can optionally include disclaimer
- All existing role configurations remain unchanged
- Frontend is fully backward compatible
