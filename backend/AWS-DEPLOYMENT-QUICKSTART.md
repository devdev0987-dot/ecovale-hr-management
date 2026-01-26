# AWS Deployment Quick Start

Fast deployment guide for experienced developers. For detailed steps, see [AWS-DEPLOYMENT-GUIDE.md](AWS-DEPLOYMENT-GUIDE.md).

---

## 🚀 Quick Deployment (30 minutes)

### 1. Create RDS MySQL (5 min)

```bash
aws rds create-db-instance \
    --db-instance-identifier ecovale-hr-db \
    --db-instance-class db.t3.micro \
    --engine mysql \
    --engine-version 8.0.35 \
    --master-username admin \
    --master-user-password 'StrongPass123!' \
    --allocated-storage 20 \
    --no-publicly-accessible \
    --storage-encrypted
```

**Wait for status: available (~5 min)**

### 2. Launch EC2 Ubuntu 22.04 (3 min)

```bash
# Launch instance
aws ec2 run-instances \
    --image-id ami-0c7217cdde317cfec \
    --instance-type t3.small \
    --key-name your-key \
    --security-group-ids sg-xxxxx \
    --subnet-id subnet-xxxxx

# Note the instance ID and public IP
```

### 3. Configure Security Groups (2 min)

```bash
# RDS: Allow 3306 from EC2 security group
# EC2: Allow 22 (SSH), 80 (HTTP), 443 (HTTPS), 8080 (from ALB)
```

### 4. SSH to EC2 and Setup (10 min)

```bash
ssh -i your-key.pem ubuntu@EC2_PUBLIC_IP

# Install Java
sudo apt update && sudo apt install -y openjdk-17-jdk

# Create directories
sudo useradd -r -s /bin/false ecovale
sudo mkdir -p /opt/ecovale-hr /etc/ecovale-hr /var/log/ecovale-hr
sudo chown -R ecovale:ecovale /opt/ecovale-hr /var/log/ecovale-hr
```

### 5. Build and Deploy JAR (5 min)

**On local machine:**

```bash
cd backend
mvn clean package -DskipTests

scp -i your-key.pem target/*.jar ubuntu@EC2_PUBLIC_IP:/tmp/ecovale-hr.jar
scp -i your-key.pem .env.production ubuntu@EC2_PUBLIC_IP:/tmp/.env
scp -i your-key.pem ecovale-hr.service ubuntu@EC2_PUBLIC_IP:/tmp/
```

### 6. Configure and Start Service (5 min)

**On EC2:**

```bash
# Move files
sudo mv /tmp/ecovale-hr.jar /opt/ecovale-hr/
sudo mv /tmp/.env /etc/ecovale-hr/
sudo mv /tmp/ecovale-hr.service /etc/systemd/system/

# Edit environment
sudo nano /etc/ecovale-hr/.env
# Update: DATABASE_URL, DATABASE_USERNAME, DATABASE_PASSWORD, JWT_SECRET

# Start service
sudo systemctl daemon-reload
sudo systemctl enable ecovale-hr
sudo systemctl start ecovale-hr

# Check status
sudo systemctl status ecovale-hr
```

### 7. Test Health Check

```bash
curl http://localhost:8080/actuator/health
# Expected: {"status":"UP"}
```

---

## 📝 Environment Variables Checklist

Edit `/etc/ecovale-hr/.env`:

```bash
# Required
DATABASE_URL=jdbc:mysql://RDS_ENDPOINT:3306/ecovale_hr?useSSL=true
DATABASE_USERNAME=admin
DATABASE_PASSWORD=YourRDSPassword
JWT_SECRET=$(openssl rand -base64 64)

# Optional
CORS_ALLOWED_ORIGINS=https://yourdomain.com
ADMIN_PASSWORD=$(openssl rand -base64 24)
```

---

## 🔧 Common Commands

```bash
# Restart service
sudo systemctl restart ecovale-hr

# View logs
sudo journalctl -u ecovale-hr -f

# Deploy new version
scp -i key.pem target/*.jar ubuntu@EC2_IP:/tmp/ecovale-hr.jar
ssh ubuntu@EC2_IP "sudo systemctl stop ecovale-hr && \
    sudo mv /tmp/ecovale-hr.jar /opt/ecovale-hr/ && \
    sudo systemctl start ecovale-hr"
```

---

## 🏥 Health Check URL

```
http://your-ec2-ip:8080/actuator/health
```

---

## 🎯 Next Steps

- [ ] Set up Nginx reverse proxy
- [ ] Configure SSL with Let's Encrypt
- [ ] Set up Application Load Balancer
- [ ] Configure CloudWatch monitoring
- [ ] Set up automated backups
- [ ] Configure CI/CD pipeline

See [AWS-DEPLOYMENT-GUIDE.md](AWS-DEPLOYMENT-GUIDE.md) for detailed instructions.
