# Database Migration & Backup Guide

Complete guide for database migrations using Flyway and automated backup strategies for the Ecovale HR System.

---

## 📋 Table of Contents

1. [Flyway Database Migrations](#flyway-database-migrations)
2. [Migration Scripts](#migration-scripts)
3. [Running Migrations](#running-migrations)
4. [Automated Backups](#automated-backups)
5. [Restore Instructions](#restore-instructions)
6. [Migration Best Practices](#migration-best-practices)
7. [Troubleshooting](#troubleshooting)

---

## 🔄 Flyway Database Migrations

### What is Flyway?

Flyway is a database migration tool that manages database schema changes through versioned SQL scripts. It ensures:

- **Version Control**: Database schema is versioned like application code
- **Consistency**: Same schema across all environments (dev, staging, prod)
- **Auditability**: Track all changes with timestamps and checksums
- **Safety**: Validates migrations before applying
- **Rollback Support**: Can revert to previous versions

### Configuration

Flyway is configured in `application.properties`:

```properties
# Enable Flyway
spring.flyway.enabled=true

# Migration scripts location
spring.flyway.locations=classpath:db/migration

# Create baseline for existing database
spring.flyway.baseline-on-migrate=true
spring.flyway.baseline-version=0

# Validate migrations on startup
spring.flyway.validate-on-migrate=true

# Prevent out-of-order migrations in production
spring.flyway.out-of-order=false
```

### Production Configuration

In `application-prod.properties`:

```properties
spring.flyway.enabled=true
spring.flyway.validate-on-migrate=true
spring.flyway.clean-disabled=true  # NEVER clean in production!
spring.flyway.out-of-order=false
```

---

## 📝 Migration Scripts

### Naming Convention

Migration files follow Flyway's naming pattern:

```
V{version}__{description}.sql
```

Examples:
- `V1__Create_users_and_roles_tables.sql`
- `V2__Create_designations_table.sql`
- `V3__Create_employees_table.sql`

### Available Migrations

| Version | File | Description |
|---------|------|-------------|
| V1 | `V1__Create_users_and_roles_tables.sql` | User authentication tables |
| V2 | `V2__Create_designations_table.sql` | Job designations |
| V3 | `V3__Create_employees_table.sql` | Main employee table |
| V4 | `V4__Create_audit_logs_table.sql` | Audit logging |
| V5 | `V5__Create_attendance_records_table.sql` | Attendance tracking |
| V6 | `V6__Create_loan_records_table.sql` | Employee loans |
| V7 | `V7__Create_advance_records_table.sql` | Salary advances |

### Migration Script Structure

Each migration includes:

1. **Header Comments**
   ```sql
   -- =================================================================
   -- Flyway Migration V1: Create Users and Roles Tables
   -- Author: Ecovale HR Team
   -- Date: 2026-01-26
   -- Description: Initial schema for authentication
   -- =================================================================
   ```

2. **Table Creation**
   ```sql
   CREATE TABLE IF NOT EXISTS users (
       id BIGINT AUTO_INCREMENT PRIMARY KEY,
       username VARCHAR(100) NOT NULL UNIQUE,
       -- ... more columns
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
   ```

3. **Indexes**
   ```sql
   INDEX idx_username (username),
   INDEX idx_email (email)
   ```

4. **Foreign Keys**
   ```sql
   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   ```

5. **Initial Data (if needed)**
   ```sql
   INSERT INTO roles (name, description) VALUES
       ('ROLE_ADMIN', 'System administrator')
   ON DUPLICATE KEY UPDATE description = VALUES(description);
   ```

---

## 🚀 Running Migrations

### Automatic Migration on Startup

By default, Flyway runs automatically when the application starts:

```bash
cd backend
mvn spring-boot:run
```

You'll see migration logs:

```
INFO  FlywayExecutor : Flyway Community Edition by Redgate
INFO  FlywayExecutor : Database: jdbc:mysql://localhost:3306/ecovale_hr
INFO  FlywayExecutor : Successfully validated 7 migrations
INFO  FlywayExecutor : Current version: 0
INFO  FlywayExecutor : Migrating schema to version 1 - Create users and roles tables
INFO  FlywayExecutor : Migrating schema to version 2 - Create designations table
...
INFO  FlywayExecutor : Successfully applied 7 migrations
```

### Manual Migration Commands

#### 1. Check Migration Status

```bash
mvn flyway:info -Dflyway.configFiles=src/main/resources/application.properties
```

Output shows:
- Installed migrations
- Pending migrations
- Current version
- Checksum validation

#### 2. Validate Migrations

```bash
mvn flyway:validate
```

Checks:
- Script checksums match
- No out-of-order migrations
- Schema matches expectations

#### 3. Apply Migrations Manually

```bash
mvn flyway:migrate
```

#### 4. Repair Metadata (if checksums fail)

```bash
mvn flyway:repair
```

⚠️ **Use with caution** - only when you know why checksums differ

### Initial Setup for Existing Database

If you already have an existing database:

1. **Baseline the database**
   ```bash
   mvn flyway:baseline
   ```

2. **Flyway will skip V1-V7** and start from V8 onwards

3. **Or manually create migration table**
   ```sql
   CREATE TABLE flyway_schema_history (
       installed_rank INT NOT NULL,
       version VARCHAR(50),
       description VARCHAR(200) NOT NULL,
       type VARCHAR(20) NOT NULL,
       script VARCHAR(1000) NOT NULL,
       checksum INT,
       installed_by VARCHAR(100) NOT NULL,
       installed_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       execution_time INT NOT NULL,
       success BOOLEAN NOT NULL,
       PRIMARY KEY (installed_rank)
   );
   ```

---

## 💾 Automated Backups

### Backup Strategy

The system includes automated MySQL backups with:

- **Compression**: gzip compression to save space
- **Retention**: 30-day retention policy (configurable)
- **Validation**: Automatic backup verification
- **Scheduling**: Cron-based automation
- **Notifications**: Email alerts (optional)
- **Safety**: Pre-restore safety backups

### Backup Scripts

#### 1. Manual Backup

```bash
cd backend/database-backups
chmod +x backup-mysql.sh
./backup-mysql.sh
```

**Output:**
```
[2026-01-26 14:30:00] Starting MySQL backup for Ecovale HR database
[2026-01-26 14:30:01] Creating database backup...
[✓] Database backup created: ecovale_hr_backup_20260126_143001.sql
[2026-01-26 14:30:02] Backup size: 2.5M
[2026-01-26 14:30:03] Compressing backup...
[✓] Backup compressed: ecovale_hr_backup_20260126_143001.sql.gz (450K)
[✓] Backup verification successful
[✓] Backup completed successfully!
```

#### 2. Configure Environment Variables

Create `.env` file in `database-backups/` directory:

```bash
# Database credentials
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ecovale_hr
DB_USER=root
DB_PASSWORD=yourpassword

# Backup configuration
BACKUP_DIR=./backups
RETENTION_DAYS=30

# Email notifications (optional)
NOTIFY_EMAIL=admin@ecovale.com
NOTIFY_ON_SUCCESS=false
NOTIFY_ON_FAILURE=true
```

**Load environment variables:**
```bash
source .env
./backup-mysql.sh
```

#### 3. Automated Cron Backups

Setup automated daily backups:

```bash
cd backend/database-backups
chmod +x setup-cron-backup.sh
./setup-cron-backup.sh
```

**Interactive prompts:**
```
Select backup frequency:
  1. Daily at 2:00 AM
  2. Daily at midnight (12:00 AM)
  3. Every 6 hours
  4. Every 12 hours
  5. Custom schedule

Enter choice (1-5): 1
```

**Verify cron job:**
```bash
crontab -l
```

Should show:
```cron
# Ecovale HR Database Backup - Daily at 2:00 AM
0 2 * * * cd /path/to/database-backups && ./backup-mysql.sh >> /path/to/backup.log 2>&1
```

#### 4. Monitor Backup Logs

```bash
tail -f database-backups/backup.log
```

---

## 🔄 Restore Instructions

### Restore from Backup

#### 1. Interactive Restore

```bash
cd backend/database-backups
chmod +x restore-mysql.sh
./restore-mysql.sh
```

**Interactive flow:**

```
==========================================
Ecovale HR Database Restore Utility
==========================================

[2026-01-26 15:00:00] Verifying database connection...
[✓] Database connection successful

[2026-01-26 15:00:01] Available backups in ./backups:

  1. ecovale_hr_backup_20260126_143001.sql.gz      450K  2026-01-26 14:30:01
  2. ecovale_hr_backup_20260125_020001.sql.gz      445K  2026-01-25 02:00:01
  3. ecovale_hr_backup_20260124_020001.sql.gz      440K  2026-01-24 02:00:01

Enter backup filename (or 'latest' for most recent): latest

[2026-01-26 15:00:05] Selected backup: ecovale_hr_backup_20260126_143001.sql.gz

Restore Configuration:
  Source: ecovale_hr_backup_20260126_143001.sql.gz
  Size: 450K
  Target Database: ecovale_hr@localhost

[!] ⚠️  WARNING: This will overwrite the current database!
[!] ⚠️  All existing data will be replaced with the backup.

Do you want to proceed with the restore? (yes/no): yes
Create a safety backup of the current database before restore? (yes/no): yes

[2026-01-26 15:00:10] Creating safety backup of current database...
[✓] Safety backup created: safety_backup_20260126_150010.sql.gz

[!] FINAL CONFIRMATION: This is your last chance to cancel!
Are you absolutely sure you want to restore the database? (yes/no): yes

[2026-01-26 15:00:15] Starting database restore...
[2026-01-26 15:00:16] Target database: ecovale_hr@localhost
[2026-01-26 15:00:17] Decompressing and restoring...
[✓] Database restore completed successfully!

===========================================
Database Restore Completed Successfully!
===========================================
```

#### 2. Command-Line Restore (Advanced)

```bash
# Decompress backup
gunzip ecovale_hr_backup_20260126_143001.sql.gz

# Restore to database
mysql -h localhost -u root -p ecovale_hr < ecovale_hr_backup_20260126_143001.sql
```

#### 3. Restore to Different Database

```bash
# Create new database
mysql -h localhost -u root -p -e "CREATE DATABASE ecovale_hr_restored;"

# Restore backup to new database
gunzip -c ecovale_hr_backup_20260126_143001.sql.gz | \
    mysql -h localhost -u root -p ecovale_hr_restored
```

### Emergency Restore Procedures

#### Scenario 1: Production Data Loss

1. **Stop application immediately**
   ```bash
   sudo systemctl stop ecovale-hr
   ```

2. **Identify latest valid backup**
   ```bash
   cd database-backups/backups
   ls -lht ecovale_hr_backup_*.sql.gz | head -5
   ```

3. **Restore from backup**
   ```bash
   ./restore-mysql.sh
   # Select latest backup
   ```

4. **Verify data integrity**
   ```bash
   mysql -h localhost -u root -p ecovale_hr -e "SELECT COUNT(*) FROM employees;"
   ```

5. **Restart application**
   ```bash
   sudo systemctl start ecovale-hr
   sudo systemctl status ecovale-hr
   ```

#### Scenario 2: Migration Failure

1. **Check Flyway status**
   ```bash
   mysql -h localhost -u root -p ecovale_hr -e "SELECT * FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 5;"
   ```

2. **Restore from pre-migration backup**
   ```bash
   ./restore-mysql.sh
   # Select backup before migration
   ```

3. **Fix migration script**
   - Update SQL file
   - Fix syntax errors
   - Update checksums

4. **Repair Flyway metadata**
   ```bash
   mvn flyway:repair
   ```

5. **Retry migration**
   ```bash
   mvn flyway:migrate
   ```

---

## 📚 Migration Best Practices

### 1. Always Backup Before Migration

```bash
# Create manual backup before risky changes
./backup-mysql.sh
```

### 2. Test Migrations in Development

```bash
# Test on local database first
export SPRING_PROFILES_ACTIVE=dev
mvn spring-boot:run
```

### 3. Write Idempotent Migrations

Use `IF NOT EXISTS` and `ON DUPLICATE KEY UPDATE`:

```sql
CREATE TABLE IF NOT EXISTS users (...);

INSERT INTO roles (name) VALUES ('ROLE_ADMIN')
ON DUPLICATE KEY UPDATE name = VALUES(name);
```

### 4. Never Edit Applied Migrations

❌ **Don't modify** migrations that have already been applied  
✅ **Create new migration** (V8, V9, etc.) for changes

### 5. Add Indexes for Performance

```sql
CREATE INDEX idx_employee_name ON employees(first_name, last_name);
CREATE INDEX idx_department ON employees(department);
```

### 6. Use Transactions

```sql
START TRANSACTION;

-- Your migration SQL here

COMMIT;
```

### 7. Document Complex Changes

```sql
-- =================================================================
-- Migration V8: Add employee performance tracking
-- Reason: New performance review system requirement
-- Impact: Adds new table, no data migration needed
-- Rollback: DROP TABLE employee_reviews;
-- =================================================================
```

---

## 🔧 Troubleshooting

### Issue 1: Checksum Mismatch

**Error:**
```
Migration checksum mismatch for migration V1
Expected: 123456789
Actual:   987654321
```

**Solutions:**

1. **If script was legitimately changed:**
   ```bash
   mvn flyway:repair
   ```

2. **If script should not have changed:**
   - Restore original script from version control
   - Verify file integrity

### Issue 2: Migration Failed

**Error:**
```
Migration V5 failed
SQL State: 42S01
Error Code: 1050
Message: Table 'attendance_records' already exists
```

**Solutions:**

1. **Check current state:**
   ```bash
   mysql -h localhost -u root -p ecovale_hr -e "SHOW TABLES;"
   ```

2. **Mark migration as successful manually:**
   ```sql
   INSERT INTO flyway_schema_history (
       installed_rank, version, description, type, script,
       checksum, installed_by, installed_on, execution_time, success
   ) VALUES (
       5, '5', 'Create attendance records table', 'SQL',
       'V5__Create_attendance_records_table.sql',
       12345, 'admin', NOW(), 100, TRUE
   );
   ```

3. **Or drop table and retry:**
   ```sql
   DROP TABLE IF EXISTS attendance_records;
   ```
   ```bash
   mvn flyway:migrate
   ```

### Issue 3: Backup Script Permission Denied

**Error:**
```bash
./backup-mysql.sh: Permission denied
```

**Solution:**
```bash
chmod +x backup-mysql.sh
chmod +x restore-mysql.sh
chmod +x setup-cron-backup.sh
```

### Issue 4: mysqldump Command Not Found

**Error:**
```
mysqldump: command not found
```

**Solution:**

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install mysql-client
```

**RHEL/CentOS:**
```bash
sudo yum install mysql
```

**macOS:**
```bash
brew install mysql-client
```

### Issue 5: Disk Space Full

**Error:**
```
ERROR: No space left on device
```

**Solutions:**

1. **Check disk space:**
   ```bash
   df -h
   ```

2. **Clean old backups:**
   ```bash
   find ./backups -name "*.sql.gz" -mtime +7 -delete
   ```

3. **Compress existing backups:**
   ```bash
   gzip backups/*.sql
   ```

4. **Move backups to external storage:**
   ```bash
   aws s3 sync ./backups s3://your-bucket/backups/
   ```

---

## ✅ Pre-Production Checklist

Before deploying to production:

- [ ] All migrations tested in development
- [ ] Backup strategy configured
- [ ] Cron job for automated backups enabled
- [ ] Restore procedure tested
- [ ] Flyway validation enabled in production
- [ ] `spring.flyway.clean-disabled=true` in production
- [ ] Database credentials secured (environment variables)
- [ ] Backup retention policy configured
- [ ] Monitoring and alerting set up
- [ ] Documentation updated

---

## 📞 Support

For migration or backup issues:

1. Check logs: `tail -f logs/spring-boot.log`
2. Check backup logs: `tail -f database-backups/backup.log`
3. Verify Flyway status: `mvn flyway:info`
4. Contact: devops@ecovale.com

---

**Database Safety First! Always backup before making changes! 🔒**
