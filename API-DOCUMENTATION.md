# API Documentation & Versioning Guide

## 📚 Overview

This document provides comprehensive guidance on accessing, using, and maintaining the Ecovale HR Management System REST API with proper versioning and OpenAPI documentation.

---

## 🚀 Quick Start

### Accessing API Documentation

**Swagger UI (Interactive):**
```
http://localhost:8080/swagger-ui.html
```

**OpenAPI JSON Specification:**
```
http://localhost:8080/v3/api-docs
```

**OpenAPI YAML Specification:**
```
http://localhost:8080/v3/api-docs.yaml
```

### Environment URLs

| Environment | Base URL | Swagger UI |
|------------|----------|------------|
| Local Development | `http://localhost:8080` | `http://localhost:8080/swagger-ui.html` |
| Development | `https://api-dev.ecovale.com` | `https://api-dev.ecovale.com/swagger-ui.html` |
| Staging | `https://api-staging.ecovale.com` | `https://api-staging.ecovale.com/swagger-ui.html` |
| Production | `https://api.ecovale.com` | `https://api.ecovale.com/swagger-ui.html` |

---

## 📌 API Versioning Strategy

### Current Version: v1

All API endpoints are prefixed with `/api/v1`:

```
/api/v1/auth/*           - Authentication endpoints
/api/v1/employees/*      - Employee management
/api/v1/leaves/*         - Leave management
/api/v1/attendance/*     - Attendance tracking
/api/v1/loans/*          - Loan management
/api/v1/advances/*       - Advance payment management
/api/v1/designations/*   - Designation management
/api/v1/admin/*          - Admin operations
```

### Versioning Principles

1. **Backward Compatibility**: Minor changes don't require new version
2. **Breaking Changes**: Require new major version (v2, v3, etc.)
3. **Parallel Versions**: Multiple versions can coexist during migration period
4. **Sunset Period**: Minimum 6 months notice before removing old version

### What Constitutes a Breaking Change?

**Breaking Changes (require new version):**
- Removing endpoints
- Removing request/response fields
- Changing field types
- Changing authentication mechanism
- Changing HTTP status codes for existing scenarios
- Changing error response format

**Non-Breaking Changes (can be added to current version):**
- Adding new endpoints
- Adding optional request fields
- Adding new response fields
- Adding new HTTP headers
- Adding new query parameters (optional)
- Bug fixes that don't change contract

---

## 🔐 Authentication

All protected endpoints require JWT Bearer token authentication.

### Obtaining Access Token

**Endpoint:** `POST /api/v1/auth/login`

**Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "type": "Bearer",
    "id": 1,
    "username": "admin",
    "email": "admin@ecovale.com",
    "fullName": "Admin User",
    "roles": ["ROLE_ADMIN", "ROLE_HR"]
  }
}
```

### Using the Token

Include in `Authorization` header:

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
     https://api.ecovale.com/api/v1/employees
```

### Token Expiration

- **Access Token**: 24 hours
- **Refresh Token**: 7 days (if implemented)

---

## 📖 API Documentation Standards

### Request/Response Format

All responses follow this standard structure:

```json
{
  "success": boolean,
  "message": "string",
  "data": object | array | null
}
```

**Success Response (200/201):**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    "id": 1,
    "name": "John Doe"
  }
}
```

**Error Response (4xx/5xx):**
```json
{
  "success": false,
  "message": "Error description",
  "data": null
}
```

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT, DELETE |
| 201 | Created | Successful POST (resource created) |
| 400 | Bad Request | Validation error, invalid input |
| 401 | Unauthorized | Missing/invalid JWT token |
| 403 | Forbidden | Valid token but insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |

### Pagination (Future Enhancement)

When implemented, paginated endpoints will support:

```
GET /api/v1/employees?page=0&size=20&sort=name,asc
```

**Response:**
```json
{
  "success": true,
  "message": "Employees retrieved",
  "data": {
    "content": [...],
    "page": 0,
    "size": 20,
    "totalElements": 150,
    "totalPages": 8
  }
}
```

---

## 🔍 Using Swagger UI

### 1. Navigate to Swagger UI
Open `http://localhost:8080/swagger-ui.html` in your browser.

### 2. Authenticate
1. Click **"Authorize"** button (top right)
2. Enter your JWT token (without "Bearer" prefix)
3. Click **"Authorize"**
4. Click **"Close"**

### 3. Explore Endpoints
- Endpoints are grouped by tags (Auth, Employees, Leaves, etc.)
- Click on an endpoint to expand details
- View request/response schemas
- See example values

### 4. Try It Out
1. Click **"Try it out"** button
2. Fill in required parameters
3. Click **"Execute"**
4. View response below

### 5. Copy curl Command
After execution, copy the generated curl command for CLI usage.

---

## 📋 OpenAPI Schema Annotations

### DTO Schema Example

```java
@Schema(description = "Employee creation request")
public class EmployeeRequestDTO {
    
    @Schema(description = "Employee unique identifier", 
            example = "EMP001", 
            required = true,
            minLength = 5,
            maxLength = 20)
    private String employeeId;
    
    @Schema(description = "Employee full name", 
            example = "John Doe",
            required = true)
    private String name;
    
    @Schema(description = "Employee email address",
            example = "john.doe@ecovale.com",
            format = "email",
            required = true)
    private String email;
}
```

### Controller Operation Example

```java
@Operation(
    summary = "Create employee",
    description = "Register a new employee in the system with validation"
)
@ApiResponses(value = {
    @ApiResponse(responseCode = "201", description = "Employee created"),
    @ApiResponse(responseCode = "400", description = "Invalid input"),
    @ApiResponse(responseCode = "409", description = "Employee already exists")
})
@PostMapping
public ResponseEntity<ApiResponse<EmployeeResponseDTO>> createEmployee(
    @Valid @RequestBody EmployeeRequestDTO request) {
    // Implementation
}
```

---

## 🚫 API Deprecation Strategy

### Deprecation Policy

When deprecating an API endpoint or field:

1. **Announcement**: 6 months notice via release notes
2. **Marking**: Add `@Deprecated` annotation
3. **Documentation**: Update API docs with deprecation notice
4. **Sunset Header**: Include `Sunset` HTTP header with removal date
5. **Alternative**: Provide migration guide to new endpoint
6. **Removal**: Remove after sunset date

### Deprecation Example

**Deprecated Endpoint:**
```java
@Deprecated(since = "v1.2", forRemoval = true)
@Operation(
    summary = "Get employee (DEPRECATED)",
    description = "⚠️ DEPRECATED: Use GET /api/v2/employees/{id} instead. " +
                  "This endpoint will be removed on 2026-07-26."
)
@GetMapping("/employee/{id}")
public ResponseEntity<ApiResponse<EmployeeResponseDTO>> getEmployeeOld(
    @PathVariable String id) {
    // Add Sunset header
    HttpHeaders headers = new HttpHeaders();
    headers.add("Sunset", "Sat, 26 Jul 2026 23:59:59 GMT");
    headers.add("Deprecation", "true");
    headers.add("Link", "</api/v2/employees>; rel=\"alternate\"");
    
    return ResponseEntity.ok()
        .headers(headers)
        .body(service.getEmployee(id));
}
```

**Client Detection:**
```bash
# Response includes deprecation headers
HTTP/1.1 200 OK
Sunset: Sat, 26 Jul 2026 23:59:59 GMT
Deprecation: true
Link: </api/v2/employees>; rel="alternate"
```

### Migration Timeline Example

| Date | Action |
|------|--------|
| 2026-01-26 | Announce deprecation of `/api/v1/old-endpoint` |
| 2026-02-01 | Add `@Deprecated` annotation and Sunset headers |
| 2026-02-15 | Release `/api/v2/new-endpoint` as replacement |
| 2026-03-01 | Update all internal clients to use v2 |
| 2026-06-01 | Send final reminder to external clients |
| 2026-07-26 | Remove deprecated endpoint |

---

## 📊 API Rate Limiting

### Current Limits

- **100 requests per minute** per IP address
- Applies to all authenticated endpoints

### Headers

**Request:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706265600
```

**Rate Limit Exceeded (429):**
```json
{
  "success": false,
  "message": "Rate limit exceeded. Please try again later.",
  "data": null
}
```

**Retry-After Header:**
```
Retry-After: 60
```

---

## 🧪 Testing APIs

### Using curl

**Login:**
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123"
  }'
```

**Create Leave Request:**
```bash
TOKEN="your-jwt-token"

curl -X POST http://localhost:8080/api/v1/leaves \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP001",
    "employeeName": "John Doe",
    "employeeEmail": "john@ecovale.com",
    "leaveType": "CASUAL_LEAVE",
    "startDate": "2026-02-15",
    "endDate": "2026-02-17",
    "reason": "Personal work and family commitment",
    "reportingManager": "manager1",
    "department": "IT"
  }'
```

### Using Postman

1. **Import OpenAPI Spec:**
   - File → Import → Link → `http://localhost:8080/v3/api-docs`

2. **Set Authorization:**
   - Collection → Authorization → Bearer Token
   - Enter JWT token

3. **Set Environment Variables:**
   - Create variable `baseUrl`: `http://localhost:8080`
   - Create variable `token`: `your-jwt-token`

---

## 🔄 Version Migration Guide

### Migrating from Unversioned to v1

**Before:**
```
POST /api/employees
GET /api/leaves
```

**After:**
```
POST /api/v1/employees
GET /api/v1/leaves
```

**Update all client code:**
```javascript
// Before
const BASE_URL = 'http://localhost:8080/api';

// After
const BASE_URL = 'http://localhost:8080/api/v1';
```

### Future v2 Migration (Example)

When v2 is released:

```javascript
// Support both versions during migration
const API_VERSION = process.env.API_VERSION || 'v1';
const BASE_URL = `http://localhost:8080/api/${API_VERSION}`;

// Gradually migrate endpoints
const employeesUrl = `${BASE_URL}/employees`; // Uses v1 or v2
```

---

## 📦 OpenAPI Code Generation

### Generate Client SDKs

**Java:**
```bash
openapi-generator-cli generate \
  -i http://localhost:8080/v3/api-docs \
  -g java \
  -o ./generated-client/java
```

**TypeScript/Axios:**
```bash
openapi-generator-cli generate \
  -i http://localhost:8080/v3/api-docs \
  -g typescript-axios \
  -o ./generated-client/typescript
```

**Python:**
```bash
openapi-generator-cli generate \
  -i http://localhost:8080/v3/api-docs \
  -g python \
  -o ./generated-client/python
```

---

## 🛡️ Security Considerations

### API Security Best Practices

1. **Always use HTTPS in production**
2. **Never commit JWT tokens to version control**
3. **Rotate JWT secrets regularly**
4. **Implement request signing for critical endpoints**
5. **Use environment variables for configuration**
6. **Monitor for unusual API usage patterns**
7. **Implement IP whitelisting for admin endpoints**

### Secure Configuration

```properties
# application-prod.properties
springdoc.swagger-ui.enabled=false  # Disable Swagger UI in production
springdoc.api-docs.enabled=true     # Keep OpenAPI docs for client generation
```

---

## 📞 Support & Feedback

### API Issues

- **Email**: api-support@ecovale.com
- **Slack**: #api-support
- **Issue Tracker**: https://github.com/ecovale/hr-api/issues

### API Changelog

- **Location**: `CHANGELOG.md` in repository root
- **Format**: Keep a Changelog (https://keepachangelog.com/)
- **Versioning**: Semantic Versioning (https://semver.org/)

---

## 🎯 Best Practices

### For API Consumers

1. **Version Pin**: Always specify API version in base URL
2. **Error Handling**: Check `success` field before processing `data`
3. **Token Refresh**: Implement token refresh before expiry
4. **Retry Logic**: Implement exponential backoff for 429/500 errors
5. **Monitor Deprecations**: Check `Sunset` and `Deprecation` headers
6. **Use SDK**: Generate client SDK from OpenAPI spec

### For API Developers

1. **Document Everything**: Use `@Operation`, `@Schema` annotations
2. **Follow REST Conventions**: Use appropriate HTTP methods and status codes
3. **Validate Input**: Use `@Valid` and validation annotations
4. **Consistent Responses**: Always use `ApiResponse<T>` wrapper
5. **Audit Trail**: Log all state-changing operations
6. **Security First**: Use `@PreAuthorize` for all endpoints

---

## 🔗 Related Documentation

- [LEAVE-MANAGEMENT-GUIDE.md](LEAVE-MANAGEMENT-GUIDE.md) - Leave module API details
- [README.md](README.md) - Project setup and overview
- [SECURITY.md](SECURITY.md) - Security configuration details

---

**Last Updated**: January 26, 2026  
**API Version**: v1  
**Document Version**: 1.0.0
