# Organizer Contact Information Bug Fix

## Problem

In the event detail page, the "Organizer Contact Information" section was displaying placeholder values instead of real contact information:

- Email: `placeholder@example.com`
- Phone: `Phone not provided`

## Root Cause

The `ResponseBuilderService.buildEventWithRegistrations()` method was directly passing through the stored `organizerDetails` from the database without fetching fresh contact information from the User collection.

```typescript
// BEFORE - Line 110 in ResponseBuilderService.ts
organizerDetails: event.organizerDetails,
```

The stored organizer details in the Event collection contained placeholder values that were meant to be replaced at read time, but this replacement wasn't happening.

## Solution

Added a `populateFreshOrganizerContacts()` helper method to the `ResponseBuilderService` class that:

1. **Fetches Fresh Data**: For each organizer with a `userId`, queries the User collection to get current email and phone
2. **Fallback Handling**: Uses stored data if no `userId` is found or user lookup fails
3. **Merges Information**: Combines fresh contact info with existing organizer role and display information

### Code Changes

#### 1. Added Helper Method

```typescript
// Added to ResponseBuilderService.ts
private static async populateFreshOrganizerContacts(
  organizerDetails: any[]
): Promise<any[]> {
  if (!organizerDetails || organizerDetails.length === 0) {
    return [];
  }

  return Promise.all(
    organizerDetails.map(async (organizer: any) => {
      if (organizer.userId) {
        // Get fresh contact info from User collection
        const user = await User.findById(organizer.userId).select(
          "email phone firstName lastName avatar"
        );
        if (user) {
          return {
            ...organizer,
            email: user.email, // Always fresh from User collection
            phone: user.phone || "Phone not provided", // Always fresh
            name: `${user.firstName} ${user.lastName}`, // Ensure name is current
            avatar: user.avatar || organizer.avatar, // Use latest avatar
          };
        }
      }
      // If no userId or user not found, return stored data
      return organizer;
    })
  );
}
```

#### 2. Updated Event Response Building

```typescript
// Modified buildEventWithRegistrations() method
// FIX: Populate fresh organizer contact information
// This ensures frontend displays current email and phone from User collection
const freshOrganizerDetails =
  await ResponseBuilderService.populateFreshOrganizerContacts(
    event.organizerDetails || []
  );

// Build complete event response
return {
  // ... other fields
  organizerDetails: freshOrganizerDetails, // Use fresh data instead of stored
  // ... rest of response
};
```

## Verification

Tested with event ID `6889abdb33f5ce4cc613388e`:

### Before Fix

```json
[
  {
    "email": "placeholder@example.com",
    "phone": "Phone not provided"
  }
]
```

### After Fix

```json
[
  {
    "userId": "687e11eb9bb79e9fa7e79e10",
    "name": "John Doe",
    "role": "System Administrator",
    "email": "johndoe@gmail.com",
    "phone": "+1 (234) 421-1828"
  },
  {
    "userId": "6886abdfcef802ebd11ae59f",
    "name": "Ruth Fan",
    "role": "Leader",
    "email": "freetosento@gmail.com",
    "phone": "3412247426"
  }
]
```

## Impact

- ✅ **Fixed**: Organizer contact information now displays real email addresses and phone numbers
- ✅ **Performance**: Minimal impact - only queries User collection for organizers with valid userId
- ✅ **Reliability**: Maintains fallback to stored data if user lookup fails
- ✅ **Consistency**: Ensures displayed contact info is always current from User collection

## Files Modified

- `/backend/src/services/ResponseBuilderService.ts` - Added helper method and updated event building logic

## Testing

1. **API Test**: `curl "http://localhost:5001/api/v1/events/{eventId}"` shows real contact info
2. **Frontend Test**: Event detail page now displays correct organizer emails and phones
3. **Backend Logs**: No errors, event data building continues to work smoothly

The organizer contact information in event detail pages now correctly displays real user contact information instead of placeholder values! 🎉
