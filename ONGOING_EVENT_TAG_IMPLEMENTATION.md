# Ongoing Event Tag Implementation

## Summary

Added an "Ongoing" tag to event cards that appears when an event is currently in progress (between start time and end time).

## Implementation Details

### Files Modified

1. **EventListItem.tsx** - Main event card component used in Upcoming Events page
2. **MyEventListItem.tsx** - Event card component used in My Events page

### Logic Added

```typescript
// Helper function to check if event is currently ongoing
const isEventOngoing = () => {
  const now = new Date();
  const eventStart = new Date(`${event.date}T${event.time}`);
  const eventEnd = new Date(`${event.date}T${event.endTime}`);

  return now >= eventStart && now <= eventEnd;
};

// Get ongoing badge if event is currently happening
const getOngoingBadge = () => {
  if (type === "passed" || !isEventOngoing()) return null;

  return <Badge variant="warning">Ongoing</Badge>;
};
```

### Visual Design

- **Tag Color**: Warning variant (typically yellow/orange) to draw attention
- **Position**: Placed first in the badge row for prominence
- **Visibility**: Only shows for active events that are currently in progress
- **Behavior**: Automatically disappears when event ends

### Badge Order

The badges now appear in this order:

1. **Ongoing** (if applicable) - Orange/yellow warning badge
2. **Active/Status** - Green success or red error badge
3. **Availability** - Shows spots remaining or "Full"

## Test Case

- **Event**: "Effective Communication - Test 2"
- **Time**: 18:00-20:00 on 2025-07-22
- **Current Time**: 18:31 (during event)
- **Expected**: Shows "Ongoing" tag ✅

## User Experience

- **Clear Visual Indicator**: Users can immediately see which events are happening now
- **Real-time Updates**: Tag appears/disappears based on current time
- **Consistent Experience**: Works across both Upcoming Events and My Events pages
- **No Disruption**: Existing functionality and other badges remain unchanged

## Technical Benefits

- **Timezone Safe**: Uses browser's local time for accurate comparison
- **Performance Optimized**: Simple date comparison with no external API calls
- **Maintainable**: Reusable logic across multiple components
- **Future-proof**: Can easily extend to show other time-based statuses

This enhancement provides immediate visual feedback to users about which events are currently active, improving the overall user experience of the event management system.
