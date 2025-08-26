# @Cloud Sign-up System

Full-stack event and workshop sign-up platform (Node/Express + React/TypeScript) with real-time updates and a comprehensive automated test suite.

## Quick start

- Install dependencies: use the root script to install backend and frontend
- Dev servers: backend on 5001, frontend on 5173 (proxy to backend)
- Health checks: see `docs/DEV_HEALTH_CHECKS.md`

## Testing

- Run the full test suite from the repo root: `npm test`
- Backend and frontend tests will run sequentially
- Test database: MongoDB on localhost using `atcloud-signup-test` (ensure MongoDB is running locally)

## Terminology (important)

We distinguish between:

- System Authorization Level "Leader" (do not rename in code or docs where it denotes permissions)
- User-facing @Cloud status label: “@Cloud Co-worker”

See `docs/TERMINOLOGY.md` for guidance and examples.

## Useful docs

- Deployment guide: `DEPLOYMENT_GUIDE.md`
- Deployment checklist: `DEPLOYMENT_CHECKLIST.md`
- Dev health checks: `docs/DEV_HEALTH_CHECKS.md`
- Test coverage roadmap: `docs/TEST_COVERAGE_ROADMAP.md`
- Monitor routes: `docs/MONITOR_ROUTES.md`

## Recurring Events: Auto-Reschedule Policy

When creating a recurring event series (every-two-weeks, monthly, every-two-months), the system enforces an Auto-Reschedule policy to avoid overlaps:

- For each desired occurrence after the first:

  - Try the desired date/time first.
  - If there’s a conflict, bump the start by +24 hours, up to 6 days.
  - If a free slot is found within those 6 days, schedule it and record it as “moved”.
  - If no free slot is found in that window, skip the occurrence for now. Each skipped occurrence is appended after the last scheduled one by advancing one cadence (e.g., +14 days for every-two-weeks; next month for monthly) and applying the same +24h up to 6-days bump rule.

- Cadence details:

  - every-two-weeks: +14 days from the prior start date
  - monthly / every-two-months: advance months first, then adjust forward to keep the same weekday as the first event

- Notifications:
  - The creator and any co-organizers receive a targeted system message summarizing moved, skipped, and appended occurrences.
  - Email notifications are sent with the same summary (skipped in test environments).

This policy ensures no overlapping occurrences while preserving the intended cadence and overall count (subject to availability within bump windows).
