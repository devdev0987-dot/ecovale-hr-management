# 🚀 Deploy Spring Boot Backend to Railway - Step by Step

## ✅ **Fixes Applied**

All build issues have been fixed in `pom.xml`:
- ✅ Added Maven Compiler Plugin with Lombok annotation processing
- ✅ Fixed JAR filename to `hr-backend-1.0.0.jar`
- ✅ Added explicit Lombok version (1.18.30)
- ✅ Configured compiler arguments for Spring Boot

**The backend is now ready for deployment!**

---

## 🎯 **Deployment Steps**

### **Option 1: Deploy via Railway Dashboard (Recommended)**

1. **Go to Railway Dashboard**: https://railway.app/dashboard

2. **Select Your Project**: `accomplished-gentleness`

3. **Click "New Service"** → **"Empty Service"**

4. **Name the Service**: `ecovale-backend` or `hr-backend`

5. **In the new service, go to Settings**:
   - **Source**: Connect to your GitHub repository
   - **Root Directory**: `/backend`
   - **Build Command**: `mvn clean package -DskipTests`
   - **Start Command**: `java -Dserver.port=$PORT -Dspring.profiles.active=railway -jar target/hr-backend-1.0.0.jar`

6. **Add Environment Variables**:
   ```env
   SPRING_PROFILES_ACTIVE=railway
   DB_HOST=centerbeam.proxy.rlwy.net
   DB_PORT=42937
   DB_NAME=railway
   DB_USERNAME=postgres
   DB_PASSWORD=nwFPMudPoNNgYODtCziyhtcLWVMihpBV
   JWT_SECRET=YOUR_SECURE_SECRET_HERE
   CORS_ALLOWED_ORIGINS=https://your-frontend-url.com
   ```

7. **Deploy**: Railway will automatically build and deploy

---

### **Option 2: Deploy via Railway CLI**

#### **Step 1: Create New Service**

```bash
cd /home/mithun/Downloads/ecovale-hr-web-app/backend

# Link to your project
railway link

# Select: devdev0987-dot's Projects > accomplished-gentleness > production

# Create new service (you'll need to do this in dashboard first)
```

#### **Step 2: Set Environment Variables**

```bash
# Set required environment variables
railway variables set SPRING_PROFILES_ACTIVE=railway
railway variables set DB_HOST=centerbeam.proxy.rlwy.net
railway variables set DB_PORT=42937
railway variables set DB_NAME=railway
railway variables set DB_USERNAME=postgres
railway variables set DB_PASSWORD=nwFPMudPoNNgYODtCziyhtcLWVMihpBV
railway variables set JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
railway variables set CORS_ALLOWED_ORIGINS=http://localhost:5173
```

#### **Step 3: Deploy**

```bash
# Deploy from backend directory
railway up
```

---

### **Option 3: Push to GitHub (Auto-Deploy)**

If you've connected your GitHub repo to Railway:

```bash
cd /home/mithun/Downloads/ecovale-hr-web-app

# Commit the fixed pom.xml
git add backend/pom.xml
git commit -m "fix: Configure Maven Compiler Plugin for Lombok in Railway CI

- Added explicit annotation processor configuration
- Fixed JAR filename to match deployment config
- Added Lombok version property for consistency
- Ready for Railway deployment"

git push origin main
```

Railway will automatically detect changes and redeploy.

---

## 🔍 **Verify Deployment**

### **1. Check Build Logs**
```bash
railway logs
```

**Expected Success Output**:
```
[INFO] Building jar: /app/target/hr-backend-1.0.0.jar
[INFO] BUILD SUCCESS
[INFO] Total time:  28.352 s
```

### **2. Check Application Startup**
Look for:
```
Started EcovaleHrBackendApplication in 8.234 seconds
Tomcat started on port 8080 (http)
```

### **3. Test Health Endpoint**

```bash
# Get your Railway URL from dashboard (e.g., https://hr-backend-production.railway.app)
curl https://your-backend-url.railway.app/actuator/health
```

**Expected Response**:
```json
{
  "status": "UP"
}
```

### **4. Test API Documentation**

Visit: `https://your-backend-url.railway.app/swagger-ui/index.html`

---

## 🔑 **Required Environment Variables**

| Variable | Value | Purpose |
|----------|-------|---------|
| `SPRING_PROFILES_ACTIVE` | `railway` | Activates Railway-specific config |
| `DB_HOST` | `centerbeam.proxy.rlwy.net` | PostgreSQL host |
| `DB_PORT` | `42937` | PostgreSQL port |
| `DB_NAME` | `railway` | Database name |
| `DB_USERNAME` | `postgres` | Database user |
| `DB_PASSWORD` | `nwFPMudPoNNgYODtCziyhtcLWVMihpBV` | Database password |
| `JWT_SECRET` | (generate secure value) | JWT signing key |
| `CORS_ALLOWED_ORIGINS` | Your frontend URL | CORS policy |

---

## ⚠️ **Important Notes**

### **1. Generate Secure JWT Secret**

Don't use the placeholder! Generate a secure secret:

```bash
openssl rand -base64 64 | tr -d '\n'
```

Then set it in Railway:
```bash
railway variables set JWT_SECRET="<your-generated-secret>"
```

### **2. Update CORS Origins**

After deploying your frontend, update CORS:

```bash
railway variables set CORS_ALLOWED_ORIGINS="https://your-frontend.vercel.app,https://your-frontend.netlify.app"
```

### **3. First Deployment - Database Schema**

The application uses JPA DDL `update` mode, so tables will be auto-created on first run. Check logs for:

```
Hibernate: create table users (...)
Hibernate: create table roles (...)
```

---

## 🛠️ **Troubleshooting**

### **Build Fails with "cannot find symbol: method getData()"**

✅ **Fixed!** The pom.xml now has proper Lombok configuration.

If still failing:
1. Check `railway logs` for exact error
2. Verify Lombok version: `1.18.30`
3. Clear build cache and retry

### **Application Starts But Can't Connect to Database**

Check:
1. Database credentials are correct
2. `SPRING_PROFILES_ACTIVE=railway` is set
3. PostgreSQL service is running in Railway

```bash
railway variables | grep DB_
```

### **Port Binding Error**

Railway automatically sets `$PORT` environment variable. The start command uses it:

```bash
java -Dserver.port=$PORT ...
```

Don't hard-code port 8080 in Railway!

### **Out of Memory Error**

Add Java memory settings in Railway service settings:

**Start Command**:
```bash
java -Xmx512m -Dserver.port=$PORT -Dspring.profiles.active=railway -jar target/hr-backend-1.0.0.jar
```

---

## ✅ **Deployment Checklist**

- [ ] pom.xml has Maven Compiler Plugin with Lombok config
- [ ] `railway.json` exists in backend directory
- [ ] Created new service in Railway dashboard
- [ ] Set all required environment variables
- [ ] Connected GitHub repo (optional)
- [ ] Deployed and checked logs
- [ ] Verified `/actuator/health` endpoint
- [ ] Tested Swagger UI
- [ ] Updated CORS origins
- [ ] Generated secure JWT secret

---

## 📱 **Next Steps**

1. **Deploy Backend**: Follow Option 1 or 2 above
2. **Get Backend URL**: Copy from Railway dashboard
3. **Update Frontend**: Point frontend API calls to Railway backend URL
4. **Test**: Verify authentication, API endpoints work
5. **Monitor**: Check Railway logs and metrics

---

## 🆘 **Need Help?**

**Check Build Logs**:
```bash
railway logs
```

**View All Services**:
```bash
railway status
```

**Common Commands**:
```bash
railway link          # Link to project
railway variables     # View environment variables
railway up            # Deploy
railway open          # Open service URL in browser
```

---

**Last Updated**: February 2, 2026  
**Status**: ✅ **READY FOR DEPLOYMENT**  
**Build**: ✅ **FIXED AND VERIFIED**
