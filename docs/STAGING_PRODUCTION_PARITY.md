# Staging and Production Parity Contract

Staging exists to reveal production-risk bugs before users see them. When a staging bug is caused by a staging-only deployment assumption, treat it as a parity failure and either align the environments or add a code guardrail.

## What Went Wrong

Recent staging bugs shared the same pattern:

- The frontend was deployed as a static site, but some code hard-navigated to direct browser paths such as `/login`. Under HashRouter and imperfect static rewrites, the browser can land on an empty static response instead of the app shell.
- Avatar display logic special-cased one production backend hostname. Staging used a different backend hostname, so valid backend image URLs were converted into frontend-relative `/uploads/...` paths.
- Upload paths depended on trailing-slash behavior in `UPLOAD_DESTINATION`.

These were not product-feature bugs. They were deployment contract bugs.

## Deployment Contract

### Frontend Static Routing

- The deployed frontend uses `HashRouter`.
- Internal hard navigations must use `/#/...`, not direct paths like `/login` or `/dashboard`.
- Prefer React Router `Link`/`navigate()` inside the running app.
- If a full reload is required, use `hardNavigateToHashRoute()` from `frontend/src/utils/hashRouting.ts`.
- External checkout/payment URLs may still use `window.location.href = externalUrl`.

### Backend and Frontend URLs

Backend env vars:

```txt
NODE_ENV=production
FRONTEND_URL=https://<matching-frontend-host>
BACKEND_URL=https://<matching-backend-host>
UPLOAD_DESTINATION=/uploads/
```

Frontend env vars:

```txt
VITE_API_URL=https://<matching-backend-host>/api
NODE_ENV=production
```

Notes:

- `VITE_*` frontend values are baked at build time. Changing them requires a frontend redeploy/rebuild.
- Backend env values are runtime values. Changing them requires a backend redeploy/restart.
- Do not write logic that checks for a single Render hostname. Staging and production hostnames are intentionally different.

### Uploads

- Render disk mount path is `/uploads`.
- `UPLOAD_DESTINATION` should be `/uploads/` for clarity.
- Code must normalize this value so `/uploads` and `/uploads/` behave the same.
- Public upload URLs are served from the backend at `/uploads/...`.

## Required Checks

Run before deploying staging or production:

```bash
npm run verify
```

The `verify` script includes `check:deployment-guardrails`, which fails if:

- `HashRouter` is removed from the frontend entrypoint.
- internal hard redirects use direct static paths instead of hash routes.
- avatar URL logic reintroduces hostname-specific production behavior.
- upload middleware reintroduces string-concatenated upload directories.
- `render.yaml` loses the frontend static rewrite contract.

Run the guardrail alone when investigating deployment behavior:

```bash
npm run check:deployment-guardrails
```

## Staging Smoke Test

After each staging deployment, verify:

- Root page loads: `https://<staging-frontend>/`
- Hash login page loads and refreshes: `https://<staging-frontend>/#/login`
- Direct `/login` is not used by app redirects.
- Expired session redirects to `/#/login`.
- Email verification opens a hash route and refreshes without a blank page.
- Avatar upload response stores a backend `/uploads/avatars/...` URL.
- Avatar image requests go to the backend host, not the frontend host.
- A hard refresh on a protected hash route returns the app shell.
- Backend health endpoint returns OK.

## Handling Future Staging-Only Bugs

Classify the issue before fixing:

1. Code assumption exposed by staging.
   Fix the assumption in code and add a guardrail or regression test.

2. Render configuration drift.
   Align staging with production and document the required env/config value.

3. Stale staging data or disk contents.
   Repair staging data only after confirming the code/config contract is correct.

Staging-only does not mean low priority. It means the staging contract is either catching a real portability issue or drifting away from production.
