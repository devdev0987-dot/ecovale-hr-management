# JWT Authentication Quick Reference

## Quick Start

### 1. Register First Admin User
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

**Response:**
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

### 3. Use Token in Requests
```bash
TOKEN="your-token-here"

curl -X GET http://localhost:8080/api/employees \
  -H "Authorization: Bearer $TOKEN"
```

## Roles & Permissions

| Role | Permissions |
|------|------------|
| `ROLE_ADMIN` | Full access - Create, Read, Update, Delete |
| `ROLE_USER` | Read-only access - View data only |

## API Endpoints

### Public (No Auth Required)
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `GET /actuator/health` - Health check

### Protected (Auth Required)
- `GET /api/auth/me` - Get current user info
- All endpoints under `/api/employees`, `/api/attendance`, etc.

## Authorization Patterns

### Admin Only
```java
@PostMapping
@PreAuthorize("hasRole('ADMIN')")
public ResponseEntity<?> create(...) { }
```

### User or Admin
```java
@GetMapping
@PreAuthorize("hasAnyRole('USER', 'ADMIN')")
public ResponseEntity<?> getAll() { }
```

## Frontend Integration

### 1. Create Auth Service
```javascript
// services/authService.js
export const login = async (username, password) => {
  const response = await apiClient.post('/auth/login', { username, password });
  localStorage.setItem('token', response.data.token);
  localStorage.setItem('user', JSON.stringify(response.data));
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getToken = () => localStorage.getItem('token');
```

### 2. Update API Client
```javascript
// services/apiClient.js
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## Configuration

### Environment Variables
```bash
# backend/.env
JWT_SECRET=your-super-secret-key-at-least-32-characters-long
JWT_EXPIRATION=86400000  # 24 hours in milliseconds
```

### Generate Secure Secret
```bash
openssl rand -base64 32
```

## Testing

### With cURL
```bash
# 1. Login and save token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.token')

# 2. Use token
curl -X GET http://localhost:8080/api/employees \
  -H "Authorization: Bearer $TOKEN"
```

### With Postman
1. **POST** `/api/auth/login` with credentials
2. In Tests tab, add:
   ```javascript
   if (pm.response.code === 200) {
       pm.environment.set("token", pm.response.json().token);
   }
   ```
3. Use `{{token}}` in Authorization header for other requests

## Common HTTP Status Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 200 | Success | - |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Check request body validation |
| 401 | Unauthorized | Token missing, expired, or invalid |
| 403 | Forbidden | User doesn't have required role |
| 404 | Not Found | Resource doesn't exist |

## Troubleshooting

### Problem: 401 Unauthorized
**Solutions:**
- Check if token is included in Authorization header
- Verify token format: `Bearer <token>`
- Check if token has expired (re-login)
- Ensure backend JWT secret matches

### Problem: 403 Forbidden
**Solutions:**
- Check user roles in token
- Verify controller @PreAuthorize annotation
- Ensure user has required role (ADMIN or USER)

### Problem: CORS Error
**Solutions:**
- Update `SecurityConfig.corsConfigurationSource()`
- Add frontend URL to allowed origins
- Check if preflight OPTIONS request is allowed

## Security Checklist

- [ ] Change JWT_SECRET in production
- [ ] Use HTTPS in production
- [ ] Set appropriate token expiration
- [ ] Implement refresh tokens
- [ ] Add rate limiting on login endpoint
- [ ] Enable account lockout after failed attempts
- [ ] Log authentication events
- [ ] Never commit secrets to git
- [ ] Use environment variables for sensitive config

## File Structure

```
backend/src/main/java/com/ecovale/hr/
├── config/
│   └── SecurityConfig.java           # Security configuration
├── controller/
│   └── AuthController.java           # Login/register endpoints
├── dto/
│   ├── LoginRequest.java
│   ├── LoginResponse.java
│   └── RegisterRequest.java
├── entity/
│   ├── User.java                     # User entity
│   └── Role.java                     # Role entity
├── repository/
│   ├── UserRepository.java
│   └── RoleRepository.java
└── security/
    ├── JwtUtil.java                  # JWT token utility
    ├── CustomUserDetailsService.java # Load user from DB
    └── JwtAuthenticationFilter.java  # Validate JWT on requests
```

## Default Credentials (Development Only)

After registration, use:
- **Username**: admin
- **Password**: admin123
- **Role**: ROLE_ADMIN

**⚠️ CHANGE THESE IN PRODUCTION!**

## Next Steps

1. Test login endpoint
2. Verify token generation
3. Test protected endpoints with token
4. Update frontend to use authentication
5. Deploy with secure JWT secret
6. Monitor authentication logs

---

📚 **Full Documentation**: See [SECURITY-JWT-GUIDE.md](./SECURITY-JWT-GUIDE.md)
