# EcoVale HR System - Database Design Documentation

## Overview

This directory contains comprehensive database design documentation for the EcoVale HR Management System. The design is derived from a thorough analysis of the existing frontend implementation and provides a complete blueprint for building a production-ready backend.

---

## Purpose

The EcoVale HR frontend currently simulates backend logic using `window.storage` (localStorage). This database design serves as:

1. **Single Source of Truth** for all data structures and business rules
2. **Implementation Guide** for backend developers
3. **Migration Blueprint** for transitioning from frontend-simulated to database-backed architecture
4. **API Contract** defining the interface between frontend and backend
5. **Reference Documentation** for future enhancements and maintenance

---

## Contents

### [01-entities.md](./01-entities.md) - Entity Definitions
**What it contains**:
- **21 domain entities** identified from the frontend codebase
- Comprehensive attribute definitions with data types and constraints
- Business descriptions and entity purposes
- Embedded vs separate entity decisions

**Key Entities**:
- User (authentication)
- Employee (core entity with personal, employment, salary info)
- Department & Designation (organizational structure)
- AttendanceRecord (monthly attendance tracking)
- PayRun & PayRunEmployeeRecord (payroll processing)
- AdvanceRecord & LoanRecord (financial management)
- Document & GeneratedLetter (document management)
- SystemSettings (configuration)

**When to use**: Understanding what data the system manages and the attributes of each entity

---

### [02-schema.md](./02-schema.md) - Database Schema Design
**What it contains**:
- Complete PostgreSQL schema with **18 tables**
- DDL statements for all tables, columns, constraints
- Primary keys, foreign keys, unique constraints, check constraints
- Computed/generated columns
- Indexes (50+ indexes defined)
- Seed data for reference tables

**Key Features**:
- 3rd Normal Form (3NF) with selective denormalization
- Strong referential integrity (CASCADE, RESTRICT, SET NULL rules)
- Data validation at database level
- Comments on tables and columns
- Production-ready schema

**When to use**: Creating the database structure, writing migration scripts

---

### [03-relationships.md](./03-relationships.md) - Entity Relationships
**What it contains**:
- **22+ relationship mappings** across all entities
- Cardinality definitions (1:1, 1:M, M:N, self-referential)
- Foreign key mappings with delete rules
- Entity Relationship Diagrams (ERD) in ASCII art
- Relationship matrix
- Common query patterns and traversal logic

**Key Patterns**:
- Department → Employees (1:M)
- Employee → Documents (1:M)
- Employee → Reporting Manager (self-referential)
- PayRun → PayRunEmployeeRecords (1:M)
- LoanRecord → LoanEMIs (1:M)

**When to use**: Understanding how entities connect, writing JOIN queries, designing foreign keys

---

### [04-business-rules.md](./04-business-rules.md) - Business Rules & Invariants
**What it contains**:
- **60+ business rules** extracted from frontend logic
- Salary calculation formulas (CTC, basic, HRA, PF, ESI, PT, TDS)
- Attendance calculations (payable days, LOP days)
- Payroll processing logic (pro-rating, advances, loans)
- Data validation rules (email, phone, IFSC codes)
- Business invariants and constraints

**Critical Rules**:
- Basic salary = 50% of CTC / 12
- PF: 12% of basic (capped at ₹15,000)
- ESI: 0.75% of gross (if gross < ₹21,000)
- Professional Tax: ₹200 if gross > ₹25,000
- Payable days = Present days + Paid leave
- Net = Gross - (PF + ESI + PT + TDS + LOP)

**When to use**: Implementing business logic, validating data, understanding calculations

---

### [05-indexing-performance.md](./05-indexing-performance.md) - Indexing & Performance
**What it contains**:
- **50+ index definitions** for optimal query performance
- Primary key indexes, foreign key indexes, unique indexes
- Composite indexes for multi-column queries
- Partial indexes for filtered queries
- Query optimization patterns with example SQL
- Performance targets and monitoring strategies

**Key Strategies**:
- Index all foreign keys for JOIN performance
- Use composite indexes for common filter combinations
- Partial indexes for frequently queried subsets (active employees, pending EMIs)
- Monitor slow queries with `pg_stat_statements`
- Connection pooling with PgBouncer

**When to use**: Optimizing database performance, troubleshooting slow queries

---

### [06-assumptions-rationale.md](./06-assumptions-rationale.md) - Design Decisions
**What it contains**:
- Rationale behind major design decisions
- Technology selection (PostgreSQL)
- Schema design philosophy (3NF + denormalization)
- ID strategy (UUID vs numeric)
- Data type choices (DECIMAL for money, VARCHAR for month/year)
- Trade-offs analysis
- Scalability assumptions

**Key Decisions**:
- PostgreSQL for ACID compliance and JSON support
- Mixed UUID and sequential IDs for different use cases
- Denormalized employee names in transaction tables for performance
- Base64 document storage for MVP (migrate to cloud later)
- Application-level authentication
- Read-heavy workload optimization

**When to use**: Understanding why the design is the way it is, making informed changes

---

### [07-migration-strategy.md](./07-migration-strategy.md) - Database Migrations
**What it contains**:
- Migration tool recommendations (Flyway, Alembic)
- Migration naming conventions and versioning
- **25+ migration scripts** in execution order
- Data migration from localStorage to database
- Rollback strategies
- CI/CD integration for migrations
- Production deployment plan

**Migration Order**:
1. Foundation: Users, Departments, Designations, Employees
2. Employee Extensions: Bank Details, Documents, Career History
3. Payroll: Attendance, PayRuns, Payslips
4. Advances & Loans
5. Letters & Configuration
6. Indexes & Constraints
7. Seed Data

**When to use**: Setting up database, executing migrations, deploying to production

---

### [08-api-design.md](./08-api-design.md) - RESTful API Design
**What it contains**:
- **50+ API endpoints** covering all HR operations
- Request/response formats with examples
- Authentication flow (JWT-based)
- Error handling and status codes
- Pagination, filtering, sorting
- Rate limiting and versioning
- OpenAPI/Swagger documentation

**Key Endpoints**:
- `POST /auth/login` - Authentication
- `GET /employees` - List employees with filters
- `POST /payroll/pay-runs` - Generate monthly payroll
- `POST /attendance` - Create/update attendance
- `POST /advances` - Create advance record
- `POST /loans` - Create loan record

**When to use**: Implementing backend APIs, updating frontend to consume APIs

---

## Database Design Summary

### Statistics

| Metric | Count |
|--------|-------|
| **Tables** | 18 |
| **Entities** | 21 (including embedded) |
| **Relationships** | 22+ |
| **Business Rules** | 60+ |
| **Indexes** | 50+ |
| **API Endpoints** | 50+ |
| **Migration Scripts** | 25+ |

### Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Database** | PostgreSQL 14+ | ACID, JSON support, mature |
| **API** | FastAPI or Express.js | Modern, fast, type-safe |
| **Authentication** | JWT | Stateless, scalable |
| **Migration** | Flyway or Alembic | Version control, rollback |
| **Documentation** | OpenAPI/Swagger | Auto-generated docs |

### Data Model Overview

```
Core Hierarchy:
Department (1) → (M) Employee (1) → (M) Documents
                      ↓
Designation (1) → (M) Employee (1) → (M) CareerHistory
                      ↓
            BankDetails (M) ← (1) Employee
            
Payroll Chain:
Employee (1) → (M) AttendanceRecord
Employee (M) ← (1) PayRun (1) → (M) PayRunEmployeeRecord (1) → (1) Payslip

Financial:
Employee (1) → (M) AdvanceRecord
Employee (1) → (M) LoanRecord (1) → (M) LoanEMI
```

---

## Implementation Roadmap

### Phase 1: Database Setup (Week 1)
- [ ] Set up PostgreSQL database (dev, staging, prod)
- [ ] Run schema migrations (tables, constraints, indexes)
- [ ] Seed reference data (departments, system settings)
- [ ] Verify schema integrity
- [ ] Create database backups

### Phase 2: Backend API Development (Weeks 2-4)
- [ ] Set up backend framework (FastAPI/Express)
- [ ] Implement authentication (JWT)
- [ ] Implement employee CRUD APIs
- [ ] Implement department/designation APIs
- [ ] Implement attendance APIs
- [ ] Implement payroll APIs (pay run generation)
- [ ] Implement advance/loan APIs
- [ ] Implement document upload/download APIs
- [ ] Write unit tests and integration tests

### Phase 3: Frontend Integration (Weeks 5-6)
- [ ] Replace `storageService.ts` with API calls
- [ ] Update authentication flow
- [ ] Update all CRUD operations to use APIs
- [ ] Update payroll generation to use backend
- [ ] Test all features end-to-end
- [ ] Handle error scenarios

### Phase 4: Data Migration (Week 7)
- [ ] Export existing data from localStorage
- [ ] Transform data to match database schema
- [ ] Import data into database
- [ ] Verify data integrity
- [ ] Test application with real data

### Phase 5: Production Deployment (Week 8)
- [ ] Deploy database to production
- [ ] Deploy backend API to production
- [ ] Deploy frontend to production
- [ ] Monitor performance and errors
- [ ] Collect user feedback
- [ ] Iterate and improve

---

## Usage Guide

### For Database Administrators

1. **Setting Up Database**: Follow [02-schema.md](./02-schema.md) for complete DDL
2. **Running Migrations**: Follow [07-migration-strategy.md](./07-migration-strategy.md)
3. **Performance Tuning**: Follow [05-indexing-performance.md](./05-indexing-performance.md)
4. **Backup Strategy**: Regular `pg_dump` before migrations

### For Backend Developers

1. **Understanding Entities**: Start with [01-entities.md](./01-entities.md)
2. **Database Queries**: Reference [03-relationships.md](./03-relationships.md) for JOINs
3. **Business Logic**: Implement rules from [04-business-rules.md](./04-business-rules.md)
4. **API Implementation**: Follow [08-api-design.md](./08-api-design.md)
5. **Testing**: Write tests based on business rules

### For Frontend Developers

1. **API Contracts**: Reference [08-api-design.md](./08-api-design.md)
2. **Data Structures**: Understand entities from [01-entities.md](./01-entities.md)
3. **Replacing storageService**: Map current functions to API calls
4. **Error Handling**: Implement based on API error responses

### For Product Managers

1. **Understanding System**: Read entity descriptions in [01-entities.md](./01-entities.md)
2. **Business Rules**: Review [04-business-rules.md](./04-business-rules.md)
3. **Feature Planning**: Understand constraints and relationships
4. **Roadmap Alignment**: Use implementation roadmap above

---

## Key Design Principles

1. **Data Integrity**: Foreign keys, constraints, and validations at database level
2. **Performance**: Strategic indexing, caching, and denormalization where needed
3. **Scalability**: Designed for 100-10,000 employees with room to grow
4. **Maintainability**: Well-documented, normalized design with clear relationships
5. **Security**: Password hashing, role-based access, data validation
6. **Auditability**: Timestamps, user tracking, historical data preservation
7. **Compliance**: PF, ESI, PT calculations follow Indian statutory requirements

---

## Validation Checklist

Before going live, ensure:

- [ ] All tables created with correct schema
- [ ] All foreign keys and constraints in place
- [ ] All indexes created for performance
- [ ] Seed data loaded (departments, settings)
- [ ] Sample queries execute successfully (< 100ms)
- [ ] Business rules enforced (salary calculations correct)
- [ ] Authentication working (JWT tokens)
- [ ] All API endpoints tested
- [ ] Error handling comprehensive
- [ ] Database backups automated
- [ ] Monitoring and alerting set up

---

## Future Enhancements

Potential additions not in current scope:

1. **Leave Management**: Annual leave, sick leave, casual leave tracking
2. **Timesheet Management**: Project-based time tracking
3. **Performance Reviews**: Appraisal cycles, goal setting
4. **Recruitment**: Job postings, candidate pipeline
5. **Training & Development**: Courses, certifications
6. **Assets Management**: Laptop, phone assignment
7. **Expense Management**: Reimbursement workflows
8. **Multi-tenancy**: Support multiple companies
9. **Audit Logs**: Comprehensive change tracking
10. **Analytics Dashboard**: Advanced reporting with charts

---

## Contributing

When extending the database design:

1. **Update Entity Definitions**: Add to [01-entities.md](./01-entities.md)
2. **Update Schema**: Add migration in [07-migration-strategy.md](./07-migration-strategy.md)
3. **Update Relationships**: Document in [03-relationships.md](./03-relationships.md)
4. **Update Business Rules**: Add to [04-business-rules.md](./04-business-rules.md)
5. **Update API Design**: Add endpoints to [08-api-design.md](./08-api-design.md)
6. **Update Indexes**: Add performance considerations to [05-indexing-performance.md](./05-indexing-performance.md)
7. **Document Rationale**: Explain decisions in [06-assumptions-rationale.md](./06-assumptions-rationale.md)

---

## Support and Maintenance

### Documentation Updates

- Keep in sync with database changes
- Version control all migrations
- Update entity definitions when schema changes
- Document new business rules as they're added

### Code References

- **Current Frontend**: `/services/storageService.ts` simulates backend
- **Types**: `/types/index.ts` defines frontend interfaces
- **Business Logic**: `/utils/helpers.ts` has calculation functions
- **Constants**: `/utils/constants.ts` has PF/ESI/PT rates

### Related Files in Repository

```
ecovale-hr-web-app/
├── db-design/                    ← You are here
│   ├── README.md                 ← This file
│   ├── 01-entities.md
│   ├── 02-schema.md
│   ├── 03-relationships.md
│   ├── 04-business-rules.md
│   ├── 05-indexing-performance.md
│   ├── 06-assumptions-rationale.md
│   ├── 07-migration-strategy.md
│   └── 08-api-design.md
├── services/
│   └── storageService.ts         ← Current simulated backend
├── types/
│   └── index.ts                  ← Frontend type definitions
├── utils/
│   ├── helpers.ts                ← Salary calculation logic
│   └── constants.ts              ← PF/ESI/PT configuration
└── pages/                        ← Frontend pages (reference for features)
```

---

## Contact and Questions

For questions about this database design:

1. Review the relevant section above
2. Check business rules in [04-business-rules.md](./04-business-rules.md)
3. Review entity definitions in [01-entities.md](./01-entities.md)
4. Consult design rationale in [06-assumptions-rationale.md](./06-assumptions-rationale.md)

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-19 | DB Design Team | Initial comprehensive design documentation |

---

## License

This database design documentation is part of the EcoVale HR project and follows the same license as the main repository.

---

**This documentation serves as the single source of truth for the EcoVale HR database design and should be referenced throughout the backend development lifecycle.**
