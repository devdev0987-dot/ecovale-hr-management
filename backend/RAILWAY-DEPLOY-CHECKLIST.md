# 🚂 Railway Deployment Checklist for LeaveRequest Build Issue

## ✅ Issues Fixed

### 1. **Lombok Annotation Processing** ✅
- `pom.xml` already has Maven Compiler Plugin with Lombok annotation processing configured
- `@Data` annotation in `LeaveRequest.java` will be processed correctly during build

### 2. **Database Configuration** ✅
- Railway uses **PostgreSQL**, not MySQL
- `application-railway.properties` correctly configured with PostgreSQL dialect
- **Flyway is DISABLED** (`spring.flyway.enabled=false`)
- Using JPA auto-schema (`spring.jpa.hibernate.ddl-auto=update`)

### 3. **JAR Filename** ✅
- `pom.xml` produces: `hr-backend-1.0.0.jar`
- `railway.json` expects: `hr-backend-1.0.0.jar`
- ✅ They match!

---

## 🔧 Railway Environment Variables to Set

In Railway Dashboard → Variables, set these:

```bash
# Required Database Variables (Auto-configured by Railway PostgreSQL)
DB_HOST=<auto-filled-by-railway>
DB_PORT=<auto-filled-by-railway>
DB_NAME=railway
DB_USERNAME=postgres
DB_PASSWORD=<auto-filled-by-railway>

# CRITICAL: Generate Secure JWT Secret
JWT_SECRET=<generate-with-command-below>
JWT_EXPIRATION=86400000
JWT_REFRESH_EXPIRATION=604800000

# Server Port (Railway auto-injects $PORT)
PORT=8080

# JPA Configuration
JPA_DDL_AUTO=update
JPA_SHOW_SQL=false

# CORS (Update with your frontend URL)
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app,https://your-github-pages.github.io
```

### Generate Secure JWT Secret:
```bash
openssl rand -base64 64
```

---

## 🚀 Deployment Commands

### Option 1: Push to Railway (Automatic Build)
```bash
git add .
git commit -m "Fix: Railway deployment with Lombok & PostgreSQL"
git push
```

Railway will automatically:
1. Detect Java/Maven project
2. Run: `mvn clean package -DskipTests`
3. Start: `java -Dserver.port=$PORT -Dspring.profiles.active=railway -jar target/hr-backend-1.0.0.jar`

### Option 2: Manual Build Test (Local)
```bash
cd backend
mvn clean package -DskipTests
java -Dserver.port=8080 -Dspring.profiles.active=railway -jar target/hr-backend-1.0.0.jar
```

---

## 🐛 If Build Still Fails

### Check Railway Build Logs for:

**1. Lombok Errors:**
```
error: cannot find symbol - method getEmployeeId()
error: cannot find symbol - method setStatus()
```
**Solution:** Already fixed in `pom.xml` lines 177-191 (Maven Compiler Plugin)

**2. PostgreSQL Connection Errors:**
```
org.postgresql.util.PSQLException: Connection refused
```
**Solution:** Verify `DB_HOST`, `DB_PORT`, `DB_PASSWORD` in Railway variables

**3. JWT Secret Missing:**
```
JWT secret cannot be null or empty
```
**Solution:** Set `JWT_SECRET` in Railway environment variables

**4. Table Creation Errors:**
```
ERROR: relation "leave_requests" does not exist
```
**Solution:** 
- Verify `JPA_DDL_AUTO=update` is set
- Check `spring.jpa.hibernate.ddl-auto=${JPA_DDL_AUTO:update}` in logs
- Ensure `LeaveRequest.java` entity is scanned by Spring Boot

---

## 📋 Quick Verification After Deployment

### 1. Check Health Endpoint:
```bash
curl https://your-app.railway.app/actuator/health
```

Expected:
```json
{
  "status": "UP",
  "components": {
    "db": {
      "status": "UP"
    }
  }
}
```

### 2. Check API Documentation:
```
https://your-app.railway.app/swagger-ui/index.html
```

### 3. Test Leave API:
```bash
# Get all leave requests (requires authentication)
curl https://your-app.railway.app/api/v1/leaves \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🔍 Database Schema Verification

Connect to Railway PostgreSQL and verify table:

```sql
-- Check if table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'leave_requests';

-- Check table structure
\d leave_requests

-- Sample query
SELECT id, employee_id, status, leave_type, created_at 
FROM leave_requests 
LIMIT 5;
```

---

## 🎯 Expected Behavior

After successful deployment:

1. ✅ Build completes without Lombok errors
2. ✅ Application starts with Railway PostgreSQL connection
3. ✅ `leave_requests` table auto-created by Hibernate
4. ✅ `/api/v1/leaves` endpoints respond
5. ✅ Health check returns `UP` status

---

## 🆘 Still Having Issues?

### Share Railway Build Logs:
1. Go to Railway Dashboard → Deployments
2. Click failed deployment
3. Copy **full build logs**
4. Look for:
   - `[ERROR]` lines during Maven build
   - `org.springframework.beans.factory` errors
   - `java.lang.NoSuchMethodError` (Lombok issue)

### Common Last-Resort Fixes:

```bash
# Force clean Railway cache
railway run mvn clean install -U

# Or redeploy with cache cleared
railway up --force
```

---

## 📚 Related Documentation

- [BUILD-FIX-SUMMARY.md](BUILD-FIX-SUMMARY.md) - Lombok annotation processing fix
- [RAILWAY-DEPLOYMENT.md](RAILWAY-DEPLOYMENT.md) - Full Railway deployment guide
- [application-railway.properties](src/main/resources/application-railway.properties) - Railway config
- [railway.json](railway.json) - Railway build configuration

---

**Last Updated:** February 2, 2026  
**Status:** ✅ Configuration verified and ready for deployment
