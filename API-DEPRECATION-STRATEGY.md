# API Deprecation Strategy & Guidelines

## 📋 Overview

This document outlines the strategy, process, and best practices for deprecating API endpoints in the Ecovale HR Management System. Following a consistent deprecation strategy ensures smooth transitions for API consumers while allowing the API to evolve.

---

## 🎯 Deprecation Policy

### Core Principles

1. **Advance Notice**: Minimum **6 months** notice before removal
2. **Clear Communication**: Multiple channels for announcing deprecations
3. **Migration Support**: Provide clear migration guides and alternative endpoints
4. **Parallel Operation**: Old and new versions coexist during transition
5. **Graceful Degradation**: Deprecated endpoints remain functional until sunset

### Deprecation Timeline

```
┌─────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│   Month 0   │   Month 1    │   Month 3    │   Month 5    │   Month 6    │
├─────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Announce    │ Add Headers  │ Send         │ Final        │ Remove       │
│ Deprecation │ & @Deprecated│ Reminders    │ Warning      │ Endpoint     │
└─────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

---

## 🚨 What Triggers Deprecation?

### Breaking Changes Requiring Deprecation

1. **Endpoint Removal**: Deleting an API endpoint
2. **Field Removal**: Removing required or commonly-used response fields
3. **Type Changes**: Changing data types (String → Integer, etc.)
4. **Behavior Changes**: Significant change in endpoint behavior
5. **Security Updates**: Major authentication/authorization changes
6. **Performance Issues**: Endpoint replaced due to scalability concerns

### Non-Breaking Changes (No Deprecation Required)

1. **Adding Endpoints**: New endpoints don't affect existing ones
2. **Adding Optional Fields**: New optional request/response fields
3. **Bug Fixes**: Fixes that don't change API contract
4. **Performance Improvements**: Internal optimizations
5. **Documentation Updates**: Clarifications and examples

---

## 📢 Deprecation Process

### Step 1: Announcement (Month 0)

**Actions:**
- Add to CHANGELOG.md
- Send email to API consumers
- Post on developer portal
- Update Slack/Teams channels

**Announcement Template:**
```markdown
## API Deprecation Notice

**Endpoint**: `POST /api/v1/old-endpoint`
**Deprecation Date**: 2026-01-26
**Sunset Date**: 2026-07-26 (6 months)
**Reason**: Performance improvements and better data model
**Alternative**: `POST /api/v2/new-endpoint`

### Migration Guide
See [Migration Guide](#migration-from-v1-to-v2) for step-by-step instructions.

### Support
Contact api-support@ecovale.com for assistance.
```

### Step 2: Code Implementation (Month 1)

**Add @Deprecated Annotation:**
```java
@Deprecated(since = "v1.2", forRemoval = true)
@Operation(
    summary = "Get employee (DEPRECATED)",
    description = "⚠️ **DEPRECATED**: This endpoint will be removed on 2026-07-26. " +
                  "Use `GET /api/v2/employees/{id}` instead.\n\n" +
                  "**Migration Guide**: [Link to migration guide]\n\n" +
                  "**Reason**: Improved performance and better response structure."
)
@GetMapping("/old-endpoint/{id}")
public ResponseEntity<ApiResponse<OldDTO>> oldEndpoint(@PathVariable String id) {
    // Add deprecation headers
    HttpHeaders headers = new HttpHeaders();
    DeprecationUtil.addDeprecationHeaders(
        headers,
        ZonedDateTime.parse("2026-07-26T23:59:59Z"),
        "/api/v2/new-endpoint",
        "This endpoint is deprecated. Use /api/v2/new-endpoint instead."
    );
    
    // Log deprecation usage
    log.warn("DEPRECATED ENDPOINT CALLED: /old-endpoint/{} by user {}", 
             id, getCurrentUsername());
    
    // Execute existing logic
    OldDTO result = service.getData(id);
    
    return ResponseEntity.ok()
        .headers(headers)
        .body(ApiResponse.success(result));
}
```

**Response Headers Added:**
```http
HTTP/1.1 200 OK
Sunset: Sat, 26 Jul 2026 23:59:59 GMT
Deprecation: true
Link: </api/v2/new-endpoint>; rel="alternate"
X-API-Deprecation-Message: This endpoint is deprecated...
X-API-Deprecation-Version: v1.2
Warning: 299 - "This endpoint is deprecated..."
```

### Step 3: Monitoring & Reminders (Month 3)

**Track Deprecated Endpoint Usage:**
```java
// Add custom metric
@Timed(value = "api.deprecated.calls", 
       description = "Calls to deprecated endpoints")
public ResponseEntity<?> deprecatedEndpoint() {
    // Implementation
}
```

**Prometheus Query:**
```promql
# Count calls to deprecated endpoints
sum(api_deprecated_calls_total) by (endpoint, user)

# Alert if usage is still high
api_deprecated_calls_total > 100
```

**Send Mid-Point Reminder:**
- Email active API consumers
- Show usage statistics
- Offer migration assistance

### Step 4: Final Warning (Month 5)

**Actions:**
- Send final email notification
- Update API documentation with prominent warnings
- Contact users still calling deprecated endpoints
- Offer 1-on-1 migration support

**Email Template:**
```
Subject: FINAL NOTICE: API Endpoint Removal in 30 Days

Dear API Consumer,

This is your final notice that the following endpoint will be removed:

Endpoint: POST /api/v1/old-endpoint
Sunset Date: July 26, 2026 (30 days from now)
Your Usage: 150 calls in the last 30 days

Action Required:
Migrate to: POST /api/v2/new-endpoint

Need help? Reply to this email or schedule a call:
https://calendly.com/ecovale-api-support

Best regards,
Ecovale API Team
```

### Step 5: Removal (Month 6)

**Remove Endpoint:**
```java
// Delete entire method from controller
// OR return 410 Gone for grace period

@GetMapping("/old-endpoint/{id}")
public ResponseEntity<?> oldEndpointRemoved() {
    return ResponseEntity
        .status(HttpStatus.GONE)
        .body(ApiResponse.error(
            "This endpoint has been removed. Use /api/v2/new-endpoint instead."
        ));
}
```

**Post-Removal:**
- Update CHANGELOG.md
- Send confirmation email
- Monitor for 404/410 errors
- Keep 410 response for 1 month minimum

---

## 🔧 Implementation Examples

### Example 1: Field Deprecation

**Old Response:**
```json
{
  "id": 1,
  "fullName": "John Doe",
  "employeeCode": "EMP001"
}
```

**New Response (Deprecated Field):**
```json
{
  "id": 1,
  "fullName": "John Doe",
  "employeeCode": "EMP001",  // ⚠️ DEPRECATED: Use 'employeeId' instead
  "employeeId": "EMP001"     // NEW: Replacement for employeeCode
}
```

**Schema Annotation:**
```java
@Schema(description = "Employee unique code",
        deprecated = true,
        example = "EMP001")
@Deprecated
private String employeeCode;

@Schema(description = "Employee unique identifier (replaces employeeCode)",
        example = "EMP001")
private String employeeId;
```

### Example 2: Version-Based Deprecation

**Both versions coexist:**
```java
// v1 - Deprecated
@RestController
@RequestMapping("/api/v1/employees")
@Deprecated
public class EmployeeControllerV1 {
    // Old implementation
}

// v2 - Current
@RestController
@RequestMapping("/api/v2/employees")
public class EmployeeControllerV2 {
    // New implementation
}
```

### Example 3: Parameter Deprecation

**Old Query Parameter:**
```java
@GetMapping("/search")
public ResponseEntity<?> search(
    @RequestParam @Deprecated String employeeCode,  // Deprecated
    @RequestParam(required = false) String employeeId  // New
) {
    // Support both during transition
    String id = employeeId != null ? employeeId : employeeCode;
    
    if (employeeCode != null) {
        log.warn("DEPRECATED PARAMETER: employeeCode used instead of employeeId");
    }
    
    // Process request
}
```

---

## 📊 Monitoring Deprecations

### Logging Deprecated Calls

```java
@Aspect
@Component
public class DeprecationLoggingAspect {
    
    @Around("@annotation(deprecated)")
    public Object logDeprecatedCall(ProceedingJoinPoint joinPoint, Deprecated deprecated) 
            throws Throwable {
        
        String methodName = joinPoint.getSignature().getName();
        String username = SecurityContextHolder.getContext()
            .getAuthentication().getName();
        
        log.warn("DEPRECATED API CALL: {} by user {} at {}", 
                 methodName, username, Instant.now());
        
        // Increment metric
        meterRegistry.counter("api.deprecated.calls",
            "endpoint", methodName,
            "user", username
        ).increment();
        
        return joinPoint.proceed();
    }
}
```

### Grafana Dashboard

**Panel 1: Deprecated Endpoint Calls**
```promql
sum(rate(api_deprecated_calls_total[5m])) by (endpoint)
```

**Panel 2: Top Users of Deprecated APIs**
```promql
topk(10, sum(api_deprecated_calls_total) by (user))
```

**Alert Rule:**
```yaml
alert: HighDeprecatedAPIUsage
expr: sum(rate(api_deprecated_calls_total[1h])) > 10
for: 1h
labels:
  severity: warning
annotations:
  summary: "High usage of deprecated API detected"
```

---

## 📝 Migration Guides

### Template: Migration from v1 to v2

```markdown
# Migration Guide: Employee API v1 → v2

## Overview
Version 2 improves performance and adds new features while maintaining core functionality.

## Breaking Changes

### 1. Endpoint URL Change
**Before (v1):**
```
POST /api/v1/employees
```

**After (v2):**
```
POST /api/v2/employees
```

### 2. Field Rename: `employeeCode` → `employeeId`
**Before (v1):**
```json
{
  "employeeCode": "EMP001",
  "name": "John Doe"
}
```

**After (v2):**
```json
{
  "employeeId": "EMP001",
  "name": "John Doe"
}
```

### 3. Response Structure Change
**Before (v1):**
```json
{
  "data": { ... },
  "status": "success"
}
```

**After (v2):**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

## Migration Steps

1. Update base URL from `/api/v1` to `/api/v2`
2. Replace `employeeCode` with `employeeId` in all requests/responses
3. Update response parsing to handle new structure
4. Test in staging environment
5. Deploy to production

## Code Examples

**JavaScript/Axios:**
```javascript
// Before (v1)
const response = await axios.post('/api/v1/employees', {
  employeeCode: 'EMP001',
  name: 'John Doe'
});

// After (v2)
const response = await axios.post('/api/v2/employees', {
  employeeId: 'EMP001',  // Changed
  name: 'John Doe'
});
```

## Testing Checklist
- [ ] Update API base URL
- [ ] Update field names in requests
- [ ] Update response parsing logic
- [ ] Test authentication flow
- [ ] Test error handling
- [ ] Test in staging
- [ ] Monitor logs after deployment
```

---

## 🎓 Best Practices

### For API Developers

1. **Plan Ahead**: Consider deprecation impact before making changes
2. **Communicate Early**: Announce as soon as deprecation is planned
3. **Provide Alternatives**: Always offer a replacement endpoint
4. **Add Headers**: Use RFC-compliant deprecation headers
5. **Monitor Usage**: Track who's using deprecated endpoints
6. **Assist Migration**: Offer support to heavy users
7. **Document Everything**: Clear migration guides are essential
8. **Test Thoroughly**: Ensure new endpoints work before deprecating old ones

### For API Consumers

1. **Monitor Headers**: Check for `Sunset` and `Deprecation` headers
2. **Subscribe to Updates**: Sign up for API changelog notifications
3. **Test Early**: Don't wait until last minute to migrate
4. **Use Latest Version**: Always use the newest stable API version
5. **Handle Errors Gracefully**: Plan for 410 Gone responses
6. **Report Issues**: Contact support if migration is problematic

---

## 📚 References

- **RFC 8594**: The Sunset HTTP Header Field
  - https://www.rfc-editor.org/rfc/rfc8594.html

- **RFC 8288**: Web Linking (Link header)
  - https://www.rfc-editor.org/rfc/rfc8288.html

- **API Deprecation Best Practices**
  - https://stripe.com/blog/api-versioning
  - https://cloud.google.com/apis/design/versioning

---

## 📞 Support

**Deprecation Questions:**
- Email: api-deprecation@ecovale.com
- Slack: #api-deprecations
- Office Hours: Tuesdays 2-4 PM UTC

**Migration Assistance:**
- Schedule 1-on-1: https://calendly.com/ecovale-api-support
- Documentation: https://docs.ecovale.com/api/migrations

---

**Last Updated**: January 26, 2026  
**Document Version**: 1.0.0
