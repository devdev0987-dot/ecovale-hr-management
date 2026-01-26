# 🚀 AWS EC2 Deployment Guide

## Overview

Complete step-by-step guide to deploy Ecovale HR Backend on AWS EC2 with RDS MySQL.

---

## 📋 Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    AWS Cloud                        │
│                                                     │
│  ┌──────────────┐         ┌──────────────┐        │
│  │   EC2        │         │   RDS MySQL  │        │
│  │   Instance   │────────▶│   Database   │        │
│  │   :8080      │         │   :3306      │        │
│  └──────┬───────┘         └──────────────┘        │
│         │                                           │
│  ┌──────▼───────────────────────────────┐         │
│  │     Security Groups                  │         │
│  │  - SSH (22) from your IP            │         │
│  │  - HTTP (8080) from anywhere        │         │
│  │  - MySQL (3306) EC2 ↔ RDS only     │         │
│  └──────────────────────────────────────┘         │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 Prerequisites

- AWS Account with billing enabled
- AWS CLI installed and configured
- SSH key pair created
- Domain name (optional, for production)

---

## Part 1: Setup AWS RDS MySQL

### Step 1: Create RDS Instance

```bash
# Using AWS Console:
# 1. Go to RDS → Create Database
# 2. Engine: MySQL 8.0
# 3. Template: Free tier (or Production)
# 4. Settings:
#    - DB instance identifier: ecovale-hr-db
#    - Master username: admin
#    - Master password: [Create strong password]
# 5. Instance: db.t3.micro (or larger for production)
# 6. Storage: 20 GB, enable autoscaling
# 7. Connectivity:
#    - VPC: Default
#    - Public access: No
#    - VPC security group: Create new → ecovale-rds-sg
# 8. Initial database name: ecovale_hr
# 9. Create Database
```

**Or using AWS CLI:**

```bash
aws rds create-db-instance \
    --db-instance-identifier ecovale-hr-db \
    --db-instance-class db.t3.micro \
    --engine mysql \
    --engine-version 8.0.35 \
    --master-username admin \
    --master-user-password YourSecurePassword123! \
    --allocated-storage 20 \
    --storage-type gp3 \
    --vpc-security-group-ids sg-xxxxx \
    --db-name ecovale_hr \
    --backup-retention-period 7 \
    --no-publicly-accessible
```

### Step 2: Note RDS Connection Details

After creation (takes 5-10 minutes):

```bash
# Get endpoint
aws rds describe-db-instances \
    --db-instance-identifier ecovale-hr-db \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text

# Output example:
# ecovale-hr-db.c9abcdefgh.us-east-1.rds.amazonaws.com
```

**Save these details:**
```
RDS Endpoint: ecovale-hr-db.c9abcdefgh.us-east-1.rds.amazonaws.com
Port: 3306
Database: ecovale_hr
Username: admin
Password: YourSecurePassword123!
```

---

## Part 2: Launch EC2 Instance

### Step 1: Create EC2 Instance

**Using AWS Console:**

1. **Go to EC2 → Launch Instance**

2. **Name and Tags**
   - Name: `ecovale-hr-backend`

3. **Choose AMI**
   - Ubuntu Server 22.04 LTS (Free tier eligible)
   - 64-bit (x86)

4. **Instance Type**
   - Free tier: `t2.micro` (1 vCPU, 1GB RAM)
   - Production: `t3.small` or larger (2 vCPU, 2GB RAM)

5. **Key Pair**
   - Create new key pair: `ecovale-hr-key.pem`
   - Download and save securely
   ```bash
   chmod 400 ecovale-hr-key.pem
   ```

6. **Network Settings**
   - VPC: Default (same as RDS)
   - Auto-assign public IP: Enable
   - Create security group: `ecovale-ec2-sg`

7. **Configure Storage**
   - 20 GB gp3 SSD

8. **Advanced Details**
   - IAM instance profile: (Optional, for AWS services access)

9. **Launch Instance**

**Or using AWS CLI:**

```bash
aws ec2 run-instances \
    --image-id ami-0c7217cdde317cfec \
    --instance-type t2.micro \
    --key-name ecovale-hr-key \
    --security-group-ids sg-xxxxx \
    --subnet-id subnet-xxxxx \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=ecovale-hr-backend}]'
```

### Step 2: Get Instance Details

```bash
# Get public IP
aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=ecovale-hr-backend" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text

# Output example: 54.123.45.67
```

---

## Part 3: Configure Security Groups

### Step 1: EC2 Security Group (ecovale-ec2-sg)

**Inbound Rules:**

| Type | Protocol | Port | Source | Description |
|------|----------|------|--------|-------------|
| SSH | TCP | 22 | Your IP/32 | SSH access |
| Custom TCP | TCP | 8080 | 0.0.0.0/0 | Backend API |
| Custom TCP | TCP | 8080 | ::/0 | Backend API (IPv6) |

**Using AWS Console:**
1. Go to EC2 → Security Groups → ecovale-ec2-sg
2. Edit inbound rules
3. Add rules as above

**Using AWS CLI:**

```bash
# Get your IP
MY_IP=$(curl -s https://checkip.amazonaws.com)

# Get EC2 security group ID
EC2_SG=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=ecovale-ec2-sg" \
    --query 'SecurityGroups[0].GroupId' \
    --output text)

# Add SSH rule
aws ec2 authorize-security-group-ingress \
    --group-id $EC2_SG \
    --protocol tcp \
    --port 22 \
    --cidr $MY_IP/32

# Add HTTP rule (port 8080)
aws ec2 authorize-security-group-ingress \
    --group-id $EC2_SG \
    --protocol tcp \
    --port 8080 \
    --cidr 0.0.0.0/0
```

### Step 2: RDS Security Group (ecovale-rds-sg)

**Inbound Rules:**

| Type | Protocol | Port | Source | Description |
|------|----------|------|--------|-------------|
| MySQL/Aurora | TCP | 3306 | ecovale-ec2-sg | Allow from EC2 |

**Using AWS Console:**
1. Go to RDS → Databases → ecovale-hr-db → Connectivity
2. Click on VPC security group
3. Edit inbound rules
4. Add: Type=MySQL/Aurora, Source=ecovale-ec2-sg

**Using AWS CLI:**

```bash
# Get RDS security group ID
RDS_SG=$(aws rds describe-db-instances \
    --db-instance-identifier ecovale-hr-db \
    --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
    --output text)

# Add MySQL rule (allow from EC2 security group)
aws ec2 authorize-security-group-ingress \
    --group-id $RDS_SG \
    --protocol tcp \
    --port 3306 \
    --source-group $EC2_SG
```

---

## Part 4: Connect to EC2 Instance

### Step 1: SSH into EC2

```bash
# Set correct permissions
chmod 400 ecovale-hr-key.pem

# Connect (replace with your instance IP)
ssh -i ecovale-hr-key.pem ubuntu@54.123.45.67
```

### Step 2: Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### Step 3: Install Java 17

```bash
# Install OpenJDK 17
sudo apt install openjdk-17-jre-headless -y

# Verify installation
java -version
# Output: openjdk version "17.0.x"
```

### Step 4: Install MySQL Client (for testing)

```bash
sudo apt install mysql-client -y
```

---

## Part 5: Test Database Connection

```bash
# Test RDS connection from EC2
mysql -h ecovale-hr-db.c9abcdefgh.us-east-1.rds.amazonaws.com \
      -P 3306 \
      -u admin \
      -p

# Enter password when prompted

# If successful, you'll see:
# mysql>

# Verify database exists
SHOW DATABASES;
USE ecovale_hr;

# Exit
exit
```

**If connection fails:**
- Check RDS security group allows EC2 security group
- Verify RDS endpoint is correct
- Ensure EC2 and RDS are in same VPC

---

## Part 6: Deploy Backend Application

### Step 1: Transfer JAR File to EC2

**Option A: Build locally and transfer**

```bash
# On your local machine:
cd backend
mvn clean package -DskipTests

# Transfer to EC2 (replace with your IP and key)
scp -i ecovale-hr-key.pem \
    target/ecovale-hr-backend.jar \
    ubuntu@54.123.45.67:/home/ubuntu/
```

**Option B: Build on EC2**

```bash
# On EC2 instance:

# Install Maven
sudo apt install maven -y

# Install Git
sudo apt install git -y

# Clone repository
cd /home/ubuntu
git clone <your-repo-url>
cd ecovale-hr-web-app/backend

# Build
mvn clean package -DskipTests

# JAR is now at: target/ecovale-hr-backend.jar
```

### Step 2: Create Application Directory

```bash
# Create directory
sudo mkdir -p /opt/ecovale-hr
sudo chown ubuntu:ubuntu /opt/ecovale-hr

# Move JAR
mv ~/ecovale-hr-backend.jar /opt/ecovale-hr/

# Or if built on EC2:
cp ~/ecovale-hr-web-app/backend/target/*.jar /opt/ecovale-hr/ecovale-hr-backend.jar
```

### Step 3: Set Environment Variables

```bash
# Create environment file
sudo nano /opt/ecovale-hr/application.env
```

**Add this content (replace with your RDS details):**

```bash
# Database Configuration
DB_HOST=ecovale-hr-db.c9abcdefgh.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_NAME=ecovale_hr
DB_USERNAME=admin
DB_PASSWORD=YourSecurePassword123!
DB_USE_SSL=true

# JPA Configuration
JPA_DDL_AUTO=update
JPA_SHOW_SQL=false
JPA_FORMAT_SQL=false

# Spring Profile
SPRING_PROFILES_ACTIVE=prod

# Server Port
SERVER_PORT=8080
```

**Secure the file:**

```bash
sudo chmod 600 /opt/ecovale-hr/application.env
sudo chown ubuntu:ubuntu /opt/ecovale-hr/application.env
```

---

## Part 7: Run as Background Service

### Step 1: Create Systemd Service

```bash
sudo nano /etc/systemd/system/ecovale-hr.service
```

**Add this content:**

```ini
[Unit]
Description=Ecovale HR Backend Service
After=syslog.target network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/ecovale-hr
EnvironmentFile=/opt/ecovale-hr/application.env

# Java options
Environment="JAVA_OPTS=-Xms512m -Xmx1024m -XX:+UseG1GC"

# Run command
ExecStart=/usr/bin/java $JAVA_OPTS -jar /opt/ecovale-hr/ecovale-hr-backend.jar

# Restart policy
Restart=always
RestartSec=10
StandardOutput=append:/var/log/ecovale-hr/application.log
StandardError=append:/var/log/ecovale-hr/error.log

# Limits
SuccessExitStatus=143
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

### Step 2: Create Log Directory

```bash
sudo mkdir -p /var/log/ecovale-hr
sudo chown ubuntu:ubuntu /var/log/ecovale-hr
```

### Step 3: Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable ecovale-hr

# Start service
sudo systemctl start ecovale-hr

# Check status
sudo systemctl status ecovale-hr
```

**Expected output:**
```
● ecovale-hr.service - Ecovale HR Backend Service
     Loaded: loaded (/etc/systemd/system/ecovale-hr.service; enabled)
     Active: active (running) since Sun 2026-01-26 10:00:00 UTC
```

### Step 4: Verify Application is Running

```bash
# Check if application started
sudo journalctl -u ecovale-hr -f

# Wait for this line:
# Started EcovaleHrBackendApplication in X.XXX seconds

# Test health endpoint
curl http://localhost:8080/actuator/health

# Expected:
# {"status":"UP"}
```

---

## Part 8: Service Management Commands

### Control Service

```bash
# Start service
sudo systemctl start ecovale-hr

# Stop service
sudo systemctl stop ecovale-hr

# Restart service
sudo systemctl restart ecovale-hr

# Check status
sudo systemctl status ecovale-hr

# Enable on boot
sudo systemctl enable ecovale-hr

# Disable on boot
sudo systemctl disable ecovale-hr
```

### View Logs

```bash
# Follow logs (real-time)
sudo journalctl -u ecovale-hr -f

# Last 100 lines
sudo journalctl -u ecovale-hr -n 100

# View application log
tail -f /var/log/ecovale-hr/application.log

# View error log
tail -f /var/log/ecovale-hr/error.log
```

---

## Part 9: Test Deployment

### From EC2 Instance

```bash
# Health check
curl http://localhost:8080/actuator/health

# Get designations
curl http://localhost:8080/api/designations

# Create test employee
curl -X POST http://localhost:8080/api/employees \
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

### From Your Local Machine

```bash
# Replace with your EC2 public IP
EC2_IP=54.123.45.67

# Health check
curl http://$EC2_IP:8080/actuator/health

# Get employees
curl http://$EC2_IP:8080/api/employees
```

---

## Part 10: Update Deployed Application

### Method 1: Manual Update

```bash
# 1. Build new JAR locally
mvn clean package -DskipTests

# 2. Transfer to EC2
scp -i ecovale-hr-key.pem \
    target/ecovale-hr-backend.jar \
    ubuntu@54.123.45.67:/home/ubuntu/

# 3. SSH to EC2
ssh -i ecovale-hr-key.pem ubuntu@54.123.45.67

# 4. Stop service
sudo systemctl stop ecovale-hr

# 5. Backup old JAR
sudo cp /opt/ecovale-hr/ecovale-hr-backend.jar \
       /opt/ecovale-hr/ecovale-hr-backend.jar.backup

# 6. Replace JAR
sudo mv ~/ecovale-hr-backend.jar /opt/ecovale-hr/

# 7. Start service
sudo systemctl start ecovale-hr

# 8. Verify
sudo systemctl status ecovale-hr
curl http://localhost:8080/actuator/health
```

### Method 2: Automated Deployment Script

Create `/opt/ecovale-hr/deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Stop service
echo "⏹️  Stopping service..."
sudo systemctl stop ecovale-hr

# Backup current JAR
echo "💾 Backing up current version..."
sudo cp /opt/ecovale-hr/ecovale-hr-backend.jar \
       /opt/ecovale-hr/ecovale-hr-backend.jar.backup.$(date +%Y%m%d_%H%M%S)

# Download new JAR (from S3, Git, or local)
echo "⬇️  Downloading new version..."
# Option A: From S3
# aws s3 cp s3://your-bucket/ecovale-hr-backend.jar /tmp/ecovale-hr-backend.jar

# Option B: Build from Git
cd /tmp
git clone <your-repo-url> repo-temp
cd repo-temp/backend
mvn clean package -DskipTests
cp target/ecovale-hr-backend.jar /tmp/
cd /tmp && rm -rf repo-temp

# Replace JAR
echo "📦 Installing new version..."
sudo mv /tmp/ecovale-hr-backend.jar /opt/ecovale-hr/ecovale-hr-backend.jar

# Start service
echo "▶️  Starting service..."
sudo systemctl start ecovale-hr

# Wait for startup
echo "⏳ Waiting for application to start..."
sleep 15

# Health check
echo "🏥 Checking health..."
if curl -f http://localhost:8080/actuator/health; then
    echo "✅ Deployment successful!"
else
    echo "❌ Deployment failed! Rolling back..."
    sudo systemctl stop ecovale-hr
    sudo mv /opt/ecovale-hr/ecovale-hr-backend.jar.backup.* \
           /opt/ecovale-hr/ecovale-hr-backend.jar
    sudo systemctl start ecovale-hr
    exit 1
fi
```

**Make executable:**
```bash
chmod +x /opt/ecovale-hr/deploy.sh
```

**Run deployment:**
```bash
/opt/ecovale-hr/deploy.sh
```

---

## Part 11: Setup SSL/HTTPS (Optional)

### Using Let's Encrypt with Nginx

```bash
# Install Nginx
sudo apt install nginx -y

# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Configure Nginx
sudo nano /etc/nginx/sites-available/ecovale-hr
```

**Add:**

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Enable and get certificate:**

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ecovale-hr /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal is configured automatically
```

**Update EC2 security group:**
- Add inbound rule: Type=HTTP, Port=80, Source=0.0.0.0/0
- Add inbound rule: Type=HTTPS, Port=443, Source=0.0.0.0/0

---

## Part 12: Monitoring and Maintenance

### CloudWatch Logs Setup

```bash
# Install CloudWatch Agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb

# Configure agent
sudo nano /opt/aws/amazon-cloudwatch-agent/etc/config.json
```

**Add:**

```json
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/ecovale-hr/application.log",
            "log_group_name": "/ecovale-hr/application",
            "log_stream_name": "{instance_id}"
          },
          {
            "file_path": "/var/log/ecovale-hr/error.log",
            "log_group_name": "/ecovale-hr/errors",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
```

### Database Backups

```bash
# Create backup script
sudo nano /opt/ecovale-hr/backup-db.sh
```

**Add:**

```bash
#!/bin/bash
BACKUP_DIR="/opt/ecovale-hr/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

mysqldump -h ecovale-hr-db.c9abcdefgh.us-east-1.rds.amazonaws.com \
          -u admin -p'YourPassword' ecovale_hr \
          > $BACKUP_DIR/backup_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete

# Upload to S3 (optional)
# aws s3 cp $BACKUP_DIR/backup_$DATE.sql s3://your-bucket/backups/
```

**Schedule with cron:**

```bash
sudo crontab -e

# Add line (daily at 2 AM):
0 2 * * * /opt/ecovale-hr/backup-db.sh
```

---

## 📋 Production Deployment Checklist

### Pre-Deployment

- [ ] RDS instance created and accessible
- [ ] EC2 instance launched and accessible via SSH
- [ ] Security groups configured correctly
- [ ] Database connection tested from EC2
- [ ] Application JAR built and tested locally
- [ ] Environment variables documented

### Security Configuration

- [ ] SSH access restricted to your IP only
- [ ] RDS not publicly accessible
- [ ] RDS security group only allows EC2
- [ ] Strong database password used
- [ ] Environment file permissions set to 600
- [ ] SSL/TLS enabled for database connection
- [ ] Application runs as non-root user

### Application Deployment

- [ ] Java 17 installed on EC2
- [ ] Application transferred to EC2
- [ ] Environment variables configured
- [ ] Systemd service created and enabled
- [ ] Application starts successfully
- [ ] Health endpoint returns UP
- [ ] Can create/read data via API

### Monitoring & Logging

- [ ] Application logs accessible
- [ ] CloudWatch logs configured (optional)
- [ ] Disk space monitoring enabled
- [ ] Database performance monitoring enabled
- [ ] Alerts configured for critical metrics

### Backup & Recovery

- [ ] RDS automated backups enabled (7+ days)
- [ ] Database backup script created
- [ ] Backup restoration tested
- [ ] Application deployment rollback tested

### Performance & Scaling

- [ ] JVM heap size configured appropriately
- [ ] Database connection pool sized correctly
- [ ] Application performance tested under load
- [ ] Auto-scaling configured (if needed)

### Documentation

- [ ] Deployment steps documented
- [ ] Environment variables documented
- [ ] Rollback procedure documented
- [ ] Monitoring dashboard created
- [ ] Runbook for common issues created

---

## 🐛 Troubleshooting

### Application won't start

```bash
# Check service status
sudo systemctl status ecovale-hr

# View logs
sudo journalctl -u ecovale-hr -n 100

# Common causes:
# - Database connection failed
# - Port 8080 already in use
# - Incorrect environment variables
```

### Database connection refused

```bash
# Test from EC2
mysql -h <RDS_ENDPOINT> -u admin -p

# Check security groups:
# - RDS security group allows EC2 security group
# - EC2 and RDS in same VPC
```

### Service stops after some time

```bash
# Check memory usage
free -h

# Check disk space
df -h

# View OOM (Out of Memory) errors
sudo journalctl -u ecovale-hr | grep -i "out of memory"

# Solution: Increase EC2 instance size or reduce JVM heap
```

### Cannot access from internet

```bash
# Check if application is running
sudo systemctl status ecovale-hr

# Check if listening on port 8080
sudo netstat -tulpn | grep 8080

# Check EC2 security group allows port 8080 from 0.0.0.0/0
```

---

## 💰 Cost Optimization

### Free Tier Eligible (12 months)

- **EC2:** t2.micro - 750 hours/month
- **RDS:** db.t2.micro - 750 hours/month
- **Storage:** 20 GB gp2/gp3
- **Data Transfer:** 15 GB/month

### Production (Estimated Monthly Costs - us-east-1)

- **EC2 t3.small:** ~$15/month
- **RDS db.t3.micro:** ~$15/month
- **Storage (40 GB):** ~$5/month
- **Data Transfer:** Variable
- **Total:** ~$35-50/month

### Cost Saving Tips

1. Use Reserved Instances (1-3 year commitment)
2. Stop EC2 during off-hours (dev/test)
3. Enable RDS storage autoscaling
4. Use AWS Budgets for alerts

---

## 📚 Additional Resources

- **AWS EC2 Documentation:** https://docs.aws.amazon.com/ec2/
- **AWS RDS Documentation:** https://docs.aws.amazon.com/rds/
- **Systemd Documentation:** https://systemd.io/
- **Spring Boot on AWS:** https://spring.io/guides/gs/spring-boot-for-azure/

---

**Your application is now deployed on AWS! 🚀**

Need help? Check the troubleshooting section or AWS support.
