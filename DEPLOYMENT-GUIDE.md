# 🚀 Public Demo Deployment Guide

This guide walks you through deploying the Ecovale HR Management System as a public demo.

## 📋 Table of Contents

1. [Backend Deployment (Railway/Render)](#backend-deployment)
2. [Frontend Deployment (Netlify/Vercel)](#frontend-deployment)
3. [Environment Configuration](#environment-configuration)
4. [Health Check & Monitoring](#health-check--monitoring)
5. [Demo Credentials](#demo-credentials)
6. [Troubleshooting](#troubleshooting)

---

## 🔧 Backend Deployment

### Option 1: Railway (Recommended - Free Tier)

**Prerequisites:**
- GitHub account
- Railway account (https://railway.app)

**Steps:**

1. **Fork and Push to GitHub:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/ecovale-hr-system.git
   git push -u origin main
   ```

2. **Create New Project on Railway:**
   - Go to https://railway.app/new
   - Click "Deploy from GitHub repo"
   - Select your forked repository
   - Select `backend` as the root directory

3. **Add MySQL Database:**
   - Click "+ New" → "Database" → "Add MySQL"
   - Railway will auto-provision a MySQL 8.0 instance
   - Note the connection details

4. **Configure Environment Variables:**
   
   In Railway dashboard, go to your service → Variables tab:
   
   ```bash
   # Database (Railway auto-provides these)
   DATABASE_URL=mysql://user:password@host:port/railway
   
   # JWT Configuration (CRITICAL - Generate strong secrets!)
   JWT_SECRET=your-256-bit-secret-key-here-min-32-chars
   JWT_EXPIRATION=86400000
   JWT_REFRESH_EXPIRATION=604800000
   
   # CORS (Update with your frontend URL after deploying)
   CORS_ALLOWED_ORIGINS=https://your-app.netlify.app,https://your-app.vercel.app
   
   # Admin Credentials
   ADMIN_USERNAME=demo_admin
   ADMIN_PASSWORD=Demo@2026!Secure
   
   # Spring Profile
   SPRING_PROFILES_ACTIVE=prod
   
   # Swagger (Disable in production)
   SWAGGER_UI_ENABLED=false
   ```

5. **Deploy:**
   - Railway auto-deploys on git push
   - Monitor logs in the Railway dashboard
   - Note your backend URL: `https://YOUR-APP.railway.app`

6. **Verify Deployment:**
   ```bash
   # Health check
   curl https://YOUR-APP.railway.app/api/v1/health
   
   # Actuator health
   curl https://YOUR-APP.railway.app/actuator/health
   ```

---

### Option 2: Render (Alternative - Free Tier)

**Prerequisites:**
- GitHub account
- Render account (https://render.com)

**Steps:**

1. **Create New Web Service:**
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select `backend` directory

2. **Configure Service:**
   ```yaml
   Name: ecovale-hr-backend
   Environment: Java
   Build Command: mvn clean package -DskipTests
   Start Command: java -Dserver.port=$PORT -Dspring.profiles.active=prod -jar target/*.jar
   ```

3. **Add PostgreSQL Database (Render Free Tier):**
   - Click "New +" → "PostgreSQL"
   - Note: Render offers PostgreSQL for free tier
   - For MySQL, upgrade to paid tier or use external DB

4. **Environment Variables:**
   Same as Railway (see above)

5. **Deploy:**
   - Render auto-deploys
   - Note your URL: `https://YOUR-APP.onrender.com`

**Important:** Render free tier sleeps after 15 min of inactivity. First request may take 30-60s to wake up.

---

## 🎨 Frontend Deployment

### Option 1: Netlify (Recommended)

**Prerequisites:**
- GitHub account
- Netlify account (https://netlify.com)

**Steps:**

1. **Prepare Frontend:**
   
   Update `.env.production`:
   ```bash
   VITE_API_BASE_URL=https://YOUR-BACKEND-APP.railway.app/api/v1
   VITE_APP_NAME=Ecovale HR Demo
   VITE_APP_ENV=production
   ```

2. **Create New Site on Netlify:**
   - Go to https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Connect GitHub and select your repository
   - Configure build settings:
     ```yaml
     Base directory: (leave blank or root)
     Build command: npm run build
     Publish directory: dist
     ```

3. **Add Environment Variables:**
   
   In Netlify dashboard → Site settings → Environment variables:
   ```bash
   VITE_API_BASE_URL=https://YOUR-BACKEND-APP.railway.app/api/v1
   ```

4. **Deploy:**
   - Netlify auto-deploys
   - Note your frontend URL: `https://YOUR-APP.netlify.app`

5. **Update Backend CORS:**
   
   Go back to Railway/Render and update `CORS_ALLOWED_ORIGINS`:
   ```bash
   CORS_ALLOWED_ORIGINS=https://YOUR-APP.netlify.app
   ```

---

### Option 2: Vercel (Alternative)

**Prerequisites:**
- GitHub account
- Vercel account (https://vercel.com)

**Steps:**

1. **Import Project:**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Vercel auto-detects Vite configuration

2. **Environment Variables:**
   
   In Vercel dashboard → Settings → Environment Variables:
   ```bash
   VITE_API_BASE_URL=https://YOUR-BACKEND-APP.railway.app/api/v1
   VITE_APP_NAME=Ecovale HR Demo
   VITE_APP_ENV=production
   ```

3. **Deploy:**
   - Vercel auto-deploys on every push
   - Note your URL: `https://YOUR-APP.vercel.app`

4. **Update Backend CORS:**
   Same as Netlify above.

---

## ⚙️ Environment Configuration

### Backend Environment Variables Reference

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | MySQL connection string | `mysql://user:pass@host:3306/db` | ✅ |
| `DATABASE_USERNAME` | DB username | `ecovale_admin` | ✅ |
| `DATABASE_PASSWORD` | DB password | `SecurePass123!` | ✅ |
| `JWT_SECRET` | JWT signing key (min 32 chars) | `your-256-bit-secret` | ✅ |
| `JWT_EXPIRATION` | Access token expiry (ms) | `86400000` (24h) | ❌ |
| `JWT_REFRESH_EXPIRATION` | Refresh token expiry (ms) | `604800000` (7d) | ❌ |
| `CORS_ALLOWED_ORIGINS` | Frontend domains (comma-separated) | `https://app.netlify.app` | ✅ |
| `ADMIN_USERNAME` | Initial admin username | `demo_admin` | ✅ |
| `ADMIN_PASSWORD` | Initial admin password | `Demo@2026!` | ✅ |
| `SPRING_PROFILES_ACTIVE` | Spring profile | `prod` | ✅ |
| `SWAGGER_UI_ENABLED` | Enable Swagger UI | `false` | ❌ |

### Frontend Environment Variables Reference

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `VITE_API_BASE_URL` | Backend API URL | `https://api.railway.app/api/v1` | ✅ |
| `VITE_APP_NAME` | Application name | `Ecovale HR Demo` | ❌ |
| `VITE_APP_ENV` | Environment | `production` | ❌ |

---

## 🏥 Health Check & Monitoring

### Health Check Endpoints

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `/api/v1/health` | Custom health check | `{"status":"UP","uptime":"..."}` |
| `/api/v1/health/ready` | Readiness probe | `{"status":"READY"}` |
| `/api/v1/health/live` | Liveness probe | `{"status":"ALIVE"}` |
| `/api/v1/health/info` | Version & build info | `{"version":"1.0.0",...}` |
| `/actuator/health` | Spring Boot health | `{"status":"UP"}` |
| `/actuator/prometheus` | Prometheus metrics | Metrics in text format |

### Monitoring Setup

**1. UptimeRobot (Free Monitoring):**
   - Sign up at https://uptimerobot.com
   - Add monitor: `https://YOUR-BACKEND-APP.railway.app/api/v1/health`
   - Check interval: 5 minutes
   - Alert via email when down

**2. Railway/Render Built-in Monitoring:**
   - View logs in dashboard
   - Set up email alerts for crashes
   - Monitor resource usage

**3. Prometheus + Grafana (Advanced):**
   - Scrape `/actuator/prometheus` endpoint
   - Create dashboards for JVM metrics, API latency, error rates

---

## 👤 Demo Credentials

After deployment, seed users are automatically created by the application.

**See [DEMO-CREDENTIALS.md](DEMO-CREDENTIALS.md) for complete list of test accounts.**

### Quick Access:

**Admin Account:**
- Username: `demo_admin` (or value of `ADMIN_USERNAME`)
- Password: `Demo@2026!Secure` (or value of `ADMIN_PASSWORD`)
- Roles: ADMIN, HR, MANAGER

**Test Employees:**
- See [DEMO-CREDENTIALS.md](DEMO-CREDENTIALS.md)

---

## 🐛 Troubleshooting

### Backend Issues

**1. "Cannot connect to database"**
```bash
# Verify database URL is correct
echo $DATABASE_URL

# Check if database is running
curl https://YOUR-APP.railway.app/actuator/health

# Solution: Verify DATABASE_URL, DATABASE_USERNAME, DATABASE_PASSWORD
```

**2. "CORS error in browser console"**
```bash
# Check CORS configuration
curl -H "Origin: https://your-frontend.netlify.app" \
     https://YOUR-BACKEND.railway.app/api/v1/health -v

# Solution: Update CORS_ALLOWED_ORIGINS to include your frontend domain
```

**3. "JWT signature does not match"**
```bash
# Solution: Ensure JWT_SECRET is at least 32 characters
# Generate strong secret: openssl rand -base64 64
```

**4. "Flyway migration failed"**
```bash
# Check logs for specific error
# Common fix: Drop and recreate database (WARNING: loses data)

# Or manually run migrations:
mvn flyway:migrate -Dflyway.url=$DATABASE_URL
```

### Frontend Issues

**1. "API calls returning 404"**
```bash
# Verify API base URL
console.log(import.meta.env.VITE_API_BASE_URL)

# Solution: Check .env.production has correct backend URL
```

**2. "CORS errors"**
```bash
# Solution: Update backend CORS_ALLOWED_ORIGINS with frontend domain
```

**3. "Build fails on Netlify/Vercel"**
```bash
# Check build logs
# Common fix: Ensure package.json has correct scripts
npm run build  # Test locally first
```

### Railway/Render Specific

**Railway Free Tier Limits:**
- $5 free credit per month
- 500 hours execution time
- 1 GB RAM
- 1 GB disk

**Render Free Tier Limits:**
- Sleeps after 15 min inactivity
- 750 hours/month (sleeps count)
- 512 MB RAM
- First request after sleep: 30-60s

---

## 🎉 Deployment Checklist

Before going live:

- [ ] Backend deployed to Railway/Render
- [ ] Database provisioned and connected
- [ ] All environment variables configured
- [ ] JWT_SECRET is strong (min 32 chars)
- [ ] ADMIN_PASSWORD is secure
- [ ] Swagger UI disabled in production
- [ ] Frontend deployed to Netlify/Vercel
- [ ] Frontend VITE_API_BASE_URL points to backend
- [ ] Backend CORS_ALLOWED_ORIGINS includes frontend domain
- [ ] Health checks returning 200 OK
- [ ] Test login with demo credentials
- [ ] UptimeRobot monitoring configured
- [ ] Database backups enabled (Railway/Render dashboard)
- [ ] SSL/HTTPS working (Railway/Render provide automatically)

---

## 📞 Support

**Documentation:**
- [Architecture Guide](../ARCHITECTURE.md)
- [API Documentation](../backend/API-DOCUMENTATION.md)
- [Demo Credentials](./DEMO-CREDENTIALS.md)

**Need Help?**
- Check logs in Railway/Render dashboard
- Review [Troubleshooting](#troubleshooting) section
- Open GitHub issue

---

## 🔐 Security Notes

**For Public Demo:**
1. Use separate demo database (not production data)
2. Set strong ADMIN_PASSWORD
3. Disable Swagger UI in production
4. Enable rate limiting (already configured)
5. Monitor for abuse with UptimeRobot
6. Consider adding authentication rate limiting
7. Review logs regularly

**For Production:**
1. Use managed database with automated backups
2. Enable SSL/TLS (Railway/Render provide automatically)
3. Set up proper monitoring and alerting
4. Implement database encryption at rest
5. Regular security audits
6. Use secrets management (Railway/Render vault)

---

## 🚀 Quick Deploy Commands

**Backend to Railway:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up
```

**Frontend to Netlify:**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

---

**Last Updated:** January 26, 2026  
**Version:** 1.0.0
