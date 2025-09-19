# Programs — Phase 2 Scope

This document scopes Phase 2 features around Pricing UX and Program Events pagination, including contracts and acceptance criteria.

## Pricing UX

Goals

- Help users understand program pricing at-a-glance with computed examples.
- Validate pricing inputs with guardrails and clear error messages.
- Keep server as source of truth; UI hints are deterministic previews.

Key UI elements

- Pricing panel on `ProgramDetail` showing:
  - Base price, discounts, and period.
  - “Computed examples” for common scenarios (e.g., single event, multi-event, family/quantity if applicable).
  - Tooltip/help text explaining rules.
- Admin edit form hints validate ranges and consistency.

Contracts

- Backend Program fields (existing): pricing object with fields used to compute examples.
- Optional endpoint: GET `/api/programs/:id/pricing/examples?events=n` (if server-calculated). Otherwise, compute on client from canonical program.pricing.

Acceptance criteria

- Rendering
  - Shows pricing panel when `program.pricing` exists.
  - Displays 2-3 computed examples with labels and formatted currency.
- Validation
  - Disallows negative or nonsensical values (min <= max, etc.).
  - Shows inline messages for invalid admin inputs (admin-only path).
- Accessibility
  - Tooltips and help text are keyboard accessible and screen-reader friendly.
- Error/edge handling
  - If pricing missing or incomplete, panel shows a soft “Pricing is being set up” message and no examples.

## Program Events Pagination

Goals

- Efficiently browse large programs by paginating/filtering events within Program Detail.
- Maintain sort stability and filter clarity.

Key UI elements

- Events section on `ProgramDetail` with:
  - Pager controls (Prev/Next) and page size selector (optional).
  - Sort dropdown (date asc/desc) and optional filters (type, status).
  - Loading and empty states.

Contracts

- Backend endpoint options:
  - GET `/api/programs/:id/events?page=1&limit=20&sort=date:asc&type=Workshop`
  - Response shape:
    {
    "items": [/_ Event[] subset _/],
    "page": 1,
    "limit": 20,
    "total": 125,
    "totalPages": 7,
    "sort": {"field":"date","dir":"asc"},
    "filters": {"type":"Workshop"}
    }
- Frontend: fall back to client pagination when server lacks pagination; prefer server pagination when available.

Acceptance criteria

- Paging
  - Default page=1, limit=20; navigates Prev/Next with disabled edge states.
  - Updates URL query (optional) to enable deep-linking and back/forward.
- Sorting/filters
  - Sort affects list order deterministically.
  - Filters reduce items and reset to page 1.
- Loading/empty states
  - Shows skeleton/spinner during fetch; shows “No events found” appropriately.
- Error/edge handling
  - Displays toast/banner on fetch error with retry action.
  - Resilient to total changes between pages (e.g., deletion).

## Rollout and Testing

- Start with client-side pagination + placeholders for server pagination.
- Add integration tests once backend pagination is exposed.
- Maintain non-breaking UI behind feature flags if needed.
