# Frontend Migration Checklist - API v1

## ⚠️ BREAKING CHANGE: API Versioning

All backend API endpoints have been updated from `/api/*` to `/api/v1/*`. Frontend code must be updated to use the new versioned endpoints.

---

## 📋 Required Changes

### 1. Update Base URL Configuration

**Location**: Environment configuration files, API service files

**Before:**
```javascript
// .env or config
REACT_APP_API_URL=http://localhost:8080/api

// Or in service files
const BASE_URL = 'http://localhost:8080/api';
const API_URL = 'http://localhost:8080/api';
```

**After:**
```javascript
// .env or config
REACT_APP_API_URL=http://localhost:8080/api/v1

// Or in service files
const BASE_URL = 'http://localhost:8080/api/v1';
const API_URL = 'http://localhost:8080/api/v1';
```

**Recommended (Future-Proof):**
```javascript
// .env
REACT_APP_API_URL=http://localhost:8080/api
REACT_APP_API_VERSION=v1

// In service
const API_VERSION = process.env.REACT_APP_API_VERSION || 'v1';
const BASE_URL = `${process.env.REACT_APP_API_URL}/${API_VERSION}`;
// Results in: http://localhost:8080/api/v1
```

---

### 2. Update All API Endpoint Paths

Search and replace in all service/API files:

| Old Endpoint | New Endpoint | Priority |
|-------------|--------------|----------|
| `/api/auth/*` | `/api/v1/auth/*` | 🔴 Critical |
| `/api/employees/*` | `/api/v1/employees/*` | 🔴 Critical |
| `/api/leaves/*` | `/api/v1/leaves/*` | 🟡 High |
| `/api/attendance/*` | `/api/v1/attendance/*` | 🟡 High |
| `/api/loans/*` | `/api/v1/loans/*` | 🟢 Medium |
| `/api/advances/*` | `/api/v1/advances/*` | 🟢 Medium |
| `/api/designations/*` | `/api/v1/designations/*` | 🟢 Medium |
| `/api/admin/audit-logs/*` | `/api/v1/admin/audit-logs/*` | 🟢 Low |

---

## 🔍 Files to Update

### Check These Locations:

1. **Environment Files**
   - `.env`
   - `.env.local`
   - `.env.development`
   - `.env.production`
   - `vite.config.ts` (if proxy configured)

2. **Service Files**
   - `services/storageService.ts`
   - `services/authService.ts` (if exists)
   - `services/apiClient.ts` (if exists)
   - Any file with `fetch()` or `axios` calls

3. **Context/Store Files**
   - `contexts/AppContext.tsx`
   - Redux store files (if using Redux)
   - Any state management API calls

4. **Component Files**
   - Search for hardcoded API URLs
   - Look for `fetch('/api/` or `axios.get('/api/`

---

## ✅ Step-by-Step Migration

### Step 1: Backup Current Code
```bash
git checkout -b feature/api-v1-migration
git add .
git commit -m "Backup before API v1 migration"
```

### Step 2: Update Environment Files

**File: `.env`**
```bash
# Before
VITE_API_URL=http://localhost:8080/api

# After
VITE_API_URL=http://localhost:8080/api/v1
```

### Step 3: Update Service Files

**Example: `services/storageService.ts` or similar**

**Before:**
```typescript
const BASE_URL = 'http://localhost:8080/api';

export const getEmployees = async () => {
  const response = await fetch(`${BASE_URL}/employees`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
```

**After:**
```typescript
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export const getEmployees = async () => {
  const response = await fetch(`${BASE_URL}/employees`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
```

### Step 4: Search for Hardcoded URLs

```bash
# Search for hardcoded API paths
grep -r "'/api/" src/
grep -r '"/api/' src/
grep -r "\`/api/" src/

# Should find and update all matches
```

### Step 5: Test Authentication

**Priority**: Login/logout functionality

```typescript
// Update login endpoint
const response = await fetch('http://localhost:8080/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});
```

### Step 6: Test Each Module

- [ ] Authentication (login/logout)
- [ ] Employee management
- [ ] Leave management
- [ ] Attendance
- [ ] Loans
- [ ] Advances
- [ ] Designations
- [ ] Admin/audit logs

---

## 🧪 Testing Checklist

### Local Testing

- [ ] Clear browser cache and localStorage
- [ ] Start backend: `cd backend && mvn spring-boot:run`
- [ ] Start frontend: `npm run dev`
- [ ] Test login with admin/password123
- [ ] Verify JWT token is received
- [ ] Test protected endpoints
- [ ] Check browser DevTools Network tab
- [ ] Verify all requests go to `/api/v1/*`

### Test Each Flow

- [ ] **Login Flow**
  - Enter credentials
  - Verify token storage
  - Check API call to `/api/v1/auth/login`

- [ ] **Employee Flow**
  - List employees
  - Create employee
  - Update employee
  - Delete employee
  - Check all use `/api/v1/employees`

- [ ] **Leave Flow**
  - Create leave request
  - Approve leave
  - Check status
  - Verify `/api/v1/leaves` endpoints

---

## 🐛 Common Issues & Solutions

### Issue 1: 404 Not Found

**Symptom**: API calls return 404

**Cause**: Old `/api/*` paths still in use

**Solution**: 
```bash
# Find remaining old paths
grep -r "'/api/[^v]" src/
```

### Issue 2: CORS Errors

**Symptom**: CORS policy blocks requests

**Cause**: Backend CORS not updated for v1

**Solution**: Check `backend/application.properties`:
```properties
cors.allowed.origins=http://localhost:3000,http://localhost:5173
```

### Issue 3: JWT Token Not Working

**Symptom**: 401 Unauthorized after login

**Cause**: Token stored with old key or not included in headers

**Solution**: 
```typescript
// Ensure Authorization header is set
headers: {
  'Authorization': `Bearer ${localStorage.getItem('token')}`
}
```

### Issue 4: Mixed API Versions

**Symptom**: Some calls work, others fail

**Cause**: Inconsistent base URL usage

**Solution**: Centralize API base URL:
```typescript
// config/api.ts
export const API_BASE_URL = import.meta.env.VITE_API_URL;

// Use everywhere
import { API_BASE_URL } from '@/config/api';
const response = await fetch(`${API_BASE_URL}/employees`);
```

---

## 📊 Verification Script

Create `verify-frontend-api.sh`:

```bash
#!/bin/bash

echo "Checking for old API paths in frontend..."

# Check for old /api/ paths (not /api/v1/)
OLD_PATHS=$(grep -rn "'/api/[^v]" src/ 2>/dev/null | grep -v node_modules)

if [ -z "$OLD_PATHS" ]; then
    echo "✅ No old API paths found"
else
    echo "⚠️  Found old API paths that need updating:"
    echo "$OLD_PATHS"
    exit 1
fi

# Check for hardcoded localhost URLs
HARDCODED=$(grep -rn "localhost:8080/api[^/]" src/ 2>/dev/null | grep -v node_modules)

if [ -z "$HARDCODED" ]; then
    echo "✅ No hardcoded non-versioned URLs found"
else
    echo "⚠️  Found hardcoded URLs:"
    echo "$HARDCODED"
fi

echo ""
echo "Migration check complete!"
```

Run with:
```bash
chmod +x verify-frontend-api.sh
./verify-frontend-api.sh
```

---

## 🚀 Deployment Checklist

### Before Deploying

- [ ] All API paths updated to `/api/v1/`
- [ ] Environment variables updated
- [ ] Local testing complete
- [ ] No console errors
- [ ] All features working
- [ ] Code reviewed
- [ ] Committed to git

### Deployment Steps

1. **Deploy Backend First**
   ```bash
   cd backend
   mvn clean package
   # Deploy to server
   ```

2. **Update Frontend Environment**
   ```bash
   # Update production .env
   VITE_API_URL=https://api.ecovale.com/api/v1
   ```

3. **Deploy Frontend**
   ```bash
   npm run build
   # Deploy build/ to hosting
   ```

4. **Verify Production**
   - Test login on production
   - Check Network tab for `/api/v1/` calls
   - Monitor for errors

---

## 📞 Support

**Issues with Migration?**

- **Backend Team**: Check backend/API-DOCUMENTATION.md
- **Swagger UI**: http://localhost:8080/swagger-ui.html
- **API Reference**: backend/API-QUICK-REFERENCE.md

**Common Questions:**

Q: Do I need to change API response handling?  
A: No, response format remains the same.

Q: Will old endpoints work?  
A: No, `/api/*` endpoints are removed. Only `/api/v1/*` works.

Q: What about WebSockets?  
A: WebSockets (if used) should also be versioned.

---

## ✅ Migration Complete Checklist

- [ ] All environment files updated with `/api/v1`
- [ ] All service files updated
- [ ] All hardcoded URLs removed
- [ ] Authentication tested and working
- [ ] All modules tested
- [ ] No 404 errors in console
- [ ] Network tab shows `/api/v1/` calls
- [ ] Production environment variables ready
- [ ] Team notified of changes
- [ ] Documentation updated

---

**Migration Date**: January 26, 2026  
**Backend Version**: v1  
**Estimated Time**: 30-60 minutes  
**Risk Level**: Medium (requires testing)

**Remember**: Backend must be running with API v1 support for frontend to work!
