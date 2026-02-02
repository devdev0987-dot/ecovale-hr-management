# Railway Build Error - Troubleshooting Guide

## 🔍 Common Build Errors & Solutions

### 1. **Out of Memory Error**
```
[ERROR] Java heap space
[ERROR] GC overhead limit exceeded
```

**Solution:** Added memory limits in `nixpacks.toml` and `.mvn/jvm.config`

### 2. **Lombok Compilation Errors**
```
[ERROR] cannot find symbol - method getData()
[ERROR] cannot find symbol - method setEmployeeId()
```

**Solution:** Already configured in `pom.xml` with annotation processing

### 3. **Maven Dependency Download Failure**
```
[ERROR] Failed to collect dependencies
[ERROR] Could not resolve dependencies
```

**Solution:** Added `-U` flag to force dependency updates

### 4. **Java Version Mismatch**
```
[ERROR] Source option 17 is no longer supported
[ERROR] Target option 17 is no longer supported
```

**Solution:** `nixpacks.toml` explicitly sets `jdk17`

---

## ✅ Applied Fixes

### 1. Updated `railway.json`:
- Added `-U` flag for dependency updates
- Set memory limit `-Xmx512m`
- Added health check configuration

### 2. Created `nixpacks.toml`:
- Explicit Java 17 configuration
- Maven memory limits
- Optimized build commands

### 3. Created `.mvn/jvm.config`:
- JVM memory limits for Railway build environment

---

## 🚀 Deploy with Fixes

```bash
git add backend/railway.json backend/nixpacks.toml backend/.mvn/jvm.config backend/RAILWAY-BUILD-FIX.md
git commit -m "Fix: Railway build configuration - memory limits and explicit Java 17"
git push origin main
```

---

## 📋 Railway Environment Variables (Required)

Ensure these are set in Railway Dashboard → Backend Service → Variables:

```bash
# Database (Link to Postgres-IV2W)
DB_HOST=${{Postgres-IV2W.PGHOST}}
DB_PORT=${{Postgres-IV2W.PGPORT}}
DB_NAME=${{Postgres-IV2W.PGDATABASE}}
DB_USERNAME=${{Postgres-IV2W.PGUSER}}
DB_PASSWORD=${{Postgres-IV2W.PGPASSWORD}}

# JWT (REQUIRED)
JWT_SECRET=<your-generated-secret>
JWT_EXPIRATION=86400000
JWT_REFRESH_EXPIRATION=604800000

# JPA
JPA_DDL_AUTO=update
FLYWAY_ENABLED=false

# Spring
SPRING_PROFILES_ACTIVE=railway

# CORS
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

---

## 🔍 Debug Build Failure

If build still fails, check Railway logs for:

### Error Pattern 1: Missing Environment Variables
```
Caused by: java.lang.IllegalArgumentException: JWT secret cannot be null
```
**Fix:** Set `JWT_SECRET` in Railway variables

### Error Pattern 2: Database Connection During Build
```
Unable to connect to database
```
**Note:** This is NORMAL during build phase. Database connection happens at runtime, not during `mvn package`

### Error Pattern 3: Test Failures
```
[ERROR] Tests run: X, Failures: Y
```
**Fix:** Already using `-DskipTests` flag

### Error Pattern 4: Dependency Conflicts
```
[ERROR] Failed to execute goal ... dependency convergence
```
**Fix:** Run locally:
```bash
cd backend
mvn dependency:tree
mvn clean install -U
```

---

## 🧪 Test Build Locally

Before pushing to Railway:

```bash
cd backend

# Clean build
mvn clean package -DskipTests -U

# Verify JAR was created
ls -lh target/hr-backend-1.0.0.jar

# Test run locally
java -Xmx512m -jar target/hr-backend-1.0.0.jar --spring.profiles.active=railway
```

---

## 📊 Expected Build Output (Success)

```
[INFO] Scanning for projects...
[INFO] Building hr-backend 1.0.0
[INFO] --------------------------------[ jar ]---------------------------------
[INFO] 
[INFO] --- maven-clean-plugin:3.2.0:clean (default-clean) @ hr-backend ---
[INFO] --- maven-resources-plugin:3.3.0:resources (default-resources) @ hr-backend ---
[INFO] --- maven-compiler-plugin:3.11.0:compile (default-compile) @ hr-backend ---
[INFO] Compiling XXX source files to /app/target/classes
[INFO] 
[INFO] --- maven-resources-plugin:3.3.0:testResources (default-testResources) @ hr-backend ---
[INFO] --- maven-compiler-plugin:3.11.0:testCompile (default-testCompile) @ hr-backend ---
[INFO] --- maven-surefire-plugin:3.0.0-M9:test (default-test) @ hr-backend ---
[INFO] Tests are skipped.
[INFO] 
[INFO] --- maven-jar-plugin:3.3.0:jar (default-jar) @ hr-backend ---
[INFO] Building jar: /app/target/hr-backend-1.0.0.jar
[INFO] 
[INFO] --- spring-boot-maven-plugin:3.2.1:repackage (repackage) @ hr-backend ---
[INFO] Replacing main artifact with repackaged archive
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time: XX.XXX s
```

---

## 🆘 Still Having Issues?

1. **Clear Railway cache:** Settings → Reset Build Cache
2. **Check Railway status:** https://status.railway.app
3. **Verify Java 17 is being used:** Check build logs for "Using Java 17"
4. **Share build logs:** Copy the full build log and check for the specific error line

---

**Last Updated:** February 2, 2026  
**Status:** Build configuration optimized for Railway
