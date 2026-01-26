# AWS Deployment Guide for Ecovale HR System

Complete step-by-step guide to deploy the Spring Boot application on AWS EC2 with RDS MySQL.

---

## 📋 Prerequisites

- AWS Account with appropriate permissions
- Domain name (optional, for production)
- SSL certificate (optional, for HTTPS)
- Local machine with AWS CLI installed

---

## 🏗️ Architecture Overview

```
┌─────────────────┐
│   Route 53      │  (Optional: DNS)
│   DNS Service   │
└────────┬────────┘
         │
┌────────▼────────┐
│   Application   │
│  Load Balancer  │  (Optional: For HA)
│     (ALB)       │
└────────┬────────┘
         │
┌────────▼────────┐
│   EC2 Instance  │
│  (Spring Boot)  │  Port 8080
│   + Nginx       │  Port 80/443
└────────┬────────┘
         │
┌────────▼────────┐
│   RDS MySQL     │
│   (Database)    │  Port 3306
└─────────────────┘
```

---

## 📝 Step 1: Create AWS RDS MySQL Database

### 1.1 Create RDS Instance

```bash
# Using AWS CLI
aws rds create-db-instance \
    --db-instance-identifier ecovale-hr-db \
    --db-instance-class db.t3.micro \
    --engine mysql \
    --engine-version 8.0.35 \
    --master-username ecovale_admin \
    --master-user-password 'YourStrongPassword123!' \
    --allocated-storage 20 \
    --storage-type gp3 \
    --vpc-security-group-ids sg-xxxxx \
    --db-subnet-group-name your-subnet-group \
    --backup-retention-period 7 \
    --preferred-backup-window "03:00-04:00" \
    --preferred-maintenance-window "sun:04:00-sun:05:00" \
    --no-publicly-accessible \
    --storage-encrypted \
    --enable-cloudwatch-logs-exports '["error","general","slowquery"]' \
    --tags Key=Environment,Value=Production Key=Application,Value=EcovaleHR
```

### 1.2 Or Using AWS Console

1. Go to **RDS Console** → **Create Database**
2. Choose **MySQL 8.0.35**
3. Template: **Production**
4. DB instance identifier: `ecovale-hr-db`
5. Master username: `ecovale_admin`
6. Master password: (strong password)
7. Instance configuration: `db.t3.micro` (or larger for production)
8. Storage: 20 GB gp3
9. **IMPORTANT**: Enable encryption
10. Backup retention: 7 days
11. Create database

### 1.3 Configure Security Group

```bash
# Create security group for RDS
aws ec2 create-security-group \
    --group-name ecovale-rds-sg \
    --description "Security group for Ecovale HR RDS" \
    --vpc-id vpc-xxxxx

# Allow MySQL access from EC2 security group only
aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxx \
    --protocol tcp \
    --port 3306 \
    --source-group sg-yyyyy  # EC2 security group
```

### 1.4 Create Database Schema

```bash
# Connect to RDS from EC2 instance
mysql -h ecovale-hr-db.xxxxx.us-east-1.rds.amazonaws.com \
      -u ecovale_admin \
      -p

# Create database
CREATE DATABASE ecovale_hr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ecovale_hr;

# Tables will be created automatically by Hibernate on first run
# Or run your SQL migration scripts here
```

---

## 🖥️ Step 2: Launch EC2 Instance

### 2.1 Create EC2 Instance

```bash
# Launch Ubuntu 22.04 LTS instance
aws ec2 run-instances \
    --image-id ami-0c7217cdde317cfec \
    --instance-type t3.small \
    --key-name your-key-pair \
    --security-group-ids sg-xxxxx \
    --subnet-id subnet-xxxxx \
    --iam-instance-profile Name=EcovaleHR-EC2-Role \
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":20,"VolumeType":"gp3"}}]' \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=EcovaleHR-API},{Key=Environment,Value=Production}]' \
    --user-data file://user-data.sh
```

### 2.2 Or Using AWS Console

1. Go to **EC2 Console** → **Launch Instance**
2. Name: `EcovaleHR-API`
3. AMI: **Ubuntu Server 22.04 LTS**
4. Instance type: `t3.small` (2 vCPU, 2 GB RAM minimum)
5. Key pair: Select or create new
6. Network settings:
   - VPC: Same as RDS
   - Subnet: Private subnet (recommended)
   - Auto-assign public IP: Yes (or use NAT Gateway)
7. Security group: Create new
   - Allow SSH (22) from your IP
   - Allow HTTP (80) from anywhere (if using Nginx)
   - Allow HTTPS (443) from anywhere (if using SSL)
   - Allow 8080 from ALB security group (if using ALB)
8. Storage: 20 GB gp3
9. Launch instance

### 2.3 Configure EC2 Security Group

```bash
# SSH access (restrict to your IP)
aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxx \
    --protocol tcp \
    --port 22 \
    --cidr YOUR_IP/32

# HTTP access (if using Nginx)
aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxx \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0

# HTTPS access (if using SSL)
aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxx \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0

# Application port (if using ALB)
aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxx \
    --protocol tcp \
    --port 8080 \
    --source-group sg-alb-xxxxx
```

---

## 🚀 Step 3: Deploy Application to EC2

### 3.1 Connect to EC2 Instance

```bash
# Get instance public IP
aws ec2 describe-instances \
    --instance-ids i-xxxxx \
    --query 'Reservations[0].Instances[0].PublicIpAddress'

# SSH into instance
ssh -i your-key.pem ubuntu@ec2-xx-xx-xx-xx.compute.amazonaws.com
```

### 3.2 Install Java 17

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Java 17
sudo apt install openjdk-17-jdk -y

# Verify installation
java -version
# Expected: openjdk version "17.0.x"
```

### 3.3 Create Application User and Directories

```bash
# Create dedicated user
sudo useradd -r -s /bin/false ecovale
sudo usermod -aG sudo ecovale  # Optional: if user needs sudo

# Create application directory
sudo mkdir -p /opt/ecovale-hr
sudo mkdir -p /etc/ecovale-hr
sudo mkdir -p /var/log/ecovale-hr

# Set permissions
sudo chown -R ecovale:ecovale /opt/ecovale-hr
sudo chown -R ecovale:ecovale /var/log/ecovale-hr
sudo chmod 755 /opt/ecovale-hr
sudo chmod 755 /var/log/ecovale-hr
```

### 3.4 Build and Transfer Application JAR

**On your local machine:**

```bash
# Build the application
cd backend
mvn clean package -DskipTests

# Verify JAR created
ls -lh target/*.jar
# Expected: ecovale-hr-0.0.1-SNAPSHOT.jar

# Transfer to EC2
scp -i your-key.pem \
    target/ecovale-hr-0.0.1-SNAPSHOT.jar \
    ubuntu@ec2-xx-xx-xx-xx.compute.amazonaws.com:/tmp/

# Transfer environment file
scp -i your-key.pem \
    .env.production \
    ubuntu@ec2-xx-xx-xx-xx.compute.amazonaws.com:/tmp/

# Transfer systemd service file
scp -i your-key.pem \
    ecovale-hr.service \
    ubuntu@ec2-xx-xx-xx-xx.compute.amazonaws.com:/tmp/
```

### 3.5 Configure Environment Variables

**On EC2 instance:**

```bash
# Move JAR to application directory
sudo mv /tmp/ecovale-hr-0.0.1-SNAPSHOT.jar /opt/ecovale-hr/ecovale-hr.jar
sudo chown ecovale:ecovale /opt/ecovale-hr/ecovale-hr.jar

# Configure environment variables
sudo mv /tmp/.env.production /etc/ecovale-hr/.env
sudo chown root:ecovale /etc/ecovale-hr/.env
sudo chmod 640 /etc/ecovale-hr/.env

# Edit with actual values
sudo nano /etc/ecovale-hr/.env
```

**Update these critical values in `/etc/ecovale-hr/.env`:**

```bash
# Get RDS endpoint from AWS Console or CLI
DATABASE_URL=jdbc:mysql://ecovale-hr-db.xxxxx.us-east-1.rds.amazonaws.com:3306/ecovale_hr?useSSL=true&requireSSL=true&serverTimezone=UTC
DATABASE_USERNAME=ecovale_admin
DATABASE_PASSWORD=YourActualRDSPassword

# Generate strong JWT secret
JWT_SECRET=$(openssl rand -base64 64)

# Set your domain
CORS_ALLOWED_ORIGINS=https://yourdomain.com

# Set admin credentials
ADMIN_PASSWORD=$(openssl rand -base64 24)
```

---

## 🔧 Step 4: Configure Systemd Service

### 4.1 Install Service

```bash
# Move service file
sudo mv /tmp/ecovale-hr.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable ecovale-hr.service

# Start service
sudo systemctl start ecovale-hr.service

# Check status
sudo systemctl status ecovale-hr.service
```

### 4.2 Service Management Commands

```bash
# Start service
sudo systemctl start ecovale-hr

# Stop service
sudo systemctl stop ecovale-hr

# Restart service
sudo systemctl restart ecovale-hr

# View logs (real-time)
sudo journalctl -u ecovale-hr -f

# View application logs
sudo tail -f /var/log/ecovale-hr/application.log

# View stdout logs
sudo tail -f /var/log/ecovale-hr/stdout.log

# View stderr logs
sudo tail -f /var/log/ecovale-hr/stderr.log
```

---

## 🌐 Step 5: Configure Nginx (Reverse Proxy)

### 5.1 Install Nginx

```bash
sudo apt install nginx -y
```

### 5.2 Configure Nginx

```bash
# Create nginx configuration
sudo nano /etc/nginx/sites-available/ecovale-hr
```

**Add this configuration:**

```nginx
upstream ecovale_backend {
    server 127.0.0.1:8080 fail_timeout=0;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS (uncomment after SSL setup)
    # return 301 https://$server_name$request_uri;

    # Access and error logs
    access_log /var/log/nginx/ecovale-hr-access.log;
    error_log /var/log/nginx/ecovale-hr-error.log;

    # Client body size (for file uploads)
    client_max_body_size 10M;

    # Proxy settings
    location / {
        proxy_pass http://ecovale_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # WebSocket support (if needed)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Health check endpoint
    location /actuator/health {
        proxy_pass http://ecovale_backend/actuator/health;
        access_log off;
    }
}

# HTTPS configuration (after SSL certificate setup)
# server {
#     listen 443 ssl http2;
#     server_name yourdomain.com www.yourdomain.com;
#
#     ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
#     ssl_prefer_server_ciphers on;
#
#     # Same proxy configuration as above
#     location / {
#         proxy_pass http://ecovale_backend;
#         # ... (same proxy settings)
#     }
# }
```

### 5.3 Enable and Test Nginx

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ecovale-hr /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Enable Nginx on boot
sudo systemctl enable nginx
```

---

## 🔒 Step 6: Setup SSL Certificate (Optional but Recommended)

### 6.1 Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 6.2 Obtain SSL Certificate

```bash
# Get certificate for your domain
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow prompts:
# - Enter email address
# - Agree to terms
# - Choose to redirect HTTP to HTTPS
```

### 6.3 Auto-renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot automatically sets up a cron job for renewal
# Check with:
sudo systemctl status certbot.timer
```

---

## 🏥 Step 7: Health Checks and Monitoring

### 7.1 Health Check URLs

```bash
# Basic health check
curl http://localhost:8080/actuator/health

# Expected response:
# {"status":"UP"}

# Detailed health (authenticated)
curl http://localhost:8080/actuator/health \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Readiness probe (Kubernetes/ECS)
curl http://localhost:8080/actuator/health/readiness

# Liveness probe
curl http://localhost:8080/actuator/health/liveness

# Metrics (for monitoring)
curl http://localhost:8080/actuator/metrics

# Application info
curl http://localhost:8080/actuator/info
```

### 7.2 Configure Application Load Balancer Health Check

If using ALB:

1. Go to **Target Groups** → Edit health check settings
2. Health check path: `/actuator/health`
3. Healthy threshold: 2
4. Unhealthy threshold: 3
5. Timeout: 5 seconds
6. Interval: 30 seconds
7. Success codes: 200

### 7.3 CloudWatch Monitoring

```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb

# Configure CloudWatch agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard

# Start agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -s \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json
```

---

## 📊 Step 8: Database Migration

### 8.1 Initial Schema Setup

```bash
# Connect to RDS
mysql -h ecovale-hr-db.xxxxx.us-east-1.rds.amazonaws.com \
      -u ecovale_admin \
      -p ecovale_hr

# Hibernate will auto-create tables on first run
# Or run your migration scripts:
source /path/to/schema.sql
```

### 8.2 Using Flyway (Recommended for Production)

**Add to pom.xml:**

```xml
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-mysql</artifactId>
</dependency>
```

**Add to application-prod.properties:**

```properties
spring.flyway.enabled=true
spring.flyway.locations=classpath:db/migration
spring.flyway.baseline-on-migrate=true
```

---

## 🔄 Step 9: Continuous Deployment

### 9.1 Create Deployment Script

```bash
# Create script
sudo nano /opt/ecovale-hr/deploy.sh
```

**Add this content:**

```bash
#!/bin/bash
set -e

# Configuration
APP_NAME="ecovale-hr"
APP_DIR="/opt/ecovale-hr"
BACKUP_DIR="/opt/ecovale-hr/backups"
JAR_NAME="ecovale-hr.jar"

echo "Starting deployment of $APP_NAME..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup current JAR
if [ -f "$APP_DIR/$JAR_NAME" ]; then
    BACKUP_NAME="$JAR_NAME.backup.$(date +%Y%m%d_%H%M%S)"
    echo "Backing up current JAR to $BACKUP_NAME"
    cp "$APP_DIR/$JAR_NAME" "$BACKUP_DIR/$BACKUP_NAME"
    
    # Keep only last 5 backups
    ls -t $BACKUP_DIR/*.backup.* | tail -n +6 | xargs -r rm
fi

# Stop service
echo "Stopping $APP_NAME service..."
sudo systemctl stop $APP_NAME

# Copy new JAR
echo "Deploying new JAR..."
cp /tmp/$JAR_NAME $APP_DIR/$JAR_NAME
sudo chown ecovale:ecovale $APP_DIR/$JAR_NAME

# Start service
echo "Starting $APP_NAME service..."
sudo systemctl start $APP_NAME

# Wait for health check
echo "Waiting for application to start..."
for i in {1..30}; do
    if curl -f http://localhost:8080/actuator/health > /dev/null 2>&1; then
        echo "Application started successfully!"
        sudo systemctl status $APP_NAME
        exit 0
    fi
    echo "Waiting... ($i/30)"
    sleep 2
done

# Rollback on failure
echo "Application failed to start! Rolling back..."
sudo systemctl stop $APP_NAME
cp "$BACKUP_DIR/$(ls -t $BACKUP_DIR/*.backup.* | head -1)" "$APP_DIR/$JAR_NAME"
sudo systemctl start $APP_NAME
echo "Rollback completed. Check logs for errors."
exit 1
```

**Make executable:**

```bash
sudo chmod +x /opt/ecovale-hr/deploy.sh
sudo chown ecovale:ecovale /opt/ecovale-hr/deploy.sh
```

### 9.2 Deploy New Version

```bash
# From local machine, build and deploy
mvn clean package -DskipTests
scp -i your-key.pem target/ecovale-hr-0.0.1-SNAPSHOT.jar \
    ubuntu@ec2-xx-xx-xx-xx.compute.amazonaws.com:/tmp/ecovale-hr.jar

# On EC2, run deployment script
ssh -i your-key.pem ubuntu@ec2-xx-xx-xx-xx.compute.amazonaws.com
sudo /opt/ecovale-hr/deploy.sh
```

---

## 🧪 Step 10: Testing Deployment

### 10.1 Test Health Endpoint

```bash
# From EC2 instance
curl http://localhost:8080/actuator/health

# From outside (if using Nginx)
curl http://yourdomain.com/actuator/health

# Expected: {"status":"UP"}
```

### 10.2 Test API Endpoints

```bash
# Test login
curl -X POST http://yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-admin-password"
  }'

# Test protected endpoint
curl http://yourdomain.com/api/employees \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 10.3 Monitor Logs

```bash
# Application logs
sudo tail -f /var/log/ecovale-hr/application.log

# System logs
sudo journalctl -u ecovale-hr -f

# Nginx logs
sudo tail -f /var/log/nginx/ecovale-hr-access.log
sudo tail -f /var/log/nginx/ecovale-hr-error.log
```

---

## 🛡️ Security Best Practices

### 11.1 EC2 Security

- ✅ Use private subnets for EC2 and RDS
- ✅ Use NAT Gateway for outbound internet access
- ✅ Restrict SSH access to your IP only
- ✅ Use IAM roles instead of access keys
- ✅ Enable CloudTrail for audit logs
- ✅ Use Systems Manager Session Manager instead of SSH

### 11.2 RDS Security

- ✅ Never make RDS publicly accessible
- ✅ Use strong passwords (20+ characters)
- ✅ Enable encryption at rest
- ✅ Enable SSL for connections
- ✅ Regular backups (7+ days retention)
- ✅ Enable CloudWatch logs

### 11.3 Application Security

- ✅ Use HTTPS (SSL certificate)
- ✅ Strong JWT secret (64+ characters)
- ✅ Rotate credentials regularly
- ✅ Keep dependencies updated
- ✅ Monitor security advisories

---

## 📈 Scaling and High Availability

### 12.1 Auto Scaling Group

```bash
# Create launch template
aws ec2 create-launch-template \
    --launch-template-name ecovale-hr-template \
    --version-description "Version 1" \
    --launch-template-data file://launch-template.json

# Create Auto Scaling Group
aws autoscaling create-auto-scaling-group \
    --auto-scaling-group-name ecovale-hr-asg \
    --launch-template LaunchTemplateName=ecovale-hr-template \
    --min-size 2 \
    --max-size 4 \
    --desired-capacity 2 \
    --vpc-zone-identifier "subnet-xxxxx,subnet-yyyyy" \
    --target-group-arns arn:aws:elasticloadbalancing:region:account:targetgroup/ecovale-hr-tg/xxxxx \
    --health-check-type ELB \
    --health-check-grace-period 300
```

### 12.2 Application Load Balancer

1. Create ALB in AWS Console
2. Add listeners (80 → redirect to 443, 443 → target group)
3. Add SSL certificate
4. Configure target group with health checks
5. Update CORS origins with ALB DNS name

---

## 🚨 Troubleshooting

### Application won't start

```bash
# Check service status
sudo systemctl status ecovale-hr

# Check logs
sudo journalctl -u ecovale-hr -n 100 --no-pager

# Check application logs
sudo tail -100 /var/log/ecovale-hr/application.log

# Check if port is in use
sudo netstat -tlnp | grep 8080

# Check environment variables
sudo cat /etc/ecovale-hr/.env

# Test database connection
mysql -h RDS_ENDPOINT -u DATABASE_USERNAME -p
```

### Cannot connect to RDS

```bash
# Test network connectivity
telnet RDS_ENDPOINT 3306

# Check security groups
aws ec2 describe-security-groups --group-ids sg-xxxxx

# Check RDS status
aws rds describe-db-instances --db-instance-identifier ecovale-hr-db
```

### Out of memory errors

```bash
# Increase heap size in ecovale-hr.service
sudo nano /etc/systemd/system/ecovale-hr.service
# Change: -Xmx2048m to -Xmx4096m (if instance has enough RAM)

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart ecovale-hr
```

---

## 📞 Support URLs

| Purpose | URL |
|---------|-----|
| Health Check | `http://yourdomain.com/actuator/health` |
| Readiness Probe | `http://yourdomain.com/actuator/health/readiness` |
| Liveness Probe | `http://yourdomain.com/actuator/health/liveness` |
| Metrics | `http://yourdomain.com/actuator/metrics` |
| API Documentation | `http://yourdomain.com/swagger-ui.html` (if enabled) |
| Application Info | `http://yourdomain.com/actuator/info` |

---

## ✅ Deployment Checklist

- [ ] RDS instance created and configured
- [ ] EC2 instance launched with proper security groups
- [ ] Java 17 installed on EC2
- [ ] Application JAR deployed to `/opt/ecovale-hr`
- [ ] Environment variables configured in `/etc/ecovale-hr/.env`
- [ ] Systemd service installed and running
- [ ] Nginx configured and running
- [ ] SSL certificate installed (if using HTTPS)
- [ ] Database schema created
- [ ] Health check endpoint responding
- [ ] CloudWatch monitoring configured
- [ ] Backup strategy implemented
- [ ] Deployment script created
- [ ] Documentation updated with actual values

---

## 🎉 Success!

Your Spring Boot application is now deployed on AWS! 

**Next steps:**
1. Set up monitoring and alerts
2. Configure automated backups
3. Implement CI/CD pipeline
4. Set up staging environment
5. Configure domain and SSL
6. Load test the application

For questions or issues, check the logs or refer to the troubleshooting section.
