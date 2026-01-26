# Audit Logging Implementation Guide

Complete guide for the audit logging system that automatically tracks all CREATE, UPDATE, and DELETE operations.

## 🎯 Overview

The audit logging system uses **Spring AOP** to automatically capture database operations and store them in a dedicated `audit_logs` table. Admin users can view and search all audit logs through REST API endpoints.

## 📋 Features

✅ Automatic logging of CREATE, UPDATE, DELETE operations  
✅ Manual logging of LOGIN, LOGOUT, ACCESS_DENIED events  
✅ Stores username, action, entity, timestamp  
✅ Tracks IP address and User-Agent  
✅ AOP-based automatic capture (no code changes needed)  
✅ Asynchronous logging (doesn't slow down operations)  
✅ Admin-only REST endpoints for viewing logs  
✅ Advanced search and filtering  
✅ Audit statistics dashboard  

---

## 📁 Files Created

### 1. **AuditLog.java** - Entity
```
Location: backend/src/main/java/com/ecovale/hr/entity/
Purpose: Database entity for audit logs
```

**Fields:**
- `id` - Primary key
- `username` - Who performed the action
- `action` - CREATE, UPDATE, DELETE, LOGIN, LOGOUT, ACCESS_DENIED
- `entityName` - Name of the entity (Employee, Attendance, etc.)
- `entityId` - ID of the affected entity
- `details` - JSON details of the operation
- `timestamp` - When the action occurred
- `ipAddress` - Client IP address
- `userAgent` - Browser/client information

**Table:**
```sql
CREATE TABLE audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity_name VARCHAR(255) NOT NULL,
    entity_id BIGINT NOT NULL,
    details TEXT,
    timestamp DATETIME NOT NULL,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500)
);
```

### 2. **AuditLogRepository.java** - Repository
```
Location: backend/src/main/java/com/ecovale/hr/repository/
Purpose: Data access for audit logs
```

**Methods:**
- `findAllByOrderByTimestampDesc()` - Get all logs
- `findByUsernameOrderByTimestampDesc()` - Filter by user
- `findByActionOrderByTimestampDesc()` - Filter by action
- `findByEntityNameOrderByTimestampDesc()` - Filter by entity
- `findByEntityNameAndEntityIdOrderByTimestampDesc()` - Entity history
- `searchLogs()` - Multi-filter search
- `countByAction()` - Statistics
- `countTodayLogs()` - Today's activity

### 3. **AuditLogService.java** - Service
```
Location: backend/src/main/java/com/ecovale/hr/service/
Purpose: Business logic for audit logging
```

**Public Methods:**
```java
// Automatic logging (called by AOP)
void logCreate(String entityName, Long entityId, Object entity)
void logUpdate(String entityName, Long entityId, Object oldEntity, Object newEntity)
void logDelete(String entityName, Long entityId, Object entity)

// Manual logging
void logLogin(String username)
void logLogout(String username)
void logAccessDenied(String resource)

// Query methods
Page<AuditLog> getAllLogs(Pageable pageable)
Page<AuditLog> getLogsByUsername(String username, Pageable pageable)
Page<AuditLog> getLogsByAction(AuditAction action, Pageable pageable)
List<AuditLog> getLogsForEntityInstance(String entityName, Long entityId)
Map<String, Long> getAuditStatistics()
```

**Features:**
- Asynchronous logging (doesn't block operations)
- Automatic username extraction from SecurityContext
- Automatic IP address and User-Agent capture
- JSON serialization of entity details

### 4. **AuditAspect.java** - AOP Aspect
```
Location: backend/src/main/java/com/ecovale/hr/aspect/
Purpose: Automatic capture of service layer operations
```

**Pointcuts:**
```java
// CREATE operations
execution(* com.ecovale.hr.service.*.save*(..))
execution(* com.ecovale.hr.service.*.create*(..))
execution(* com.ecovale.hr.service.*.add*(..))

// UPDATE operations
execution(* com.ecovale.hr.service.*.update*(..))
execution(* com.ecovale.hr.service.*.modify*(..))

// DELETE operations
execution(* com.ecovale.hr.service.*.delete*(..))
execution(* com.ecovale.hr.service.*.remove*(..))
```

**How it works:**
1. AOP intercepts service method calls
2. Extracts entity name from service class name
3. Extracts entity ID from result or arguments
4. Calls AuditLogService to create log entry
5. All happens automatically after method execution

### 5. **AuditLogController.java** - REST Controller
```
Location: backend/src/main/java/com/ecovale/hr/controller/
Purpose: Admin-only API endpoints for viewing logs
Secured: @PreAuthorize("hasRole('ADMIN')")
```

**Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/audit-logs` | GET | Get all logs (paginated) |
| `/api/admin/audit-logs/user/{username}` | GET | Logs by username |
| `/api/admin/audit-logs/action/{action}` | GET | Logs by action |
| `/api/admin/audit-logs/entity/{entityName}` | GET | Logs by entity type |
| `/api/admin/audit-logs/entity/{entityName}/{entityId}` | GET | History of specific entity |
| `/api/admin/audit-logs/search` | GET | Advanced search with filters |
| `/api/admin/audit-logs/statistics` | GET | Audit statistics |
| `/api/admin/audit-logs/actions` | GET | Available action types |

### 6. **AuditLogResponseDTO.java** - DTO
```
Location: backend/src/main/java/com/ecovale/hr/dto/
Purpose: Response format for audit logs
```

### 7. **AsyncConfig.java** - Configuration
```
Location: backend/src/main/java/com/ecovale/hr/config/
Purpose: Enable async logging
```

---

## 🔧 Configuration

### application.properties

```properties
# Enable AOP
spring.aop.auto=true
spring.aop.proxy-target-class=true

# Async configuration (optional tuning)
spring.task.execution.pool.core-size=2
spring.task.execution.pool.max-size=5
spring.task.execution.pool.queue-capacity=100
```

---

## 🚀 Usage Examples

### Automatic Logging (No Code Changes)

Any service method matching the naming patterns will be automatically logged:

```java
@Service
public class EmployeeService {
    
    // Automatically logged as CREATE
    public Employee saveEmployee(EmployeeRequestDTO dto) {
        // ... save logic
        return employee; // ID extracted from result
    }
    
    // Automatically logged as UPDATE
    public Employee updateEmployee(Long id, EmployeeRequestDTO dto) {
        // ... update logic
        return updatedEmployee;
    }
    
    // Automatically logged as DELETE
    public void deleteEmployee(Long id) {
        // ... delete logic
    }
}
```

### Manual Logging

For custom events:

```java
@Service
@RequiredArgsConstructor
public class AuthService {
    
    private final AuditLogService auditLogService;
    
    public void login(String username) {
        // ... authentication logic
        auditLogService.logLogin(username);
    }
    
    public void logout(String username) {
        // ... logout logic
        auditLogService.logLogout(username);
    }
}
```

---

## 📊 API Examples

### Get All Logs (Paginated)

```bash
curl -X GET "http://localhost:8080/api/admin/audit-logs?page=0&size=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response:**
```json
{
  "content": [
    {
      "id": 123,
      "username": "admin",
      "action": "CREATE",
      "entityName": "Employee",
      "entityId": 45,
      "details": "{\"name\":\"John Doe\",\"email\":\"john@example.com\"}",
      "timestamp": "2026-01-26T12:30:00",
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0..."
    }
  ],
  "pageable": {...},
  "totalElements": 1500,
  "totalPages": 75,
  "size": 20,
  "number": 0
}
```

### Get Logs by Username

```bash
curl -X GET "http://localhost:8080/api/admin/audit-logs/user/john?page=0&size=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Get Logs by Action

```bash
curl -X GET "http://localhost:8080/api/admin/audit-logs/action/DELETE" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Get Entity History

Track all changes to a specific employee:

```bash
curl -X GET "http://localhost:8080/api/admin/audit-logs/entity/Employee/45" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response:**
```json
[
  {
    "id": 125,
    "username": "admin",
    "action": "UPDATE",
    "entityName": "Employee",
    "entityId": 45,
    "details": "{\"old\":{\"salary\":50000},\"new\":{\"salary\":55000}}",
    "timestamp": "2026-01-26T14:00:00",
    "ipAddress": "192.168.1.100"
  },
  {
    "id": 100,
    "username": "admin",
    "action": "CREATE",
    "entityName": "Employee",
    "entityId": 45,
    "details": "{\"name\":\"John Doe\",\"email\":\"john@example.com\"}",
    "timestamp": "2026-01-20T09:15:00",
    "ipAddress": "192.168.1.100"
  }
]
```

### Advanced Search

Search with multiple filters:

```bash
curl -X GET "http://localhost:8080/api/admin/audit-logs/search?\
username=admin&\
action=CREATE&\
entityName=Employee&\
startDate=2026-01-01T00:00:00&\
endDate=2026-01-31T23:59:59&\
page=0&\
size=50" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Get Statistics

```bash
curl -X GET "http://localhost:8080/api/admin/audit-logs/statistics" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response:**
```json
{
  "total": 1500,
  "today": 45,
  "creates": 500,
  "updates": 800,
  "deletes": 150,
  "logins": 50
}
```

### Get Available Actions

```bash
curl -X GET "http://localhost:8080/api/admin/audit-logs/actions" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response:**
```json
[
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "ACCESS_DENIED"
]
```

---

## 🎨 Frontend Integration

### React Example - Audit Logs Page

```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState({
    username: '',
    action: '',
    entityName: '',
  });

  useEffect(() => {
    fetchLogs();
  }, [page, filters]);

  const fetchLogs = async () => {
    const params = new URLSearchParams({
      page: page,
      size: 20,
      ...filters,
    });
    
    const response = await axios.get(
      `/api/admin/audit-logs/search?${params}`
    );
    
    setLogs(response.data.content);
    setTotalPages(response.data.totalPages);
  };

  return (
    <div>
      <h1>Audit Logs</h1>
      
      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="Username"
          value={filters.username}
          onChange={(e) => setFilters({...filters, username: e.target.value})}
        />
        <select
          value={filters.action}
          onChange={(e) => setFilters({...filters, action: e.target.value})}
        >
          <option value="">All Actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
        </select>
      </div>

      {/* Logs Table */}
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Username</th>
            <th>Action</th>
            <th>Entity</th>
            <th>ID</th>
            <th>IP Address</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td>{new Date(log.timestamp).toLocaleString()}</td>
              <td>{log.username}</td>
              <td>
                <span className={`badge ${log.action.toLowerCase()}`}>
                  {log.action}
                </span>
              </td>
              <td>{log.entityName}</td>
              <td>{log.entityId}</td>
              <td>{log.ipAddress}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="pagination">
        <button onClick={() => setPage(p => Math.max(0, p - 1))}>
          Previous
        </button>
        <span>Page {page + 1} of {totalPages}</span>
        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>
          Next
        </button>
      </div>
    </div>
  );
}
```

---

## 🔍 How AOP Works

### 1. Service Method Execution
```java
employeeService.saveEmployee(dto); // You call this
```

### 2. AOP Intercepts
```java
@AfterReturning(pointcut = "createOperations()", returning = "result")
public void logCreateOperation(JoinPoint joinPoint, Object result) {
    // Automatically called after saveEmployee returns
}
```

### 3. Extract Information
```java
String entityName = "Employee";  // From service class name
Long entityId = result.getId();  // From returned entity
String username = "admin";        // From SecurityContext
```

### 4. Create Audit Log
```java
AuditLog log = new AuditLog();
log.setUsername("admin");
log.setAction(AuditAction.CREATE);
log.setEntityName("Employee");
log.setEntityId(45);
log.setDetails("{...}");
log.setTimestamp(LocalDateTime.now());
auditLogRepository.save(log);
```

### 5. Asynchronous Execution
```java
@Async  // Doesn't block the main operation
public void logAction(...) {
    // Saved in background thread
}
```

---

## 🧪 Testing

### 1. Create an Employee
```bash
curl -X POST http://localhost:8080/api/employees \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "email": "john@example.com",
    "designation": "Developer"
  }'
```

### 2. Check Audit Log
```bash
curl -X GET "http://localhost:8080/api/admin/audit-logs?page=0&size=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Expected:**
```json
{
  "content": [{
    "action": "CREATE",
    "entityName": "Employee",
    "username": "admin",
    "timestamp": "2026-01-26T..."
  }]
}
```

### 3. Update the Employee
```bash
curl -X PUT http://localhost:8080/api/employees/45 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe Updated",
    "email": "john.updated@example.com"
  }'
```

### 4. Check Entity History
```bash
curl -X GET "http://localhost:8080/api/admin/audit-logs/entity/Employee/45" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Expected:** 2 logs (CREATE and UPDATE)

---

## 📈 Database Schema

The audit logs table will be created automatically by Hibernate:

```sql
CREATE TABLE audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity_name VARCHAR(255) NOT NULL,
    entity_id BIGINT NOT NULL,
    details TEXT,
    timestamp DATETIME NOT NULL,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    INDEX idx_username (username),
    INDEX idx_action (action),
    INDEX idx_entity (entity_name, entity_id),
    INDEX idx_timestamp (timestamp)
);
```

---

## 🎯 Benefits

✅ **Automatic Tracking** - No code changes needed in services  
✅ **Complete History** - Track all changes to entities  
✅ **Security Audit** - Know who did what and when  
✅ **Compliance** - Meet audit requirements (GDPR, SOX, etc.)  
✅ **Debugging** - Trace issues to specific changes  
✅ **User Accountability** - Track all user actions  
✅ **Admin Control** - Only admins can view logs  
✅ **Performance** - Asynchronous, doesn't slow down operations  

---

## ⚠️ Important Notes

### 1. Privacy Considerations
- Audit logs contain sensitive data
- Only admins can access logs
- Consider data retention policies
- May need to anonymize old logs

### 2. Storage Considerations
- Audit logs grow quickly
- Consider archiving old logs (>90 days)
- Add indexes for common queries
- Monitor disk space

### 3. Performance
- Logging is asynchronous (no impact)
- Database writes happen in background
- Consider separate database for audit logs
- Monitor audit log table size

### 4. Customization
To log custom entities, ensure service methods match naming patterns:
- `save*`, `create*`, `add*` for CREATE
- `update*`, `modify*` for UPDATE
- `delete*`, `remove*` for DELETE

Or call `auditLogService.logAction()` manually.

---

## 🔧 Troubleshooting

### Issue: Logs not being created

**Check:**
1. Is Spring AOP enabled? (`spring.aop.auto=true`)
2. Is async enabled? (`@EnableAsync` in config)
3. Does service method name match pattern? (`save*`, `update*`, `delete*`)
4. Is method in a `@Service` class?
5. Check logs for AOP errors

### Issue: Cannot extract entity ID

**Solution:**
Ensure your entity has a `getId()` method:
```java
public Long getId() {
    return this.id;
}
```

### Issue: "Access Denied" when viewing logs

**Solution:**
Logs endpoint requires ADMIN role:
```bash
# Login as admin
curl -X POST http://localhost:8080/api/auth/login \
  -d '{"username":"admin","password":"admin123"}'
```

---

## 🎉 Summary

Your audit logging system is now complete! All CREATE, UPDATE, and DELETE operations are automatically tracked using Spring AOP, and admin users can view and search all logs through REST API endpoints.

**Key Features:**
- ✅ Automatic logging via AOP
- ✅ Stores username, action, entity, timestamp
- ✅ Admin-only viewing endpoints
- ✅ Advanced search and filtering
- ✅ Entity history tracking
- ✅ Asynchronous for performance
- ✅ IP address and User-Agent tracking

For questions, check the code comments in each class!
