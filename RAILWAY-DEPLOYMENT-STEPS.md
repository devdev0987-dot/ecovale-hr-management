# Railway Deployment Steps for Ecovale HR Backend

## ✅ Changes Pushed Successfully

All code fixes have been committed and pushed to GitHub:
- Fixed compile errors
- Removed unused imports
- Updated deprecated API usage (JJWT, Bucket4j, Swagger)
- Fixed Lombok plugin configuration
- Resolved ApiResponse conflicts

Commit: `9059af4` - "Fix compile errors: remove unused imports, update deprecated APIs, fix ApiResponse conflicts, update Lombok plugin config"

## 🚀 Railway Deployment Guide

### Step 1: Connect to Railway

1. Go to [Railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select: `devdev0987-dot/ecovale-hr-management`

### Step 2: Configure Build Settings

Railway should auto-detect the Nixpacks configuration, but verify:

**Root Directory:** `ecovale-hr-management/backend`

**Build Command (auto-detected from nixpacks.toml):**
```bash
mvn clean package -DskipTests -U -B -e
```

**Start Command (auto-detected from nixpacks.toml):**
```bash
java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom -Dserver.port=$PORT -Dspring.profiles.active=railway -jar target/hr-backend-1.0.0.jar
```

### Step 3: Add Database (MySQL)

1. In your Railway project, click "+ New"
2. Select "Database" → "Add MySQL"
3. Railway will automatically create these variables:
   - `MYSQL_URL`
   - `MYSQL_USER`
   - `MYSQL_PASSWORD`
   - `MYSQL_DATABASE`
   - `MYSQL_HOST`
   - `MYSQL_PORT`

### Step 4: Configure Environment Variables

Add these variables in Railway (Settings → Variables):

#### Required Variables:

```bash
# Database Connection (use Railway's provided variables)
SPRING_DATASOURCE_URL=jdbc:mysql://${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
DB_HOST=${MYSQL_HOST}
DB_PORT=${MYSQL_PORT}
DB_NAME=${MYSQL_DATABASE}
DB_USERNAME=${MYSQL_USER}
DB_PASSWORD=${MYSQL_PASSWORD}

# Spring Profile
SPRING_PROFILES_ACTIVE=railway

# JWT Secret (CRITICAL - Generate a strong secret)
# Generate with: openssl rand -base64 64
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-make-it-very-long-and-random

# JWT Expiration (24 hours in milliseconds)
JWT_EXPIRATION=86400000

# JWT Refresh Token Expiration (7 days in milliseconds)
JWT_REFRESH_EXPIRATION=604800000

# CORS Configuration (add your frontend URLs)
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://yourdomain.com

# JPA Settings
JPA_DDL_AUTO=update
JPA_SHOW_SQL=false

# Port (Railway provides this automatically)
PORT=8080
```

#### Optional Variables:

```bash
# Logging
LOGGING_LEVEL_ROOT=INFO
LOGGING_LEVEL_COM_ECOVALE_HR=INFO

# Maven Build Options
MAVEN_OPTS=-Xmx1024m
JAVA_TOOL_OPTIONS=-Xmx1024m
```

### Step 5: Health Check Configuration

Railway should use the health check path from `railway.toml`:

**Health Check Path:** `/actuator/health`
**Timeout:** 300 seconds

Verify in Settings → Deploy → Health Check

### Step 6: Deploy

1. Click "Deploy" or trigger deployment
2. Monitor logs in Railway dashboard
3. Wait for build to complete (~3-5 minutes)
4. Check health endpoint: `https://your-app.railway.app/actuator/health`

### Step 7: Verify Deployment

Test your API endpoints:

```bash
# Health Check
curl https://your-app.railway.app/actuator/health

# API Info
curl https://your-app.railway.app/actuator/info

# Swagger Documentation
https://your-app.railway.app/swagger-ui/index.html

# Test Login
curl -X POST https://your-app.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## 🔧 Troubleshooting

### Build Fails

**Issue:** Maven build errors
**Solution:**
```bash
# Check if pom.xml is in correct location
# Verify Root Directory is set to: ecovale-hr-management/backend
```

### Database Connection Fails

**Issue:** Cannot connect to database
**Solution:**
- Verify all database variables are set correctly
- Check MySQL service is running in Railway
- Ensure `SPRING_DATASOURCE_URL` uses Railway's MySQL variables

### Application Doesn't Start

**Issue:** App crashes on startup
**Solution:**
```bash
# Check logs for specific errors
# Common issues:
# 1. Missing JWT_SECRET
# 2. Database connection timeout
# 3. Port binding issues (Railway provides $PORT)
```

### Health Check Fails

**Issue:** Railway shows "Unhealthy"
**Solution:**
- Increase health check timeout (default: 300s)
- Check `/actuator/health` endpoint manually
- Verify application started successfully in logs

## 📝 Post-Deployment

### 1. Update Frontend Configuration

Update your frontend `.env` file with Railway backend URL:

```bash
VITE_API_BASE_URL=https://your-app.railway.app/api/v1
```

### 2. Initialize Database

First deployment will auto-create tables (using `JPA_DDL_AUTO=update`).

### 3. Create Admin User

Use Swagger UI or direct API call to create admin user:

```bash
POST /api/v1/auth/register
{
  "username": "admin",
  "email": "admin@ecovale.com",
  "password": "admin123",
  "fullName": "Admin User",
  "roles": ["ROLE_ADMIN"]
}
```

### 4. Monitor Application

- Check Railway logs regularly
- Monitor `/actuator/metrics`
- Set up alerts in Railway dashboard

## 🔐 Security Checklist

- [ ] Changed JWT_SECRET from default
- [ ] Updated CORS_ALLOWED_ORIGINS with actual frontend URLs
- [ ] Disabled JPA_SHOW_SQL in production
- [ ] Enabled HTTPS (Railway provides this automatically)
- [ ] Created strong database password
- [ ] Reviewed exposed actuator endpoints

## 📊 Your Deployment URLs

After deployment, note these URLs:

- **Backend API:** `https://[your-app].railway.app`
- **Health Check:** `https://[your-app].railway.app/actuator/health`
- **API Docs:** `https://[your-app].railway.app/swagger-ui/index.html`
- **Metrics:** `https://[your-app].railway.app/actuator/metrics`

## 🆘 Need Help?

- Railway Docs: https://docs.railway.app
- Project Logs: Available in Railway dashboard
- Support: Railway Discord or GitHub Issues

---

**Status:** ✅ Code is ready for deployment
**Last Updated:** 2026-02-05
**Repository:** https://github.com/devdev0987-dot/ecovale-hr-management
