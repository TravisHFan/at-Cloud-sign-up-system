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
