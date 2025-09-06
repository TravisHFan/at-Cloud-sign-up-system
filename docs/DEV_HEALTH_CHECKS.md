## Development Health & Connectivity Checks

Unified default backend dev port: **5001** (matches `frontend/vite.config.ts` proxy and `ConfigService` default).

### 1. API Liveness

```
curl -i http://localhost:5001/api/health
```

Expect HTTP 200. If `Connection refused`:

- Backend server not running (`npm run dev` inside backend/)
- Different PORT in `.env` (grep PORT backend/.env\*)
- Port conflict (`lsof -i :5001`)

### 2. Static Uploads (Avatars)

```
curl -I http://localhost:5001/uploads/avatars/default-avatar-male.jpg
```

Expect 200/304. If 404 ensure file exists at `backend/uploads/avatars/`.
If ECONNREFUSED see step 1 causes.

### 3. Through Frontend Proxy

With frontend (Vite) on 5173:

```
curl -i http://localhost:5173/api/health
curl -I http://localhost:5173/uploads/avatars/default-avatar-male.jpg
```

If these fail but direct 5001 works, inspect `frontend/vite.config.ts` proxy section.

### 4. WebSocket Reachability

```
nc -vz localhost 5001 || echo "Port closed"
```

Closed => backend not listening.

### 5. Environment Sanity

```
grep PORT backend/.env* 2>/dev/null || true
```

Ensure no stale `PORT=5000` remains.

### 6. Avatar URL Normalization

`getAvatarUrl` strips host in dev converting absolute `http://localhost:5001/uploads/...` to relative `/uploads/...` for proxying. Mixed forms often mean cached user data; refresh after new code.

### 7. Common Failures

| Symptom                        | Likely Cause                        | Fix                          |
| ------------------------------ | ----------------------------------- | ---------------------------- |
| ECONNREFUSED via frontend only | Frontend started first              | Start backend then reload    |
| 404 then later 200 avatar      | File created after initial request  | UI retry (optional)          |
| 403 on /uploads                | Incorrect middleware on static path | Check `app.ts` static config |

### 8. One-Liner Combined Check

```
curl -s http://localhost:5001/api/health && curl -I http://localhost:5001/uploads/avatars/default-avatar-male.jpg | head -n1
```

### 9. Changing the Port

If you change backend port (e.g. 5002):

1. Set `PORT=5002` in backend `.env`.
2. Update `VITE_API_URL` + `VITE_UPLOAD_BASE` in frontend `.env`.
3. Adjust `frontend/vite.config.ts` proxy targets.
4. Restart both dev servers.

---

Maintain this file as diagnostics expand.

### 10. Testing tips (observability)

- Correlation ID: Include `x-correlation-id` on requests to trace flows; logs emit a `correlationId` field. If absent, one is generated for minimal/mocked reqs.
- Ops endpoints (PII-safe):
  - GET `/api/system/health` – liveness plus lock/concurrency context.
  - GET `/api/system/metrics` – request rates, top endpoints, suspicious patterns.
    - New fields:
      - `uniques`: `{ ipsLastHour, userAgentsLastHour }` — approximate unique IPs and user agents in the last hour.
      - `errors`: `{ lastHour, rateLastHour }` — total error count and error rate over the last hour (excludes expected auth 401/403).
  - GET `/api/system/scheduler` – enabled flag + runtime status.
  - POST `/api/system/scheduler/manual-trigger` – admin-only manual tick.
- Console parity: Structured logs exist alongside console output; tests relying on console messages remain stable.
