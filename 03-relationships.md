# Entity Relationships - EcoVale HR System

## Overview
This document details all entity relationships in the EcoVale HR system, including cardinality, foreign key mappings, relationship types, and visual ERD representations.

---

## 1. Relationship Types

### 1.1 One-to-One (1:1)
- Rare in this system; mostly handled through embedded attributes
- Example: Employee → Primary Bank Account (though we allow multiple)

### 1.2 One-to-Many (1:M)
- Most common relationship type in this system
- Parent entity can have multiple child records
- Examples: Employee → Documents, Department → Employees

### 1.3 Many-to-Many (M:N)
- Currently not implemented directly
- Could be used for: Employee ↔ Projects, Employee ↔ Skills
- Would require junction/bridge tables

### 1.4 Self-Referential
- Entity references itself
- Examples: Employee → Reporting Manager, Designation → Parent Designation

---

## 2. Core Entity Relationships

### 2.1 Department Relationships

#### Department → Employees (1:M)
- **Cardinality**: One department has many employees
- **Foreign Key**: `employees.department_id` → `departments.id`
- **Delete Rule**: RESTRICT (cannot delete department with active employees)
- **Business Logic**: Every employee must belong to exactly one department

#### Department → Designations (1:M)
- **Cardinality**: One department has many designations
- **Foreign Key**: `designations.department_id` → `departments.id`
- **Delete Rule**: RESTRICT (cannot delete department with existing designations)
- **Business Logic**: Designations are scoped to departments

#### Department → Department Head (1:1 Optional)
- **Cardinality**: One department may have one head
- **Foreign Key**: `departments.head_employee_id` → `employees.id`
- **Delete Rule**: SET NULL (if head leaves, clear the reference)
- **Business Logic**: Department head is optional and references an employee

---

### 2.2 Designation Relationships

#### Designation → Employees (1:M)
- **Cardinality**: One designation can be held by many employees
- **Foreign Key**: `employees.designation_id` → `designations.id`
- **Delete Rule**: RESTRICT (cannot delete designation with active employees)
- **Business Logic**: Every employee must have exactly one designation

#### Designation → Parent Designation (Self-Referential, M:1 Optional)
- **Cardinality**: One designation may report to another designation
- **Foreign Key**: `designations.reporting_to_designation_id` → `designations.id`
- **Delete Rule**: SET NULL (if parent designation deleted, clear reference)
- **Business Logic**: Defines organizational hierarchy at designation level
- **Note**: Creates a tree structure for reporting hierarchy

#### Designation → Career History (1:M)
- **Cardinality**: One designation can appear in multiple career history records
- **Foreign Keys**: 
  - `career_history.old_designation_id` → `designations.id`
  - `career_history.new_designation_id` → `designations.id`
- **Delete Rule**: SET NULL (historical records maintain, but designation link can be cleared)
- **Business Logic**: Tracks designation changes over time

---

### 2.3 Employee Relationships

#### Employee → Reporting Manager (Self-Referential, M:1 Optional)
- **Cardinality**: One employee may report to another employee
- **Foreign Key**: `employees.reporting_manager_id` → `employees.id`
- **Delete Rule**: SET NULL (if manager leaves, clear reference)
- **Business Logic**: Defines reporting hierarchy at employee level
- **Note**: Alternative to designation-based hierarchy; more flexible

#### Employee → Bank Details (1:M)
- **Cardinality**: One employee can have multiple bank accounts
- **Foreign Key**: `bank_details.employee_id` → `employees.id`
- **Delete Rule**: CASCADE (if employee deleted, remove bank details)
- **Business Logic**: 
  - Each employee must have at least one bank account
  - Only one account can be marked as primary
  - Unique constraint ensures one primary per employee

#### Employee → Documents (1:M)
- **Cardinality**: One employee can have multiple documents
- **Foreign Key**: `documents.employee_id` → `employees.id`
- **Delete Rule**: CASCADE (if employee deleted, remove documents)
- **Business Logic**:
  - Each document type should be unique per employee (Aadhar, PAN, etc.)
  - Unique constraint: `(employee_id, document_type)`

#### Employee → Career History (1:M)
- **Cardinality**: One employee can have multiple career history records
- **Foreign Key**: `career_history.employee_id` → `employees.id`
- **Delete Rule**: CASCADE (if employee deleted, remove career history)
- **Business Logic**: Chronological audit trail of promotions, increments, demotions

#### Employee → Salary Annexures (1:M)
- **Cardinality**: One employee can have multiple salary annexures
- **Foreign Key**: `salary_annexures.employee_id` → `employees.id`
- **Delete Rule**: CASCADE (if employee deleted, remove annexures)
- **Business Logic**: Generated documents are historical snapshots

#### Employee → Attendance Records (1:M)
- **Cardinality**: One employee has multiple monthly attendance records
- **Foreign Key**: `attendance_records.employee_id` → `employees.id`
- **Delete Rule**: CASCADE (if employee deleted, remove attendance records)
- **Business Logic**:
  - One record per employee per month-year
  - Unique constraint: `(employee_id, month, year)`

#### Employee → Pay Run Employee Records (1:M)
- **Cardinality**: One employee appears in multiple pay runs
- **Foreign Key**: `pay_run_employee_records.employee_id` → `employees.id`
- **Delete Rule**: RESTRICT (cannot delete employee with processed payroll)
- **Business Logic**: Maintains payroll history integrity

#### Employee → Payslips (1:M)
- **Cardinality**: One employee has multiple payslips
- **Foreign Key**: `payslips.employee_id` → `employees.id`
- **Delete Rule**: RESTRICT (cannot delete employee with payslips)
- **Business Logic**:
  - One payslip per employee per month-year
  - Unique constraint: `(employee_id, salary_month, salary_year)`

#### Employee → Advance Records (1:M)
- **Cardinality**: One employee can have multiple advance records
- **Foreign Key**: `advance_records.employee_id` → `employees.id`
- **Delete Rule**: CASCADE (if employee deleted, remove advance records)
- **Business Logic**: Tracks salary advances and recovery

#### Employee → Loan Records (1:M)
- **Cardinality**: One employee can have multiple loans
- **Foreign Key**: `loan_records.employee_id` → `employees.id`
- **Delete Rule**: CASCADE (if employee deleted, remove loan records)
- **Business Logic**: Multiple active or completed loans per employee

#### Employee → Generated Letters (1:M)
- **Cardinality**: One employee can have multiple letters
- **Foreign Key**: `generated_letters.employee_id` → `employees.id`
- **Delete Rule**: CASCADE (if employee deleted, remove letters)
- **Business Logic**: Offer letters, appointment letters, etc.

---

### 2.4 Payroll Relationships

#### Pay Run → Pay Run Employee Records (1:M)
- **Cardinality**: One pay run contains multiple employee records
- **Foreign Key**: `pay_run_employee_records.pay_run_id` → `pay_runs.id`
- **Delete Rule**: CASCADE (if pay run deleted, remove all employee records)
- **Business Logic**:
  - One employee record per employee per pay run
  - Unique constraint: `(pay_run_id, employee_id)`

#### Pay Run Employee Record → Payslip (1:1 Optional)
- **Cardinality**: One pay run employee record may generate one payslip
- **Foreign Key**: `payslips.pay_run_employee_record_id` → `pay_run_employee_records.id`
- **Delete Rule**: SET NULL (payslip can exist independently)
- **Business Logic**: Links payslip to the pay run that generated it

---

### 2.5 Loan Relationships

#### Loan Record → Loan EMIs (1:M)
- **Cardinality**: One loan has multiple EMI installments
- **Foreign Key**: `loan_emis.loan_id` → `loan_records.id`
- **Delete Rule**: CASCADE (if loan deleted, remove all EMIs)
- **Business Logic**:
  - Number of EMI records = `number_of_emis` field
  - Sequential EMI numbers: 1, 2, 3, ..., N
  - Unique constraint: `(loan_id, emi_number)`

---

### 2.6 Letter and Document Relationships

#### Letter Template → Generated Letters (1:M Optional)
- **Cardinality**: One template can be used to generate multiple letters
- **Foreign Key**: `generated_letters.template_id` → `letter_templates.id`
- **Delete Rule**: SET NULL (letter retains content even if template deleted)
- **Business Logic**: Template provides base structure for letter generation

---

### 2.7 User Relationships

#### User → Pay Runs (1:M)
- **Cardinality**: One user can generate multiple pay runs
- **Foreign Key**: `pay_runs.generated_by_user_id` → `users.id`
- **Delete Rule**: SET NULL (pay run retains even if user deleted)
- **Business Logic**: Audit trail of who generated payroll

#### User → Generated Letters (1:M)
- **Cardinality**: One user can generate multiple letters
- **Foreign Key**: `generated_letters.generated_by_user_id` → `users.id`
- **Delete Rule**: SET NULL (letter retains even if user deleted)
- **Business Logic**: Audit trail of who generated letters

---

## 3. Relationship Matrix

| Parent Entity | Child Entity | Cardinality | Foreign Key Column | Delete Rule |
|---------------|--------------|-------------|-------------------|-------------|
| departments | employees | 1:M | employees.department_id | RESTRICT |
| departments | designations | 1:M | designations.department_id | RESTRICT |
| employees | departments | M:1 | departments.head_employee_id | SET NULL |
| designations | employees | 1:M | employees.designation_id | RESTRICT |
| designations | designations | M:1 | designations.reporting_to_designation_id | SET NULL |
| designations | career_history | 1:M | career_history.old_designation_id | SET NULL |
| designations | career_history | 1:M | career_history.new_designation_id | SET NULL |
| employees | employees | M:1 | employees.reporting_manager_id | SET NULL |
| employees | bank_details | 1:M | bank_details.employee_id | CASCADE |
| employees | documents | 1:M | documents.employee_id | CASCADE |
| employees | career_history | 1:M | career_history.employee_id | CASCADE |
| employees | salary_annexures | 1:M | salary_annexures.employee_id | CASCADE |
| employees | attendance_records | 1:M | attendance_records.employee_id | CASCADE |
| employees | pay_run_employee_records | 1:M | pay_run_employee_records.employee_id | RESTRICT |
| employees | payslips | 1:M | payslips.employee_id | RESTRICT |
| employees | advance_records | 1:M | advance_records.employee_id | CASCADE |
| employees | loan_records | 1:M | loan_records.employee_id | CASCADE |
| employees | generated_letters | 1:M | generated_letters.employee_id | CASCADE |
| pay_runs | pay_run_employee_records | 1:M | pay_run_employee_records.pay_run_id | CASCADE |
| pay_run_employee_records | payslips | 1:1 | payslips.pay_run_employee_record_id | SET NULL |
| loan_records | loan_emis | 1:M | loan_emis.loan_id | CASCADE |
| letter_templates | generated_letters | 1:M | generated_letters.template_id | SET NULL |
| users | pay_runs | 1:M | pay_runs.generated_by_user_id | SET NULL |
| users | generated_letters | 1:M | generated_letters.generated_by_user_id | SET NULL |

---

## 4. Entity Relationship Diagrams (ERD)

### 4.1 Core Employee Structure

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   departments   │1       M│   designations   │1       M│   employees     │
│─────────────────│─────────│──────────────────│─────────│─────────────────│
│ id (PK)         │         │ id (PK)          │         │ id (PK)         │
│ name            │         │ title            │         │ first_name      │
│ description     │         │ department_id(FK)│         │ last_name       │
│ head_emp_id(FK) │────┐    │ reporting_to(FK) │──┐      │ department_id(FK)│
└─────────────────┘    │    │ level            │  │      │ designation_id(FK)│
                       │    └──────────────────┘  │      │ rep_manager_id(FK)│──┐
                       │                           │      │ ...             │  │
                       └───────────────────────────┼──────│ status          │  │
                                                   │      └─────────────────┘  │
                                                   │              │1           │
                                                   └──────────────┘            │
                                                                 M│            │
                                                                  └────────────┘
```

### 4.2 Employee Related Entities

```
                    ┌─────────────────┐
                    │   employees     │
                    │─────────────────│
                    │ id (PK)         │
                    └────────┬────────┘
                             │1
                ┌────────────┼───────────┬───────────┬────────────┐
                │M           │M          │M          │M           │M
    ┌───────────▼────┐  ┌───▼───────┐  ┌▼────────┐  ┌▼──────────────┐  ┌▼────────────┐
    │ bank_details   │  │ documents │  │ career_ │  │ salary_       │  │ attendance_ │
    │────────────────│  │───────────│  │ history │  │ annexures     │  │ records     │
    │ id (PK)        │  │ id (PK)   │  │─────────│  │───────────────│  │─────────────│
    │ employee_id(FK)│  │ emp_id(FK)│  │ id (PK) │  │ id (PK)       │  │ id (PK)     │
    │ account_number │  │ type      │  │ emp(FK) │  │ employee_id   │  │ emp_id(FK)  │
    │ is_primary     │  │ file_data │  │ event   │  │ file_data     │  │ month/year  │
    └────────────────┘  └───────────┘  │ details │  │ salary_snap   │  │ days_detail │
                                        └─────────┘  └───────────────┘  └─────────────┘
```

### 4.3 Payroll Structure

```
            ┌────────────┐
            │  pay_runs  │1
            │────────────│
            │ id (PK)    │
            │ month/year │
            │ status     │
            └─────┬──────┘
                  │
                  │M
    ┌─────────────▼──────────────────┐
    │ pay_run_employee_records       │1
    │────────────────────────────────│
    │ id (PK)                        │
    │ pay_run_id (FK)                │
    │ employee_id (FK)               │───┐
    │ basic, hra, deductions, net    │   │
    └─────────────┬──────────────────┘   │M
                  │1                      │
                  │                  ┌────▼─────┐
                  │                  │ employees│
                  │                  │──────────│
                  │                  │ id (PK)  │
                  │                  └──────────┘
                  │
                  │1 (optional)
           ┌──────▼──────┐
           │  payslips   │
           │─────────────│
           │ id (PK)     │
           │ emp_id (FK) │
           │ pay_rec(FK) │
           │ detailed... │
           └─────────────┘
```

### 4.4 Loan Structure

```
       ┌───────────────┐
       │ loan_records  │1
       │───────────────│
       │ id (PK)       │
       │ employee_id   │───────┐
       │ loan_amount   │       │M
       │ num_emis      │       │
       │ status        │  ┌────▼─────┐
       └───────┬───────┘  │ employees│
               │1         │──────────│
               │          │ id (PK)  │
               │M         └──────────┘
        ┌──────▼──────┐
        │  loan_emis  │
        │─────────────│
        │ id (PK)     │
        │ loan_id(FK) │
        │ emi_number  │
        │ month/year  │
        │ status      │
        └─────────────┘
```

### 4.5 Advance Records

```
       ┌───────────────────┐
       │ advance_records   │M
       │───────────────────│
       │ id (PK)           │
       │ employee_id (FK)  │─────────┐
       │ paid_amount       │         │
       │ deduction_month   │         │1
       │ status            │    ┌────▼─────┐
       │ remaining_amount  │    │ employees│
       └───────────────────┘    │──────────│
                                │ id (PK)  │
                                └──────────┘
```

### 4.6 Letter Generation

```
    ┌──────────────────┐
    │ letter_templates │1
    │──────────────────│
    │ id (PK)          │
    │ template_name    │
    │ template_type    │
    │ content          │
    └────────┬─────────┘
             │
             │M (optional)
    ┌────────▼────────────┐
    │ generated_letters   │M
    │─────────────────────│
    │ id (PK)             │
    │ employee_id (FK)    │──────┐
    │ template_id (FK)    │      │
    │ letter_content      │      │1
    │ file_data           │  ┌───▼──────┐
    │ generated_by (FK)   │──│ employees│
    └─────────────────────┘  │──────────│
                  │1         │ id (PK)  │
                  │M         └──────────┘
            ┌─────▼────┐
            │  users   │
            │──────────│
            │ id (PK)  │
            └──────────┘
```

---

## 5. Relationship Constraints and Rules

### 5.1 Circular Dependency Prevention

#### Employee → Reporting Manager
- **Issue**: Employee A cannot report to Employee B if B reports to A (direct or transitive)
- **Solution**: Application-level validation before updates
- **Implementation**: Check reporting chain for cycles

#### Designation → Reporting Designation
- **Issue**: Similar circular reporting at designation level
- **Solution**: Validate hierarchy tree on designation creation/update

### 5.2 Orphan Prevention

#### Active Employees without Department/Designation
- **Constraint**: NOT NULL on `department_id` and `designation_id`
- **Delete Rule**: RESTRICT on departments/designations prevents deletion

#### Pay Run Employee Records without Employee
- **Constraint**: RESTRICT delete on employees with processed payroll
- **Business Rule**: Employees with payroll history cannot be hard-deleted; mark as inactive instead

### 5.3 Data Consistency Rules

#### Attendance → Pay Run
- Attendance record for month-year should exist before generating pay run
- Application validates attendance data availability

#### Loan EMI → Pay Run
- EMI schedule must be created when loan is created
- Pay run processing updates EMI status from 'pending' to 'paid'

#### Advance Deduction → Pay Run
- Advance deduction month must match pay run month for processing
- Status updated from 'pending' to 'deducted' after deduction

---

## 6. Relationship Implementation Guidelines

### 6.1 Foreign Key Naming Convention
```
{child_table_singular}_{referenced_column}
Example: employee_id, department_id, designation_id
```

### 6.2 Index Creation for Foreign Keys
```sql
-- Always create index on foreign key columns for performance
CREATE INDEX idx_{table}_{fk_column} ON {table}({fk_column});
```

### 6.3 Composite Foreign Keys
Currently not used, but could be useful for:
- Linking to attendance by (employee_id, month, year)
- Linking to pay runs by (month, year)

### 6.4 Soft Deletes vs Hard Deletes

**Soft Delete** (mark as inactive):
- employees (critical data)
- departments (organizational structure)
- designations (job positions)

**Hard Delete** (with CASCADE):
- documents (if employee removed)
- career_history (employee-specific)
- bank_details (employee-specific)

**Never Delete** (RESTRICT):
- pay_runs (financial records)
- payslips (salary history)
- pay_run_employee_records (payroll audit)

---

## 7. Traversal Patterns

### 7.1 Get Employee's Full Information
```sql
SELECT e.*, 
       d.name as department_name,
       des.title as designation_title,
       bd.* as bank_details,
       docs.* as documents
FROM employees e
JOIN departments d ON e.department_id = d.id
JOIN designations des ON e.designation_id = des.id
LEFT JOIN bank_details bd ON e.id = bd.employee_id AND bd.is_primary = true
LEFT JOIN documents docs ON e.id = docs.employee_id
WHERE e.id = ?;
```

### 7.2 Get Employee's Reporting Chain
```sql
WITH RECURSIVE reporting_chain AS (
    SELECT id, first_name, last_name, reporting_manager_id, 0 as level
    FROM employees
    WHERE id = ?
    
    UNION ALL
    
    SELECT e.id, e.first_name, e.last_name, e.reporting_manager_id, rc.level + 1
    FROM employees e
    JOIN reporting_chain rc ON e.id = rc.reporting_manager_id
)
SELECT * FROM reporting_chain;
```

### 7.3 Get All Subordinates (Direct and Indirect)
```sql
WITH RECURSIVE subordinates AS (
    SELECT id, first_name, last_name, reporting_manager_id, 0 as level
    FROM employees
    WHERE id = ?
    
    UNION ALL
    
    SELECT e.id, e.first_name, e.last_name, e.reporting_manager_id, s.level + 1
    FROM employees e
    JOIN subordinates s ON e.reporting_manager_id = s.id
)
SELECT * FROM subordinates WHERE id != ?;
```

### 7.4 Get Monthly Payroll with All Dependencies
```sql
SELECT 
    pr.id as pay_run_id,
    pr.month,
    pr.year,
    pre.employee_id,
    e.first_name || ' ' || e.last_name as employee_name,
    pre.gross_salary,
    pre.total_deductions,
    pre.net_pay,
    att.payable_days,
    adv.advance_deduction,
    le.emi_amount as loan_deduction
FROM pay_runs pr
JOIN pay_run_employee_records pre ON pr.id = pre.pay_run_id
JOIN employees e ON pre.employee_id = e.id
LEFT JOIN attendance_records att ON e.id = att.employee_id 
    AND att.month = pr.month AND att.year = pr.year
LEFT JOIN advance_records adv ON e.id = adv.employee_id 
    AND adv.advance_deduction_month = pr.month 
    AND adv.advance_deduction_year = pr.year
    AND adv.status = 'pending'
LEFT JOIN loan_emis le ON le.employee_id = e.id 
    AND le.month = pr.month AND le.year = pr.year 
    AND le.status = 'pending'
WHERE pr.month = ? AND pr.year = ?;
```

---

## Summary

This document has defined:
- **22+ relationship mappings** across all entities
- **Cardinality rules** (1:1, 1:M, M:1, self-referential)
- **Foreign key constraints** with appropriate delete rules
- **Circular dependency prevention** strategies
- **Data integrity rules** and orphan prevention
- **ERD diagrams** for visual understanding
- **Traversal patterns** for common queries
- **Implementation guidelines** for foreign keys and indexes

These relationships form the backbone of the database design and ensure data integrity, consistency, and proper referencing across the EcoVale HR system.
