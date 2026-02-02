# Railway Deployment Guide for Ecovale HR Backend

## Quick Setup

### 1. Create Railway Project
```bash
# Install Railway CLI (if not installed)
npm i -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init
```

### 2. Set Environment Variables in Railway Dashboard

Go to your Railway project → Variables and add:

```env
DB_HOST=caboose.proxy.rlwy.net
DB_PORT=31780
DB_NAME=railway
DB_USERNAME=root
DB_PASSWORD=MFCPqQfEUjybWfKBDyEOqJjycpJUiViW
SPRING_PROFILES_ACTIVE=railway
JWT_SECRET=<generate-secure-secret>
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com
```

### 3. Deploy

```bash
# Deploy from backend directory
cd backend
railway up
```

Or connect your GitHub repository in Railway dashboard for automatic deployments.

## Database Connection Details

Your Spring Boot application is configured to connect to:

- **Host:** caboose.proxy.rlwy.net
- **Port:** 31780
- **Database:** railway
- **Username:** root
- **Password:** MFCPqQfEUjybWfKBDyEOqJjycpJUiViW

## Configuration Files Created

1. **`.env.railway`** - Local environment variables for testing
2. **`application-railway.properties`** - Railway-specific Spring Boot config
3. **`railway.json`** - Railway build/deploy configuration
4. **`Dockerfile.railway`** - Optimized Docker image for Railway

## Testing Locally with Railway Database

```bash
# Copy the Railway environment file
cp .env.railway .env

# Run the application
mvn spring-boot:run
```

The application will connect to your Railway MySQL database.

## Important Notes

1. **JPA DDL Auto:** Set to `update` for Railway (auto-creates tables)
2. **Flyway:** Disabled for Railway deployment
3. **SSL:** Disabled for Railway MySQL proxy
4. **Port:** Railway automatically assigns a port via `$PORT` variable

## Health Check

Once deployed, check:
```
https://your-railway-app.railway.app/actuator/health
```

## Common Issues

### Connection Refused
- Verify database credentials in Railway variables
- Check if Railway MySQL service is running

### Tables Not Created
- JPA DDL is set to `update` - tables will auto-create on first run
- Check logs: `railway logs`

### CORS Errors
- Update `CORS_ALLOWED_ORIGINS` with your frontend URL

## Security Recommendations

⚠️ **Before going to production:**

1. Generate a strong JWT secret:
   ```bash
   openssl rand -base64 64
   ```

2. Update admin password in environment variables

3. Enable SSL if needed for production database

4. Review and restrict CORS origins
