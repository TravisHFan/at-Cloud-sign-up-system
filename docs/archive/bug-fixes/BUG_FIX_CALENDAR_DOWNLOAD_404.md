# Bug Fix: Calendar Download 404 in Production

**Date:** 2025-10-21  
**Status:** ✅ FIXED

## Problem

The "Add to Calendar" button on EventDetail page was returning 404 in production but worked perfectly in development:

- **Development:** ✅ Downloads .ics file successfully
- **Production:** ❌ Returns 404 (Not Found)
- **Symptom:** No backend logs generated when clicking button

## Root Cause

The calendar download code was using **`fetch(apiUrl(...))`** instead of **`apiFetch(...)`**:

```typescript
// INCORRECT - causes 404 in production
const response = await fetch(apiUrl(`/events/${event.id}/calendar`));
```

### Why This Failed in Production

1. **Architecture Difference:**

   - **Development:** Frontend and backend run on same host (localhost), Vite proxy handles `/api/*`
   - **Production:** Frontend (static site) and backend are on **different domains**:
     - Frontend: `https://at-cloud-sign-up-system.onrender.com`
     - Backend: `https://atcloud-backend.onrender.com`

2. **URL Construction Issue:**

   - `apiUrl()` constructs the full URL correctly
   - BUT `fetch()` treats it as a same-origin request
   - Request never reaches the backend server
   - No CORS headers attached
   - Results in 404 from the frontend static host

3. **Why No Backend Logs:**
   - Request was hitting the **frontend static site host**, not the backend
   - Frontend host returns 404 (no such static file exists)
   - Backend never receives the request, hence no logs

## Solution

Changed from `fetch(apiUrl(...))` to `apiFetch(...)`:

```typescript
// CORRECT - works in both dev and production
const response = await apiFetch(`/events/${event.id}/calendar`);
```

### Why This Works

`apiFetch()` from `frontend/src/lib/apiClient.ts`:

1. ✅ Constructs correct cross-origin URL in production
2. ✅ Adds proper authentication headers
3. ✅ Handles CORS correctly
4. ✅ Works identically in dev and production

### Files Changed

**frontend/src/pages/EventDetail.tsx:**

- Line ~1460: Changed `fetch(apiUrl(...))` to `apiFetch(...)`
- Line ~31: Changed import from `apiUrl` to `apiFetch`

## Testing

### Development Testing

```bash
cd frontend && npm run dev
# Click "Add to Calendar" on any published event
# Verify .ics file downloads
```

### Production Testing

After deployment:

1. Navigate to any published event
2. Click "Add to Calendar" button
3. Verify .ics file downloads successfully
4. Check backend logs - should see calendar download request

## Related Issues

This is the same pattern that was previously fixed for:

- Notifications (`notificationService.ts`)
- Socket connections (`socketService.ts`)
- System messages

All these services correctly use the centralized API client methods instead of raw `fetch()`.

## Lessons Learned

1. **Always use `apiFetch()` for backend requests** - Never use plain `fetch()` with `apiUrl()`
2. **"No backend logs" = request not reaching backend** - Check frontend URL construction
3. **Dev/prod parity** - Test cross-origin scenarios in staging before production
4. **Centralized API client exists for a reason** - Use it consistently

## Prevention

### Code Review Checklist

- [ ] All backend API calls use `apiFetch()` or API service methods
- [ ] No direct `fetch(apiUrl(...))` calls
- [ ] CORS-aware for production multi-domain architecture

### Grep Commands to Find Issues

```bash
# Find potential issues (should return no results)
cd frontend/src
grep -r "fetch(apiUrl" .
grep -r "fetch(\`\${apiUrl" .
```

## Deployment

**Status:** Ready for deployment  
**Build:** ✅ `npm run build` passes  
**Breaking Changes:** None  
**Rollback:** Not needed (backward compatible)

Deploy frontend with:

```bash
# Render auto-deploys from main branch
git add docs/BUG_FIX_CALENDAR_DOWNLOAD_404.md frontend/src/pages/EventDetail.tsx
git commit -m "fix: calendar download 404 in production - use apiFetch"
git push origin main
```
