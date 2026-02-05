# Railway Deployment Troubleshooting Guide

## 🔴 Service Unavailable Error - Quick Fixes

### Issue 1: Build Directory Problems

**Symptom:** Build fails with "no POM found" or similar errors

**Solution:**
1. In Railway dashboard, go to Settings → Service
2. Set **Root Directory** to: `backend` (NOT `ecovale-hr-management/backend`)
3. The repository should already be at `ecovale-hr-management` level
4. Redeploy

### Issue 2: Port Binding Issues

**Symptom:** Service starts but shows "Service Unavailable"

**Check:**
```bash
# Application MUST bind to 0.0.0.0:$PORT (Railway provides $PORT)
server.port=${PORT:8080}
server.address=0.0.0.0
```

**Fix:** Already configured in `application-railway.properties`

### Issue 3: Database Connection Timeout

**Symptom:** Health check fails, logs show DB connection errors

**Quick Fix - Disable DB in Health Check Temporarily:**

Add to Railway environment variables:
```
MANAGEMENT_HEALTH_DB_ENABLED=false
```

**Proper Fix - Use PostgreSQL Database:**
1. In Railway project, click "+ New" → "Database" → "Add PostgreSQL"
2. Railway auto-creates these variables:
   - `DATABASE_URL`
   - `PGHOST`
   - `PGPORT`
   - `PGDATABASE`
   - `PGUSER`
   - `PGPASSWORD`
3. No manual configuration needed!

### Issue 4: Health Check Timeout

**Symptom:** Deployment shows "Unhealthy" status

**Solution:**
1. Go to Settings → Deploy → Health Check
2. Increase timeout to **300 seconds**
3. Verify path is: `/actuator/health`
4. Save and redeploy

### Issue 5: Missing Environment Variables

**Symptom:** Application crashes on startup

**Required Variables:**
```bash
# CRITICAL - Must set these:
SPRING_PROFILES_ACTIVE=railway
JWT_SECRET=your-long-random-secret-key-at-least-32-characters

# OPTIONAL - Database (Railway auto-provides if you added PostgreSQL)
# Only set if using custom database:
DATABASE_URL=jdbc:postgresql://host:port/database
PGHOST=your-db-host
PGPORT=5432
PGDATABASE=railway
PGUSER=postgres
PGPASSWORD=your-password

# OPTIONAL - CORS
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

### Issue 6: Build Command Issues

**Current nixpacks.toml configuration:**
```toml
[phases.build]
cmds = ["mvn clean package -DskipTests -U -B -e"]

[phases.start]
cmd = "java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Dserver.port=$PORT -Dspring.profiles.active=railway -jar target/hr-backend-1.0.0.jar"
```

**If build still fails, manually override in Railway:**
1. Settings → Build → Custom Build Command:
   ```bash
   mvn clean package -DskipTests -Dmaven.test.skip=true
   ```
2. Settings → Deploy → Custom Start Command:
   ```bash
   java -Xmx512m -Dserver.port=$PORT -Dspring.profiles.active=railway -jar target/hr-backend-1.0.0.jar
   ```

## 🔍 Debugging Steps

### Step 1: Check Build Logs
1. Go to Railway dashboard
2. Click on your service
3. View "Deploy" tab
4. Look for errors in build phase

**Common errors:**
- `[ERROR] No POM found` → Fix Root Directory setting
- `[ERROR] Compilation failure` → Check Java version (should be 17)
- `OutOfMemoryError` → Increase memory in start command

### Step 2: Check Runtime Logs
1. In Railway dashboard, click "View Logs"
2. Look for:
   - ✅ `Started HrBackendApplication in X seconds`
   - ✅ `Tomcat started on port(s): 8080`
   - ❌ Database connection errors
   - ❌ Port already in use

### Step 3: Test Health Endpoint Manually
```bash
# Once deployed, test:
curl https://your-app.railway.app/actuator/health

# Should return:
{"status":"UP"}
```

### Step 4: Check Database Connectivity
```bash
# Test database endpoint (if DB is configured):
curl https://your-app.railway.app/actuator/health/db

# Or view all health details:
curl https://your-app.railway.app/actuator/health | jq
```

## ⚡ Quick Deployment Checklist

- [ ] Root Directory set to: `backend`
- [ ] PostgreSQL database added in Railway
- [ ] `SPRING_PROFILES_ACTIVE=railway` set in variables
- [ ] `JWT_SECRET` set (generate with `openssl rand -base64 64`)
- [ ] Health check path: `/actuator/health`
- [ ] Health check timeout: 300 seconds
- [ ] Build command configured (auto from nixpacks.toml)
- [ ] Start command configured (auto from nixpacks.toml)

## 🚀 Complete Fresh Deployment Steps

1. **Delete existing service** (if any) from Railway dashboard

2. **Create new service:**
   - Click "+ New" → "GitHub Repo"
   - Select: `devdev0987-dot/ecovale-hr-management`

3. **Configure Settings:**
   ```
   Root Directory: backend
   ```

4. **Add PostgreSQL Database:**
   - Click "+ New" → "Database" → "PostgreSQL"
   - Wait for it to provision (~30 seconds)

5. **Set Environment Variables:**
   ```bash
   SPRING_PROFILES_ACTIVE=railway
   JWT_SECRET=$(openssl rand -base64 64)
   CORS_ALLOWED_ORIGINS=https://your-frontend-url.com
   ```

6. **Configure Health Check:**
   - Settings → Deploy → Health Check
   - Path: `/actuator/health`
   - Timeout: 300 seconds

7. **Deploy:**
   - Click "Deploy"
   - Monitor logs
   - Wait 3-5 minutes

8. **Verify:**
   ```bash
   curl https://your-app.railway.app/actuator/health
   ```

## 🔧 Alternative: Use Railway Template

Create a `railway.json` in backend directory:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "mvn clean package -DskipTests"
  },
  "deploy": {
    "startCommand": "java -Dserver.port=$PORT -Dspring.profiles.active=railway -jar target/hr-backend-1.0.0.jar",
    "healthcheckPath": "/actuator/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## 📞 Still Having Issues?

### Check These Common Problems:

1. **Wrong Java Version:**
   - Railway should use JDK 17
   - Check logs: `java -version` output

2. **Memory Issues:**
   - Reduce memory in start command: `-Xmx512m`
   - Or upgrade Railway plan

3. **Database Not Ready:**
   - Temporarily disable: `MANAGEMENT_HEALTH_DB_ENABLED=false`
   - Or increase health check timeout to 600 seconds

4. **Firewall/Network:**
   - Ensure app binds to `0.0.0.0` not `localhost`
   - Check `server.address=0.0.0.0` in properties

### Get Detailed Logs:

Enable debug logging by adding to Railway variables:
```bash
LOGGING_LEVEL_ROOT=DEBUG
LOGGING_LEVEL_ORG_SPRINGFRAMEWORK=DEBUG
```

### Railway Support:

- Discord: https://discord.gg/railway
- Docs: https://docs.railway.app
- Status: https://status.railway.app

---

**Last Updated:** 2026-02-05
**Status:** Troubleshooting guide for Railway deployment issues
