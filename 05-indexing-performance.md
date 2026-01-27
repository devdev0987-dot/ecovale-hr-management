# Indexing and Performance Optimization - EcoVale HR System

## Overview
This document provides comprehensive indexing strategies, query optimization patterns, and performance considerations for the EcoVale HR database.

---

## 1. Indexing Strategy

### 1.1 Primary Key Indexes
All tables have primary key indexes (automatically created):

```sql
-- Automatically created by PRIMARY KEY constraint
employees (id)
departments (id)
designations (id)
users (id)
bank_details (id)
documents (id)
career_history (id)
salary_annexures (id)
attendance_records (id)
pay_runs (id)
pay_run_employee_records (id)
payslips (id)
advance_records (id)
loan_records (id)
loan_emis (id)
letter_templates (id)
generated_letters (id)
system_settings (id)
```

---

### 1.2 Foreign Key Indexes
**Critical for join performance**

```sql
-- Department relationships
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_designations_department ON designations(department_id);

-- Designation relationships
CREATE INDEX idx_employees_designation ON employees(designation_id);
CREATE INDEX idx_designations_reporting ON designations(reporting_to_designation_id);
CREATE INDEX idx_career_history_old_desig ON career_history(old_designation_id);
CREATE INDEX idx_career_history_new_desig ON career_history(new_designation_id);

-- Employee relationships
CREATE INDEX idx_employees_reporting_manager ON employees(reporting_manager_id);
CREATE INDEX idx_bank_details_employee ON bank_details(employee_id);
CREATE INDEX idx_documents_employee ON documents(employee_id);
CREATE INDEX idx_career_history_employee ON career_history(employee_id);
CREATE INDEX idx_salary_annexures_employee ON salary_annexures(employee_id);
CREATE INDEX idx_attendance_employee ON attendance_records(employee_id);
CREATE INDEX idx_pay_run_records_employee ON pay_run_employee_records(employee_id);
CREATE INDEX idx_payslips_employee ON payslips(employee_id);
CREATE INDEX idx_advance_records_employee ON advance_records(employee_id);
CREATE INDEX idx_loan_records_employee ON loan_records(employee_id);
CREATE INDEX idx_generated_letters_employee ON generated_letters(employee_id);

-- Pay run relationships
CREATE INDEX idx_pay_run_records_pay_run ON pay_run_employee_records(pay_run_id);
CREATE INDEX idx_payslips_pay_run_record ON payslips(pay_run_employee_record_id);

-- Loan relationships
CREATE INDEX idx_loan_emis_loan ON loan_emis(loan_id);

-- User relationships
CREATE INDEX idx_pay_runs_user ON pay_runs(generated_by_user_id);
CREATE INDEX idx_generated_letters_user ON generated_letters(generated_by_user_id);
CREATE INDEX idx_generated_letters_template ON generated_letters(template_id);
```

---

### 1.3 Unique Indexes
**Enforce business constraints and improve lookup**

```sql
-- User unique constraints
CREATE UNIQUE INDEX idx_users_email_unique ON users(email);

-- Employee unique constraints
CREATE UNIQUE INDEX idx_employees_official_email_unique ON employees(official_email);

-- Attendance unique constraint
CREATE UNIQUE INDEX idx_attendance_unique ON attendance_records(employee_id, month, year);

-- Pay run unique constraint
CREATE UNIQUE INDEX idx_pay_runs_unique ON pay_runs(month, year);

-- Payslip unique constraint
CREATE UNIQUE INDEX idx_payslips_unique ON payslips(employee_id, salary_month, salary_year);

-- Document unique constraint
CREATE UNIQUE INDEX idx_documents_unique ON documents(employee_id, document_type);

-- Loan EMI unique constraint
CREATE UNIQUE INDEX idx_loan_emis_unique ON loan_emis(loan_id, emi_number);

-- System settings unique constraint
CREATE UNIQUE INDEX idx_system_settings_key_unique ON system_settings(setting_key);

-- Bank details primary account (partial unique index)
CREATE UNIQUE INDEX idx_bank_details_primary_unique 
    ON bank_details(employee_id) 
    WHERE is_primary = true;
```

---

### 1.4 Search and Filter Indexes

```sql
-- Employee search and filters
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_employment_type ON employees(employment_type);
CREATE INDEX idx_employees_name ON employees(first_name, last_name);
CREATE INDEX idx_employees_join_date ON employees(join_date);
CREATE INDEX idx_employees_work_location ON employees(work_location);

-- Department and designation search
CREATE INDEX idx_departments_name ON departments(name);
CREATE INDEX idx_departments_active ON departments(is_active);
CREATE INDEX idx_designations_title ON designations(title);
CREATE INDEX idx_designations_level ON designations(level);

-- User search and filters
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- Document search
CREATE INDEX idx_documents_type ON documents(document_type);

-- Attendance filters
CREATE INDEX idx_attendance_month_year ON attendance_records(month, year);

-- Pay run filters
CREATE INDEX idx_pay_runs_status ON pay_runs(status);
CREATE INDEX idx_pay_runs_month_year ON pay_runs(month, year);

-- Loan and advance filters
CREATE INDEX idx_advance_records_status ON advance_records(status);
CREATE INDEX idx_advance_records_deduction_month ON advance_records(advance_deduction_month, advance_deduction_year);
CREATE INDEX idx_loan_records_status ON loan_records(status);
CREATE INDEX idx_loan_emis_status ON loan_emis(status);
CREATE INDEX idx_loan_emis_month_year ON loan_emis(month, year);

-- Letter filters
CREATE INDEX idx_letter_templates_type ON letter_templates(template_type);
CREATE INDEX idx_letter_templates_active ON letter_templates(is_active);
CREATE INDEX idx_generated_letters_type ON generated_letters(letter_type);
```

---

### 1.5 Chronological/Sorting Indexes

```sql
-- Timestamp-based sorting (DESC for recent first)
CREATE INDEX idx_career_history_date ON career_history(event_date DESC);
CREATE INDEX idx_salary_annexures_date ON salary_annexures(generated_at DESC);
CREATE INDEX idx_attendance_created ON attendance_records(created_at DESC);
CREATE INDEX idx_pay_runs_date ON pay_runs(generated_at DESC);
CREATE INDEX idx_payslips_date ON payslips(salary_date DESC);
CREATE INDEX idx_advance_records_created ON advance_records(created_at DESC);
CREATE INDEX idx_loan_records_created ON loan_records(created_at DESC);
CREATE INDEX idx_generated_letters_date ON generated_letters(generated_at DESC);
```

---

### 1.6 Composite Indexes for Complex Queries

```sql
-- Employee search by status and department
CREATE INDEX idx_employees_status_dept ON employees(status, department_id);

-- Employee search by status and type
CREATE INDEX idx_employees_status_type ON employees(status, employment_type);

-- Attendance lookup by employee and month-year
CREATE INDEX idx_attendance_emp_month_year ON attendance_records(employee_id, month, year);

-- Loan EMI lookup by status and month-year
CREATE INDEX idx_loan_emis_status_month ON loan_emis(status, month, year);

-- Advance lookup by employee and deduction month
CREATE INDEX idx_advance_emp_deduction ON advance_records(employee_id, advance_deduction_month, advance_deduction_year);

-- Payslip lookup by employee and month-year
CREATE INDEX idx_payslips_emp_month ON payslips(employee_id, salary_month, salary_year);
```

---

### 1.7 Partial Indexes

```sql
-- Active employees only (frequently queried)
CREATE INDEX idx_employees_active_only ON employees(id) WHERE status = 'active';

-- Primary bank accounts only
CREATE INDEX idx_bank_details_primary_only ON bank_details(employee_id, account_number) WHERE is_primary = true;

-- Pending advances only
CREATE INDEX idx_advance_pending_only ON advance_records(employee_id, advance_deduction_month, advance_deduction_year) WHERE status = 'pending';

-- Active loans only
CREATE INDEX idx_loan_active_only ON loan_records(employee_id) WHERE status = 'active';

-- Pending EMIs only
CREATE INDEX idx_loan_emis_pending_only ON loan_emis(loan_id, month, year) WHERE status = 'pending';

-- Active letter templates only
CREATE INDEX idx_letter_templates_active_only ON letter_templates(template_type, template_name) WHERE is_active = true;
```

---

## 2. Query Optimization Patterns

### 2.1 Employee List with Details
**Query**:
```sql
SELECT 
    e.id, e.first_name, e.last_name, e.official_email,
    d.name as department_name,
    des.title as designation_title,
    e.status, e.employment_type
FROM employees e
JOIN departments d ON e.department_id = d.id
JOIN designations des ON e.designation_id = des.id
WHERE e.status = 'active'
ORDER BY e.id;
```

**Indexes Used**:
- `employees (status)` for WHERE filter
- `employees.department_id` for JOIN
- `employees.designation_id` for JOIN
- `departments (id)` PK
- `designations (id)` PK

---

### 2.2 Monthly Payroll Report
**Query**:
```sql
SELECT 
    pr.id, pr.month, pr.year,
    e.id as employee_id,
    e.first_name || ' ' || e.last_name as employee_name,
    pre.gross_salary,
    pre.total_deductions,
    pre.net_pay,
    att.payable_days,
    adv.advance_deduction,
    SUM(le.emi_amount) as loan_deduction
FROM pay_runs pr
JOIN pay_run_employee_records pre ON pr.id = pre.pay_run_id
JOIN employees e ON pre.employee_id = e.id
LEFT JOIN attendance_records att 
    ON e.id = att.employee_id 
    AND att.month = pr.month 
    AND att.year = pr.year
LEFT JOIN advance_records adv 
    ON e.id = adv.employee_id 
    AND adv.advance_deduction_month = pr.month 
    AND adv.advance_deduction_year = pr.year
    AND adv.status = 'pending'
LEFT JOIN loan_emis le 
    ON le.loan_id IN (SELECT id FROM loan_records WHERE employee_id = e.id)
    AND le.month = pr.month 
    AND le.year = pr.year 
    AND le.status = 'pending'
WHERE pr.month = $1 AND pr.year = $2
GROUP BY pr.id, e.id, pre.id, att.id, adv.id;
```

**Optimization**:
- Use composite index on `(month, year)` for pay_runs
- Use composite indexes for LEFT JOINs on `(employee_id, month, year)`
- Consider materialized view for frequently accessed payroll data

---

### 2.3 Employee Reporting Chain (Recursive)
**Query**:
```sql
WITH RECURSIVE reporting_chain AS (
    SELECT id, first_name, last_name, reporting_manager_id, 0 as level
    FROM employees
    WHERE id = $1
    
    UNION ALL
    
    SELECT e.id, e.first_name, e.last_name, e.reporting_manager_id, rc.level + 1
    FROM employees e
    JOIN reporting_chain rc ON e.id = rc.reporting_manager_id
    WHERE rc.level < 10  -- Prevent infinite recursion
)
SELECT * FROM reporting_chain ORDER BY level;
```

**Optimization**:
- Index on `reporting_manager_id` critical for recursive join
- Add level limit to prevent infinite loops
- Consider caching result for frequently accessed chains

---

### 2.4 Employee Search with Filters
**Query**:
```sql
SELECT 
    e.id, e.first_name, e.last_name, e.official_email,
    d.name as department, des.title as designation,
    e.employment_type, e.status
FROM employees e
JOIN departments d ON e.department_id = d.id
JOIN designations des ON e.designation_id = des.id
WHERE 
    (e.status = $1 OR $1 IS NULL)
    AND (e.employment_type = $2 OR $2 IS NULL)
    AND (e.department_id = $3 OR $3 IS NULL)
    AND (
        e.first_name ILIKE '%' || $4 || '%' 
        OR e.last_name ILIKE '%' || $4 || '%'
        OR e.official_email ILIKE '%' || $4 || '%'
    )
ORDER BY e.id
LIMIT 50 OFFSET $5;
```

**Optimization**:
- Composite index on `(status, employment_type, department_id)`
- Full-text search index for name search (if supported)
- Pagination with LIMIT/OFFSET
- Consider pg_trgm extension for fuzzy search

---

### 2.5 Active Loans with Pending EMIs
**Query**:
```sql
SELECT 
    lr.id, lr.employee_id,
    e.first_name || ' ' || e.last_name as employee_name,
    lr.loan_amount, lr.remaining_balance,
    COUNT(le.id) as pending_emis
FROM loan_records lr
JOIN employees e ON lr.employee_id = e.id
LEFT JOIN loan_emis le ON lr.id = le.loan_id AND le.status = 'pending'
WHERE lr.status = 'active'
GROUP BY lr.id, e.id;
```

**Optimization**:
- Partial index on `loan_records WHERE status = 'active'`
- Partial index on `loan_emis WHERE status = 'pending'`

---

## 3. Performance Considerations

### 3.1 Table Size Estimates

| Table | Estimated Rows (1000 employees, 5 years) |
|-------|------------------------------------------|
| employees | 1,000 |
| departments | 10 |
| designations | 100 |
| users | 50 |
| bank_details | 1,500 (1.5 per employee) |
| documents | 3,000 (3 per employee) |
| career_history | 2,000 (2 per employee) |
| attendance_records | 60,000 (5 years × 12 months × 1000) |
| pay_runs | 60 (5 years × 12 months) |
| pay_run_employee_records | 60,000 (60 pay runs × 1000 emp) |
| payslips | 60,000 (same as above) |
| advance_records | 5,000 (5 per employee) |
| loan_records | 500 (0.5 per employee) |
| loan_emis | 6,000 (avg 12 EMIs per loan) |

**Total Estimated Size**: ~100-500 MB (depending on document storage)

---

### 3.2 Query Performance Targets

| Query Type | Target Response Time |
|------------|---------------------|
| Employee lookup by ID | < 10 ms |
| Employee list (paginated) | < 50 ms |
| Pay run generation | < 5 seconds |
| Payroll report (monthly) | < 100 ms |
| Search queries | < 100 ms |
| Complex analytics | < 1 second |

---

### 3.3 Slow Query Identification

**Enable PostgreSQL slow query log**:
```sql
-- In postgresql.conf
log_min_duration_statement = 100  -- Log queries taking > 100ms
log_statement = 'all'  -- Log all statements (dev only)
```

**Monitor query performance**:
```sql
-- Enable pg_stat_statements extension
CREATE EXTENSION pg_stat_statements;

-- Find slow queries
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

### 3.4 Index Usage Analysis

```sql
-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY tablename, indexname;

-- Find unused indexes
SELECT 
    schemaname || '.' || tablename AS table,
    indexname AS index,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexrelname NOT LIKE '%_pkey';
```

---

### 3.5 VACUUM and ANALYZE

**Regular maintenance**:
```sql
-- Auto-vacuum settings (postgresql.conf)
autovacuum = on
autovacuum_vacuum_scale_factor = 0.1
autovacuum_analyze_scale_factor = 0.05

-- Manual vacuum and analyze
VACUUM ANALYZE employees;
VACUUM ANALYZE pay_run_employee_records;
VACUUM ANALYZE attendance_records;
```

---

### 3.6 Connection Pooling

**Recommended**: Use connection pooling (PgBouncer, Pgpool-II)

**Configuration**:
```
pool_mode = transaction
max_client_conn = 100
default_pool_size = 20
reserve_pool_size = 5
```

---

## 4. Caching Strategies

Comprehensive caching approaches to reduce database load and improve application response times.

---

### 4.1 Application-Level Caching

Implement caching in the application layer to reduce repeated database queries using Redis.

---

**Redis Cache Setup**:

```typescript
// Redis client configuration
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

// Key naming convention
const CACHE_KEYS = {
  employee: (id: string) => `employee:${id}`,
  employeeList: (filters: string) => `employees:list:${filters}`,
  department: (id: string) => `department:${id}`,
  departmentList: () => `departments:list`,
  designation: (id: string) => `designation:${id}`,
  designationList: () => `designations:list`,
  userByUsername: (username: string) => `user:username:${username}`,
  employeeReportingChain: (id: string) => `employee:${id}:chain`,
  payroll: (month: string) => `payroll:${month}`,
};

// TTL (Time To Live) strategy
const CACHE_TTL = {
  SHORT: 60,           // 1 minute - frequently changing data
  MEDIUM: 300,         // 5 minutes - moderate changes
  LONG: 1800,          // 30 minutes - rarely changing
  VERY_LONG: 86400,    // 24 hours - static data
};
```

---

**Cache-Aside Pattern** (Most Common):

```typescript
// Get employee with cache-aside pattern
async function getEmployeeById(id: string): Promise<Employee> {
  const cacheKey = CACHE_KEYS.employee(id);
  
  // 1. Try to get from cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log('Cache HIT:', cacheKey);
    return JSON.parse(cached);
  }
  
  console.log('Cache MISS:', cacheKey);
  
  // 2. Query database
  const result = await pool.query(
    `SELECT e.*, d.name as department_name, des.title as designation_name
     FROM employees e
     JOIN departments d ON e.department_id = d.id
     JOIN designations des ON e.designation_id = des.id
     WHERE e.id = $1`,
    [id]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const employee = result.rows[0];
  
  // 3. Store in cache
  await redis.setex(cacheKey, CACHE_TTL.MEDIUM, JSON.stringify(employee));
  
  return employee;
}

// Performance:
// - Cache HIT: 1-3ms (vs 10-20ms database)
// - Cache MISS: 11-23ms (query + cache write)
// - 80% cache hit rate = 7-14ms average (vs 10-20ms without cache)
```

---

**Read-Through Cache** (Automatic):

```typescript
// Wrapper function for automatic caching
async function cachedQuery<T>(
  cacheKey: string,
  ttl: number,
  queryFn: () => Promise<T>
): Promise<T> {
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Execute query
  const result = await queryFn();
  
  // Cache result
  if (result !== null && result !== undefined) {
    await redis.setex(cacheKey, ttl, JSON.stringify(result));
  }
  
  return result;
}

// Usage examples
const employee = await cachedQuery(
  CACHE_KEYS.employee(id),
  CACHE_TTL.MEDIUM,
  () => db.getEmployee(id)
);

const departments = await cachedQuery(
  CACHE_KEYS.departmentList(),
  CACHE_TTL.VERY_LONG,
  () => db.getDepartments()
);
```

---

**Write-Through Cache** (Immediate Consistency):

```typescript
// Update employee and cache simultaneously
async function updateEmployee(id: string, updates: Partial<Employee>): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Update database
    const result = await client.query(
      `UPDATE employees SET 
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        department_id = COALESCE($3, department_id),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [updates.first_name, updates.last_name, updates.department_id, id]
    );
    
    await client.query('COMMIT');
    
    // 2. Update cache immediately
    const employee = result.rows[0];
    const cacheKey = CACHE_KEYS.employee(id);
    await redis.setex(cacheKey, CACHE_TTL.MEDIUM, JSON.stringify(employee));
    
    // 3. Invalidate related caches
    await invalidateRelatedCaches('employee', id);
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

---

**Cache Invalidation Strategies**:

```typescript
// Strategy 1: TTL-based (Automatic Expiration)
// - Simplest approach
// - May serve stale data until expiry
// - Use for data that changes predictably

// Strategy 2: Event-based Invalidation
async function invalidateRelatedCaches(entity: string, id: string): Promise<void> {
  const patterns = {
    employee: [
      CACHE_KEYS.employee(id),
      `employees:list:*`,  // All employee list caches
      CACHE_KEYS.employeeReportingChain(id),
      `employee:${id}:*`,  // All employee-related caches
    ],
    department: [
      CACHE_KEYS.department(id),
      CACHE_KEYS.departmentList(),
      `employees:list:*`,  // Employee lists include department
    ],
    designation: [
      CACHE_KEYS.designation(id),
      CACHE_KEYS.designationList(),
      `employees:list:*`,
    ],
  };
  
  const keysToDelete = patterns[entity] || [];
  
  for (const pattern of keysToDelete) {
    if (pattern.includes('*')) {
      // Delete by pattern (requires SCAN, careful in production)
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else {
      await redis.del(pattern);
    }
  }
  
  console.log(`Invalidated ${keysToDelete.length} cache patterns for ${entity}:${id}`);
}

// Strategy 3: Version-based Caching
// Include version in cache key: `employee:${id}:v${version}`
// Increment version on update, old cache keys ignored
```

---

**Caching Lookup Tables** (Departments, Designations):

```typescript
// Cache all departments (rarely change)
async function getAllDepartments(): Promise<Department[]> {
  const cacheKey = CACHE_KEYS.departmentList();
  
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  const result = await pool.query(
    'SELECT * FROM departments ORDER BY name'
  );
  
  const departments = result.rows;
  
  // Cache for 24 hours (very stable data)
  await redis.setex(cacheKey, CACHE_TTL.VERY_LONG, JSON.stringify(departments));
  
  return departments;
}

// Pre-warm cache on application startup
async function warmupCache(): Promise<void> {
  console.log('Warming up cache...');
  
  await getAllDepartments();
  await getAllDesignations();
  await getSystemSettings();
  
  console.log('Cache warmed up successfully');
}

// Call on application start
warmupCache().catch(console.error);
```

---

**Session Caching**:

```typescript
// Store sessions in Redis instead of database
interface Session {
  userId: string;
  employeeId: string;
  username: string;
  role: string;
  expiresAt: Date;
}

async function createSession(userId: string, userData: Session): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const cacheKey = `session:${token}`;
  
  // Store in Redis with auto-expiry
  await redis.setex(
    cacheKey,
    7 * 24 * 60 * 60,  // 7 days
    JSON.stringify(userData)
  );
  
  return token;
}

async function getSession(token: string): Promise<Session | null> {
  const cacheKey = `session:${token}`;
  const cached = await redis.get(cacheKey);
  
  return cached ? JSON.parse(cached) : null;
}

// Performance: 0.5-2ms (vs 5-10ms database)
```

---

**Cache Metrics & Monitoring**:

```typescript
// Track cache performance
interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  avgHitTime: number;
  avgMissTime: number;
}

class CacheMonitor {
  private hits = 0;
  private misses = 0;
  private hitTimes: number[] = [];
  private missTimes: number[] = [];
  
  recordHit(duration: number): void {
    this.hits++;
    this.hitTimes.push(duration);
  }
  
  recordMiss(duration: number): void {
    this.misses++;
    this.missTimes.push(duration);
  }
  
  getMetrics(): CacheMetrics {
    const totalRequests = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      avgHitTime: this.average(this.hitTimes),
      avgMissTime: this.average(this.missTimes),
    };
  }
  
  private average(arr: number[]): number {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }
  
  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.hitTimes = [];
    this.missTimes = [];
  }
}

// Usage
const cacheMonitor = new CacheMonitor();

// Report metrics every hour
setInterval(() => {
  const metrics = cacheMonitor.getMetrics();
  console.log('Cache Metrics:', {
    hitRate: `${(metrics.hitRate * 100).toFixed(2)}%`,
    avgHitTime: `${metrics.avgHitTime.toFixed(2)}ms`,
    avgMissTime: `${metrics.avgMissTime.toFixed(2)}ms`,
  });
  cacheMonitor.reset();
}, 60 * 60 * 1000);
```

---

**Redis Memory Management**:

```bash
# redis.conf settings
maxmemory 2gb
maxmemory-policy allkeys-lru  # Evict least recently used keys

# Monitor Redis memory
redis-cli INFO memory

# Common policies:
# - allkeys-lru: Evict any key, LRU (good for cache)
# - volatile-lru: Evict keys with TTL, LRU (good for mixed use)
# - allkeys-lfu: Evict least frequently used (Redis 4+)
# - noeviction: Return errors when memory full
```

---

### 4.2 Materialized Views

Pre-computed database views that store query results for fast access.

---

**When to Use Materialized Views**:

- ✅ Complex aggregations run frequently (dashboard metrics)
- ✅ Reports with expensive JOINs (employee with all details)
- ✅ Data changes infrequently compared to reads (lookup tables)
- ✅ Acceptable staleness (5-60 minutes)
- ❌ Real-time data requirements
- ❌ Frequently updated source tables

---

**Example 1: Employee Details View**:

```sql
-- Complex query executed 100+ times per minute
-- Performance without materialized view: 50-150ms per query
-- Total load: 100 queries/min * 100ms = 10 seconds of DB time per minute

-- Create materialized view
CREATE MATERIALIZED VIEW mv_employee_details AS
SELECT 
    e.id,
    e.employee_id,
    e.first_name,
    e.last_name,
    e.first_name || ' ' || e.last_name as full_name,
    e.email,
    e.phone,
    e.date_of_birth,
    e.gender,
    e.join_date,
    e.ctc,
    e.gross_salary,
    e.status,
    
    -- Department info
    d.id as department_id,
    d.name as department_name,
    d.code as department_code,
    
    -- Designation info
    des.id as designation_id,
    des.title as designation_name,
    des.level as designation_level,
    
    -- Manager info
    m.id as manager_id,
    m.first_name || ' ' || m.last_name as manager_name,
    
    -- Bank info
    b.bank_name,
    b.account_number,
    b.ifsc_code,
    
    -- Aggregated stats
    COUNT(DISTINCT doc.id) as document_count,
    MAX(pr.pay_period_end) as last_payroll_date,
    
    -- Metadata
    CURRENT_TIMESTAMP as refreshed_at
    
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN designations des ON e.designation_id = des.id
LEFT JOIN employees m ON e.reporting_manager_id = m.id
LEFT JOIN bank_details b ON e.id = b.employee_id AND b.is_primary = true
LEFT JOIN documents doc ON e.id = doc.employee_id
LEFT JOIN pay_run_employee_records pr ON e.id = pr.employee_id
GROUP BY e.id, d.id, des.id, m.id, b.id;

-- Create indexes on materialized view
CREATE UNIQUE INDEX idx_mv_employee_details_id ON mv_employee_details(id);
CREATE INDEX idx_mv_employee_details_employee_id ON mv_employee_details(employee_id);
CREATE INDEX idx_mv_employee_details_status ON mv_employee_details(status);
CREATE INDEX idx_mv_employee_details_department ON mv_employee_details(department_id);
CREATE INDEX idx_mv_employee_details_name ON mv_employee_details(full_name);

-- Query the materialized view (fast!)
SELECT * FROM mv_employee_details WHERE status = 'active';
-- Performance: 3-8ms (vs 50-150ms)
-- Improvement: 6-20x faster
```

---

**Refresh Strategies**:

```sql
-- Strategy 1: Manual Refresh (Full)
REFRESH MATERIALIZED VIEW mv_employee_details;
-- Duration: 500-2000ms (depends on data size)
-- Locks view during refresh (readers blocked)

-- Strategy 2: Concurrent Refresh (Non-Blocking)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_employee_details;
-- Duration: 800-3000ms (slower but non-blocking)
-- Requires unique index on materialized view
-- Readers can query stale data during refresh

-- Strategy 3: Scheduled Refresh (Cron)
-- Refresh every 15 minutes during business hours
*/15 6-20 * * * psql -d ecovale_hr -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_employee_details;"

-- Strategy 4: Trigger-Based Refresh (Event-Driven)
-- Refresh when source data changes
CREATE OR REPLACE FUNCTION refresh_employee_details_mv()
RETURNS TRIGGER AS $$
BEGIN
    -- Use pg_notify to signal application to refresh
    PERFORM pg_notify('refresh_mv', 'employee_details');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_refresh_employee_mv
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_employee_details_mv();

-- Application listens for notification
-- await client.query('LISTEN refresh_mv');
-- client.on('notification', (msg) => {
--   if (msg.payload === 'employee_details') {
--     refreshMaterializedView('mv_employee_details');
--   }
-- });
```

---

**Example 2: Dashboard Metrics View**:

```sql
-- Dashboard query (expensive aggregations)
CREATE MATERIALIZED VIEW mv_dashboard_metrics AS
SELECT 
    -- Employee metrics
    COUNT(*) FILTER (WHERE e.status = 'active') as active_employees,
    COUNT(*) FILTER (WHERE e.status = 'probation') as probation_employees,
    COUNT(*) FILTER (WHERE e.status = 'inactive') as inactive_employees,
    
    -- Department breakdown
    json_object_agg(
        d.name,
        COUNT(e.id)
    ) FILTER (WHERE e.status = 'active') as employees_by_department,
    
    -- Salary metrics
    ROUND(AVG(e.ctc) FILTER (WHERE e.status = 'active'), 2) as avg_ctc,
    ROUND(AVG(e.gross_salary) FILTER (WHERE e.status = 'active'), 2) as avg_gross,
    SUM(e.ctc) FILTER (WHERE e.status = 'active') as total_ctc,
    
    -- New hires (last 30 days)
    COUNT(*) FILTER (WHERE e.join_date >= CURRENT_DATE - INTERVAL '30 days') as new_hires_30d,
    
    -- Attendance (current month)
    COUNT(DISTINCT att.employee_id) FILTER (
        WHERE att.date >= DATE_TRUNC('month', CURRENT_DATE)
    ) as employees_with_attendance_this_month,
    
    -- Payroll (last month)
    COUNT(DISTINCT pr.employee_id) FILTER (
        WHERE pr.pay_period_start >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
        AND pr.pay_period_end < DATE_TRUNC('month', CURRENT_DATE)
    ) as employees_paid_last_month,
    
    SUM(pr.net_pay) FILTER (
        WHERE pr.pay_period_start >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
        AND pr.pay_period_end < DATE_TRUNC('month', CURRENT_DATE)
    ) as total_payout_last_month,
    
    -- Metadata
    CURRENT_TIMESTAMP as refreshed_at

FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN attendance_records att ON e.id = att.employee_id
LEFT JOIN pay_run_employee_records pr ON e.id = pr.employee_id;

-- Query dashboard (instant!)
SELECT * FROM mv_dashboard_metrics;
-- Performance: 1-3ms (vs 200-500ms for raw query)
-- Refresh: Every 5-15 minutes

-- Refresh schedule (every 10 minutes)
*/10 * * * * psql -d ecovale_hr -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_metrics;"
```

---

**Example 3: Payroll Summary View**:

```sql
-- Monthly payroll summary (for reports)
CREATE MATERIALIZED VIEW mv_payroll_monthly_summary AS
SELECT 
    TO_CHAR(pr.pay_period_start, 'YYYY-MM') as month,
    pr.pay_period_start,
    pr.pay_period_end,
    
    -- Employee counts
    COUNT(DISTINCT pr.employee_id) as employee_count,
    
    -- Salary components
    SUM(pr.basic_salary) as total_basic,
    SUM(pr.hra) as total_hra,
    SUM(pr.special_allowance) as total_special_allowance,
    SUM(pr.gross_salary) as total_gross,
    
    -- Deductions
    SUM(pr.pf_employee) as total_pf_employee,
    SUM(pr.pf_employer) as total_pf_employer,
    SUM(pr.esi_employee) as total_esi_employee,
    SUM(pr.esi_employer) as total_esi_employer,
    SUM(pr.professional_tax) as total_pt,
    SUM(pr.tds) as total_tds,
    SUM(pr.advance_deduction) as total_advance_deduction,
    SUM(pr.loan_deduction) as total_loan_deduction,
    SUM(pr.other_deductions) as total_other_deductions,
    SUM(pr.total_deductions) as total_deductions,
    
    -- Net pay
    SUM(pr.net_pay) as total_net_pay,
    
    -- Department breakdown
    json_object_agg(
        d.name,
        json_build_object(
            'employee_count', COUNT(DISTINCT pr.employee_id),
            'gross_salary', SUM(pr.gross_salary),
            'net_pay', SUM(pr.net_pay)
        )
    ) as department_summary,
    
    -- Metadata
    CURRENT_TIMESTAMP as refreshed_at

FROM pay_run_employee_records pr
JOIN employees e ON pr.employee_id = e.id
JOIN departments d ON e.department_id = d.id
GROUP BY TO_CHAR(pr.pay_period_start, 'YYYY-MM'), pr.pay_period_start, pr.pay_period_end;

CREATE INDEX idx_mv_payroll_summary_month ON mv_payroll_monthly_summary(month DESC);

-- Query payroll report (instant)
SELECT * FROM mv_payroll_monthly_summary 
WHERE month >= TO_CHAR(CURRENT_DATE - INTERVAL '12 months', 'YYYY-MM')
ORDER BY month DESC;

-- Performance: 2-5ms (vs 100-300ms)
-- Refresh: After payroll processing completes
```

---

**Materialized View Management**:

```sql
-- Check materialized view sizes
SELECT 
    schemaname,
    matviewname,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) AS size
FROM pg_matviews
ORDER BY pg_total_relation_size(schemaname||'.'||matviewname) DESC;

-- Check last refresh time
SELECT 
    schemaname,
    matviewname,
    last_refresh
FROM pg_matviews
ORDER BY last_refresh DESC NULLS LAST;

-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS mv_employee_details;

-- Recreate with new definition
CREATE MATERIALIZED VIEW mv_employee_details AS ...
```

---

**Best Practices**:

1. **Always use CONCURRENTLY** for refresh in production (requires unique index)
2. **Monitor refresh duration**: Should be <5% of refresh interval
3. **Add indexes** on materialized views (they're regular tables)
4. **Document staleness**: Users should know data may be 5-15 minutes old
5. **Schedule refreshes** during low-traffic periods when possible
6. **Monitor disk usage**: Materialized views consume storage

---

### 4.3 Query Result Caching

Database-level and application-level caching of query results.

---

**PostgreSQL Shared Buffers** (Built-in Cache):

```sql
-- Check shared_buffers setting
SHOW shared_buffers;  -- Default: 128MB, Recommended: 25% of RAM

-- Recommended: 4GB for 16GB RAM server
-- postgresql.conf:
-- shared_buffers = 4GB

-- Query cache hit ratio (should be >95%)
SELECT 
    'Cache Hit Ratio' as metric,
    ROUND(
        SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit + heap_blks_read), 0) * 100,
        2
    ) || '%' as value
FROM pg_statio_user_tables;

-- If cache hit ratio <95%:
-- 1. Increase shared_buffers (requires restart)
-- 2. Optimize queries to reduce data scanned
-- 3. Add indexes to reduce I/O
```

---

**Application Query Result Cache** (with Redis):

```typescript
// Cache query results with automatic key generation
interface QueryCacheOptions {
  ttl: number;  // Seconds
  invalidateOn?: string[];  // Events that invalidate this cache
}

async function cachedDatabaseQuery<T>(
  queryKey: string,
  query: string,
  params: any[],
  options: QueryCacheOptions
): Promise<T[]> {
  // Generate cache key from query + params
  const cacheKey = `query:${queryKey}:${crypto
    .createHash('md5')
    .update(JSON.stringify({ query, params }))
    .digest('hex')}`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log('Query cache HIT:', queryKey);
    return JSON.parse(cached);
  }
  
  console.log('Query cache MISS:', queryKey);
  
  // Execute query
  const result = await pool.query(query, params);
  const data = result.rows;
  
  // Cache result
  await redis.setex(cacheKey, options.ttl, JSON.stringify(data));
  
  // Register for invalidation
  if (options.invalidateOn) {
    for (const event of options.invalidateOn) {
      await redis.sadd(`invalidate:${event}`, cacheKey);
    }
  }
  
  return data;
}

// Usage
const employees = await cachedDatabaseQuery(
  'active_employees',
  'SELECT * FROM employees WHERE status = $1 ORDER BY join_date DESC LIMIT $2',
  ['active', 50],
  {
    ttl: 300,  // 5 minutes
    invalidateOn: ['employee_update', 'employee_create'],
  }
);

// Invalidate all caches for an event
async function invalidateCachesByEvent(event: string): Promise<void> {
  const cacheKeys = await redis.smembers(`invalidate:${event}`);
  
  if (cacheKeys.length > 0) {
    await redis.del(...cacheKeys);
    await redis.del(`invalidate:${event}`);
    console.log(`Invalidated ${cacheKeys.length} caches for event: ${event}`);
  }
}

// Trigger invalidation after updates
async function updateEmployee(id: string, updates: any): Promise<void> {
  await pool.query('UPDATE employees SET ... WHERE id = $1', [id]);
  await invalidateCachesByEvent('employee_update');
}
```

---

**Pagination Cache Strategy**:

```typescript
// Cache individual pages separately
async function getEmployeesPage(
  page: number,
  limit: number,
  filters: any
): Promise<{ data: Employee[]; total: number }> {
  const offset = (page - 1) * limit;
  const filterHash = crypto
    .createHash('md5')
    .update(JSON.stringify(filters))
    .digest('hex');
  
  const pageCacheKey = `employees:page:${page}:${limit}:${filterHash}`;
  const totalCacheKey = `employees:total:${filterHash}`;
  
  // Try to get page from cache
  const cachedPage = await redis.get(pageCacheKey);
  const cachedTotal = await redis.get(totalCacheKey);
  
  if (cachedPage && cachedTotal) {
    return {
      data: JSON.parse(cachedPage),
      total: parseInt(cachedTotal),
    };
  }
  
  // Query database
  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `SELECT * FROM mv_employee_details 
       WHERE status = $1 
       ORDER BY join_date DESC 
       LIMIT $2 OFFSET $3`,
      [filters.status, limit, offset]
    ),
    pool.query(
      'SELECT COUNT(*) FROM employees WHERE status = $1',
      [filters.status]
    ),
  ]);
  
  const data = dataResult.rows;
  const total = parseInt(countResult.rows[0].count);
  
  // Cache page and total separately
  await redis.setex(pageCacheKey, CACHE_TTL.MEDIUM, JSON.stringify(data));
  await redis.setex(totalCacheKey, CACHE_TTL.MEDIUM, total.toString());
  
  return { data, total };
}

// Invalidate all pages when data changes
async function invalidateEmployeeListCache(): Promise<void> {
  const keys = await redis.keys('employees:page:*');
  const totalKeys = await redis.keys('employees:total:*');
  
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  if (totalKeys.length > 0) {
    await redis.del(...totalKeys);
  }
}
```

---

**Prepared Statement Caching** (PostgreSQL):

```typescript
// PostgreSQL caches execution plans for prepared statements
// Use parameterized queries for better performance

// BAD: String interpolation (no plan caching, SQL injection risk)
const query = `SELECT * FROM employees WHERE id = '${id}'`;
await pool.query(query);

// GOOD: Parameterized query (plan cached, safe)
await pool.query('SELECT * FROM employees WHERE id = $1', [id]);

// ADVANCED: Named prepared statements (explicit caching)
import { Client } from 'pg';

const client = new Client({ /* config */ });
await client.connect();

// Prepare statement once
await client.query({
  name: 'get_employee_by_id',
  text: 'SELECT * FROM employees WHERE id = $1',
});

// Execute multiple times (uses cached plan)
const result1 = await client.query({
  name: 'get_employee_by_id',
  values: ['employee-1'],
});

const result2 = await client.query({
  name: 'get_employee_by_id',
  values: ['employee-2'],
});

// Performance: 5-10% faster for simple queries, 20-30% for complex queries
```

---

**Cache Warming Strategy**:

```typescript
// Pre-populate cache on application startup or deployment
async function warmupApplicationCache(): Promise<void> {
  console.log('Starting cache warmup...');
  
  const warmupTasks = [
    // Frequently accessed data
    cachedQuery(
      CACHE_KEYS.departmentList(),
      CACHE_TTL.VERY_LONG,
      () => pool.query('SELECT * FROM departments').then(r => r.rows)
    ),
    
    cachedQuery(
      CACHE_KEYS.designationList(),
      CACHE_TTL.VERY_LONG,
      () => pool.query('SELECT * FROM designations').then(r => r.rows)
    ),
    
    // First page of active employees (most common view)
    cachedDatabaseQuery(
      'active_employees_page1',
      'SELECT * FROM mv_employee_details WHERE status = $1 LIMIT 20',
      ['active'],
      { ttl: CACHE_TTL.MEDIUM }
    ),
    
    // Dashboard metrics
    cachedQuery(
      'dashboard_metrics',
      CACHE_TTL.MEDIUM,
      () => pool.query('SELECT * FROM mv_dashboard_metrics').then(r => r.rows[0])
    ),
  ];
  
  await Promise.all(warmupTasks);
  
  console.log('Cache warmup completed');
}

// Call on app start
await warmupApplicationCache();

// Schedule periodic warmup (e.g., after cache flush)
setInterval(warmupApplicationCache, 4 * 60 * 60 * 1000);  // Every 4 hours
```

---

**Multi-Level Caching Architecture**:

```
┌─────────────┐
│  Browser    │  L1 Cache: 5-60 seconds (HTTP cache headers)
└──────┬──────┘
       │
┌──────▼──────┐
│  CDN/Proxy  │  L2 Cache: 1-5 minutes (reverse proxy like Nginx)
└──────┬──────┘
       │
┌──────▼──────┐
│Application  │  L3 Cache: 5-30 minutes (Redis, in-memory)
└──────┬──────┘
       │
┌──────▼──────┐
│PostgreSQL   │  L4 Cache: Shared buffers, OS cache
└─────────────┘
```

```typescript
// HTTP cache headers for static lookup data
app.get('/api/departments', async (req, res) => {
  const departments = await getAllDepartments();
  
  res.set({
    'Cache-Control': 'public, max-age=1800',  // 30 minutes
    'ETag': crypto.createHash('md5').update(JSON.stringify(departments)).digest('hex'),
  });
  
  res.json(departments);
});

// Conditional request handling
app.get('/api/employees/:id', async (req, res) => {
  const employee = await getEmployeeById(req.params.id);
  const etag = crypto.createHash('md5').update(JSON.stringify(employee)).digest('hex');
  
  // Check If-None-Match header
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();  // Not Modified
  }
  
  res.set({
    'Cache-Control': 'private, max-age=300',  // 5 minutes
    'ETag': etag,
  });
  
  res.json(employee);
});
```

---

**Cache Performance Comparison**:

| Cache Layer | Latency | TTL Recommendation | Use Case |
|-------------|---------|-------------------|----------|
| **Browser** | 0ms (instant) | 30-300s | Static assets, lookup tables |
| **CDN/Proxy** | 1-5ms | 60-300s | API responses, public data |
| **Redis** | 1-3ms | 60-1800s | Session data, query results |
| **PostgreSQL Shared Buffers** | 0.5-2ms | Automatic | Hot data, indexes |
| **Disk** | 5-50ms | N/A | Cold data, full table scans |

---

## 5. Partitioning Strategy (Future)

### 5.1 Time-Based Partitioning

**Candidates for partitioning** (as data grows):
- `attendance_records` (by year)
- `pay_run_employee_records` (by year)
- `payslips` (by year)

**Example**:
```sql
CREATE TABLE attendance_records (
    -- columns...
) PARTITION BY RANGE (EXTRACT(YEAR FROM created_at));

CREATE TABLE attendance_records_2024 PARTITION OF attendance_records
    FOR VALUES FROM (2024) TO (2025);

CREATE TABLE attendance_records_2025 PARTITION OF attendance_records
    FOR VALUES FROM (2025) TO (2026);
```

---

### 5.2 List-Based Partitioning

**Not currently needed**, but could partition by:
- Department (if one department has significantly more data)
- Employee status (active vs inactive)

---

## 6. Monitoring and Alerts

### 6.1 Key Metrics to Monitor

- Query response times (95th percentile)
- Connection pool utilization
- Table and index sizes
- Slow query count
- Cache hit ratios
- Replication lag (if applicable)

### 6.2 Recommended Tools

- **pgAdmin**: Database administration
- **pg_stat_statements**: Query performance analysis
- **pgBadger**: Log analyzer
- **Prometheus + Grafana**: Metrics and alerting
- **DataDog / New Relic**: APM and database monitoring

---

## Summary

This document provides:
- **50+ indexes** covering primary keys, foreign keys, unique constraints, and search patterns
- **Composite and partial indexes** for complex queries
- **Query optimization patterns** with example queries
- **Performance targets** and monitoring strategies
- **Caching and partitioning** recommendations
- **Maintenance procedures** (VACUUM, ANALYZE)

**Key Takeaways**:
1. Index all foreign keys for join performance
2. Use composite indexes for multi-column filters
3. Use partial indexes for frequently queried subsets
4. Monitor query performance and index usage
5. Cache rarely-changing reference data
6. Consider partitioning as data grows (>10 million rows)

This indexing strategy should handle 1,000-10,000 employees efficiently with sub-second query times for most operations.
