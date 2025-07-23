# Event Status Filtering Bug Fix

## Issue

The event "Effective Communication - Test 2" was not showing in the Upcoming Events page even though its end time had not been reached.

## Root Cause Analysis

### Backend Issue

The `getAllEvents` function in `eventController.ts` had a flawed filtering logic:

1. It fetched events with pagination (limited number)
2. Updated event statuses after pagination
3. Applied status filtering to the already-limited results

This caused events to be missing if they needed status updates but weren't in the initial paginated results.

### Frontend Behavior

The "Upcoming Events" page only showed events with status "upcoming", excluding "ongoing" events. The "Test 2" event was correctly classified as "ongoing" (current time 6:12 PM, event time 6:00-8:00 PM), so it didn't appear.

## Solution

### Backend Fix

1. **Modified `getAllEvents` in `eventController.ts`:**

   - Created helper function `updateAllEventStatusesHelper()` to update statuses without sending response
   - When status filtering is requested, update ALL event statuses first, then apply filter
   - This ensures the database status is current before pagination and filtering

2. **Updated filtering logic:**
   ```typescript
   // If status filtering is requested, update all statuses first
   if (status) {
     await EventController.updateAllEventStatusesHelper();
     filter.status = status;
   }
   ```

### Frontend Enhancement

1. **Updated `UpcomingEvents.tsx`:**

   - Now fetches both "upcoming" and "ongoing" events
   - Combines and sorts them by date/time
   - Shows events that users can still participate in

2. **Updated navigation:**
   - Changed "Upcoming Events" to "Active Events" in sidebar
   - Updated page title and descriptions

## Technical Details

### Event Status Logic

Events are classified as:

- **Upcoming**: Current time < event start time
- **Ongoing**: Event start time ≤ current time ≤ event end time
- **Completed**: Current time > event end time

### API Changes

- Backend: Fixed status filtering to work correctly with pagination
- Frontend: Now calls both `/api/v1/events?status=upcoming` and `/api/v1/events?status=ongoing`

## Test Results

✅ "Effective Communication - Test 2" now appears in Active Events page
✅ Backend properly updates event statuses before filtering
✅ Frontend shows both upcoming and ongoing events
✅ No compilation errors
✅ Navigation updated to reflect new behavior

## Files Modified

- `backend/src/controllers/eventController.ts` - Fixed filtering logic
- `frontend/src/pages/UpcomingEvents.tsx` - Enhanced to show active events
- `frontend/src/layouts/dashboard/Sidebar.tsx` - Updated navigation text

The fix ensures users can see and interact with events they can still participate in, providing a better user experience.
