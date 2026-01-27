# Spring Security JWT Authentication Guide

## Overview
This guide explains the JWT-based authentication system implemented in the Ecovale HR backend. All API endpoints are protected except the authentication endpoints.

## Architecture

### Components
1. **User & Role Entities**: Database entities for user management
2. **JWT Utility**: Token generation and validation
3. **Authentication Filter**: Intercepts requests and validates tokens
4. **Security Configuration**: Configures Spring Security with JWT
5. **Auth Controller**: Handles login and registration

### Security Flow
```
1. User sends credentials → /api/auth/login
2. Backend validates credentials
3. Backend generates JWT token
4. User receives token in response
5. User includes token in subsequent requests (Authorization: Bearer <token>)
6. JWT Filter validates token on each request
7. Request proceeds to controller with authenticated user context
```

## API Endpoints

### Public Endpoints (No Authentication Required)
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /actuator/health` - Health check

### Protected Endpoints (Authentication Required)
All other endpoints under `/api/**` require a valid JWT token.

## Authentication Endpoints

### 1. Login
**Endpoint**: `POST /api/auth/login`

**Request Body**:
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Success Response** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "type": "Bearer",
  "id": 1,
  "username": "admin",
  "email": "admin@ecovale.com",
  "fullName": "Admin User",
  "roles": ["ROLE_ADMIN"]
}
```

**Error Response** (401 Unauthorized):
```json
{
  "success": false,
  "message": "Invalid username or password"
}
```

### 2. Register
**Endpoint**: `POST /api/auth/register`

**Request Body**:
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123",
  "fullName": "John Doe",
  "roles": ["ROLE_USER"]
}
```

**Success Response** (201 Created):
```json
{
  "success": true,
  "message": "User registered successfully"
}
```

**Error Responses**:
- 400 Bad Request: Username or email already exists
```json
{
  "success": false,
  "message": "Username is already taken"
}
```

### 3. Get Current User
**Endpoint**: `GET /api/auth/me`

**Headers**: 
```
Authorization: Bearer <token>
```

**Success Response** (200 OK):
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@ecovale.com",
  "fullName": "Admin User",
  "roles": ["ROLE_ADMIN"]
}
```

## Role-Based Access Control

### Available Roles
- `ROLE_USER`: Regular user with read access
- `ROLE_ADMIN`: Administrator with full access

### Controller Authorization Examples

#### Employee Controller
- **Create Employee**: `@PreAuthorize("hasRole('ADMIN')")` - ADMIN only
- **Update Employee**: `@PreAuthorize("hasRole('ADMIN')")` - ADMIN only
- **Delete Employee**: `@PreAuthorize("hasRole('ADMIN')")` - ADMIN only
- **Get/Search Employees**: `@PreAuthorize("hasAnyRole('USER', 'ADMIN')")` - USER or ADMIN

#### Recommended Authorization Pattern
```java
@PostMapping
@PreAuthorize("hasRole('ADMIN')")
public ResponseEntity<?> create(...) { }

@GetMapping
@PreAuthorize("hasAnyRole('USER', 'ADMIN')")
public ResponseEntity<?> getAll() { }

@PutMapping("/{id}")
@PreAuthorize("hasRole('ADMIN')")
public ResponseEntity<?> update(...) { }

@DeleteMapping("/{id}")
@PreAuthorize("hasRole('ADMIN')")
public ResponseEntity<?> delete(...) { }
```

## Frontend Integration

### 1. Login Flow
```javascript
// services/authService.js
import apiClient from './apiClient';

export const login = async (username, password) => {
  const response = await apiClient.post('/auth/login', {
    username,
    password
  });
  
  // Store token in localStorage
  localStorage.setItem('token', response.data.token);
  localStorage.setItem('user', JSON.stringify(response.data));
  
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

export const getToken = () => {
  return localStorage.getItem('token');
};
```

### 2. Update API Client to Send Token
```javascript
// services/apiClient.js
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add token to all requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### 3. Protected Route Component
```javascript
// components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { getCurrentUser } from '../services/authService';

const ProtectedRoute = ({ children, requiredRole }) => {
  const user = getCurrentUser();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (requiredRole && !user.roles.includes(requiredRole)) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  return children;
};

export default ProtectedRoute;
```

### 4. Login Component Example
```javascript
// components/LoginPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/authService';

const LoginPage = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await login(credentials.username, credentials.password);
      console.log('Login successful:', response);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Username"
        value={credentials.username}
        onChange={(e) => setCredentials({...credentials, username: e.target.value})}
      />
      <input
        type="password"
        placeholder="Password"
        value={credentials.password}
        onChange={(e) => setCredentials({...credentials, password: e.target.value})}
      />
      {error && <div className="error">{error}</div>}
      <button type="submit">Login</button>
    </form>
  );
};

export default LoginPage;
```

## Configuration

### application.properties
```properties
# JWT Configuration
jwt.secret=${JWT_SECRET:ecovale-hr-secret-key-change-in-production-minimum-32-characters}
jwt.expiration=${JWT_EXPIRATION:86400000}
# JWT expiration: 86400000 ms = 24 hours
```

### Environment Variables
Create a `.env` file in the backend root:
```properties
JWT_SECRET=your-super-secret-key-at-least-32-characters-long
JWT_EXPIRATION=86400000
```

**IMPORTANT**: Always use a strong, random secret in production. Generate one using:
```bash
openssl rand -base64 32
```

## Testing with cURL

### 1. Register a User
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@ecovale.com",
    "password": "admin123",
    "fullName": "Admin User",
    "roles": ["ROLE_ADMIN"]
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

**Save the token from response:**
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. Access Protected Endpoint
```bash
curl -X GET http://localhost:8080/api/employees \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Test Unauthorized Access (without token)
```bash
curl -X GET http://localhost:8080/api/employees
# Expected: 403 Forbidden
```

## Testing with Postman

### 1. Create Environment
Create a Postman environment with variables:
- `base_url`: `http://localhost:8080/api`
- `token`: (will be set automatically)

### 2. Login Request
**POST** `{{base_url}}/auth/login`
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Tests Tab** (to save token):
```javascript
if (pm.response.code === 200) {
    var jsonData = pm.response.json();
    pm.environment.set("token", jsonData.token);
}
```

### 3. Protected Request
**GET** `{{base_url}}/employees`

**Headers**:
```
Authorization: Bearer {{token}}
```

## Database Schema

The security system creates two new tables:

### users table
```sql
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    account_non_expired BOOLEAN NOT NULL DEFAULT TRUE,
    account_non_locked BOOLEAN NOT NULL DEFAULT TRUE,
    credentials_non_expired BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    last_login_at TIMESTAMP
);
```

### roles table
```sql
CREATE TABLE roles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(20) UNIQUE NOT NULL,
    description VARCHAR(200)
);
```

### user_roles junction table
```sql
CREATE TABLE user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);
```

## Initial Setup

### 1. Start the Application
The tables will be created automatically (ddl-auto=update).

### 2. Create Initial Admin User
Use the `/api/auth/register` endpoint or directly insert into database:

```sql
-- Insert roles (if not exists)
INSERT INTO roles (name, description) VALUES 
    ('ROLE_ADMIN', 'Administrator with full access'),
    ('ROLE_USER', 'Regular user with read access');

-- Create admin user (password: admin123)
-- BCrypt hash generated with: new BCryptPasswordEncoder().encode("admin123")
INSERT INTO users (username, email, password, full_name, enabled, account_non_expired, 
                   account_non_locked, credentials_non_expired, created_at, updated_at) 
VALUES ('admin', 'admin@ecovale.com', 
        '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG',
        'Admin User', TRUE, TRUE, TRUE, TRUE, NOW(), NOW());

-- Assign admin role to admin user
INSERT INTO user_roles (user_id, role_id) 
SELECT u.id, r.id FROM users u, roles r 
WHERE u.username = 'admin' AND r.name = 'ROLE_ADMIN';
```

## Common Issues & Solutions

### 1. "Access Denied" (403 Forbidden)
**Cause**: User doesn't have required role
**Solution**: Check user roles in JWT token and controller @PreAuthorize annotation

### 2. "Unauthorized" (401)
**Cause**: Token missing, expired, or invalid
**Solution**: 
- Check if token is sent in Authorization header
- Verify token hasn't expired (default: 24 hours)
- Re-login to get a new token

### 3. CORS Errors
**Cause**: Frontend origin not allowed
**Solution**: Update `SecurityConfig.corsConfigurationSource()` to include your frontend URL

### 4. Token Not Being Sent
**Cause**: API client not configured to send Authorization header
**Solution**: Update apiClient request interceptor to include token

### 5. BCrypt Password Encoding Issues
**Cause**: Password not properly encoded
**Solution**: Always use `passwordEncoder.encode()` when setting passwords

## Security Best Practices

1. **Strong JWT Secret**: Use at least 32 characters, randomly generated
2. **HTTPS in Production**: Always use HTTPS to prevent token interception
3. **Token Expiration**: Set appropriate expiration time (24 hours is default)
4. **Refresh Tokens**: Consider implementing refresh tokens for long-lived sessions
5. **Password Policy**: Enforce strong passwords (min 8 chars, complexity rules)
6. **Rate Limiting**: Add rate limiting to login endpoint to prevent brute force
7. **Account Lockout**: Implement account lockout after failed login attempts
8. **Audit Logging**: Log authentication events (login, logout, failed attempts)
9. **Secure Storage**: Never store passwords in plain text (use BCrypt)
10. **Environment Variables**: Never commit secrets to version control

## Next Steps

1. ✅ Basic JWT authentication implemented
2. ✅ Role-based access control with @PreAuthorize
3. 🔄 Add refresh token mechanism
4. 🔄 Implement password reset functionality
5. 🔄 Add email verification for registration
6. 🔄 Implement account lockout after failed attempts
7. 🔄 Add audit logging for security events
8. 🔄 Implement rate limiting on auth endpoints

## Resources

- [Spring Security Documentation](https://docs.spring.io/spring-security/reference/)
- [JWT.io](https://jwt.io/) - JWT debugger
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
