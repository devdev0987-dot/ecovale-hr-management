# 🚀 Quick Deploy - Railway

## Prerequisites
You're already in the backend directory! ✅

## Method 1: Automated Script (Easiest)
```bash
# Run from backend directory (where you are now)
./deploy.sh
```

This script will:
- Check Railway CLI installation
- Verify authentication
- Link project if needed
- Deploy to Railway

## Method 2: Manual Railway CLI

### Step 1: Login & Link
```bash
# Login to Railway
railway login

# Link to your project (select existing or create new)
railway link
```

### Step 2: Set Environment Variables
```bash
# Set required variables
railway variables set SPRING_PROFILES_ACTIVE=railway
railway variables set JWT_SECRET=$(openssl rand -base64 64)
railway variables set CORS_ALLOWED_ORIGINS=https://yourdomain.github.io
```

### Step 3: Deploy
```bash
railway up
```

## Method 3: Railway Dashboard
1. Go to https://railway.app/new
2. **Deploy from GitHub repo**
3. Select: `/backend` as root directory

## Step 2: Add PostgreSQL
- Click **New** → **Database** → **PostgreSQL**
- Auto-configures connection!

## Step 3: Environment Variables
```bash
SPRING_PROFILES_ACTIVE=railway
JWT_SECRET=<run command below>
CORS_ALLOWED_ORIGINS=https://yourdomain.github.io
```

**Generate JWT Secret:**
```bash
openssl rand -base64 64
```

## Step 4: Deploy Settings
- **Build Command**: `mvn clean package -DskipTests`
- **Start Command**: `java -Dserver.port=$PORT -Dspring.profiles.active=railway -jar target/hr-backend-1.0.0.jar`

## Step 5: Deploy!
Click **Deploy** → Wait 2-3 minutes

## Step 6: Test
```bash
# Get your Railway URL from dashboard
curl https://your-backend.railway.app/actuator/health
```

Expected: `{"status":"UP"}`

## Step 7: Frontend Integration
Update your frontend API URL to Railway backend URL

---

## 🎯 That's it! Your backend is live!

**Full Guide:** See `PRODUCTION-DEPLOYMENT-GUIDE.md`
**Troubleshooting:** See `DEPLOYMENT-SUMMARY.md`
