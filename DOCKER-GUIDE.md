# 🐋 Docker Deployment Guide

## Overview

Complete guide to containerize and deploy the Ecovale HR Backend using Docker and Docker Compose.

---

## 📋 What's Included

- **Dockerfile** - Multi-stage build with OpenJDK 17
- **docker-compose.yml** - Development environment (backend + MySQL)
- **docker-compose.prod.yml** - Production environment (backend only)
- **.dockerignore** - Optimized build context

---

## 🚀 Quick Start

### Prerequisites

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose (if not included)
sudo apt install docker-compose

# Verify installation
docker --version
docker-compose --version
```

### Start Everything (Backend + MySQL)

```bash
cd backend
docker-compose up -d
```

**That's it!** Your application is running:
- Backend: http://localhost:8080
- MySQL: localhost:3306

---

## 📦 Docker Architecture

### Multi-Stage Build

The Dockerfile uses a two-stage build for optimization:

**Stage 1: Build (Maven)**
- Base: `maven:3.9-eclipse-temurin-17-alpine`
- Downloads dependencies
- Compiles Java code
- Creates JAR file
- Size: ~500MB (discarded)

**Stage 2: Runtime (JRE)**
- Base: `eclipse-temurin:17-jre-alpine`
- Copies only JAR from Stage 1
- Non-root user (`spring`)
- Health check configured
- Final size: ~280MB

### Benefits

✅ **Small image size** - Only runtime dependencies
✅ **Fast builds** - Layer caching for dependencies
✅ **Secure** - Non-root user, minimal attack surface
✅ **Production-ready** - Health checks, proper signal handling

---

## 🐳 Docker Compose Configurations

### Development (docker-compose.yml)

**Services:**
- `mysql` - MySQL 8.0 database container
- `backend` - Spring Boot application

**Features:**
- Automatic database creation
- Schema auto-update (JPA DDL auto=update)
- SQL logging enabled
- Volume for persistent data
- Health checks
- Automatic service dependency

**Usage:**
```bash
docker-compose up -d
```

### Production (docker-compose.prod.yml)

**Services:**
- `backend` only - Connects to external database (AWS RDS)

**Features:**
- Schema validation only (no auto-updates)
- Minimal logging
- Resource limits (2 CPU, 2GB RAM)
- Production JVM tuning
- Health checks

**Usage:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🔧 Configuration

### Environment Variables

All database configuration via environment variables:

| Variable | Dev Default | Prod Default | Description |
|----------|-------------|--------------|-------------|
| `DB_HOST` | `mysql` | Required | Database hostname |
| `DB_PORT` | `3306` | `3306` | Database port |
| `DB_NAME` | `ecovale_hr` | Required | Database name |
| `DB_USERNAME` | `hruser` | Required | Database username |
| `DB_PASSWORD` | `hrpassword` | Required | Database password |
| `DB_USE_SSL` | `false` | `true` | Enable SSL |
| `JPA_DDL_AUTO` | `update` | `validate` | Hibernate DDL mode |
| `JPA_SHOW_SQL` | `true` | `false` | SQL logging |
| `SPRING_PROFILES_ACTIVE` | `dev` | `prod` | Spring profile |
| `JAVA_OPTS` | `-Xms512m -Xmx1024m` | Custom | JVM options |

### Customizing docker-compose.yml

Edit `docker-compose.yml` to change configuration:

```yaml
services:
  backend:
    environment:
      DB_PASSWORD: your-password
      JPA_DDL_AUTO: validate
      JAVA_OPTS: "-Xms1g -Xmx2g"
```

Or use `.env` file:

```bash
# .env
DB_PASSWORD=your-password
JPA_DDL_AUTO=validate
```

```yaml
# docker-compose.yml
services:
  backend:
    environment:
      DB_PASSWORD: ${DB_PASSWORD}
      JPA_DDL_AUTO: ${JPA_DDL_AUTO}
```

---

## 📝 Common Use Cases

### 1. Development with Local MySQL

```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f backend

# Access MySQL
docker-compose exec mysql mysql -u hruser -phrpassword ecovale_hr

# Stop everything
docker-compose down
```

### 2. Development with External Database

```bash
# Create custom compose file
cat > docker-compose.override.yml << EOF
version: '3.8'
services:
  backend:
    environment:
      DB_HOST: my-external-db.com
      DB_USERNAME: myuser
      DB_PASSWORD: mypassword
EOF

# Start (automatically uses override)
docker-compose up -d
```

### 3. Production with AWS RDS

```bash
# Set environment variables
export DB_HOST=ecovale-hr.xxxx.us-east-1.rds.amazonaws.com
export DB_USERNAME=admin
export DB_PASSWORD=secure-password
export DB_USE_SSL=true

# Start with production config
docker-compose -f docker-compose.prod.yml up -d
```

### 4. Build and Push to Registry

```bash
# Build image
docker build -t myregistry/ecovale-hr-backend:1.0.0 .

# Tag as latest
docker tag myregistry/ecovale-hr-backend:1.0.0 myregistry/ecovale-hr-backend:latest

# Push to registry
docker push myregistry/ecovale-hr-backend:1.0.0
docker push myregistry/ecovale-hr-backend:latest
```

---

## 🔍 Monitoring and Management

### View Logs

```bash
# All services
docker-compose logs

# Follow logs (real-time)
docker-compose logs -f

# Specific service
docker-compose logs backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Health Checks

```bash
# Check container status
docker-compose ps

# Manual health check
curl http://localhost:8080/actuator/health

# Check from inside container
docker-compose exec backend wget -qO- http://localhost:8080/actuator/health
```

### Resource Usage

```bash
# Container stats
docker stats ecovale-hr-backend

# Disk usage
docker system df

# Image size
docker images ecovale-hr-backend
```

### Execute Commands in Container

```bash
# Shell access
docker-compose exec backend sh

# Run specific command
docker-compose exec backend java -version

# Check environment variables
docker-compose exec backend env | grep DB_
```

---

## 🧹 Maintenance

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose up -d --build
```

### Clear Data and Restart

```bash
# Stop and remove volumes (CAUTION: Deletes database!)
docker-compose down -v

# Restart fresh
docker-compose up -d
```

### Clean Up Docker Resources

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune

# Clean everything
docker system prune -a --volumes
```

### Backup MySQL Data

```bash
# Backup database
docker-compose exec mysql mysqldump -u hruser -phrpassword ecovale_hr > backup.sql

# Restore database
docker-compose exec -T mysql mysql -u hruser -phrpassword ecovale_hr < backup.sql
```

---

## 🚀 Advanced Configurations

### Custom Network

```yaml
networks:
  ecovale-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

### Volume for Logs

```yaml
services:
  backend:
    volumes:
      - ./logs:/app/logs
```

### Multiple Backend Instances (Load Balancing)

```bash
# Scale backend to 3 instances
docker-compose up -d --scale backend=3

# Add nginx as load balancer
# See docker-compose.lb.yml example below
```

### Health Check Customization

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:8080/actuator/health"]
      interval: 60s
      timeout: 5s
      retries: 3
      start_period: 120s
```

---

## 🌐 Deployment Platforms

### AWS ECS/Fargate

1. Push image to ECR:
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
docker tag ecovale-hr-backend:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/ecovale-hr:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/ecovale-hr:latest
```

2. Create ECS task definition with environment variables
3. Create ECS service with load balancer

### AWS Elastic Beanstalk

```bash
# Create Dockerrun.aws.json
cat > Dockerrun.aws.json << EOF
{
  "AWSEBDockerrunVersion": "1",
  "Image": {
    "Name": "myregistry/ecovale-hr-backend:latest"
  },
  "Ports": [
    {
      "ContainerPort": 8080
    }
  ]
}
EOF

# Deploy
eb init
eb create ecovale-hr-backend-env
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ecovale-hr-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ecovale-hr-backend
  template:
    metadata:
      labels:
        app: ecovale-hr-backend
    spec:
      containers:
      - name: backend
        image: ecovale-hr-backend:latest
        ports:
        - containerPort: 8080
        env:
        - name: DB_HOST
          value: "mysql-service"
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: username
```

### Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Create stack
docker stack deploy -c docker-compose.yml ecovale-hr

# Scale service
docker service scale ecovale-hr_backend=5

# View services
docker service ls
```

---

## 🔐 Security Best Practices

### 1. Non-Root User
✅ Already configured - runs as `spring` user

### 2. Secrets Management

**Don't do this:**
```yaml
environment:
  DB_PASSWORD: plaintext-password  # ❌ Bad
```

**Do this:**
```yaml
environment:
  DB_PASSWORD: ${DB_PASSWORD}  # ✅ Good - from .env file

# Or use Docker secrets
secrets:
  - db_password
```

### 3. Image Scanning

```bash
# Scan for vulnerabilities
docker scan ecovale-hr-backend:latest

# Or use Trivy
trivy image ecovale-hr-backend:latest
```

### 4. Read-Only Filesystem

```yaml
services:
  backend:
    read_only: true
    tmpfs:
      - /tmp
      - /app/logs
```

### 5. Resource Limits

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

---

## 🐛 Troubleshooting

### Container Exits Immediately

```bash
# Check logs
docker-compose logs backend

# Common causes:
# - MySQL not ready (wait for health check)
# - Wrong credentials
# - Port already in use
```

### Can't Connect to MySQL

```bash
# Check if MySQL is running
docker-compose ps mysql

# Check MySQL logs
docker-compose logs mysql

# Test connection from backend container
docker-compose exec backend sh
ping mysql
```

### Application Health Check Failing

```bash
# Check if application started
docker-compose logs backend | grep "Started"

# Manually check health
docker-compose exec backend wget -qO- http://localhost:8080/actuator/health

# Common causes:
# - Application still starting (wait 60s)
# - Database connection failed
# - Port binding issue
```

### Out of Disk Space

```bash
# Check disk usage
docker system df

# Clean up
docker system prune -a --volumes
```

### MySQL Data Corruption

```bash
# Stop services
docker-compose down

# Remove volume
docker volume rm ecovale-hr-mysql-data

# Restart (fresh database)
docker-compose up -d
```

---

## 📊 Performance Tuning

### JVM Options

```yaml
environment:
  JAVA_OPTS: >-
    -Xms1g
    -Xmx2g
    -XX:+UseG1GC
    -XX:MaxGCPauseMillis=200
    -XX:+HeapDumpOnOutOfMemoryError
    -XX:HeapDumpPath=/app/logs/
```

### Connection Pool

```yaml
environment:
  HIKARI_MAX_POOL_SIZE: 20
  HIKARI_MIN_IDLE: 10
```

### MySQL Configuration

```yaml
services:
  mysql:
    command: >
      --max-connections=200
      --innodb-buffer-pool-size=1G
      --innodb-log-file-size=256M
```

---

## ✅ Production Deployment Checklist

- [ ] Image scanned for vulnerabilities
- [ ] Environment variables set (no defaults in production)
- [ ] Database connection tested
- [ ] Health checks configured
- [ ] Resource limits set
- [ ] Logging configured (external logging service)
- [ ] Monitoring configured (Prometheus/Grafana)
- [ ] Secrets managed securely (AWS Secrets Manager/Vault)
- [ ] Backup strategy implemented
- [ ] Rollback plan documented
- [ ] Load testing performed
- [ ] SSL/TLS enabled for database connection

---

## 📚 Additional Resources

- **Docker Documentation:** https://docs.docker.com/
- **Docker Compose Reference:** https://docs.docker.com/compose/compose-file/
- **Spring Boot Docker Guide:** https://spring.io/guides/topicals/spring-boot-docker/
- **Multi-Stage Builds:** https://docs.docker.com/build/building/multi-stage/

---

**Your application is now containerized and ready for deployment! 🐋🚀**
