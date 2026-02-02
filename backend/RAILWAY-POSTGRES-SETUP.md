# Railway PostgreSQL Setup - Postgres-IV2W

## 🎯 Quick Setup Steps

### 1. Get Database Connection Details from Railway

In Railway Dashboard:
1. Click on **Postgres-IV2W** service
2. Go to **Variables** tab
3. Copy these auto-generated values:
   - `PGHOST` (or `DATABASE_URL`)
   - `PGPORT`
   - `PGDATABASE`
   - `PGUSER`
   - `PGPASSWORD`

### 2. Set Environment Variables in Your Backend Service

In Railway Dashboard:
1. Click on your **Backend Service** (Java/Spring Boot app)
2. Go to **Variables** tab
3. Add these variables:

```bash
# Database Connection (use values from Postgres-IV2W)
DB_HOST=${{Postgres-IV2W.PGHOST}}
DB_PORT=${{Postgres-IV2W.PGPORT}}
DB_NAME=${{Postgres-IV2W.PGDATABASE}}
DB_USERNAME=${{Postgres-IV2W.PGUSER}}
DB_PASSWORD=${{Postgres-IV2W.PGPASSWORD}}

# OR use the full DATABASE_URL (Railway auto-injects)
# DATABASE_URL=${{Postgres-IV2W.DATABASE_URL}}

# JPA Configuration
JPA_DDL_AUTO=update
JPA_SHOW_SQL=false
FLYWAY_ENABLED=false

# JWT Secret (REQUIRED - Generate new one)
JWT_SECRET=<generate-with-openssl-command>
JWT_EXPIRATION=86400000
JWT_REFRESH_EXPIRATION=604800000

# CORS (Update with your frontend URL)
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com

# Server Port (Railway auto-sets)
PORT=${{PORT}}

# Spring Profile
SPRING_PROFILES_ACTIVE=railway
```

### 3. Generate Secure JWT Secret

Run this command locally:
```bash
openssl rand -base64 64
```

Copy the output and paste it as `JWT_SECRET` value in Railway.

### 4. Link PostgreSQL to Backend Service

In Railway Dashboard:
1. Click on your **Backend Service**
2. Click **Settings** → **Service Variables**
3. Click **+ New Variable** → **Add Reference**
4. Select **Postgres-IV2W** and add its variables

Or use Railway CLI:
```bash
railway link
railway variables set DB_HOST=${{Postgres-IV2W.PGHOST}}
railway variables set DB_PORT=${{Postgres-IV2W.PGPORT}}
railway variables set DB_NAME=${{Postgres-IV2W.PGDATABASE}}
railway variables set DB_USERNAME=${{Postgres-IV2W.PGUSER}}
railway variables set DB_PASSWORD=${{Postgres-IV2W.PGPASSWORD}}
```

### 5. Trigger Redeployment

```bash
# Option 1: Push to GitHub (auto-deploys)
git commit --allow-empty -m "Trigger Railway redeploy with new PostgreSQL"
git push

# Option 2: Manual redeploy in Railway Dashboard
# Click "Deploy" → "Redeploy"

# Option 3: Railway CLI
railway up
```

---

## 🔍 Verify Connection

After deployment, check:

### 1. Check Application Logs
In Railway Dashboard → Deployments → View Logs

Look for:
```
✅ HikariPool-1 - Start completed
✅ Started HrBackendApplication in X seconds
```

### 2. Test Health Endpoint
```bash
curl https://your-backend.railway.app/actuator/health
```

Expected response:
```json
{
  "status": "UP",
  "components": {
    "db": {
      "status": "UP",
      "details": {
        "database": "PostgreSQL",
        "validationQuery": "isValid()"
      }
    }
  }
}
```

### 3. Connect to Database (Optional)
```bash
# Using Railway CLI
railway connect Postgres-IV2W

# Then run SQL
\dt  -- List all tables
SELECT * FROM information_schema.tables WHERE table_name = 'leave_requests';
```

---

## 🐛 Troubleshooting

### Connection Refused
**Error:** `Connection to localhost:5432 refused`
**Solution:** 
- Verify `DB_HOST` is set to `${{Postgres-IV2W.PGHOST}}`, NOT localhost
- Check variables are properly linked in Railway

### Authentication Failed
**Error:** `password authentication failed for user "postgres"`
**Solution:**
- Use `${{Postgres-IV2W.PGPASSWORD}}` variable reference
- Don't hardcode passwords

### Tables Not Created
**Error:** `relation "leave_requests" does not exist`
**Solution:**
- Verify `JPA_DDL_AUTO=update` is set
- Check logs for Hibernate schema generation
- Ensure entities are scanned by Spring Boot

### Build Fails with Lombok Errors
**Error:** `cannot find symbol - method getData()`
**Solution:**
- Already fixed in `pom.xml`
- Clear Railway cache: Redeploy from scratch

---

## 📋 Complete Environment Variables Checklist

Mark off as you set them in Railway:

- [ ] `DB_HOST` = `${{Postgres-IV2W.PGHOST}}`
- [ ] `DB_PORT` = `${{Postgres-IV2W.PGPORT}}`
- [ ] `DB_NAME` = `${{Postgres-IV2W.PGDATABASE}}`
- [ ] `DB_USERNAME` = `${{Postgres-IV2W.PGUSER}}`
- [ ] `DB_PASSWORD` = `${{Postgres-IV2W.PGPASSWORD}}`
- [ ] `JWT_SECRET` = (generated 64-char string)
- [ ] `JWT_EXPIRATION` = `86400000`
- [ ] `JWT_REFRESH_EXPIRATION` = `604800000`
- [ ] `JPA_DDL_AUTO` = `update`
- [ ] `FLYWAY_ENABLED` = `false`
- [ ] `CORS_ALLOWED_ORIGINS` = (your frontend URL)
- [ ] `SPRING_PROFILES_ACTIVE` = `railway`

---

## 🚀 Expected Result

After successful deployment:

1. ✅ Backend connects to Postgres-IV2W
2. ✅ Tables auto-created by Hibernate
3. ✅ API endpoints respond at `https://your-backend.railway.app`
4. ✅ Health check returns `UP`
5. ✅ Swagger UI available at `/swagger-ui/index.html`

---

**Database:** Postgres-IV2W  
**Last Updated:** February 2, 2026  
**Status:** Ready for deployment
