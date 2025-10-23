# Bug Fix: Short Link JSON Parsing Error in Production

## Issue

In production environment, the Share Event dialog showed "Unexpected end of JSON input" error in the Short Link section. This bug did not exist in development.

## Root Cause

The `shortLinks.ts` service was using **hardcoded `/api/` paths** instead of using the centralized `apiUrl()` helper from `apiClient.ts`:

```typescript
// BEFORE (broken in production)
const res = await fetch(`/api/public/short-links`, { ... });
const res = await fetch(`/api/public/short-links/${key}`, { ... });
```

This worked in development because:

- Vite's dev server proxies `/api/` requests to the backend automatically
- Frontend and backend run on different ports but same localhost

This failed in production because:

- Frontend is a static site hosted on Render
- Backend is a separate Node.js service on a different domain
- Requests to `/api/` were hitting the frontend domain (which has no API)
- This resulted in HTML 404 pages being returned instead of JSON
- Attempting to parse HTML as JSON caused "Unexpected end of JSON input"

## Solution

Updated `shortLinks.ts` to use the centralized `apiUrl()` helper that properly handles production vs development environments:

```typescript
// AFTER (works in both environments)
import { apiUrl } from "../lib/apiClient";

const res = await fetch(apiUrl("/public/short-links"), { ... });
const res = await fetch(apiUrl(`/public/short-links/${key}`), { ... });
```

The `apiUrl()` helper:

- In development: returns `/api/public/short-links` (proxied by Vite)
- In production: returns `https://backend-domain.com/api/public/short-links`

## Files Changed

- `frontend/src/services/shortLinks.ts`

## Testing

- ✅ All frontend tests pass
- ✅ Type checking passes
- ✅ Short link feature works in development
- ✅ Created comprehensive API client integration tests
- ✅ Verified Audit Logs feature is unaffected
- 🔄 Needs verification in production after deployment

## Verification of Audit Logs Feature

The Audit Logs feature was verified to ensure it's unaffected by the short links fix:

- ✅ `AuditLogs.tsx` already uses `apiFetch()` from `apiClient.ts`
- ✅ `apiFetch()` internally calls `apiUrl()` for correct URL construction
- ✅ Both features now use the same centralized API client
- ✅ New integration tests verify both features work correctly

### Test Coverage

Created `frontend/tests/apiClient.integration.test.tsx` that verifies:

- `apiUrl()` constructs correct URLs for both audit logs and short links
- `apiFetch()` properly includes auth tokens when present
- URL construction works for various endpoints with query parameters
- Both features use the same URL handling logic

## Related Files

The fix aligns with how other services handle API calls:

- `frontend/src/lib/apiClient.ts` - Centralized API URL configuration
- `frontend/src/services/api.ts` - Uses `API_BASE_URL` with env variable
- `frontend/src/services/notificationService.ts` - Uses `VITE_API_URL`
- `frontend/src/services/socketService.ts` - Uses `VITE_API_URL`

## Deployment Notes

Ensure `VITE_API_URL` is properly configured in production environment:

- Should point to backend domain (e.g., `https://atcloud-backend.onrender.com`)
- Already configured in `render.yaml` to auto-populate from backend service
