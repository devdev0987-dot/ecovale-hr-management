# Deploy Backend to Railway - Step-by-Step Guide

## Current Status ✅
- ✅ Code pushed to GitHub with Lombok fixes
- ✅ MySQL database running on Railway (hopper.proxy.rlwy.net:28788)
- ✅ Environment variables configured for MySQL service
- ❌ Backend service not created yet

---

## 🚀 Deploy Backend to Railway (Two Options)

### **Option 1: Via Railway Dashboard (RECOMMENDED - Easiest)**

#### Step 1: Open Railway Dashboard
```
https://railway.app/project/accomplished-gentleness
```

#### Step 2: Add New Service
1. Click **"+ New"** button (top right)
2. Select **"GitHub Repo"**
3. Choose your repository: **`ecovale-hr-management`** or **`ecovale-hr-web-app`**
4. Railway will detect it's a Java Spring Boot application

#### Step 3: Configure Service
1. **Service Name**: `backend` or `ecovale-hr-backend`
2. **Root Directory**: `/backend` (important!)
3. **Build Command**: `mvn clean package -DskipTests -U`
4. **Start Command**: Will be auto-detected from Dockerfile

#### Step 4: Set Environment Variables
Railway should already have these from MySQL service, but verify:
```
DB_HOST=hopper.proxy.rlwy.net
DB_PORT=28788
DB_NAME=railway
DB_USERNAME=root
DB_PASSWORD=eLrQYSuxZURhmfnuhzQmkmdPgBRonKKm
SPRING_PROFILES_ACTIVE=railway
JWT_SECRET=(already set)
CORS_ALLOWED_ORIGINS=*
```

#### Step 5: Deploy
1. Click **"Deploy"**
2. Wait 3-5 minutes for build
3. Railway will provide a public URL

---

### **Option 2: Via Railway CLI**

```bash
# 1. Login to Railway (if not already)
railway login

# 2. Link to your project
cd /home/mithun/Downloads/ecovale-hr-web-app
railway link

# 3. Create service from current directory
cd backend
railway up --detach

# 4. Get the service URL
railway domain
```

---

## 🔍 Monitor Deployment

### Check Build Logs:
```bash
# In Railway Dashboard
Click on your backend service → "Deployments" tab → Click latest deployment
```

### Or via CLI:
```bash
railway logs
```

### Expected Build Output:
```
✅ Cloning repository from GitHub
✅ Detecting Dockerfile
✅ Building Docker image
✅ Running: mvn clean package -DskipTests
✅ Lombok annotation processing - SUCCESS
✅ Build completed: hr-backend-1.0.0.jar
✅ Starting Spring Boot application
✅ Connected to MySQL database
✅ Application started on port 8080
✅ Deployment successful!
```

---

## ✅ Verify Deployment

Once deployed, get your Railway URL (looks like: `https://your-app.up.railway.app`)

### Test Health Endpoint:
```bash
curl https://your-app.up.railway.app/actuator/health
```

**Expected Response:**
```json
{
  "status": "UP",
  "components": {
    "db": {
      "status": "UP",
      "details": {
        "database": "MySQL"
      }
    }
  }
}
```

### Test API Endpoints:
```bash
# Login endpoint
curl -X POST https://your-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo_admin",
    "password": "Demo@2026!Secure"
  }'

# Get employees (requires JWT token)
curl https://your-app.up.railway.app/api/v1/employees \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

## 🔧 Troubleshooting

### If Build Fails:

#### 1. Check Lombok Processing:
Look for in build logs:
```
[INFO] Compiling 50 source files to /build/target/classes
```
Should NOT show "cannot find symbol" errors.

#### 2. Check MySQL Connection:
```
spring.datasource.url=jdbc:mysql://hopper.proxy.rlwy.net:28788/railway
```

#### 3. Check Environment Variables:
In Railway Dashboard → Service → Variables tab

#### 4. View Detailed Logs:
```bash
railway logs --follow
```

---

## 🗃️ Database Setup

Once backend is running, it will auto-create tables (JPA DDL auto=update).

### Verify Tables Created:
```bash
# Connect to MySQL
railway run mysql -h hopper.proxy.rlwy.net -P 28788 -u root -p railway

# List tables
SHOW TABLES;
```

**Expected Tables:**
- users
- roles
- employees
- designations
- attendance
- advances
- loans
- audit_logs

---

## 📝 Project Structure on Railway

```
Railway Project: accomplished-gentleness
├── Service: MySQL (already running)
│   ├── Host: hopper.proxy.rlwy.net
│   ├── Port: 28788
│   └── Database: railway
│
└── Service: backend (to be created)
    ├── Source: GitHub (ecovale-hr-management)
    ├── Root: /backend
    ├── Dockerfile: Detected
    ├── Port: 8080 (auto-mapped)
    └── Public URL: Provided by Railway
```

---

## 🎯 Quick Start Command

Run this in Railway Dashboard after creating service:

```bash
# Railway will automatically run:
docker build -t backend .
docker run -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=railway \
  -e DB_HOST=hopper.proxy.rlwy.net \
  -e DB_PORT=28788 \
  -e DB_NAME=railway \
  backend
```

---

## ✅ Success Checklist

- [ ] Backend service created in Railway
- [ ] GitHub repository connected
- [ ] Root directory set to `/backend`
- [ ] Environment variables configured
- [ ] Build completed successfully
- [ ] Application started (logs show "Started EcovaleHrBackendApplication")
- [ ] Health endpoint returns `{"status":"UP"}`
- [ ] MySQL tables auto-created
- [ ] Login endpoint works

---

## 🔗 Useful Links

- **Railway Dashboard**: https://railway.app/project/accomplished-gentleness
- **GitHub Repo**: https://github.com/devdev0987-dot/ecovale-hr-management
- **Lombok Fix Summary**: [LOMBOK-FIX-SUMMARY.md](LOMBOK-FIX-SUMMARY.md)
- **Railway Docs**: https://docs.railway.app/

---

## 📞 Need Help?

If deployment fails:
1. Check Railway deployment logs
2. Verify environment variables
3. Ensure `/backend` is set as root directory
4. Confirm Dockerfile exists in backend folder
5. Check that code is pushed to main branch

---

**Ready to deploy!** 🚀
Follow **Option 1** (Dashboard) for the easiest deployment experience.
