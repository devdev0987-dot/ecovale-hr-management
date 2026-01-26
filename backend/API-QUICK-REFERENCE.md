# API Versioning & OpenAPI Quick Reference

## 🚀 Quick Access

| Resource | URL |
|----------|-----|
| **Swagger UI** | http://localhost:8080/swagger-ui.html |
| **OpenAPI JSON** | http://localhost:8080/v3/api-docs |
| **OpenAPI YAML** | http://localhost:8080/v3/api-docs.yaml |
| **Health Check** | http://localhost:8080/actuator/health |

---

## 📍 API Versioning

### All Endpoints Now Use v1 Prefix

```
OLD: /api/employees          ❌
NEW: /api/v1/employees       ✅

OLD: /api/leaves             ❌
NEW: /api/v1/leaves          ✅

OLD: /api/auth/login         ❌
NEW: /api/v1/auth/login      ✅
```

### Frontend Update Required

**Before:**
```javascript
const BASE_URL = 'http://localhost:8080/api';
```

**After:**
```javascript
const BASE_URL = 'http://localhost:8080/api/v1';
```

---

## 🔐 Using Swagger UI

### Step 1: Start Backend
```bash
cd backend
mvn spring-boot:run
```

### Step 2: Open Swagger UI
Navigate to: http://localhost:8080/swagger-ui.html

### Step 3: Authenticate
1. Click **"Authorize"** button (🔒 icon, top right)
2. Login first at `/api/v1/auth/login` to get JWT token
3. Copy the token value (without "Bearer" prefix)
4. Paste into "Value" field
5. Click **"Authorize"**
6. Click **"Close"**

### Step 4: Test Endpoints
- Expand any endpoint
- Click **"Try it out"**
- Fill parameters
- Click **"Execute"**
- View response

---

## 📝 Adding OpenAPI Annotations

### Controller Tag
```java
@RestController
@RequestMapping("/api/v1/leaves")
@Tag(name = "Leave Management", description = "Leave APIs")
@SecurityRequirement(name = "Bearer Authentication")
public class LeaveController {
```

### Operation Documentation
```java
@Operation(
    summary = "Create leave request",
    description = "Submit a new leave request with date validation"
)
@ApiResponses(value = {
    @ApiResponse(responseCode = "201", description = "Created"),
    @ApiResponse(responseCode = "400", description = "Invalid input"),
    @ApiResponse(responseCode = "401", description = "Unauthorized")
})
@PostMapping
public ResponseEntity<?> createLeave(@Valid @RequestBody LeaveRequestDTO dto) {
```

### DTO Schema
```java
@Schema(description = "Leave request creation payload")
public class LeaveRequestDTO {
    
    @Schema(description = "Employee ID", 
            example = "EMP001", 
            required = true,
            minLength = 5,
            maxLength = 20)
    private String employeeId;
```

### Parameter Documentation
```java
@GetMapping("/{id}")
public ResponseEntity<?> getLeave(
    @Parameter(description = "Leave request ID", example = "1")
    @PathVariable Long id) {
```

---

## 🚫 Deprecating an Endpoint

### 1. Add @Deprecated
```java
@Deprecated(since = "v1.2", forRemoval = true)
@GetMapping("/old-endpoint")
public ResponseEntity<?> oldEndpoint() {
```

### 2. Update @Operation
```java
@Operation(
    summary = "Old endpoint (DEPRECATED)",
    description = "⚠️ **DEPRECATED**: Use /api/v2/new-endpoint instead. " +
                  "Removal date: 2026-07-26"
)
```

### 3. Add Deprecation Headers
```java
import com.ecovale.hr.util.DeprecationUtil;

HttpHeaders headers = new HttpHeaders();
DeprecationUtil.addDeprecationHeaders(
    headers,
    ZonedDateTime.parse("2026-07-26T23:59:59Z"),
    "/api/v2/new-endpoint",
    "This endpoint is deprecated"
);

return ResponseEntity.ok()
    .headers(headers)
    .body(result);
```

---

## 🧪 Testing APIs

### Using curl

**Get JWT Token:**
```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}' \
  | jq -r '.data.token')

echo $TOKEN
```

**Call Protected Endpoint:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8080/api/v1/employees
```

**Create Leave Request:**
```bash
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
    "reason": "Personal work"
  }'
```

---

## 📊 Monitoring

### Check Swagger UI Status
```bash
curl http://localhost:8080/swagger-ui.html
# Should return HTML page (200 OK)
```

### Check OpenAPI Spec
```bash
curl http://localhost:8080/v3/api-docs | jq .
```

### Verify API Version
```bash
curl http://localhost:8080/v3/api-docs | jq '.info.version'
# Output: "v1"
```

---

## 🔧 Configuration

### Disable Swagger UI in Production

In `application-prod.properties`:
```properties
springdoc.swagger-ui.enabled=false
springdoc.api-docs.enabled=true  # Keep for client generation
```

### Customize Swagger UI

In `application.properties`:
```properties
springdoc.swagger-ui.path=/swagger-ui.html
springdoc.swagger-ui.operationsSorter=method
springdoc.swagger-ui.tagsSorter=alpha
springdoc.swagger-ui.tryItOutEnabled=true
```

---

## 📚 Documentation Links

- **Full API Guide**: [API-DOCUMENTATION.md](API-DOCUMENTATION.md)
- **Deprecation Policy**: [API-DEPRECATION-STRATEGY.md](API-DEPRECATION-STRATEGY.md)
- **Leave Management**: [LEAVE-MANAGEMENT-GUIDE.md](LEAVE-MANAGEMENT-GUIDE.md)

---

## ⚡ Common Issues

### Issue: Swagger UI shows 404
**Solution**: Ensure dependency is in pom.xml and restart server

### Issue: JWT token not working in Swagger
**Solution**: Use token value only (without "Bearer " prefix)

### Issue: Endpoints not showing in Swagger
**Solution**: Check controller has `@RestController` and correct `@RequestMapping`

### Issue: Schema not showing for DTO
**Solution**: Add `@Schema` annotations to class and fields

---

## 🎯 Checklist for New Endpoints

- [ ] Add `@RequestMapping("/api/v1/...")`
- [ ] Add `@Tag(name = "...")` to controller
- [ ] Add `@Operation(...)` to methods
- [ ] Add `@ApiResponses(...)` for status codes
- [ ] Add `@Schema(...)` to DTOs
- [ ] Add `@Parameter(...)` to path/query params
- [ ] Test in Swagger UI
- [ ] Update CHANGELOG.md

---

**Last Updated**: January 26, 2026  
**Version**: 1.0.0
