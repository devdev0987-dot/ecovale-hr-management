# JWT Authentication - Frontend Implementation Guide

## 🎯 Overview
Complete JWT authentication implementation for React frontend with secure token handling, automatic token injection, and global error handling.

---

## 📁 Files Created

### 1. **services/authService.js**
Authentication service with token management and user operations.

**Key Functions:**
- `login(username, password)` - Authenticate user and store token
- `logout()` - Clear authentication data and redirect
- `isAuthenticated()` - Check if user has valid token
- `getUser()` - Get stored user data
- `hasRole(role)` - Check if user has specific role
- `hasAnyRole(roles)` - Check if user has any of specified roles
- `isAdmin()` - Check if user is admin
- `getCurrentUser()` - Fetch current user from backend

### 2. **services/apiClient.js** (Updated)
Axios client with JWT interceptors for automatic token injection.

**Features:**
- Automatically adds `Authorization: Bearer <token>` header
- Handles 401 (Unauthorized) - clears auth and redirects to login
- Handles 403 (Forbidden) - insufficient permissions
- Global error handling for all API requests

### 3. **components/ProtectedRoute.jsx**
Route protection component for authenticated and role-based access.

**Props:**
- `requireRole` - Single required role (e.g., 'ROLE_ADMIN')
- `requireAnyRole` - Array of acceptable roles
- `fallback` - Custom component for unauthorized access
- `redirectTo` - Custom redirect path (default: '/')

### 4. **components/Login.jsx**
Production-ready login component with validation and error handling.

**Features:**
- Form validation (client-side)
- Loading states
- Error messages (API and validation)
- Keyboard support (Enter to submit)
- Auto-redirect if already authenticated
- Responsive design with Tailwind CSS

### 5. **contexts/AuthContext.jsx**
Global authentication context using React Context API.

**Provides:**
- `user` - Current user object
- `isAuthenticated` - Authentication status
- `isLoading` - Loading state
- `login(username, password)` - Login function
- `logout()` - Logout function
- `hasRole(role)` - Role checking
- `isAdmin()` - Admin checking
- `getDisplayName()` - User display name

---

## 🚀 Quick Start

### Step 1: Install Dependencies (if needed)
```bash
npm install axios
```

### Step 2: Set Environment Variable
Create `.env` file in project root:
```env
VITE_API_BASE_URL=http://localhost:8080/api
```

### Step 3: Wrap App with AuthProvider
Update `App.jsx` or `index.jsx`:

```jsx
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';

function App() {
  return (
    <AuthProvider>
      <YourApp />
    </AuthProvider>
  );
}
```

### Step 4: Use Login Component
```jsx
import Login from './components/Login';

function LoginPage() {
  const handleLoginSuccess = (userData) => {
    console.log('Login successful:', userData);
    // Redirect or update app state
    window.location.href = '/dashboard';
  };

  return <Login onLoginSuccess={handleLoginSuccess} />;
}
```

### Step 5: Protect Routes
```jsx
import ProtectedRoute from './components/ProtectedRoute';
import EmployeesPage from './pages/EmployeesPage';

function App() {
  return (
    <ProtectedRoute>
      <EmployeesPage />
    </ProtectedRoute>
  );
}
```

---

## 💻 Usage Examples

### Example 1: Basic Login Flow
```jsx
import { useAuth } from './contexts/AuthContext';
import Login from './components/Login';

function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <Dashboard />;
}
```

### Example 2: Protected Route with Role
```jsx
import ProtectedRoute from './components/ProtectedRoute';
import AdminPanel from './pages/AdminPanel';

function AdminRoute() {
  return (
    <ProtectedRoute requireRole="ROLE_ADMIN">
      <AdminPanel />
    </ProtectedRoute>
  );
}
```

### Example 3: Using Auth Service Directly
```jsx
import { login, logout, isAdmin } from './services/authService';

const handleLogin = async () => {
  try {
    const user = await login('admin', 'password');
    console.log('Logged in:', user);
  } catch (error) {
    console.error('Login failed:', error);
  }
};

const handleLogout = () => {
  logout(); // Clears token and redirects
};

const checkAdmin = () => {
  if (isAdmin()) {
    console.log('User is admin');
  }
};
```

### Example 4: Using Auth Context Hook
```jsx
import { useAuth } from './contexts/AuthContext';

function UserProfile() {
  const { user, logout, isAdmin } = useAuth();

  return (
    <div>
      <h1>Welcome, {user.fullName}</h1>
      <p>Email: {user.email}</p>
      <p>Roles: {user.roles.join(', ')}</p>
      {isAdmin() && <button>Admin Panel</button>}
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Example 5: Conditional Rendering Based on Role
```jsx
import { useAuth } from './contexts/AuthContext';

function Navigation() {
  const { hasRole, hasAnyRole } = useAuth();

  return (
    <nav>
      <a href="/dashboard">Dashboard</a>
      {hasAnyRole(['ROLE_USER', 'ROLE_ADMIN']) && (
        <a href="/employees">Employees</a>
      )}
      {hasRole('ROLE_ADMIN') && (
        <>
          <a href="/settings">Settings</a>
          <a href="/users">User Management</a>
        </>
      )}
    </nav>
  );
}
```

### Example 6: API Call with Automatic Token
```jsx
import apiClient from './services/apiClient';

// Token is automatically added by interceptor
const fetchEmployees = async () => {
  try {
    const response = await apiClient.get('/employees');
    console.log('Employees:', response.data);
    return response.data;
  } catch (error) {
    // 401 errors automatically handled by interceptor
    console.error('Failed to fetch employees:', error);
  }
};
```

### Example 7: Handling Login Errors
```jsx
import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';

function LoginForm() {
  const { login } = useAuth();
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await login(username, password);
      // Success - AuthProvider updates state
    } catch (err) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      {/* form fields */}
    </form>
  );
}
```

### Example 8: Logout Button
```jsx
import { useAuth } from './contexts/AuthContext';

function LogoutButton() {
  const { logout, getDisplayName } = useAuth();

  return (
    <div>
      <span>Logged in as: {getDisplayName()}</span>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

---

## 🔐 Security Features

### ✅ Implemented
- JWT tokens stored in localStorage
- Automatic token injection in API requests
- Token expiration checking (client-side)
- Automatic logout on 401 errors
- Role-based access control
- Protected routes with role requirements
- Secure password handling (never stored)

### ⚠️ Security Best Practices
1. **Always use HTTPS in production**
2. **Never log tokens** (removed in production build)
3. **Set appropriate token expiration** (backend: 24 hours default)
4. **Clear tokens on logout**
5. **Validate tokens server-side** (backend responsibility)
6. **Use secure password requirements**

---

## 🔄 Authentication Flow

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │ 1. Enter credentials
       ▼
┌─────────────┐
│  Login.jsx  │
└──────┬──────┘
       │ 2. Call login()
       ▼
┌──────────────┐
│ authService  │
└──────┬───────┘
       │ 3. POST /api/auth/login
       ▼
┌──────────────┐
│   Backend    │
└──────┬───────┘
       │ 4. Validate & return JWT
       ▼
┌──────────────┐
│ authService  │
└──────┬───────┘
       │ 5. Store token in localStorage
       │ 6. Store user data
       ▼
┌──────────────┐
│ AuthContext  │
└──────┬───────┘
       │ 7. Update global state
       │ 8. Redirect to dashboard
       ▼
┌──────────────┐
│  Dashboard   │
└──────────────┘

Subsequent API Requests:
┌──────────────┐
│   Component  │
└──────┬───────┘
       │ apiClient.get('/employees')
       ▼
┌──────────────┐
│  Interceptor │ → Add: Authorization: Bearer <token>
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Backend    │
└──────┬───────┘
       │ Validate JWT
       ▼
     Response
```

---

## 🛡️ Error Handling

### 401 Unauthorized
**When**: Token is missing, invalid, or expired
**Action**: 
- Clear localStorage
- Redirect to login page
- Show error message

### 403 Forbidden
**When**: User doesn't have required role/permission
**Action**:
- Show "Access Denied" message
- Keep user logged in
- Don't redirect (user may have access to other pages)

### Network Errors
**When**: Server unreachable
**Action**:
- Show "Network error" message
- Don't log out user
- Allow retry

---

## 📊 File Structure

```
src/
├── components/
│   ├── Login.jsx                    ✅ New - Login component
│   └── ProtectedRoute.jsx           ✅ New - Route protection
├── contexts/
│   ├── AuthContext.jsx              ✅ New - Auth state management
│   └── AppContext.tsx               (existing)
├── services/
│   ├── authService.js               ✅ New - Auth operations
│   ├── apiClient.js                 ✅ Updated - JWT interceptors
│   ├── employeeService.js           (existing)
│   └── ...                          (other services)
└── pages/
    ├── LoginPage.tsx                (can be replaced with Login.jsx)
    ├── EmployeesPage.tsx            (existing)
    └── ...                          (other pages)
```

---

## 🧪 Testing

### Test Login
```bash
# 1. Start backend
cd backend && mvn spring-boot:run

# 2. Register test user (if not exists)
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"test123","fullName":"Test User"}'

# 3. Start frontend
npm run dev

# 4. Navigate to http://localhost:5173
# 5. Login with testuser / test123
```

### Test Protected Routes
1. Login successfully
2. Open DevTools → Application → Local Storage
3. Verify `auth_token` and `auth_user` are stored
4. Navigate to protected pages
5. Logout and verify redirect to login

### Test Token Expiration
1. Login successfully
2. In DevTools Console: `localStorage.setItem('auth_token', 'invalid')`
3. Try to access protected endpoint
4. Should redirect to login with error

---

## 🔧 Configuration

### Environment Variables
```env
# .env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_API_TIMEOUT=30000
```

### Token Storage Keys
```javascript
// services/authService.js
const TOKEN_KEY = 'auth_token';      // JWT token
const USER_KEY = 'auth_user';        // User data
```

### Backend Configuration
```properties
# backend/src/main/resources/application.properties
jwt.secret=your-secret-key-min-32-chars
jwt.expiration=86400000  # 24 hours
```

---

## ⚡ Performance Tips

1. **Lazy Load Login**: Only load Login component when needed
2. **Memoize Auth Context**: Use `useMemo` for expensive operations
3. **Optimize Re-renders**: Use `React.memo` for auth-dependent components
4. **Cache User Data**: Store user data to avoid re-fetching
5. **Token Refresh**: Implement refresh tokens for long sessions (optional)

---

## 🐛 Troubleshooting

### Issue: "Network error - Unable to reach server"
**Solution**: Verify backend is running on correct port (8080)

### Issue: Token not being sent with requests
**Solution**: Check apiClient.js interceptor is configured correctly

### Issue: Redirecting to login on every request
**Solution**: Check token is stored in localStorage with correct key

### Issue: "Access Denied" for valid user
**Solution**: Verify user has correct roles in backend

### Issue: CORS errors
**Solution**: Update backend CORS configuration to allow frontend origin

---

## 📚 API Reference

### authService.js

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `login` | username, password | Promise\<Object\> | Login user |
| `logout` | - | void | Logout and redirect |
| `isAuthenticated` | - | boolean | Check if authenticated |
| `getUser` | - | Object\|null | Get user data |
| `getToken` | - | string\|null | Get JWT token |
| `hasRole` | role | boolean | Check role |
| `hasAnyRole` | roles[] | boolean | Check any role |
| `isAdmin` | - | boolean | Check if admin |

### AuthContext Hook

| Property/Method | Type | Description |
|----------------|------|-------------|
| `user` | Object\|null | Current user |
| `isAuthenticated` | boolean | Auth status |
| `isLoading` | boolean | Loading state |
| `login` | Function | Login method |
| `logout` | Function | Logout method |
| `hasRole` | Function | Check role |
| `isAdmin` | Function | Check admin |

---

## 🎓 Next Steps

1. ✅ **Test Login Flow**: Verify login works end-to-end
2. ✅ **Protect All Routes**: Wrap pages with ProtectedRoute
3. ⏳ **Add Remember Me**: Implement persistent sessions
4. ⏳ **Refresh Tokens**: Add token refresh mechanism
5. ⏳ **Password Reset**: Implement forgot password flow
6. ⏳ **Profile Management**: Add user profile editing
7. ⏳ **Audit Logging**: Track login/logout events

---

## 📞 Support

For issues or questions:
- Backend Security Guide: `backend/SECURITY-JWT-GUIDE.md`
- Backend Quick Reference: `backend/SECURITY-QUICK-REF.md`
- API Documentation: Check backend README.md

---

**Status**: ✅ Complete and Ready for Testing  
**Created**: January 26, 2025  
**Version**: 1.0.0
