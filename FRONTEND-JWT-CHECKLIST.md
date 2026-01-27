# JWT Frontend Integration Checklist

## ✅ Files Created

- [x] `services/authService.js` - Authentication service
- [x] `services/apiClient.js` - Updated with JWT interceptors
- [x] `components/Login.jsx` - Login component
- [x] `components/ProtectedRoute.jsx` - Route protection
- [x] `contexts/AuthContext.jsx` - Global auth state
- [x] `FRONTEND-JWT-GUIDE.md` - Complete documentation

## 🚀 Integration Steps

### Step 1: Environment Setup
- [ ] Create `.env` file with `VITE_API_BASE_URL`
- [ ] Verify backend is running on port 8080
- [ ] Test backend `/api/auth/login` endpoint works

### Step 2: Update App Entry Point
```jsx
// App.jsx or main.jsx
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      {/* Your app content */}
    </AuthProvider>
  );
}
```

### Step 3: Replace Existing Login Page
```jsx
// Update existing LoginPage.tsx or create new route
import Login from './components/Login';

function LoginPage() {
  return <Login onLoginSuccess={() => window.location.href = '/dashboard'} />;
}
```

### Step 4: Protect Routes
```jsx
// Wrap pages that require authentication
import ProtectedRoute from './components/ProtectedRoute';

function EmployeesPage() {
  return (
    <ProtectedRoute requireAnyRole={['ROLE_USER', 'ROLE_ADMIN']}>
      {/* Your employees page content */}
    </ProtectedRoute>
  );
}
```

### Step 5: Update Navigation
```jsx
// Add logout button to navbar
import { useAuth } from './contexts/AuthContext';

function Navbar() {
  const { logout, getDisplayName, isAdmin } = useAuth();
  
  return (
    <nav>
      <span>Welcome, {getDisplayName()}</span>
      {isAdmin() && <a href="/admin">Admin</a>}
      <button onClick={logout}>Logout</button>
    </nav>
  );
}
```

## 🧪 Testing Checklist

### Test Authentication
- [ ] Login with valid credentials → Success
- [ ] Login with invalid credentials → Error message shown
- [ ] Token stored in localStorage after login
- [ ] User data stored in localStorage after login
- [ ] Redirect to dashboard after successful login

### Test Protected Routes
- [ ] Access protected page without login → Redirect to login
- [ ] Access protected page with login → Page loads
- [ ] Access admin page with USER role → Access denied
- [ ] Access admin page with ADMIN role → Page loads

### Test Token Injection
- [ ] Open DevTools Network tab
- [ ] Make API request to `/api/employees`
- [ ] Verify `Authorization: Bearer <token>` header is present
- [ ] Request succeeds with 200 status

### Test Logout
- [ ] Click logout button
- [ ] localStorage cleared (auth_token, auth_user)
- [ ] Redirected to login page
- [ ] Cannot access protected routes after logout

### Test Token Expiration
- [ ] Login successfully
- [ ] In Console: `localStorage.setItem('auth_token', 'invalid')`
- [ ] Make API request → Should get 401 error
- [ ] Should redirect to login page
- [ ] localStorage should be cleared

## 🔍 Debugging

### Check Token Storage
```javascript
// In browser console
localStorage.getItem('auth_token')
localStorage.getItem('auth_user')
```

### Inspect API Requests
```javascript
// In DevTools Network tab, check:
// 1. Request Headers → Authorization: Bearer <token>
// 2. Response → Status code (200, 401, 403)
```

### Test Auth Context
```jsx
// In any component
import { useAuth } from './contexts/AuthContext';

function DebugAuth() {
  const auth = useAuth();
  console.log('Auth State:', auth);
  return <div>{JSON.stringify(auth.user)}</div>;
}
```

## 🎯 Quick Commands

### Start Frontend
```bash
npm run dev
```

### Start Backend
```bash
cd backend
mvn spring-boot:run
```

### Test Login API
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Test Protected Endpoint
```bash
TOKEN="your-token-here"
curl -X GET http://localhost:8080/api/employees \
  -H "Authorization: Bearer $TOKEN"
```

## ⚠️ Common Issues

### Issue: CORS Error
**Solution**: Backend CORS config should allow `http://localhost:5173`

### Issue: Token Not Sent
**Solution**: Check `apiClient.js` interceptor gets token from localStorage

### Issue: Infinite Redirect Loop
**Solution**: Check login page doesn't use ProtectedRoute wrapper

### Issue: "useAuth must be used within AuthProvider"
**Solution**: Wrap app with `<AuthProvider>` in App.jsx or main.jsx

## 📋 Production Checklist

Before deploying to production:

- [ ] Change `VITE_API_BASE_URL` to production backend URL
- [ ] Update backend `JWT_SECRET` with strong random value
- [ ] Enable HTTPS for both frontend and backend
- [ ] Update CORS origins to production domains
- [ ] Remove console.log statements (or use env check)
- [ ] Set appropriate token expiration (24 hours default)
- [ ] Test all authentication flows in production environment
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Add rate limiting on login endpoint
- [ ] Implement refresh token mechanism (optional)

## 🎉 Success Criteria

Your JWT authentication is working when:

✅ Users can login with valid credentials  
✅ JWT token is stored in localStorage  
✅ Token is automatically sent with all API requests  
✅ Protected routes redirect to login when not authenticated  
✅ Role-based access control works (ADMIN vs USER)  
✅ 401 errors automatically logout and redirect to login  
✅ Logout clears tokens and redirects to login  
✅ No CORS errors in browser console  

---

**Ready to Test?** Start both backend and frontend, then navigate to `http://localhost:5173`
