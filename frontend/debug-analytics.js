// Debug script to log what the Analytics page is actually receiving

// Add this to Analytics.tsx temporarily to debug the data:

console.log('=== ANALYTICS DEBUG ===');
console.log('backendEventAnalytics:', backendEventAnalytics);
console.log('upcomingEvents:', upcomingEvents);
console.log('passedEvents:', passedEvents);

// Debug the format calculation step by step
console.log('=== FORMAT STATS DEBUG ===');
const debugFormatStats = [...upcomingEvents, ...passedEvents].reduce((acc, event, index) => {
  console.log(`Event ${index + 1}:`, {
    event: event,
    hasEvent: !!event,
    hasFormat: !!(event && event.format),
    format: event?.format,
    formatType: typeof event?.format
  });
  
  if (event && event.format) {
    acc[event.format] = (acc[event.format] || 0) + 1;
    console.log(`  Added to formatStats[${event.format}] = ${acc[event.format]}`);
  } else {
    console.log(`  SKIPPED: event=${!!event}, format=${event?.format}`);
  }
  return acc;
}, {} as Record<string, number>);

console.log('Final formatStats:', debugFormatStats);
console.log('=== END DEBUG ===');
