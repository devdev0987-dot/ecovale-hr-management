# Database Migration Strategy - EcoVale HR System

## Overview
This document outlines the strategy for creating, versioning, and executing database migrations to transition from the frontend-simulated backend to a production-ready database.

---

## 1. Migration Tool Selection

### 1.1 Recommended Tools

**Option 1: Flyway** (Recommended for Java/Spring Boot)
- Version-based migration
- Simple SQL scripts
- Automatic versioning
- Production-ready

**Option 2: Alembic** (Recommended for Python/FastAPI)
- Python-based migrations
- Auto-generation from ORM models
- Revision history

**Option 3: Liquibase**
- XML/YAML/JSON/SQL formats
- Database-agnostic
- Rollback support

**Option 4: Node.js Knex.js** (If using Node.js backend)
- JavaScript migrations
- Programmatic migrations
- Good TypeScript support

**Decision**: Choose based on backend language (Flyway for Java, Alembic for Python)

---

## 2. Migration Naming Convention

### 2.1 Version-Based Naming (Flyway Style)

```
V{version}__{description}.sql

Examples:
V001__create_users_table.sql
V002__create_departments_table.sql
V003__create_designations_table.sql
V004__create_employees_table.sql
...
V020__create_indexes.sql
V021__seed_departments.sql
V022__seed_system_settings.sql
```

### 2.2 Timestamp-Based Naming (Alembic Style)

```
{timestamp}_{description}.py

Examples:
20260119120000_create_users_table.py
20260119120100_create_departments_table.py
20260119120200_create_designations_table.py
```

---

## 3. Migration Order

### 3.1 Core Schema Creation Order

```
Phase 1: Foundation
├── V001: Create users table
├── V002: Create departments table
├── V003: Create designations table
└── V004: Create employees table

Phase 2: Employee Extensions
├── V005: Create bank_details table
├── V006: Create documents table
├── V007: Create career_history table
└── V008: Create salary_annexures table

Phase 3: Attendance & Payroll
├── V009: Create attendance_records table
├── V010: Create pay_runs table
├── V011: Create pay_run_employee_records table
└── V012: Create payslips table

Phase 4: Advances & Loans
├── V013: Create advance_records table
├── V014: Create loan_records table
└── V015: Create loan_emis table

Phase 5: Letters & Configuration
├── V016: Create letter_templates table
├── V017: Create generated_letters table
└── V018: Create system_settings table

Phase 6: Indexes & Constraints
├── V019: Create primary indexes
├── V020: Create foreign key indexes
├── V021: Create search indexes
└── V022: Create composite indexes

Phase 7: Seed Data
├── V023: Seed departments
├── V024: Seed system_settings
└── V025: Seed sample designations (optional)
```

**Rationale**: Create tables in dependency order (no forward references)

---

## 4. Sample Migration Scripts

### 4.1 V001: Create Users Table

```sql
-- V001__create_users_table.sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'manager', 'hr', 'employee')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

COMMENT ON TABLE users IS 'System users with authentication credentials';
```

### 4.2 V002: Create Departments Table

```sql
-- V002__create_departments_table.sql
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL CHECK (name IN ('IT', 'HR', 'Finance', 'Sales', 'Marketing')),
    description TEXT,
    head_employee_id VARCHAR(20) NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_departments_name ON departments(name);
CREATE INDEX idx_departments_active ON departments(is_active);
```

### 4.3 V023: Seed Departments

```sql
-- V023__seed_departments.sql
INSERT INTO departments (name, description) VALUES 
    ('IT', 'Information Technology'),
    ('HR', 'Human Resources'),
    ('Finance', 'Finance and Accounting'),
    ('Sales', 'Sales and Business Development'),
    ('Marketing', 'Marketing and Communications');
```

### 4.4 V024: Seed System Settings

```sql
-- V024__seed_system_settings.sql
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
    ('PF_WAGE_CEILING_MONTHLY', '15000', 'number', 'PF wage ceiling per month'),
    ('PF_EMPLOYEE_RATE', '0.12', 'number', 'Employee PF contribution rate (12%)'),
    ('PF_EMPLOYER_RATE', '0.12', 'number', 'Employer PF contribution rate (12%)'),
    ('ESI_EMPLOYEE_RATE', '0.0075', 'number', 'Employee ESI rate (0.75%)'),
    ('ESI_EMPLOYER_RATE', '0.0325', 'number', 'Employer ESI rate (3.25%)'),
    ('ESI_WAGE_CEILING_MONTHLY', '21000', 'number', 'ESI wage ceiling per month'),
    ('BASIC_PCT_OF_CTC', '0.50', 'number', 'Basic as percentage of CTC (50%)'),
    ('GRATUITY_RATE_ANNUAL', '0.0481', 'number', 'Gratuity provision rate (~4.81%)'),
    ('EMPLOYEE_HEALTH_INSURANCE_ANNUAL', '1000', 'number', 'Annual health insurance amount');
```

---

## 5. Data Migration Strategy

### 5.1 Migrating Existing Data from localStorage

**Current State**: Frontend stores data in `window.storage` (mocked as localStorage)

**Migration Steps**:

1. **Extract Data from Frontend**:
```javascript
// Export script (run in browser console)
const data = {
    employees: JSON.parse(localStorage.getItem('employees') || '[]'),
    designations: JSON.parse(localStorage.getItem('designations') || '[]'),
    attendanceRecords: JSON.parse(localStorage.getItem('attendanceRecords') || '[]'),
    advanceRecords: JSON.parse(localStorage.getItem('advanceRecords') || '[]'),
    loanRecords: JSON.parse(localStorage.getItem('loanRecords') || '[]'),
    payRunRecords: JSON.parse(localStorage.getItem('payRunRecords') || '[]')
};
console.log(JSON.stringify(data, null, 2));
// Copy output to file
```

2. **Transform Data**:
```python
# data_migration.py
import json

def transform_employee(emp_data):
    return {
        'id': emp_data['id'],
        'first_name': emp_data['personalInfo']['firstName'],
        'last_name': emp_data['personalInfo']['lastName'],
        # ... map all fields
    }

with open('exported_data.json') as f:
    data = json.load(f)

employees_sql = []
for emp in data['employees']:
    transformed = transform_employee(emp)
    sql = f"INSERT INTO employees (id, first_name, ...) VALUES ('{transformed['id']}', '{transformed['first_name']}', ...);"
    employees_sql.append(sql)

with open('V030__migrate_employees.sql', 'w') as f:
    f.write('\n'.join(employees_sql))
```

3. **Create Migration SQL**:
```sql
-- V030__migrate_employees.sql (auto-generated)
INSERT INTO employees (id, first_name, last_name, ...) VALUES
    ('1', 'Alice', 'Johnson', ...),
    ('2', 'Bob', 'Smith', ...),
    ...;
```

---

### 5.2 Handling Seed vs Production Data

**Seed Data** (Development):
- Sample employees (6 seed employees from storageService.ts)
- Sample designations
- For testing and development

**Production Data**:
- Real employee data
- Imported from existing system or manual entry
- Use separate migration or import tool

**Approach**:
```sql
-- V031__seed_sample_employees.sql (only for dev/test)
-- Check if this should run
DO $$
BEGIN
    IF current_database() NOT LIKE '%prod%' THEN
        -- Insert seed employees
        INSERT INTO employees (...) VALUES (...);
    END IF;
END $$;
```

---

## 6. Rollback Strategy

### 6.1 Downgrade Migrations

**Flyway**: Use `undo` migrations
```
V001__create_users_table.sql
U001__drop_users_table.sql
```

**Alembic**: Automatic downgrade
```python
def upgrade():
    op.create_table('users', ...)

def downgrade():
    op.drop_table('users')
```

### 6.2 Backup Before Migration

```bash
# Backup before production migration
pg_dump -h localhost -U postgres -d ecovale_hr > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
flyway migrate

# If issue, restore
psql -h localhost -U postgres -d ecovale_hr < backup_20260119_120000.sql
```

---

## 7. Migration Execution Plan

### 7.1 Development Environment

```bash
# 1. Create database
createdb ecovale_hr_dev

# 2. Run migrations
flyway -url=jdbc:postgresql://localhost/ecovale_hr_dev \
       -user=postgres \
       -password=password \
       -locations=filesystem:./migrations \
       migrate

# 3. Verify
psql -d ecovale_hr_dev -c "\dt"
```

### 7.2 Staging Environment

```bash
# 1. Backup production data (if any)
pg_dump production_db > prod_backup.sql

# 2. Clone to staging
createdb ecovale_hr_staging
psql -d ecovale_hr_staging < prod_backup.sql

# 3. Run migrations on staging
flyway -url=jdbc:postgresql://localhost/ecovale_hr_staging migrate

# 4. Test application against staging

# 5. If successful, proceed to production
```

### 7.3 Production Environment

```bash
# 1. Schedule maintenance window
# 2. Backup production database
pg_dump production_db > prod_backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Run migrations
flyway -url=jdbc:postgresql://production_host/ecovale_hr_prod migrate

# 4. Verify schema
psql -d ecovale_hr_prod -c "SELECT version FROM schema_version ORDER BY installed_rank DESC LIMIT 1;"

# 5. Start application

# 6. Monitor for errors

# 7. If issue, rollback
# psql -d ecovale_hr_prod < prod_backup_20260119_120000.sql
```

---

## 8. Continuous Integration Setup

### 8.1 CI Pipeline for Migrations

```yaml
# .github/workflows/db-migrations.yml
name: Database Migrations

on: [push, pull_request]

jobs:
  test-migrations:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Flyway
        run: |
          wget -qO- https://repo1.maven.org/maven2/org/flywaydb/flyway-commandline/9.0.0/flyway-commandline-9.0.0-linux-x64.tar.gz | tar xvz
      
      - name: Run Migrations
        run: |
          flyway/flyway -url=jdbc:postgresql://localhost/postgres \
                        -user=postgres \
                        -password=postgres \
                        -locations=filesystem:./db-migrations \
                        migrate
      
      - name: Verify Schema
        run: |
          psql postgresql://postgres:postgres@localhost/postgres -c "\dt"
```

---

## 9. Post-Migration Tasks

### 9.1 Verification Checklist

- [ ] All tables created
- [ ] All indexes created
- [ ] All constraints enforced
- [ ] Seed data inserted
- [ ] Foreign keys validated
- [ ] Sample queries execute successfully
- [ ] Application connects to database
- [ ] Basic CRUD operations work

### 9.2 Application Code Updates

**Update storageService.ts**:
```typescript
// Before: window.storage
const getData = async <T,>(key: string, defaultValue: T): Promise<T> => {
    const result = await window.storage.get(key);
    return result ? JSON.parse(result.value) : defaultValue;
};

// After: API calls
const getData = async <T,>(key: string, defaultValue: T): Promise<T> => {
    const response = await fetch(`/api/${key}`);
    return response.ok ? await response.json() : defaultValue;
};
```

---

## 10. Migration Versioning

### 10.1 Version Numbering Scheme

```
V{major}{minor}{patch}__{description}.sql

V001__initial_schema.sql          (1.0.0)
V002__add_user_roles.sql          (1.0.1)
...
V100__add_leave_management.sql    (2.0.0)
```

### 10.2 Schema Version Tracking

Flyway automatically creates `schema_version` table:

```sql
SELECT * FROM schema_version ORDER BY installed_rank;

-- Output:
-- installed_rank | version | description           | installed_on
-- 1              | 001     | create users table    | 2026-01-19 12:00:00
-- 2              | 002     | create departments    | 2026-01-19 12:00:05
```

---

## Summary

This migration strategy provides:
- **Tool selection**: Flyway/Alembic based on backend language
- **Naming conventions**: Version-based or timestamp-based
- **Migration order**: Dependency-aware creation sequence
- **Sample scripts**: Ready-to-use migration examples
- **Data migration**: Strategy for moving from localStorage to database
- **Rollback plan**: Backup and undo mechanisms
- **Execution plan**: Step-by-step for dev/staging/production
- **CI integration**: Automated testing of migrations
- **Verification**: Post-migration checklist

**Next Steps**:
1. Choose migration tool based on backend technology
2. Create `db-migrations` folder
3. Write migration scripts in order
4. Test on development database
5. Set up CI pipeline
6. Plan production migration window
7. Execute migration with backup
8. Update application code to use database
