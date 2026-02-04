# Railway Startup Issues - Fixed

## Issues Identified & Fixed

### 1. ✅ Missing Health Check Configuration
**Problem:** Railway couldn't detect when the app was ready
**Solution:** Added to [railway.toml](../railway.toml):
```toml
healthcheckPath = "/actuator/health"
healthcheckTimeout = 300
```

### 2. ✅ Spring Actuator Probes Not Enabled
**Problem:** Kubernetes-style liveness/readiness probes were disabled
**Solution:** Added to [application-railway.properties](src/main/resources/application-railway.properties):
```properties
management.endpoint.health.probes.enabled=true
management.health.livenessState.enabled=true
management.health.readinessState.enabled=true
```

### 3. ✅ Server Configuration Incomplete
**Problem:** Missing graceful shutdown and binding configuration
**Solution:** Added:
```properties
server.address=0.0.0.0
server.shutdown=graceful
spring.lifecycle.timeout-per-shutdown-phase=30s
```

### 4. ✅ Database Connection Timeouts
**Problem:** Slow database initialization causing startup failures
**Solution:** Added HikariCP timeout configurations:
```properties
spring.datasource.hikari.initialization-fail-timeout=60000
spring.datasource.hikari.validation-timeout=5000
```

## Verify Environment Variables in Railway

Make sure these are set in your Railway project dashboard:

### Required Variables
```bash
# Database Configuration (from Railway MySQL addon)
DB_HOST=<your-railway-mysql-host>
DB_PORT=<your-railway-mysql-port>
DB_NAME=railway
DB_USERNAME=root
DB_PASSWORD=<your-railway-mysql-password>

# Spring Profile
SPRING_PROFILES_ACTIVE=railway

# JWT Secret (generate a secure one)
JWT_SECRET=<generate-using-openssl-rand-base64-64>

# CORS Origins (your frontend URL)
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com

# Optional: JPA Configuration
JPA_DDL_AUTO=update
JPA_SHOW_SQL=false
FLYWAY_ENABLED=false
```

### Generate JWT Secret
```bash
openssl rand -base64 64
```

## Testing the Health Endpoint

Once deployed, test your health endpoint:

```bash
# Replace with your Railway app URL
curl https://your-app.railway.app/actuator/health
```

Expected response:
```json
{
  "status": "UP",
  "groups": ["liveness", "readiness"]
}
```

### Detailed Health Check
```bash
curl https://your-app.railway.app/actuator/health/readiness
curl https://your-app.railway.app/actuator/health/liveness
```

## Common Startup Errors & Solutions

### Error: "Port already in use"
**Cause:** Railway's `$PORT` variable not being used
**Solution:** Already configured in `server.port=${PORT:8080}`

### Error: "Unable to connect to database"
**Possible Causes:**
1. Database environment variables not set in Railway
2. Database addon not linked to your service
3. Wrong database credentials

**Solution:**
- Go to Railway dashboard → Your Project → Variables
- Verify all DB_* variables match your Railway MySQL addon
- Check Railway MySQL addon for correct connection details

### Error: "Application failed to start within 300 seconds"
**Cause:** Slow startup due to database migrations or heavy initialization
**Solution:** 
- Increased `healthcheckTimeout = 300` (5 minutes)
- Database connection pool optimized
- Flyway disabled (using JPA `update` mode)

### Error: "Health check failing"
**Possible Causes:**
1. Spring Actuator not included (already in pom.xml ✅)
2. Health endpoint disabled
3. Database not accessible

**Solution:**
- Check Railway logs: `railway logs`
- Verify health endpoint is accessible
- Check database connection

## Deployment Checklist

- [ ] All environment variables set in Railway dashboard
- [ ] Railway MySQL addon provisioned and linked
- [ ] `SPRING_PROFILES_ACTIVE=railway` is set
- [ ] JWT_SECRET is generated and set (min 32 characters)
- [ ] CORS_ALLOWED_ORIGINS includes your frontend URL
- [ ] Build completes successfully (`mvn clean package`)
- [ ] Health check endpoint responds: `/actuator/health`
- [ ] Application logs show successful startup
- [ ] Database connection pool initialized
- [ ] No port binding errors

## View Logs

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# View logs
railway logs
```

## Next Steps After Deployment

1. **Test the API:**
   ```bash
   curl https://your-app.railway.app/api/health
   ```

2. **Check actuator endpoints:**
   ```bash
   curl https://your-app.railway.app/actuator/health
   curl https://your-app.railway.app/actuator/info
   ```

3. **Monitor application:**
   - Railway dashboard → Metrics
   - Check CPU and memory usage
   - Monitor request latency

4. **Update Frontend:**
   - Set `VITE_API_BASE_URL=https://your-app.railway.app` in frontend

## Troubleshooting Commands

```bash
# View real-time logs
railway logs --tail

# Check environment variables
railway variables

# Restart the service
railway restart

# Open Railway dashboard
railway open
```

## Production Recommendations

1. **Database Backups:**
   - Enable automatic backups in Railway MySQL addon
   - Consider scheduled backup scripts

2. **Monitoring:**
   - Set up Railway webhooks for deployment notifications
   - Monitor health endpoint externally (UptimeRobot, Pingdom)

3. **Scaling:**
   - Monitor memory usage (currently set to 75% max)
   - Adjust HikariCP pool size based on load
   - Consider Railway's autoscaling features

4. **Security:**
   - Rotate JWT_SECRET periodically
   - Review CORS_ALLOWED_ORIGINS regularly
   - Enable HTTPS (Railway provides this automatically)

## Support

If issues persist after these fixes:

1. Check Railway logs: `railway logs`
2. Review Railway status page: https://railway.app/status
3. Contact Railway support: https://help.railway.app/
4. Check Spring Boot actuator health details

---

**Last Updated:** February 4, 2026
**Status:** ✅ All critical issues fixed
