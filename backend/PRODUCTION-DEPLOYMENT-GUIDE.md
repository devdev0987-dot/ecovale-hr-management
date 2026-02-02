# 🚀 Spring Boot Backend - Cloud Deployment Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Configuration](#configuration)
4. [Deployment Options](#deployment-options)
5. [Environment Variables](#environment-variables)
6. [Database Setup](#database-setup)
7. [CORS Configuration](#cors-configuration)
8. [GitHub Integration](#github-integration)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This Spring Boot backend is production-ready and can be deployed to:
- **Railway** ✅ (Recommended - PostgreSQL included)
- **Render.com** ✅ (Free tier available)
- **Fly.io** ✅ (Global deployment)
- **Heroku**, **DigitalOcean App Platform**, etc.

**Tech Stack:**
- Java 17
- Spring Boot 3.2.1
- PostgreSQL (Railway) or MySQL
- Maven build tool
- Docker support

---

## 📦 Prerequisites

### Local Development:
```bash
# Required
- Java 17 or higher
- Maven 3.9+
- Git

# Optional
- Docker (for containerized deployment)
- PostgreSQL or MySQL (for local database)
```

### Cloud Provider Account:
- Sign up at [Railway.app](https://railway.app) (recommended)
- Or [Render.com](https://render.com)
- Or [Fly.io](https://fly.io)

---

## ⚙️ Configuration

### 1. Application Profiles

The backend supports multiple profiles:
- `default` - Local development
- `railway` - Railway deployment (PostgreSQL)
- `prod` - Generic production (MySQL/PostgreSQL)

### 2. Key Configuration Files

| File | Purpose |
|------|---------|
| `pom.xml` | Maven dependencies & build config |
| `application.properties` | Default configuration |
| `application-railway.properties` | Railway-specific config |
| `Dockerfile` | Container image definition |
| `railway.json` | Railway deployment config |
| `render.yaml` | Render.com deployment config |
| `fly.toml` | Fly.io deployment config |

---

## 🌐 Deployment Options

### **Option 1: Railway (Recommended)**

#### **A. Via Railway Dashboard**

1. **Go to** [Railway Dashboard](https://railway.app/new)

2. **Create New Project** → **Deploy from GitHub repo**

3. **Select your repository** and configure:
   - **Service Name**: `ecovale-backend`
   - **Root Directory**: `/backend`
   - **Build Command**: `mvn clean package -DskipTests`
   - **Start Command**: `java -Dserver.port=$PORT -Dspring.profiles.active=railway -jar target/hr-backend-1.0.0.jar`

4. **Add PostgreSQL**:
   - Click **New** → **Database** → **Add PostgreSQL**
   - Railway auto-configures connection

5. **Set Environment Variables** (see section below)

6. **Deploy** - Railway auto-deploys on every GitHub push!

#### **B. Via Railway CLI**

```bash
# YOU'RE ALREADY IN THE BACKEND DIRECTORY ✅
# No need to cd backend

# Install Railway CLI (if not installed)
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Set environment variables
railway variables set SPRING_PROFILES_ACTIVE=railway
railway variables set JWT_SECRET=$(openssl rand -base64 64)
railway variables set CORS_ALLOWED_ORIGINS="https://yourdomain.github.io"

# Deploy
railway up

# OR use the automated script
./deploy.sh
```

---

### **Option 2: Render.com**

1. **Go to** [Render Dashboard](https://dashboard.render.com/)

2. **New** → **Web Service** → **Connect your GitHub repo**

3. **Configure**:
   - **Name**: `ecovale-backend`
   - **Root Directory**: `backend`
   - **Environment**: Java
   - **Build Command**: `mvn clean package -DskipTests`
   - **Start Command**: `java -Dserver.port=$PORT -Dspring.profiles.active=prod -jar target/hr-backend-1.0.0.jar`

4. **Add PostgreSQL**:
   - **New** → **PostgreSQL** → Link to web service

5. **Set Environment Variables** (see section below)

6. **Deploy** - Automatic on every push!

---

### **Option 3: Fly.io**

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Create app
cd backend
fly launch

# Create PostgreSQL database
fly postgres create

# Attach database to app
fly postgres attach <database-name>

# Set environment variables
fly secrets set JWT_SECRET=$(openssl rand -base64 64)
fly secrets set SPRING_PROFILES_ACTIVE=prod
fly secrets set CORS_ALLOWED_ORIGINS="https://yourdomain.github.io"

# Deploy
fly deploy
```

---

## 🔐 Environment Variables

### **Required Variables**

| Variable | Description | Example |
|----------|-------------|---------|
| `SPRING_PROFILES_ACTIVE` | Profile to use | `railway` or `prod` |
| `JWT_SECRET` | JWT signing key (64+ chars) | `<generate with openssl>` |
| `CORS_ALLOWED_ORIGINS` | Frontend URLs (comma-separated) | `https://yourdomain.github.io,https://yourdomain.vercel.app` |

### **Database Variables (If not auto-configured)**

| Variable | Railway | Render/Fly |
|----------|---------|-----------|
| `DB_HOST` | Auto-set | Manual |
| `DB_PORT` | Auto-set | Manual |
| `DB_NAME` | Auto-set | Manual |
| `DB_USERNAME` | Auto-set | Manual |
| `DB_PASSWORD` | Auto-set | Manual |

### **Optional Variables**

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8080` | Server port (auto-set by platform) |
| `JPA_DDL_AUTO` | `update` | Hibernate schema management |
| `FLYWAY_ENABLED` | `false` | Database migrations |
| `LOG_LEVEL` | `INFO` | Logging level |

### **Generate Secure JWT Secret**

```bash
# Linux/Mac
openssl rand -base64 64 | tr -d '\n'

# Windows (PowerShell)
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(64))
```

---

## 🗄️ Database Setup

### **Railway PostgreSQL (Auto-Configured)**

Railway automatically provides:
- `DATABASE_URL` (PostgreSQL connection string)
- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`

The backend reads these automatically when `SPRING_PROFILES_ACTIVE=railway`.

### **Render PostgreSQL**

Render provides `DATABASE_URL`. Parse it in application properties:

```properties
spring.datasource.url=${DATABASE_URL}
```

### **Manual PostgreSQL/MySQL**

Set these environment variables:

```bash
DB_HOST=your-db-host.com
DB_PORT=5432
DB_NAME=your_database
DB_USERNAME=your_user
DB_PASSWORD=your_password
```

### **Schema Management**

The backend uses **Hibernate DDL** mode `update`:
- Tables are auto-created on first run
- Schema changes are applied automatically
- **Production**: Consider Flyway for migrations

---

## 🌍 CORS Configuration

### **Why CORS is Important**

Your frontend (GitHub Pages, Vercel, Netlify) runs on a different domain than your backend. CORS allows cross-origin requests.

### **Configure CORS**

Set `CORS_ALLOWED_ORIGINS` environment variable with your frontend URLs:

```bash
# Single domain
CORS_ALLOWED_ORIGINS=https://yourusername.github.io

# Multiple domains (comma-separated)
CORS_ALLOWED_ORIGINS=https://yourdomain.github.io,https://yourdomain.vercel.app,https://yourdomain.netlify.app

# During development (include localhost)
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,https://yourdomain.github.io
```

### **Verify CORS**

After deployment, test from your frontend:

```javascript
fetch('https://your-backend.railway.app/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ username: 'test', password: 'test' })
})
.then(response => response.json())
.then(data => console.log('✅ CORS working!', data))
.catch(error => console.error('❌ CORS error:', error));
```

---

## 🔗 GitHub Integration

### **Auto-Deploy on Push**

#### **1. Connect GitHub to Railway/Render/Fly**

**Railway:**
- Dashboard → Project → Settings → Connect Repo
- Select your repository
- Set **Watch Paths**: `backend/**`

**Render:**
- Service → Settings → Build & Deploy
- **Auto-Deploy**: Yes

#### **2. GitHub Actions (Optional)**

Use the provided workflow: `.github/workflows/deploy-railway.yml`

**Setup:**
1. Get Railway API token: `railway login` → `railway whoami --token`
2. Add to GitHub Secrets: `RAILWAY_TOKEN`
3. Push to `main` branch → Auto-deploy!

---

## ✅ Testing

### **1. Health Check**

```bash
curl https://your-backend.railway.app/actuator/health
```

**Expected:**
```json
{
  "status": "UP"
}
```

### **2. API Documentation**

Visit: `https://your-backend.railway.app/swagger-ui/index.html`

### **3. Test Authentication**

```bash
curl -X POST https://your-backend.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### **4. Test CORS**

```bash
curl -H "Origin: https://yourdomain.github.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: X-Requested-With" \
  -X OPTIONS \
  --verbose \
  https://your-backend.railway.app/api/v1/auth/login
```

Look for: `Access-Control-Allow-Origin: https://yourdomain.github.io`

---

## 🐛 Troubleshooting

### **Build Fails: "cannot find symbol: method getData()"**

✅ **Fixed!** pom.xml now has Lombok annotation processing.

If still failing:
```bash
# Check logs
railway logs

# Verify Lombok version
grep lombok backend/pom.xml
```

### **CORS Error in Browser Console**

```
Access to fetch at 'https://backend.railway.app/api/v1/...' from origin 'https://yourdomain.github.io' has been blocked by CORS policy
```

**Fix:**
1. Check `CORS_ALLOWED_ORIGINS` environment variable
2. Ensure your frontend URL is included (no trailing slash)
3. Restart the backend service

### **Database Connection Refused**

**Railway:**
- Check if PostgreSQL service is running
- Verify `SPRING_PROFILES_ACTIVE=railway`

**Manual Database:**
```bash
# Test connection
railway run psql $DATABASE_URL

# Check environment variables
railway variables | grep DB_
```

### **Application Won't Start: "Port already in use"**

Railway/Render auto-set `$PORT`. Never hardcode port in production!

**Check start command:**
```bash
java -Dserver.port=$PORT -jar app.jar  # ✅ Correct
java -jar app.jar                       # ❌ Uses 8080 (may fail)
```

### **Out of Memory**

**Railway:**
- Upgrade plan for more RAM
- Or optimize JVM settings:
  ```bash
  java -Xmx512m -jar app.jar
  ```

---

## 📊 Deployment Checklist

### **Pre-Deployment**
- [ ] Lombok configured in pom.xml
- [ ] Application profiles created
- [ ] CORS configuration updated
- [ ] JWT secret generated
- [ ] Database credentials secured

### **Deployment**
- [ ] Cloud provider account created
- [ ] Repository connected to platform
- [ ] Environment variables set
- [ ] Database provisioned
- [ ] Build and deploy successful

### **Post-Deployment**
- [ ] Health check endpoint working
- [ ] Swagger UI accessible
- [ ] API endpoints responding
- [ ] CORS working from frontend
- [ ] Database connection verified
- [ ] Logs checked for errors

### **Frontend Integration**
- [ ] Backend URL updated in frontend
- [ ] API calls working
- [ ] Authentication functioning
- [ ] Data persisting to database

---

## 🎉 Success!

Your backend is now deployed! 🚀

**Next Steps:**
1. Update frontend API base URL to your backend URL
2. Test all API endpoints from frontend
3. Monitor logs and performance
4. Set up monitoring (optional):
   - Railway: Built-in metrics
   - External: Sentry, DataDog, New Relic

**Get Backend URL:**
- **Railway**: Dashboard → Service → Settings → Domain
- **Render**: Dashboard → Service → URL
- **Fly**: `fly info` or Dashboard

**Example Usage in Frontend:**

```javascript
// config.js
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://your-backend.railway.app'
  : 'http://localhost:8080';

export default API_BASE_URL;
```

---

## 📚 Additional Resources

- [Railway Docs](https://docs.railway.app/)
- [Render Docs](https://render.com/docs)
- [Fly.io Docs](https://fly.io/docs/)
- [Spring Boot Docs](https://docs.spring.io/spring-boot/)

---

**Last Updated**: February 2, 2026  
**Status**: ✅ Production Ready  
**Author**: Ecovale HR Team

Need help? Check the troubleshooting section or create an issue on GitHub!
