# AWS RDS MySQL Deployment Guide

## 🎯 Overview

Complete guide to deploy the Ecovale HR Backend with AWS RDS MySQL database.

---

## 📋 Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured (`aws configure`)
- Backend application tested locally
- Understanding of AWS RDS, EC2/ECS basics

---

## 🗄️ Part 1: AWS RDS MySQL Setup

### Step 1: Create RDS MySQL Instance

#### Using AWS Console

1. **Navigate to RDS**
   - Go to AWS Console → RDS → Create Database

2. **Choose Database Creation Method**
   - Select: **Standard Create**

3. **Engine Options**
   - Engine type: **MySQL**
   - Edition: **MySQL Community**
   - Version: **8.0.35** or latest

4. **Templates**
   - For Production: **Production**
   - For Dev/Test: **Dev/Test**

5. **Settings**
   ```
   DB instance identifier: ecovale-hr-db
   Master username: admin
   Master password: [Create strong password - save this!]
   ```

6. **Instance Configuration**
   - For Production: `db.t3.small` or larger
   - For Dev/Test: `db.t3.micro` (Free tier eligible)

7. **Storage**
   - Storage type: **General Purpose SSD (gp3)**
   - Allocated storage: **20 GB** (minimum)
   - Enable storage autoscaling: **Yes**
   - Maximum storage threshold: **100 GB**

8. **Connectivity**
   - Virtual Private Cloud (VPC): Default or create new
   - Public access: **No** (for security)
   - VPC security group: Create new → `ecovale-hr-db-sg`
   - Availability Zone: No preference

9. **Database Authentication**
   - Database authentication: **Password authentication**
   - (Optional: Enable IAM database authentication for enhanced security)

10. **Additional Configuration**
    - Initial database name: `ecovale_hr`
    - DB parameter group: default
    - Backup retention: **7 days** (or more for production)
    - Encryption: **Enable encryption**
    - Monitoring: Enable Enhanced Monitoring

11. **Click "Create Database"**
    - Wait 5-15 minutes for creation

### Step 2: Configure Security Group

Once RDS instance is created:

1. **Go to RDS Dashboard → Databases → ecovale-hr-db**
2. **Click on the VPC security group link**
3. **Edit Inbound Rules:**

```
Type: MySQL/Aurora
Protocol: TCP
Port: 3306
Source: [Your EC2/ECS Security Group ID] or [Your IP for testing]
Description: Allow MySQL from application servers
```

**Security Best Practices:**
- ❌ **NEVER** set source to `0.0.0.0/0` (public internet)
- ✅ Only allow specific security groups or IP ranges
- ✅ Use VPC peering or PrivateLink for cross-VPC access

### Step 3: Note Connection Details

After creation, note these values:

```
Endpoint: ecovale-hr-db.c9abcdefgh.us-east-1.rds.amazonaws.com
Port: 3306
Database Name: ecovale_hr
Master Username: admin
Master Password: [The password you set]
```

### Step 4: Test Connection

From your local machine or EC2 instance:

```bash
# Install MySQL client
sudo apt install mysql-client

# Test connection
mysql -h ecovale-hr-db.c9abcdefgh.us-east-1.rds.amazonaws.com \
      -P 3306 \
      -u admin \
      -p ecovale_hr

# If successful, you'll see:
# mysql>
```

---

## 🚀 Part 2: Application Configuration

### Environment Variables for AWS RDS

Set these environment variables in your deployment environment:

```bash
# AWS RDS Configuration
DB_HOST=ecovale-hr-db.c9abcdefgh.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_NAME=ecovale_hr
DB_USERNAME=admin
DB_PASSWORD=your-secure-master-password
DB_USE_SSL=true

# Production Settings
JPA_DDL_AUTO=validate
JPA_SHOW_SQL=false
JPA_FORMAT_SQL=false
SPRING_PROFILES_ACTIVE=prod
```

### Setting Environment Variables by Deployment Method

#### Option A: EC2 Instance

**Method 1: System Environment Variables**
```bash
# Add to /etc/environment
sudo nano /etc/environment

# Add these lines:
DB_HOST="ecovale-hr-db.c9abcdefgh.us-east-1.rds.amazonaws.com"
DB_PORT="3306"
DB_NAME="ecovale_hr"
DB_USERNAME="admin"
DB_PASSWORD="your-password"
DB_USE_SSL="true"
JPA_DDL_AUTO="validate"
SPRING_PROFILES_ACTIVE="prod"

# Reload environment
source /etc/environment
```

**Method 2: Application Service File**
```bash
# Create systemd service
sudo nano /etc/systemd/system/ecovale-hr.service

[Unit]
Description=Ecovale HR Backend
After=syslog.target network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/ecovale-hr-backend
ExecStart=/usr/bin/java -jar ecovale-hr-backend.jar
Environment="DB_HOST=ecovale-hr-db.c9abcdefgh.us-east-1.rds.amazonaws.com"
Environment="DB_PORT=3306"
Environment="DB_NAME=ecovale_hr"
Environment="DB_USERNAME=admin"
Environment="DB_PASSWORD=your-password"
Environment="DB_USE_SSL=true"
Environment="JPA_DDL_AUTO=validate"
Environment="SPRING_PROFILES_ACTIVE=prod"
SuccessExitStatus=143
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable ecovale-hr
sudo systemctl start ecovale-hr
```

#### Option B: Elastic Beanstalk

1. **Using EB Console:**
   - Configuration → Software → Environment Properties
   - Add each variable as key-value pair

2. **Using EB CLI:**
```bash
eb setenv DB_HOST=ecovale-hr-db.c9abcdefgh.us-east-1.rds.amazonaws.com \
         DB_PORT=3306 \
         DB_NAME=ecovale_hr \
         DB_USERNAME=admin \
         DB_PASSWORD=your-password \
         DB_USE_SSL=true \
         JPA_DDL_AUTO=validate \
         SPRING_PROFILES_ACTIVE=prod
```

#### Option C: ECS/Fargate

In task definition JSON:

```json
{
  "containerDefinitions": [
    {
      "name": "ecovale-hr-backend",
      "image": "your-ecr-repo/ecovale-hr-backend:latest",
      "environment": [
        { "name": "DB_HOST", "value": "ecovale-hr-db.c9abcdefgh.us-east-1.rds.amazonaws.com" },
        { "name": "DB_PORT", "value": "3306" },
        { "name": "DB_NAME", "value": "ecovale_hr" },
        { "name": "DB_USERNAME", "value": "admin" },
        { "name": "DB_USE_SSL", "value": "true" },
        { "name": "JPA_DDL_AUTO", "value": "validate" },
        { "name": "SPRING_PROFILES_ACTIVE", "value": "prod" }
      ],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:ecovale/db/password"
        }
      ]
    }
  ]
}
```

#### Option D: Docker Compose

```yaml
version: '3.8'
services:
  backend:
    image: ecovale-hr-backend:latest
    ports:
      - "8080:8080"
    environment:
      DB_HOST: ecovale-hr-db.c9abcdefgh.us-east-1.rds.amazonaws.com
      DB_PORT: 3306
      DB_NAME: ecovale_hr
      DB_USERNAME: admin
      DB_PASSWORD: ${DB_PASSWORD}  # From .env file
      DB_USE_SSL: true
      JPA_DDL_AUTO: validate
      SPRING_PROFILES_ACTIVE: prod
```

---

## 🔐 Part 3: Enhanced Security with AWS Secrets Manager

### Why Use Secrets Manager?

- ✅ No passwords in environment variables or code
- ✅ Automatic rotation
- ✅ Audit logging
- ✅ Encryption at rest

### Step 1: Create Secret

```bash
# Using AWS CLI
aws secretsmanager create-secret \
    --name ecovale/db/credentials \
    --description "Ecovale HR Database Credentials" \
    --secret-string '{
      "username":"admin",
      "password":"your-secure-password",
      "host":"ecovale-hr-db.c9abcdefgh.us-east-1.rds.amazonaws.com",
      "port":"3306",
      "database":"ecovale_hr"
    }'
```

### Step 2: Grant IAM Permissions

Attach this policy to your EC2/ECS role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:123456789:secret:ecovale/db/credentials-*"
    }
  ]
}
```

### Step 3: Update Application

Add dependency to `pom.xml`:

```xml
<dependency>
    <groupId>com.amazonaws.secretsmanager</groupId>
    <artifactId>aws-secretsmanager-jdbc</artifactId>
    <version>1.0.8</version>
</dependency>
```

Update `application-prod.properties`:

```properties
spring.datasource.url=jdbc-secretsmanager:mysql://ecovale-hr-db.c9abcdefgh.us-east-1.rds.amazonaws.com:3306/ecovale_hr
spring.datasource.username=ecovale/db/credentials
spring.datasource.driver-class-name=com.amazonaws.secretsmanager.sql.AWSSecretsManagerMySQLDriver
```

---

## 📊 Part 4: Database Initialization

### Option 1: Automatic (JPA DDL Auto)

For **initial setup only**, you can use `JPA_DDL_AUTO=update`:

```bash
# First deployment only
export JPA_DDL_AUTO=update

# Run application - tables will be created
java -jar ecovale-hr-backend.jar --spring.profiles.active=prod

# After tables are created, change to:
export JPA_DDL_AUTO=validate
```

### Option 2: Manual Schema Creation (Recommended for Production)

```bash
# Connect to RDS
mysql -h ecovale-hr-db.c9abcdefgh.us-east-1.rds.amazonaws.com \
      -u admin -p ecovale_hr

# Run schema script (from backend/database-schema.sql)
source /path/to/database-schema.sql

# Verify tables
SHOW TABLES;

# Exit
exit
```

Then set `JPA_DDL_AUTO=validate` for production deployments.

---

## 🧪 Part 5: Testing Deployment

### 1. Health Check

```bash
curl http://your-server:8080/actuator/health

# Expected response:
{"status":"UP"}
```

### 2. Database Connection Test

```bash
curl http://your-server:8080/api/designations

# Should return JSON array (empty or with data)
```

### 3. Create Test Employee

```bash
curl -X POST http://your-server:8080/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "gender": "Male",
    "contactNumber": "9876543210",
    "personalEmail": "test@example.com",
    "currentAddress": "Test Address",
    "type": "FULL_TIME",
    "department": "IT",
    "designation": "Software Engineer",
    "officialEmail": "test@ecovale.com",
    "workLocation": "Bangalore",
    "ctc": 1200000,
    "basic": 50000,
    "net": 88800,
    "paymentMode": "Bank",
    "status": "ACTIVE"
  }'
```

---

## 📈 Part 6: Monitoring and Maintenance

### CloudWatch Metrics

Monitor these RDS metrics:

- **CPUUtilization** - Keep < 80%
- **DatabaseConnections** - Monitor connection pool usage
- **FreeStorageSpace** - Enable autoscaling
- **ReadLatency / WriteLatency** - Performance indicators

### CloudWatch Alarms

Create alarms for:

```bash
# High CPU
aws cloudwatch put-metric-alarm \
    --alarm-name ecovale-hr-db-high-cpu \
    --alarm-description "RDS CPU > 80%" \
    --metric-name CPUUtilization \
    --namespace AWS/RDS \
    --statistic Average \
    --period 300 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2
```

### Backup Strategy

1. **Automated Backups:**
   - Enabled by default (7-35 day retention)
   - Taken during maintenance window

2. **Manual Snapshots:**
```bash
aws rds create-db-snapshot \
    --db-instance-identifier ecovale-hr-db \
    --db-snapshot-identifier ecovale-hr-db-snapshot-$(date +%Y%m%d)
```

3. **Point-in-Time Recovery:**
   - Available for any time within retention period

---

## 🔧 Part 7: Performance Tuning

### RDS Parameter Group

Create custom parameter group:

```bash
# Create parameter group
aws rds create-db-parameter-group \
    --db-parameter-group-name ecovale-hr-mysql-params \
    --db-parameter-group-family mysql8.0 \
    --description "Custom MySQL parameters for Ecovale HR"

# Modify parameters
aws rds modify-db-parameter-group \
    --db-parameter-group-name ecovale-hr-mysql-params \
    --parameters "ParameterName=max_connections,ParameterValue=200,ApplyMethod=immediate" \
                 "ParameterName=innodb_buffer_pool_size,ParameterValue={DBInstanceClassMemory*3/4},ApplyMethod=pending-reboot"

# Apply to RDS instance
aws rds modify-db-instance \
    --db-instance-identifier ecovale-hr-db \
    --db-parameter-group-name ecovale-hr-mysql-params \
    --apply-immediately
```

### Application-Side Optimizations

Already configured in `application-prod.properties`:

- Connection pooling (HikariCP)
- Batch inserts/updates
- Query optimization
- Open-in-view disabled

---

## 📋 Deployment Checklist

### Pre-Deployment

- [ ] RDS instance created and running
- [ ] Security group configured (only application access)
- [ ] Database `ecovale_hr` created
- [ ] Master password saved securely
- [ ] Connection tested from application server

### Application Configuration

- [ ] Environment variables set correctly
- [ ] `DB_HOST` points to RDS endpoint
- [ ] `DB_USE_SSL=true` enabled
- [ ] `JPA_DDL_AUTO=validate` for production
- [ ] `SPRING_PROFILES_ACTIVE=prod` set
- [ ] Application logs show successful database connection

### Security

- [ ] SSL/TLS enabled for database connections
- [ ] Passwords not in code or version control
- [ ] Security groups restrict access
- [ ] Encryption at rest enabled
- [ ] Automated backups configured
- [ ] CloudWatch alarms created

### Testing

- [ ] Health endpoint returns UP
- [ ] Can create/read/update/delete employees
- [ ] Application logs show no connection errors
- [ ] Performance acceptable under load

---

## 🚨 Troubleshooting

### Connection Timeout

**Symptom:** `Communications link failure`

**Solutions:**
1. Check security group allows your server IP/security group
2. Verify RDS instance is in same VPC as application
3. Check route tables and network ACLs

### Authentication Failed

**Symptom:** `Access denied for user`

**Solutions:**
1. Verify username and password correct
2. Check user has permissions: `GRANT ALL PRIVILEGES ON ecovale_hr.* TO 'admin'@'%';`
3. Ensure password doesn't have special characters causing shell issues

### SSL/TLS Errors

**Symptom:** `SSL connection error`

**Solutions:**
1. Download RDS certificate bundle:
```bash
wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```
2. Update JDBC URL:
```properties
spring.datasource.url=jdbc:mysql://host:3306/db?useSSL=true&requireSSL=true&serverSslCert=/path/to/global-bundle.pem
```

### Schema Mismatch

**Symptom:** `Table doesn't exist` or `Column not found`

**Solutions:**
1. Run database schema script manually
2. Temporarily set `JPA_DDL_AUTO=update` (dev only)
3. Check entity class matches database schema

---

## 💰 Cost Optimization

### RDS Pricing (us-east-1 example)

- **db.t3.micro:** ~$15/month (Free tier: 750 hours/month for 12 months)
- **db.t3.small:** ~$30/month
- **db.t3.medium:** ~$60/month
- **Storage:** $0.115/GB/month (gp3)

### Cost Saving Tips

1. **Use Reserved Instances** - Save up to 60% for 1-3 year commitment
2. **Stop during off-hours** - Dev/test environments
3. **Right-size instance** - Monitor CPU and adjust
4. **Enable storage autoscaling** - Avoid over-provisioning
5. **Delete old snapshots** - Cleanup policy

---

## 📚 Additional Resources

- **AWS RDS Documentation:** https://docs.aws.amazon.com/rds/
- **Spring Boot AWS Deployment:** https://spring.io/guides/gs/spring-boot-docker/
- **AWS Secrets Manager with Spring Boot:** https://docs.aws.amazon.com/secretsmanager/latest/userguide/integrating.html

---

**Your AWS RDS MySQL deployment is ready! 🎉**
