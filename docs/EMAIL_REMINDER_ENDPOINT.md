# Event Reminder Endpoint

Endpoint: POST /api/notifications/event-reminder

Summary

- Sends reminder emails to event participants and guests
- Creates system messages/bell notifications for participants only
- Supports reminder types: 1h | 24h | 1week
- 24h uses atomic deduplication (findOneAndUpdate) to prevent duplicates

Request Body
{
"eventId": "<ObjectId>",
"eventData": {
"title": "string",
"date": "string", // optional -> defaults to "TBD"
"time": "string", // optional -> defaults to "TBD"
"location": "string", // optional -> defaults to "TBD"
"zoomLink": "string", // optional
"format": "string" // optional -> defaults to "in-person"
},
"reminderType": "24h" | "1h" | "1week" // optional -> defaults to 24h in emails
}

Behavior

- For 24h reminders:
  - Atomically claims the event if not yet sent; otherwise returns alreadySent=true and preventedDuplicate=true with HTTP 200.
  - Invalidates event cache after flagging.
- Fetches participants via EmailRecipientUtils.getEventParticipants(eventId).
- Fetches guests via EmailRecipientUtils.getEventGuests(eventId).
- Sends emails to participants + guests.
- Creates a targeted system message only for participant IDs (not guests).
- Resilient to participant/guest fetch errors: continues with available recipients and returns HTTP 200 with counts.

Successful Response (example)
{
"success": true,
"message": "Event reminder notification sent to 3 recipient(s)",
"recipientCount": 3,
"systemMessageCreated": true,
"details": {
"emailsSent": 3,
"totalParticipants": 2,
"totalGuests": 1,
"totalEmailRecipients": 3,
"systemMessageSuccess": true
}
}

Duplicate 24h Response
{
"success": true,
"message": "24h reminder already sent for this event",
"alreadySent": true,
"preventedDuplicate": true
}

Error Response (unexpected server failure)
{
"success": false,
"message": "Failed to send event reminder notifications",
"error": "<message>"
}

Notes

- Guests do not receive system messages.
- When participant fetch fails but guest fetch succeeds, emails are still sent to guests and the response remains HTTP 200 with counts.
- Tests cover: participants-only, guests-only, mixed, fetch failure resiliency, and non-24h types.
