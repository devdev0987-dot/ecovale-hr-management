# Environment Configuration Guide

## 📋 Overview

This guide explains how to configure environment variables for the Ecovale HR web application, supporting local development, staging, and production deployments.

---

## ⚠️ Important: Vite vs Create React App

This project uses **Vite**, not Create React App:

| Framework | Environment Prefix | Access Method |
|-----------|-------------------|---------------|
| **Vite** (This project) | `VITE_` | `import.meta.env.VITE_*` |
| Create React App | `REACT_APP_` | `process.env.REACT_APP_*` |

**Always use `VITE_` prefix for this project!**

---

## 📁 Environment Files

### File Structure
```
ecovale-hr-web-app/
├── .env.example          # ✅ Template (commit to git)
├── .env                  # ❌ Local dev (git ignored)
├── .env.local            # ❌ Local overrides (git ignored)
├── .env.production       # ✅ Production config (commit to git)
└── .gitignore            # Excludes .env and .env.local
```

### File Purposes

#### `.env.example`
- Template for team members
- Contains all required variables with placeholders
- **Committed to git** for documentation
- Copy this to create your `.env`

#### `.env`
- Active configuration for `npm run dev`
- **Not committed to git** (contains your local settings)
- Overrides default values

#### `.env.local`
- Personal overrides (e.g., testing different API)
- **Not committed to git**
- Highest priority for local development

#### `.env.production`
- Active configuration for `npm run build`
- **Committed to git** (contains production defaults)
- Team agrees on production API URL here

---

## 🚀 Quick Start

### First Time Setup

```bash
# 1. Copy example file
cp .env.example .env

# 2. Edit with your local backend URL
nano .env
# or
code .env

# 3. Verify configuration
cat .env

# 4. Start development server
npm run dev
```

### What to Put in `.env`

```env
# Backend API - Local Development
VITE_API_BASE_URL=http://localhost:8080

# API Timeout (milliseconds)
VITE_API_TIMEOUT=30000

# Debug Mode (shows API config in console)
VITE_ENABLE_DEBUG=true
```

---

## 🔧 Configuration Options

### Required Variables

#### `VITE_API_BASE_URL`
**Purpose:** Backend API base URL  
**Type:** String (URL)  
**Examples:**
- Local: `http://localhost:8080`
- Staging: `https://staging-api.ecovale.com`
- Production: `https://api.ecovale.com`

**Default Fallback:** `http://localhost:8080` (in apiClient.js)

#### `VITE_API_TIMEOUT`
**Purpose:** API request timeout in milliseconds  
**Type:** Number  
**Examples:**
- Fast network: `15000` (15 seconds)
- Normal: `30000` (30 seconds)
- Slow network: `60000` (60 seconds)

**Default Fallback:** `30000` (30 seconds)

### Optional Variables

#### `VITE_ENABLE_DEBUG`
**Purpose:** Enable debug logging in browser console  
**Type:** Boolean (true/false)  
**Usage:**
- Development: `true` (see API logs)
- Production: `false` (clean console)

---

## 🌍 Environment-Specific Configuration

### Local Development

**File:** `.env`

```env
# Local Backend (Spring Boot running on localhost)
VITE_API_BASE_URL=http://localhost:8080
VITE_API_TIMEOUT=30000
VITE_ENABLE_DEBUG=true
```

**Start:**
```bash
npm run dev
# Opens: http://localhost:5173 (Vite default)
```

### Staging Environment

**File:** `.env.staging`

```env
# Staging Backend (AWS/Cloud deployment)
VITE_API_BASE_URL=https://staging-api.ecovale.com
VITE_API_TIMEOUT=45000
VITE_ENABLE_DEBUG=false
```

**Build:**
```bash
npm run build -- --mode staging
```

### Production Environment

**File:** `.env.production`

```env
# Production Backend
VITE_API_BASE_URL=https://api.ecovale.com
VITE_API_TIMEOUT=45000
VITE_ENABLE_DEBUG=false
```

**Build:**
```bash
npm run build
# Automatically uses .env.production
```

---

## 💻 Using Environment Variables in Code

### ✅ Correct Usage (Vite)

```javascript
// Read environment variables
const apiUrl = import.meta.env.VITE_API_BASE_URL;
const timeout = import.meta.env.VITE_API_TIMEOUT;
const debug = import.meta.env.VITE_ENABLE_DEBUG;

// Check build mode
const isDevelopment = import.meta.env.DEV;   // true in dev
const isProduction = import.meta.env.PROD;   // true in prod
const mode = import.meta.env.MODE;           // 'development' or 'production'

// With fallback values
const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const timeout = parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000;
```

### ❌ Incorrect Usage (Create React App syntax)

```javascript
// DON'T USE - This won't work in Vite!
const apiUrl = process.env.REACT_APP_API_BASE_URL;  // undefined
const timeout = process.env.VITE_API_TIMEOUT;       // undefined
```

### Example: Conditional Logic

```javascript
// Different behavior based on environment
if (import.meta.env.DEV) {
  console.log('🔧 Development Mode');
  console.log('API URL:', import.meta.env.VITE_API_BASE_URL);
} else {
  console.log('🚀 Production Mode');
}

// Feature flags
const showDebugTools = import.meta.env.VITE_ENABLE_DEBUG === 'true';
```

---

## 🔐 Security Best Practices

### ✅ DO:
- ✅ Commit `.env.example` with placeholder values
- ✅ Commit `.env.production` with production URL (if public)
- ✅ Use `VITE_` prefix for all frontend variables
- ✅ Document all variables in `.env.example`
- ✅ Restart dev server after changing `.env`

### ❌ DON'T:
- ❌ Commit `.env` or `.env.local` to git
- ❌ Store API keys or secrets in client-side env vars
- ❌ Use sensitive data with `VITE_` prefix (visible in browser!)
- ❌ Hardcode URLs or configs in source code
- ❌ Share your `.env` file publicly

### 🚨 Important Security Note

**All `VITE_` variables are embedded in the client bundle and visible to users!**

```javascript
// ❌ BAD - Visible to anyone
VITE_DATABASE_PASSWORD=secret123        // NEVER DO THIS
VITE_API_SECRET_KEY=abc123             // NEVER DO THIS

// ✅ GOOD - Public configuration only
VITE_API_BASE_URL=https://api.example.com
VITE_APP_VERSION=1.0.0
```

**Store secrets in backend environment variables, never frontend!**

---

## 🐛 Troubleshooting

### Problem: Environment variables are undefined

**Symptoms:**
```javascript
console.log(import.meta.env.VITE_API_BASE_URL);  // undefined
```

**Solutions:**
1. Check variable has `VITE_` prefix
2. Restart dev server (`Ctrl+C`, then `npm run dev`)
3. Verify `.env` file exists in project root
4. Check for syntax errors in `.env` (no quotes needed)

### Problem: Still using old values after changing `.env`

**Solutions:**
1. Stop dev server completely (`Ctrl+C`)
2. Clear Vite cache: `rm -rf node_modules/.vite`
3. Restart: `npm run dev`
4. Hard refresh browser: `Ctrl+Shift+R`

### Problem: Production build uses wrong URL

**Solutions:**
1. Check `.env.production` exists and has correct values
2. Rebuild: `npm run build`
3. Check `dist/assets/*.js` doesn't contain old URL
4. Clear browser cache
5. Verify Vite replaces variables at build time

### Problem: Backend connection refused

**Check:**
```bash
# 1. Is backend running?
curl http://localhost:8080/actuator/health

# 2. Check CORS configuration in backend
# backend/src/main/java/com/ecovale/hr/config/CorsConfig.java

# 3. Verify .env URL matches backend
cat .env | grep VITE_API_BASE_URL
```

---

## 📊 Environment Loading Priority

Vite loads files in this order (later overrides earlier):

1. `.env` - Base configuration
2. `.env.local` - Local overrides (git ignored)
3. `.env.[mode]` - Mode-specific (e.g., `.env.production`)
4. `.env.[mode].local` - Mode-specific local (git ignored)

**Example:**

```bash
# .env
VITE_API_BASE_URL=http://localhost:8080

# .env.local (overrides .env)
VITE_API_BASE_URL=http://localhost:9090

# Result: Uses http://localhost:9090
```

---

## 📝 Complete Example Setup

### Step-by-Step Tutorial

```bash
# 1. Clone repository
git clone <repo-url>
cd ecovale-hr-web-app

# 2. Copy environment template
cp .env.example .env

# 3. Edit configuration
nano .env
# Change VITE_API_BASE_URL if your backend uses different port

# 4. Install dependencies
npm install

# 5. Verify configuration
npm run dev
# Check browser console for: "🔧 API Client Configuration"

# 6. Test API connection
# Open browser DevTools → Network tab
# Navigate to Employees page
# Should see requests to your VITE_API_BASE_URL
```

---

## 🚢 Deployment Checklist

### Before Deploying to Production:

- [ ] Update `.env.production` with production API URL
- [ ] Set `VITE_ENABLE_DEBUG=false`
- [ ] Increase `VITE_API_TIMEOUT` if needed (slow networks)
- [ ] Test production build locally: `npm run build && npm run preview`
- [ ] Verify API calls go to production URL (check Network tab)
- [ ] Ensure backend CORS allows production frontend URL
- [ ] Document any new environment variables in `.env.example`
- [ ] Never commit `.env` or `.env.local` to version control

---

## 🔄 Migration Guide

### From Create React App to Vite

If you're migrating from CRA:

**Before (CRA):**
```env
REACT_APP_API_BASE_URL=http://localhost:8080
```
```javascript
const apiUrl = process.env.REACT_APP_API_BASE_URL;
```

**After (Vite):**
```env
VITE_API_BASE_URL=http://localhost:8080
```
```javascript
const apiUrl = import.meta.env.VITE_API_BASE_URL;
```

**Migration Steps:**
1. Rename all `REACT_APP_*` to `VITE_*` in `.env` files
2. Replace `process.env.REACT_APP_*` with `import.meta.env.VITE_*` in code
3. Replace `process.env.NODE_ENV` with `import.meta.env.MODE`
4. Test thoroughly

---

## 📞 Support

**Documentation:**
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [FRONTEND-API-INTEGRATION.md](FRONTEND-API-INTEGRATION.md)

**Check Your Setup:**
```javascript
// Add to any component temporarily
console.log('All env vars:', import.meta.env);
```

**Common Files to Check:**
- [.env](.env) - Your local configuration
- [.env.example](.env.example) - Template
- [services/apiClient.js](services/apiClient.js) - Where env vars are used

---

## ✅ Verification

### Verify Configuration is Working

```bash
# 1. Start dev server
npm run dev

# 2. Open browser console (F12)
# Should see:
# 🔧 API Client Configuration:
#   Base URL: http://localhost:8080
#   Timeout: 30000 ms

# 3. Check Network tab when using app
# Requests should go to your VITE_API_BASE_URL
```

---

**You're all set! 🎉**

Environment configuration is critical for seamless development and deployment. Keep `.env.example` updated as you add new variables, and never commit sensitive data to version control.
