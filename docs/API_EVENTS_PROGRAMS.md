# Events API — Programs integration (minimal contract)

This document describes the additional fields and behavior when integrating Events with Programs.

## Endpoints

- POST /api/events
- PUT /api/events/:id

Both endpoints accept the standard Event payload plus the following optional fields for Programs:

- programId: string | null

  - MongoDB ObjectId of a Program. When provided:
    - The server validates the id and ensures the program exists.
    - On create, the new event id is added to Program.events (idempotent via $addToSet).
    - On update, if programId changes:
      - The event id is pulled from the previous Program.events.
      - The event id is added to the new Program.events via $addToSet.
    - If set to null on update, the event id is pulled from the previous Program.events and the event’s program linkage is cleared.

- mentorCircle: "E" | "M" | "B" | "A" | null
  - Only meaningful when type === "Mentor Circle" and a valid programId is present for a Program of type "EMBA Mentor Circles".
  - The server snapshots mentors for the selected circle from Program.mentorsByCircle[circle] into event.mentors at create/update time.
  - Mentors are stored as lightweight snapshots on the Event; they are distinct from organizer/co-organizer fields.

## Responses

- Create (201):

  - success: true
  - data.event: Event resource (with mentors snapshot when applicable)
  - data.series: string[] (only when recurring series is created)

- Update (200):
  - success: true
  - data.event: updated Event resource (mentors snapshot refreshed when applicable)

## Validation & error cases

- Invalid programId format → 400 { message: "Invalid programId." }
- programId references a non-existent Program → 400 { message: "Program not found for provided programId." }
- mentorCircle provided without a valid programId or for non-"Mentor Circle" event type → ignored; no snapshot.

## Notes

- mentor snapshot is a copy (name/email/avatar/etc.) at the time of create/update and won’t retroactively change if Program mentors change later.
- Deleting an Event will also $pull its id from Program.events, if programId is set.
