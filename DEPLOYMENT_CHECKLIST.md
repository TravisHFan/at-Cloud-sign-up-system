# 🚀 Render Deployment Checklist

Note on terminology: "Leader" denotes the System Authorization Level. The user-facing @Cloud status label is “@Cloud Co-worker.” See `docs/TERMINOLOGY.md`.

## Pre-Deployment Validation

Run this before deploying to catch issues early:

```bash
# Generate secure secrets
node generate-secrets.js

# Check deployment readiness
node health-check.js
```

## ✅ Critical Issues Fixed

### 1. **TypeScript Dependencies** ✅ FIXED

- Moved all `@types/*` packages to `dependencies` (not `devDependencies`)
- Moved `typescript` and `ts-node` to `dependencies`
- **Why:** Render skips `devDependencies` in production builds

### 2. **CSP (Content Security Policy)** ✅ FIXED

- Updated `frontend/index.html` to include production backend URL
- Added: `https://at-cloud-sign-up-system-backend.onrender.com` to `connect-src`
- **Why:** Browser blocks API calls without proper CSP permissions

### 3. **Port Configuration Consistency** ✅ FIXED

- Fixed backend `ConfigService.ts` port default from `5000` → `5001`
- **Why:** Ensures consistency across codebase

### 4. **Environment Variable Templates** ✅ CREATED

- Created `frontend/.env.production` template
- Updated deployment guide with all required variables
- **Why:** Clear configuration reference for production

## 🔍 Potential Issues to Watch

### 1. **WebSocket Connection**

**Status:** ⚠️ NEEDS MONITORING
**Location:** `frontend/src/hooks/useSocket.ts`
**Issue:** Socket.IO URL derives from `VITE_API_URL`
**Solution:** Ensure `VITE_API_URL` is set correctly in Render

### 2. **Email Service Configuration**

**Status:** ✅ GOOD
**Location:** `backend/src/services/infrastructure/emailService.ts`
**Details:** Uses `process.env.FRONTEND_URL` for links in emails

### 3. **CORS Configuration**

**Status:** ✅ GOOD  
**Location:** `backend/src/services/infrastructure/SocketService.ts`
**Details:** Uses `process.env.FRONTEND_URL` for CORS origins

### 4. **File Uploads**

**Status:** ⚠️ MONITOR
**Location:** Backend `/uploads` endpoint
**Consideration:** Render ephemeral filesystem - uploads lost on restart
**Recommendation:** Consider cloud storage (S3, Cloudinary) for production

## 📋 Deployment Steps

### Phase 1: Backend Deployment

1. **Create Backend Service:**

   ```
   Service Type: Web Service
   Name: at-cloud-sign-up-system-backend
   Environment: Node
   Build Command: npm install && npm run build
   Start Command: npm start
   ```

2. **Set Environment Variables:**

   ```bash
   # Run this to generate secrets:
   node generate-secrets.js

   # Set in Render dashboard:
   NODE_ENV=production
   PORT=10000  # Render default
   MONGODB_URI=mongodb+srv://...
   JWT_ACCESS_SECRET=<generated>
   JWT_REFRESH_SECRET=<generated>
   SESSION_SECRET=<generated>
   FRONTEND_URL=https://your-frontend.onrender.com
   # ... email config
   ```

### Phase 2: Frontend Deployment

1. **Create Frontend Service:**

   ```
   Service Type: Static Site
   Name: at-cloud-sign-up-system-frontend
   Build Command: npm install && npm run build
   Publish Directory: dist
   ```

2. **Set Environment Variables:**
   ```bash
   VITE_API_URL=https://at-cloud-sign-up-system-backend.onrender.com/api
   NODE_ENV=production
   ```

### Phase 3: Update Cross-References

1. **Update Backend FRONTEND_URL:**

   - Set to actual frontend URL from Render
   - Redeploy backend

2. **Verify CSP includes backend URL:**
   - Check `frontend/index.html`
   - Should include your actual backend URL

## 🧪 Post-Deployment Testing

### 1. Health Checks

```bash
# Backend health
curl https://your-backend.onrender.com/api/health

# Frontend loads
curl https://your-frontend.onrender.com
```

### 2. Functionality Tests

- [ ] User registration works
- [ ] User login works
- [ ] Event creation works
- [ ] WebSocket real-time updates work
- [ ] Email notifications send
- [ ] File uploads work (avatar, etc.)

### 3. Performance Checks

- [ ] Initial page load < 3 seconds
- [ ] API responses < 1 second
- [ ] No console errors in browser
- [ ] No CSP violations

## 🚨 Common Deployment Issues

### Issue: "Failed to fetch" errors

**Cause:** VITE_API_URL not set or CSP blocking
**Fix:** Verify environment variables and CSP configuration

### Issue: "Cannot connect to MongoDB"

**Cause:** MONGODB_URI incorrect or IP not whitelisted
**Fix:** Check Atlas connection string and network access

### Issue: TypeScript compilation errors

**Cause:** @types packages in devDependencies  
**Fix:** Already fixed - types moved to dependencies

### Issue: Socket connection fails

**Cause:** WebSocket URL incorrect
**Fix:** Verify VITE_API_URL strips `/api` for socket connection

### Issue: Emails not sending

**Cause:** SMTP credentials or FRONTEND_URL incorrect
**Fix:** Verify email environment variables

## 📊 Monitoring

### Key Metrics to Watch:

- Response times
- Error rates
- Database connection status
- Email delivery success
- WebSocket connection stability

### Render Logs:

- Check service logs for errors
- Monitor build logs for warnings
- Watch for memory/CPU usage

## 🔧 Maintenance

### Regular Tasks:

- [ ] Rotate JWT secrets monthly
- [ ] Update dependencies quarterly
- [ ] Monitor database storage usage
- [ ] Review and update CSP as needed
- [ ] Check email deliverability

Your deployment should now be robust and production-ready! 🚀

## 🔒 Concurrency Guard (In-Memory Lock)

We use an in-memory lock for guest/role capacity operations. This is sufficient for our low QPS and DAU, but requires a single backend instance.

- Single instance only: Do not enable Node cluster/PM2 multi-process or multiple replicas.
- Environment guards:
  - Set `WEB_CONCURRENCY=1` (or leave unset) and avoid cluster modes.
  - Optionally set `SINGLE_INSTANCE_ENFORCE=true` to fail fast if multiple workers are detected.
- Visibility:
  - `GET /api/system/health` returns `lock.implementation` and `lock.inferredConcurrency`.
  - `GET /api/system/locks` (admin) exposes lock stats.
