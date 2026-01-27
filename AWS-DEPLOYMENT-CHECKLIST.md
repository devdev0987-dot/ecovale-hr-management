# ☁️ AWS Deployment Quick Checklist

## 🎯 Overview

Quick reference checklist for deploying Ecovale HR Backend to AWS.

---

## 📋 Pre-Deployment Checklist

### AWS Account Setup
- [ ] AWS account created and verified
- [ ] Billing enabled
- [ ] AWS CLI installed (`aws --version`)
- [ ] AWS CLI configured (`aws configure`)
- [ ] SSH key pair created and downloaded

### Local Preparation
- [ ] Application builds successfully (`mvn clean package`)
- [ ] JAR file created in `target/` directory
- [ ] Environment variables documented
- [ ] Database schema SQL ready (optional)

---

## 🗄️ Part 1: RDS MySQL Setup (15 minutes)

- [ ] RDS instance created
  - Engine: MySQL 8.0
  - Instance: db.t3.micro (or larger)
  - Storage: 20 GB with autoscaling
  - Initial database: `ecovale_hr`
- [ ] RDS endpoint noted
- [ ] Master credentials saved securely
- [ ] RDS security group created (`ecovale-rds-sg`)
- [ ] Public access: DISABLED

**RDS Endpoint Example:**
```
ecovale-hr-db.c9abcdefgh.us-east-1.rds.amazonaws.com:3306
```

---

## 💻 Part 2: EC2 Instance Setup (10 minutes)

- [ ] EC2 instance launched
  - AMI: Ubuntu 22.04 LTS
  - Instance type: t2.micro (or larger)
  - Key pair: Downloaded and secured (`chmod 400`)
  - EC2 security group created (`ecovale-ec2-sg`)
- [ ] Public IP noted
- [ ] Can SSH into instance

**SSH Command:**
```bash
ssh -i ecovale-hr-key.pem ubuntu@<EC2_PUBLIC_IP>
```

---

## 🔐 Part 3: Security Groups (5 minutes)

### EC2 Security Group (ecovale-ec2-sg)

- [ ] **SSH** - Port 22 from Your IP
- [ ] **HTTP** - Port 8080 from 0.0.0.0/0

### RDS Security Group (ecovale-rds-sg)

- [ ] **MySQL** - Port 3306 from ecovale-ec2-sg

**Verification:**
```bash
# From EC2, test RDS connection:
mysql -h <RDS_ENDPOINT> -u admin -p
```

---

## 🚀 Part 4: Application Deployment (15 minutes)

### On EC2 Instance

- [ ] System updated (`sudo apt update && sudo apt upgrade -y`)
- [ ] Java 17 installed (`sudo apt install openjdk-17-jre-headless -y`)
- [ ] Application directory created (`/opt/ecovale-hr/`)
- [ ] JAR file transferred to EC2
- [ ] Environment file created (`/opt/ecovale-hr/application.env`)
- [ ] File permissions secured (`chmod 600`)

**Environment Variables:**
```bash
DB_HOST=<RDS_ENDPOINT>
DB_USERNAME=admin
DB_PASSWORD=<RDS_PASSWORD>
DB_USE_SSL=true
JPA_DDL_AUTO=update
SPRING_PROFILES_ACTIVE=prod
```

---

## ⚙️ Part 5: Systemd Service (10 minutes)

- [ ] Service file created (`/etc/systemd/system/ecovale-hr.service`)
- [ ] Log directory created (`/var/log/ecovale-hr/`)
- [ ] Systemd daemon reloaded
- [ ] Service enabled (`sudo systemctl enable ecovale-hr`)
- [ ] Service started (`sudo systemctl start ecovale-hr`)
- [ ] Service status: ACTIVE

**Check Status:**
```bash
sudo systemctl status ecovale-hr
```

---

## ✅ Part 6: Verification (5 minutes)

### Health Check

- [ ] Health endpoint returns UP
```bash
curl http://localhost:8080/actuator/health
# Expected: {"status":"UP"}
```

### API Testing

- [ ] Can retrieve designations
```bash
curl http://localhost:8080/api/designations
```

- [ ] Can create test employee
```bash
curl -X POST http://localhost:8080/api/employees \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### External Access

- [ ] Accessible from internet
```bash
curl http://<EC2_PUBLIC_IP>:8080/actuator/health
```

---

## 📊 Part 7: Post-Deployment (Optional)

### Monitoring

- [ ] CloudWatch logs configured
- [ ] Disk space alerts set up
- [ ] CPU/Memory monitoring enabled
- [ ] Application logs accessible

### Backup

- [ ] RDS automated backups enabled (7+ days)
- [ ] Manual backup script created
- [ ] Backup tested successfully

### SSL/HTTPS (Production)

- [ ] Domain name configured
- [ ] Nginx installed and configured
- [ ] SSL certificate obtained (Let's Encrypt)
- [ ] HTTPS access verified

### Documentation

- [ ] Deployment steps documented
- [ ] Environment variables listed
- [ ] Rollback procedure documented
- [ ] Team notified of deployment

---

## 🔄 Update Checklist

When deploying a new version:

- [ ] Build new JAR (`mvn clean package -DskipTests`)
- [ ] Stop service (`sudo systemctl stop ecovale-hr`)
- [ ] Backup current JAR
- [ ] Upload new JAR to EC2
- [ ] Replace JAR in `/opt/ecovale-hr/`
- [ ] Start service (`sudo systemctl start ecovale-hr`)
- [ ] Verify health check
- [ ] Test critical endpoints
- [ ] Monitor logs for errors

**Quick Update:**
```bash
# Use deployment script
/opt/ecovale-hr/deploy.sh
```

---

## 🐛 Troubleshooting Checklist

### Application Won't Start

- [ ] Check service status: `sudo systemctl status ecovale-hr`
- [ ] View logs: `sudo journalctl -u ecovale-hr -n 100`
- [ ] Verify Java installed: `java -version`
- [ ] Check JAR exists: `ls -la /opt/ecovale-hr/`
- [ ] Verify environment file: `cat /opt/ecovale-hr/application.env`

### Cannot Connect to Database

- [ ] Test connection: `mysql -h <RDS_ENDPOINT> -u admin -p`
- [ ] Check security groups (RDS allows EC2)
- [ ] Verify RDS is in same VPC as EC2
- [ ] Check environment variables are correct

### Cannot Access from Internet

- [ ] Service is running: `sudo systemctl status ecovale-hr`
- [ ] Port 8080 open: `sudo netstat -tulpn | grep 8080`
- [ ] EC2 security group allows port 8080
- [ ] Test locally first: `curl http://localhost:8080/actuator/health`

### High Memory Usage

- [ ] Check memory: `free -h`
- [ ] Adjust JVM heap: Edit `JAVA_OPTS` in service file
- [ ] Consider larger EC2 instance type

---

## 💰 Cost Estimate

### Free Tier (First 12 Months)
- EC2 t2.micro: 750 hours/month - **FREE**
- RDS db.t2.micro: 750 hours/month - **FREE**
- Storage: 20 GB - **FREE**
- **Total: $0/month**

### After Free Tier (us-east-1)
- EC2 t3.small: ~$15/month
- RDS db.t3.micro: ~$15/month
- Storage: ~$5/month
- **Total: ~$35/month**

---

## 📚 Documentation Links

- **[Complete EC2 Deployment Guide](AWS-EC2-DEPLOYMENT.md)** - Step-by-step instructions
- **[RDS Setup Guide](AWS-RDS-DEPLOYMENT.md)** - Database configuration
- **[Backend README](README.md)** - General setup
- **[Docker Guide](DOCKER-GUIDE.md)** - Container deployment

---

## ✅ Final Checklist

Before going live:

- [ ] All tests passing
- [ ] Security groups properly configured
- [ ] SSL/HTTPS enabled (production)
- [ ] Monitoring and alerts set up
- [ ] Backups enabled and tested
- [ ] Documentation updated
- [ ] Team trained on deployment
- [ ] Rollback plan documented

---

**Ready to deploy? Start with [AWS-EC2-DEPLOYMENT.md](AWS-EC2-DEPLOYMENT.md)! 🚀**
