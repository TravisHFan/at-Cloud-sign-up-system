# @Cloud Sign-up System - Render Deployment Guide

## Prerequisites

✅ Project synced to GitHub main branch  
✅ Render account logged in  
✅ MongoDB Atlas account (for production database)

## Step 1: Prepare Environment Variables

### Backend Environment Variables (Set in Render Dashboard)

**Database Configuration:**

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/atcloud_signup_production
```

**Security Secrets (Generate secure random strings):**

```bash
# Generate these using: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_ACCESS_SECRET=<64-char-random-string>
JWT_REFRESH_SECRET=<64-char-random-string>
SESSION_SECRET=<64-char-random-string>
```

**Application Configuration:**

```
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://your-frontend-url.onrender.com
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Email Configuration:**

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="@Cloud Ministry" <your-email@gmail.com>
```

### Frontend Environment Variables

```
VITE_API_URL=https://your-backend-url.onrender.com
NODE_ENV=production
```

## Step 2: MongoDB Atlas Setup

1. **Create MongoDB Atlas Cluster:**

   - Go to [MongoDB Atlas](https://cloud.mongodb.com/)
   - Create a new cluster (Free tier is fine for testing)
   - Create database user with read/write permissions
   - Whitelist Render's IP addresses (or use 0.0.0.0/0 for simplicity)

2. **Get Connection String:**
   - In Atlas dashboard, click "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `atcloud_signup_production`

## Step 3: Deploy Backend Service

1. **Create New Web Service in Render:**

   - Go to Render Dashboard
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Choose the repository: `at-Cloud-sign-up-system`

2. **Configure Backend Service:**

   ```
   Name: atcloud-backend
   Environment: Node
   Region: Choose closest to your users
   Branch: main
   Root Directory: backend
   Build Command: npm install && npm run build
   Start Command: npm start
   ```

3. **Set Environment Variables:**

   - In the service settings, add all backend environment variables listed in Step 1
   - ⚠️ **Important:** Use the "Secret File" option for sensitive values like JWT secrets

4. **Advanced Settings:**
   ```
   Auto-Deploy: Yes (deploy on git push)
   Health Check Path: /api/health
   ```

## Step 4: Deploy Frontend Service

1. **Create Static Site in Render:**

   - Click "New +" → "Static Site"
   - Connect same GitHub repository
   - Choose branch: main

2. **Configure Frontend Service:**

   ```
   Name: atcloud-frontend
   Root Directory: frontend
   Build Command: npm install && npm run build
   Publish Directory: dist
   ```

3. **Set Environment Variables:**
   - Add frontend environment variables from Step 1
   - Set `VITE_API_URL` to your backend service URL

## Step 5: Update Frontend API URL

After backend is deployed, update the frontend environment variable:

1. Get your backend service URL from Render dashboard
2. Update `VITE_API_URL` in frontend service settings
3. Trigger a frontend rebuild

## Step 6: Verify Deployment

### Backend Health Check

```bash
curl https://your-backend-url.onrender.com/api/health
```

Expected response: `{"status": "ok", "timestamp": "..."}`

### Frontend Access

Visit your frontend URL and verify:

- ✅ Site loads without errors
- ✅ Can navigate between pages
- ✅ API calls work (check browser dev tools)

### Database Connection

Check backend logs in Render dashboard for:

- ✅ "Connected to MongoDB" message
- ❌ No connection errors

## Step 7: Configure Custom Domain (Optional)

1. **Add Custom Domain in Render:**

   - In service settings → "Custom Domains"
   - Add your domain (e.g., `api.yourchurch.com` for backend)
   - Follow DNS configuration instructions

2. **Update Environment Variables:**
   - Update `FRONTEND_URL` in backend service
   - Update `VITE_API_URL` in frontend service
   - Redeploy both services

## Troubleshooting

### Common Issues:

**Build Failures:**

- Check build logs for missing dependencies
- Ensure all TypeScript types are in `dependencies`, not `devDependencies`

**Runtime Errors:**

- Check service logs in Render dashboard
- Verify all environment variables are set correctly
- Ensure MongoDB connection string is correct

**CORS Issues:**

- Verify `FRONTEND_URL` matches your frontend domain
- Check that frontend is making requests to correct backend URL

**Database Connection Issues:**

- Verify MongoDB Atlas cluster is running
- Check IP whitelist settings in Atlas
- Ensure connection string format is correct

### Useful Commands:

**Generate Secure Secrets:**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Test API Locally:**

```bash
# Test backend health
curl http://localhost:5001/api/health

# Test with production API
curl https://your-backend-url.onrender.com/api/health
```

## Production Considerations

1. **Monitoring:**

   - Set up Render service monitoring
   - Configure alerts for service downtime
   - Monitor database performance in Atlas

2. **Backup:**

   - Enable automated backups in MongoDB Atlas
   - Export critical configuration

3. **Security:**

   - Regularly rotate JWT secrets
   - Monitor for unusual API usage
   - Keep dependencies updated

4. **Performance:**
   - Monitor response times
   - Consider upgrading to paid plans for better performance
   - Implement caching strategies if needed

## Next Steps

After successful deployment:

- [ ] Test all user flows (signup, login, event creation, etc.)
- [ ] Set up monitoring and alerts
- [ ] Configure backup procedures
- [ ] Update documentation with production URLs
- [ ] Train administrators on production system
