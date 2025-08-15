# Monitor Routes

All monitor endpoints (`/api/monitor/*`) are protected by:

1. `authenticate` middleware (valid Bearer access token)
2. `requireAdmin` middleware (role must be Administrator or higher)

## Endpoints

- `GET /api/monitor/stats`
- `POST /api/monitor/emergency-disable`
- `POST /api/monitor/emergency-enable`
- `GET /api/monitor/rate-limiting-status`
- `GET /api/monitor/health`

## Emergency Rate Limiting Toggle

Use these to temporarily bypass global rate limiting when debugging or mitigating traffic anomalies.

```http
POST /api/monitor/emergency-disable  # sets ENABLE_RATE_LIMITING = false
POST /api/monitor/emergency-enable   # restores ENABLE_RATE_LIMITING = true
```

Both require an Administrator token. In tests, use the helper `createAdminToken()` from `tests/test-utils/createTestUser.ts`.

## Testing Pattern

When writing integration tests that hit monitor routes:

```ts
import { createAdminToken } from "../../test-utils/createTestUser";

const adminToken = await createAdminToken();
await request(app)
  .post("/api/monitor/emergency-disable")
  .set("Authorization", `Bearer ${adminToken}`)
  .expect(200);
```

## Rationale

Enforcing admin-only access prevents untrusted clients from disabling protective throttling or viewing traffic analytics.
