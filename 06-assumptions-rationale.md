# Design Assumptions and Rationale - EcoVale HR System

## Overview
This document explains key design decisions, assumptions made during database design, trade-offs considered, and the rationale behind specific architectural choices.

---

## 1. Database Technology Selection

### 1.1 PostgreSQL as Primary Database

**Decision**: Use PostgreSQL 14+ as the primary database

**Rationale**:
- **ACID Compliance**: Critical for financial data (payroll, advances, loans)
- **JSON Support**: JSONB columns for flexible data (career history details, settings)
- **Strong Constraints**: CHECK constraints, GENERATED columns for business rules
- **Mature Ecosystem**: Excellent tooling, extensions, and community support
- **Open Source**: No licensing costs, wide adoption

**Alternatives Considered**:
- **MySQL 8+**: Similar features, but PostgreSQL has better JSON support
- **MongoDB**: NoSQL flexibility, but lacks transactional guarantees for financial data
- **SQL Server**: Enterprise features, but licensing costs and platform lock-in

---

### 1.2 Single Database vs Microservices

**Decision**: Single PostgreSQL database for MVP

**Rationale**:
- **Simplicity**: Easier to develop, deploy, and maintain
- **Transactional Integrity**: Cross-entity transactions (pay run generation)
- **Joins**: Efficient relational queries across entities
- **Scale**: Sufficient for 10,000+ employees

**Future Consideration**:
- Microservices architecture if scaling beyond 100,000 employees
- Separate read replicas for analytics
- Event-driven architecture for audit trails

---

## 2. Schema Design Decisions

### 2.1 Normalized vs Denormalized Design

**Decision**: 3NF with selective denormalization

**Normalized Design** (Default):
- Separate tables for departments, designations, employees
- Foreign keys maintain referential integrity
- Single source of truth for each entity

**Denormalized Fields**:
- `employee_name` in `pay_run_employee_records`, `attendance_records`, `advance_records`, `loan_records`
- `department`, `designation` in `payslips`

**Rationale for Denormalization**:
- **Performance**: Reduces joins in frequently accessed transaction tables
- **Historical Accuracy**: Employee name/designation at time of transaction
- **Reporting**: Faster query execution for payroll reports
- **Trade-off**: Slight data redundancy vs significant performance gain

**Maintenance**:
- Application layer responsible for keeping denormalized data in sync
- Triggers or background jobs can update denormalized fields

---

### 2.2 Embedded vs Separate Tables

**Decision**: Embed personal info, employment details, salary info in `employees` table

**Rationale**:
- **Single Entity**: Employee is the central aggregate root
- **Atomic Operations**: All employee data updated in single transaction
- **Query Simplicity**: No joins for basic employee info
- **Common Access Pattern**: Personal, employment, and salary data always queried together

**Alternatives Considered**:
- Separate `employee_personal_info`, `employee_employment_details`, `employee_salary_info` tables
- **Rejected** because: Adds complexity, more joins, no significant benefit

**Exception**: `bank_details` separated because:
- One-to-many relationship (multiple accounts)
- Not always needed (optional for queries)
- Contains sensitive data (separate access control)

---

### 2.3 UUID vs Auto-Increment IDs

**Decision**: Mixed approach

**UUID (gen_random_uuid())**:
- Used for: designations, bank_details, documents, career_history, salary_annexures, pay_run_employee_records, payslips, advance_records (future), loan_records, loan_emis, users, letter_templates, generated_letters, system_settings
- **Rationale**: Distributed generation, no collisions, security (non-guessable)

**Sequential Numeric IDs**:
- Used for: `employees.id` (1, 2, 3, ...), `departments.id` (SERIAL)
- **Rationale**: 
  - **Employees**: Business requirement (user-friendly, short IDs)
  - **Departments**: Small table, simple integer sufficient

**Custom Format**:
- Used for: `attendance_records.id` (ATT{timestamp}), `pay_runs.id` (PR{timestamp})
- **Rationale**: Human-readable, sortable, contains metadata

**Trade-offs**:
- UUIDs: 128-bit (16 bytes) vs Integer (4-8 bytes)
- UUIDs: Better for security, distributed systems
- Integers: More compact, better for user display

---

### 2.4 JSON vs Relational for Flexible Data

**Decision**: Use JSONB for specific use cases

**JSONB Used For**:
- `career_history.details`: Flexible event-specific data
- `salary_annexures.salary_snapshot`: Historical salary structure
- `system_settings.setting_value`: Variable data types

**Rationale**:
- **Flexibility**: Schema can evolve without migrations
- **Historical Data**: Preserve exact structure at point in time
- **Configuration**: Different settings have different types

**Not Used For**:
- Core employee data (structured, queryable)
- Financial data (strict validation required)
- Relational queries (foreign keys, joins)

**Trade-offs**:
- JSONB: Flexible but harder to query and validate
- Relational: Rigid but strongly typed and queryable

---

## 3. Data Type Choices

### 3.1 Monetary Values: DECIMAL(12,2)

**Decision**: Use `DECIMAL(12,2)` for all monetary values

**Rationale**:
- **Precision**: Exact decimal representation (no floating-point errors)
- **Scale**: 2 decimal places for rupee and paise
- **Range**: 12 digits = up to ₹9,999,999,999.99 (sufficient for employee salaries)

**Alternatives Considered**:
- **FLOAT/DOUBLE**: Rejected due to precision issues (0.1 + 0.2 ≠ 0.3)
- **INTEGER** (store paise): More performant, but less readable

---

### 3.2 Date Storage: DATE vs TIMESTAMP

**Decision**: Mixed approach

**DATE**:
- Used for: `date_of_birth`, `join_date`, `event_date`, `salary_date`, `period_start_date`, `period_end_date`
- **Rationale**: Time component irrelevant, saves space

**TIMESTAMP**:
- Used for: `created_at`, `updated_at`, `generated_at`, `upload_date`, `last_login`, `paid_date`
- **Rationale**: Full precision needed for audit trails and chronological ordering

---

### 3.3 Month/Year Storage: VARCHAR vs DATE

**Decision**: Store `month` as VARCHAR('January') and `year` as VARCHAR('2026')

**Rationale**:
- **User Display**: Directly usable in UI without conversion
- **Simplicity**: No complex date arithmetic for monthly data
- **Current Implementation**: Frontend uses this format

**Alternatives Considered**:
- Store as DATE (first day of month): More database-native, better for queries
- Store as YYYY-MM string: Sortable, compact
- **Trade-off**: VARCHAR less efficient but more user-friendly

**Future Enhancement**: Add computed columns for DATE representation

```sql
ALTER TABLE attendance_records 
ADD COLUMN month_date DATE GENERATED ALWAYS AS 
    (TO_DATE(year || '-' || month || '-01', 'YYYY-Month-DD')) STORED;
```

---

### 3.4 Enum vs VARCHAR for Fixed Values

**Decision**: Mixed approach

**CHECK Constraint (Pseudo-Enum)**:
- Used for: `gender`, `employment_type`, `work_location`, `payment_mode`, `status`, `role`, `event_type`, `letter_type`, `setting_type`
- **Rationale**: Enforces valid values at database level, flexible (can add values without schema change)

**Separate Table (Department)**:
- Used for: `departments`
- **Rationale**: Reference data that may have attributes (description, head)

**Alternatives Considered**:
- PostgreSQL native ENUM type: More type-safe but harder to modify
- No constraint: Less safe, relies on application validation
- **Trade-off**: CHECK constraint offers good balance

---

## 4. Relationship Design Decisions

### 4.1 Self-Referential Relationships

**Decision**: Support self-referential relationships for `employees` and `designations`

**`employees.reporting_manager_id`**:
- Allows employee-to-employee reporting
- **Nullable**: Top executives have no manager
- **ON DELETE SET NULL**: If manager deleted, clear reference

**`designations.reporting_to_designation_id`**:
- Allows designation-based hierarchy
- Alternative to employee-based reporting
- **More flexible**: Role-based rather than person-based

**Circular Dependency Handling**:
- **Database Level**: Cannot enforce (would require triggers or constraints)
- **Application Level**: Validate reporting chain before updates

---

### 4.2 Cascade vs Restrict on Delete

**Decision**: Different rules for different relationships

**CASCADE** (Delete children):
- `employee → bank_details, documents, career_history, salary_annexures, attendance_records, advance_records, loan_records, generated_letters`
- **Rationale**: These are employee-specific, meaningless without employee

**RESTRICT** (Prevent deletion):
- `employee → pay_run_employee_records, payslips`
- `department → employees, designations`
- **Rationale**: Financial and organizational data must be preserved

**SET NULL** (Clear reference):
- `employee → reporting_manager_id`
- `designation → reporting_to_designation_id`
- `template → generated_letters`
- **Rationale**: Optional relationships, data can exist independently

**Trade-off**: CASCADE simplifies cleanup but risks data loss; RESTRICT protects data but complicates deletion

---

### 4.3 One-to-Many vs Many-to-Many

**Decision**: Only one-to-many relationships in current design

**Rationale**:
- **Simplicity**: HR domain doesn't currently require M:N relationships
- **No junction tables**: Reduces complexity

**Future M:N Candidates**:
- **Employee ↔ Projects**: Employees can work on multiple projects, projects have multiple employees
- **Employee ↔ Skills**: Employees have multiple skills, skills belong to multiple employees
- **Employee ↔ Certifications**: Similar to skills

**Implementation When Needed**:
```sql
CREATE TABLE employee_projects (
    employee_id VARCHAR(20) REFERENCES employees(id),
    project_id UUID REFERENCES projects(id),
    PRIMARY KEY (employee_id, project_id)
);
```

---

## 5. Data Storage Assumptions

### 5.1 Document Storage: Base64 vs Cloud

**Current Decision**: Store documents as base64 TEXT in database

**Rationale**:
- **Simplicity**: No external dependencies
- **MVP**: Sufficient for initial implementation
- **Atomicity**: Documents deleted with employee

**Limitations**:
- **Size**: Database bloat for large files
- **Performance**: Slower than filesystem/CDN
- **Backup**: Larger database backups

**Future Migration**: Store in S3/GCS/Azure Blob Storage

```sql
-- Future schema
ALTER TABLE documents ADD COLUMN storage_url TEXT;
-- file_data becomes NULL, storage_url contains cloud URL
```

---

### 5.2 Photo Storage: Base64 vs URL

**Current Decision**: Store employee photos as base64 TEXT

**Same rationale as documents**: Simplicity for MVP

**Future**: Move to CDN for performance

---

### 5.3 Letter Content: Text vs PDF

**Current Decision**: Store letter content as TEXT

**Rationale**:
- **Editable**: Can regenerate with updated templates
- **Searchable**: Text-based search
- **Version Control**: Track content changes

**Additionally**: Store generated PDF as base64 in `file_data`

**Trade-off**: Storing both TEXT and PDF is redundant but offers flexibility

---

## 6. Calculation and Computation

### 6.1 Computed Columns vs Application Logic

**Decision**: Use PostgreSQL GENERATED columns for simple calculations

**Examples**:
```sql
-- attendance_records
payable_days GENERATED ALWAYS AS (present_days + paid_leave) STORED
loss_of_pay_days GENERATED ALWAYS AS (unpaid_leave + absent_days) STORED
```

**Rationale**:
- **Consistency**: Always correct, cannot be manually set
- **Performance**: Pre-computed, indexed if needed
- **Clarity**: Self-documenting

**Limitations**:
- Only for simple expressions (cannot reference other tables)
- Complex calculations (salary, CTC) still in application

---

### 6.2 Salary Calculations: Database vs Application

**Decision**: Application-level salary calculations

**Rationale**:
- **Complexity**: Iterative algorithms (special allowance balancing)
- **Business Logic**: Rules change frequently (PF ceilings, rates)
- **Flexibility**: Easier to modify in code than in DB functions

**Database Responsibility**:
- Store final calculated values
- Enforce constraints (basic = CTC * 0.5 / 12)
- Validate ranges (positive amounts)

---

## 7. Security and Access Control

### 7.1 Authentication: Database vs Application

**Decision**: Application-level authentication

**Database Role**:
- Store user credentials (hashed passwords)
- Provide user lookup

**Application Role**:
- Password hashing (bcrypt/argon2)
- Session management (JWT tokens)
- Role-based authorization

**Rationale**:
- **Flexibility**: Modern auth patterns (OAuth, SSO)
- **Scalability**: Stateless authentication
- **Industry Standard**: Application handles auth, database stores identity

---

### 7.2 Password Storage

**Decision**: Store hashed passwords, never plain text

**Algorithm**: bcrypt or argon2 (not implemented in schema, but assumed)

**Note**: `password_hash` column in `users` table

---

### 7.3 Row-Level Security (RLS)

**Current Decision**: Not implemented in schema

**Future Consideration**: PostgreSQL RLS for multi-tenant scenarios

**Example**:
```sql
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY employee_access_policy ON employees
    FOR SELECT
    USING (
        status = 'active' 
        AND (
            id = current_setting('app.user_id')::VARCHAR
            OR current_setting('app.user_role') IN ('admin', 'hr')
        )
    );
```

---

## 8. Scalability Assumptions

### 8.1 Expected Scale

**Assumptions**:
- **Employees**: 100 - 10,000
- **Years of Data**: 5-10 years
- **Concurrent Users**: 10-100

**Database Size Estimate**: 100 MB - 5 GB

**Performance Targets**: Sub-second queries for 99% of operations

---

### 8.2 Read vs Write Patterns

**Assumption**: Read-heavy workload (90% reads, 10% writes)

**Reads**:
- Employee lookups
- Payroll reports
- Attendance queries

**Writes**:
- Monthly pay run generation
- Daily attendance updates
- Occasional employee CRUD

**Optimization**: Index-heavy design, caching for reads

---

### 8.3 Growth Strategy

**Phase 1** (MVP): Single database, no replication
**Phase 2** (1,000+ employees): Read replicas for reporting
**Phase 3** (10,000+ employees): Partitioning, caching layer
**Phase 4** (100,000+ employees): Sharding, microservices

---

## 9. Migration and Evolution

### 9.1 Schema Versioning

**Decision**: Use migration tools (Flyway, Liquibase, Alembic)

**Version Control**: All migrations in version control

**Backward Compatibility**: Schema changes should not break existing code

---

### 9.2 Zero-Downtime Migrations

**Strategy**:
1. **Additive Changes**: Add new columns with defaults
2. **Dual-Write**: Write to old and new schema
3. **Backfill**: Migrate existing data
4. **Switch Reads**: Update queries to use new schema
5. **Remove Old**: Drop old columns/tables

---

## 10. Trade-offs Summary

| Decision | Pros | Cons | Rationale |
|----------|------|------|-----------|
| PostgreSQL | ACID, JSON, mature | Learning curve | Best fit for HR domain |
| 3NF + selective denormalization | Data integrity, performance | Sync complexity | Balance consistency and speed |
| UUIDs for most IDs | Security, distributed | Larger size | Best for scalability |
| Sequential IDs for employees | User-friendly | Manual generation | Business requirement |
| DECIMAL for money | Precision | Storage overhead | Financial accuracy critical |
| VARCHAR for month/year | User-friendly | Less queryable | Matches frontend format |
| Base64 for documents | Simplicity | Database bloat | MVP convenience |
| Application-level auth | Flexibility | Implementation | Industry standard |
| Computed columns | Consistency | Limited use cases | Simple calculations only |
| Denormalized names | Performance | Redundancy | Reporting optimization |

---

## Summary

This document has explained:
- **Database technology choice**: PostgreSQL for ACID compliance and JSON support
- **Schema design philosophy**: 3NF with selective denormalization
- **ID strategy**: Mixed UUID and sequential numeric
- **Data type rationale**: DECIMAL for money, DATE vs TIMESTAMP, VARCHAR for month/year
- **Relationship patterns**: CASCADE vs RESTRICT, self-referential handling
- **Storage decisions**: Base64 for MVP, cloud storage for scale
- **Calculation strategy**: Database for simple, application for complex
- **Security approach**: Application-level auth, database for identity
- **Scalability assumptions**: 100-10,000 employees, read-heavy workload
- **Trade-offs**: Explicit pros/cons for each major decision

These decisions balance:
- **Simplicity** (MVP) vs **Scalability** (future growth)
- **Consistency** (normalization) vs **Performance** (denormalization)
- **Flexibility** (JSON) vs **Structure** (relational)
- **Security** (constraints) vs **Convenience** (VARCHAR dates)

The design is intentionally pragmatic, favoring working software over theoretical purity, while maintaining a clear path for evolution and scale.
