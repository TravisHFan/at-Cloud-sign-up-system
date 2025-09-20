# Programs — Events Pagination Wiring Plan

This note describes the contract and integration steps to switch Program Detail events from client-side pagination to server-driven pagination, with a safe fallback.

## API Contract (proposed)

- Endpoint: GET `/api/programs/:id/events`
- Query params:
  - `page` number (default 1)
  - `limit` number (default 20)
  - `sort` `date:asc` | `date:desc` (default `date:asc`)
  - Optional filters: `type`, `status`
- Response:

```
{
  "items": [/* Event[] subset */],
  "page": 1,
  "limit": 20,
  "total": 125,
  "totalPages": 7,
  "sort": { "field": "date", "dir": "asc" },
  "filters": { "type": "Workshop" }
}
```

## Frontend Integration

- Add `programService.listEventsPaged(id, { page, limit, sort, filters })` that calls the new endpoint.
- In `ProgramDetail`, prefer server pagination when a feature flag is on (e.g., `VITE_PROGRAM_EVENTS_PAGINATION=server`).
  - When server returns, render `items` and use `totalPages` for the pager.
  - On error or when flag is `client`, fall back to the existing client pagination logic.
- Keep the current UI (Sort select, Prev/Next, page indicator) unchanged.

## Rollout

1. Ship client-only (current state) — done.
2. Implement `listEventsPaged` and wire a feature flag to opt-in to server mode.
3. Add integration tests once backend endpoint is available; keep unit tests for client logic.

## Notes

- Preserve accessibility for pager controls and announce page changes via `aria-live` regions (already present for the page indicator).
- Ensure deterministic sort by timestamp to avoid flicker on boundaries.
- Handle total shrink/growth across pages gracefully (disable invalid page indices).
