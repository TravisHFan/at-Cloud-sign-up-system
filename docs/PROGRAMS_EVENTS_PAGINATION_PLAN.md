# Programs — Events Pagination Wiring Plan

This note describes the contract and integration steps to switch Program Detail events from client-side pagination to server-driven pagination, with a safe fallback.

## API Contract (implemented)

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

- Add `programService.listEventsPaged(id, { page, limit, sort, filters })` that calls the new endpoint. (Implemented)
- In `ProgramDetail`, prefer server pagination when a feature flag is on (e.g., `VITE_PROGRAM_EVENTS_PAGINATION=server`). (Implemented)
  - When server returns, render `items` and use `totalPages` for the pager. (Implemented)
  - On error or when flag is `client`, fall back to the existing client pagination logic. (Implemented)
- Maintain current UI and add:
  - URL query sync for page/sort (Implemented)
  - List-only spinner during server page transitions with role="status" and visible text (Implemented)
  - Numeric "Go to page" input that clamps to range and announces via aria-live (Implemented)

## Rollout

1. Ship client-only (current state) — done.
2. Implement `listEventsPaged` and wire a feature flag to opt-in to server mode — done.
3. Backend endpoint `/api/programs/:id/events?page&limit&sort` implemented with totals and sorting; backend integration tests passing.
4. Add frontend integration tests against the live endpoint (optional in CI) and/or E2E smoke; keep deterministic unit tests for client/server logic.
5. Enable `VITE_PROGRAM_EVENTS_PAGINATION=server` in staging by default and monitor. Roll out to production after confidence week.

## Notes

- Preserve accessibility for pager controls and announce page changes via `aria-live` regions (already present for the page indicator).
- Ensure deterministic sort by timestamp to avoid flicker on boundaries.
- Handle total shrink/growth across pages gracefully (disable invalid page indices).
