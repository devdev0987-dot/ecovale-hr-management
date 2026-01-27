# Docker and CI/CD Implementation Guide

Complete guide for Docker containerization and CI/CD pipeline for the Ecovale HR System.

---

## 🐳 Docker Setup

### Files Created

1. **Dockerfile** - Multi-stage build for Spring Boot
2. **docker-compose.yml** - Full stack (App + MySQL)
3. **.dockerignore** - Optimize build context
4. **.env.docker** - Environment variables template

### Quick Start

```bash
# 1. Build and run with Docker Compose
cd backend
cp .env.docker .env
# Edit .env with your values
docker-compose up -d

# 2. Check status
docker-compose ps

# 3. View logs
docker-compose logs -f app

# 4. Access application
curl http://localhost:8080/actuator/health

# 5. Stop containers
docker-compose down

# 6. Clean up (including volumes)
docker-compose down -v
```

---

## 📦 Docker Commands

### Build Docker Image

```bash
# Build image manually
cd backend
docker build -t ecovale-hr:latest .

# Build with specific tag
docker build -t ecovale-hr:1.0.0 .

# Build without cache
docker build --no-cache -t ecovale-hr:latest .
```

### Run Container

```bash
# Run with environment variables
docker run -d \
  --name ecovale-hr \
  -p 8080:8080 \
  -e DATABASE_URL=jdbc:mysql://mysql:3306/ecovale_hr \
  -e DATABASE_USERNAME=root \
  -e DATABASE_PASSWORD=password \
  -e JWT_SECRET=your-secret-key \
  ecovale-hr:latest

# Run with .env file
docker run -d --env-file .env -p 8080:8080 ecovale-hr:latest

# Run interactively for debugging
docker run -it --rm ecovale-hr:latest sh
```

### Container Management

```bash
# View running containers
docker ps

# View all containers
docker ps -a

# View logs
docker logs -f ecovale-hr

# Execute command in container
docker exec -it ecovale-hr sh

# Stop container
docker stop ecovale-hr

# Remove container
docker rm ecovale-hr

# View resource usage
docker stats ecovale-hr
```

---

## 🔧 Docker Compose Usage

### Services

- **mysql** - MySQL 8.0 database
- **app** - Spring Boot application
- **nginx** - Reverse proxy (optional, use with `--profile with-nginx`)

### Commands

```bash
# Start all services
docker-compose up -d

# Start with Nginx
docker-compose --profile with-nginx up -d

# View logs
docker-compose logs -f
docker-compose logs -f app
docker-compose logs -f mysql

# Restart specific service
docker-compose restart app

# Stop all services
docker-compose stop

# Remove all containers and networks
docker-compose down

# Remove everything including volumes
docker-compose down -v

# Rebuild and restart
docker-compose up -d --build

# Scale application (multiple instances)
docker-compose up -d --scale app=3
```

### Environment Variables

Create `.env` file in backend directory:

```env
# Database
DB_ROOT_PASSWORD=securepassword
DB_NAME=ecovale_hr
DB_USERNAME=ecovale_user
DB_PASSWORD=ecovalepassword123

# Application
SPRING_PROFILES_ACTIVE=prod
JWT_SECRET=$(openssl rand -base64 64)
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:80
```

---

## 🚀 CI/CD Pipeline (GitHub Actions)

### Workflow Overview

**File:** `.github/workflows/backend-ci-cd.yml`

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Only when backend files change

### Jobs

#### 1. Build and Test
- ✅ Checkout code
- ✅ Set up Java 17
- ✅ Cache Maven dependencies
- ✅ Build application
- ✅ Run tests
- ✅ Generate test reports
- ✅ Package JAR
- ✅ Upload artifacts

#### 2. Code Quality Analysis
- ✅ SonarCloud integration (optional)
- ✅ Code coverage analysis
- ✅ Quality gate checks

#### 3. Security Scan
- ✅ OWASP Dependency Check
- ✅ CVE vulnerability scanning
- ✅ Security report generation

#### 4. Build and Push Docker Image
- ✅ Multi-platform builds (amd64, arm64)
- ✅ Push to GitHub Container Registry
- ✅ Tag with branch, SHA, and latest
- ✅ Image caching for faster builds

#### 5. Deploy (Optional)
- ✅ Deploy to production environment
- ✅ AWS ECS, Kubernetes, etc.

#### 6. Notification
- ✅ Build status notifications
- ✅ Integration with Slack/Discord

---

## 🔐 GitHub Secrets Configuration

### Required Secrets

Go to **GitHub Repository → Settings → Secrets and variables → Actions**

```bash
# Optional: SonarCloud integration
SONAR_TOKEN=your-sonarcloud-token

# Docker Registry (automatic with GITHUB_TOKEN)
# No additional secrets needed for ghcr.io

# Optional: Deployment secrets
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
KUBE_CONFIG=your-kubernetes-config
```

### GitHub Token Permissions

Ensure workflow has these permissions:
- ✅ Read repository contents
- ✅ Write packages (for Docker registry)
- ✅ Write actions (for artifacts)

---

## 📊 Workflow Status Badges

Add to your README.md:

```markdown
![CI/CD Pipeline](https://github.com/your-org/ecovale-hr-web-app/actions/workflows/backend-ci-cd.yml/badge.svg)
```

---

## 🐋 Docker Registry

### GitHub Container Registry (GHCR)

Images are automatically pushed to:
```
ghcr.io/your-org/ecovale-hr-web-app/ecovale-hr-backend:latest
ghcr.io/your-org/ecovale-hr-web-app/ecovale-hr-backend:main
ghcr.io/your-org/ecovale-hr-web-app/ecovale-hr-backend:main-sha-abc123
```

### Pull Image

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull latest image
docker pull ghcr.io/your-org/ecovale-hr-web-app/ecovale-hr-backend:latest

# Run pulled image
docker run -d -p 8080:8080 \
  --env-file .env \
  ghcr.io/your-org/ecovale-hr-web-app/ecovale-hr-backend:latest
```

---

## 🔨 Local Development with Docker

### Development Setup

```bash
# 1. Start only MySQL with Docker
docker-compose up -d mysql

# 2. Run Spring Boot locally (connects to Docker MySQL)
mvn spring-boot:run \
  -Dspring-boot.run.arguments="--spring.datasource.url=jdbc:mysql://localhost:3306/ecovale_hr"

# 3. Stop MySQL when done
docker-compose down
```

### Debug Mode

```bash
# Run with debug port exposed
docker run -d \
  -p 8080:8080 \
  -p 5005:5005 \
  -e JAVA_OPTS="-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005" \
  ecovale-hr:latest

# Connect debugger to localhost:5005
```

---

## 📈 Monitoring Docker Containers

### Health Checks

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' ecovale-hr

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' ecovale-hr
```

### Resource Monitoring

```bash
# Real-time stats
docker stats

# View container processes
docker top ecovale-hr

# Check logs
docker logs --tail 100 ecovale-hr
docker logs --since 1h ecovale-hr
```

---

## 🚢 Production Deployment

### AWS ECS Example

```yaml
# Add to .github/workflows/backend-ci-cd.yml deploy job
- name: Deploy to AWS ECS
  run: |
    aws ecs update-service \
      --cluster production-cluster \
      --service ecovale-hr-service \
      --force-new-deployment \
      --region us-east-1
```

### Kubernetes Example

```yaml
# Add to .github/workflows/backend-ci-cd.yml deploy job
- name: Deploy to Kubernetes
  run: |
    kubectl set image deployment/ecovale-hr \
      ecovale-hr=ghcr.io/${{ env.IMAGE_NAME }}:${{ github.sha }} \
      --record
    kubectl rollout status deployment/ecovale-hr
```

### Docker Swarm Example

```bash
# Deploy to swarm
docker stack deploy -c docker-compose.yml ecovale-hr

# Update service
docker service update --image ghcr.io/org/ecovale-hr:latest ecovale-hr_app
```

---

## 🧪 Testing CI/CD Pipeline

### Test Locally

```bash
# Install act (GitHub Actions local runner)
# https://github.com/nektos/act
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run workflow locally
act -j build-and-test

# Run specific job
act -j build-docker --secret-file .secrets
```

### Manual Trigger

```bash
# Trigger workflow via GitHub CLI
gh workflow run backend-ci-cd.yml

# View workflow runs
gh run list --workflow=backend-ci-cd.yml

# View logs
gh run view --log
```

---

## 📋 Docker Image Optimization

### Current Image Size

```bash
# Check image size
docker images ecovale-hr:latest

# Expected: ~200-300 MB (multi-stage build with JRE)
```

### Optimization Tips

1. ✅ Multi-stage build (already implemented)
2. ✅ Use Alpine Linux (already implemented)
3. ✅ JRE instead of JDK (already implemented)
4. ✅ Exclude test dependencies
5. ✅ Layer caching for dependencies

---

## 🔍 Troubleshooting

### Build Fails

```bash
# Check build logs
docker-compose logs app

# Rebuild without cache
docker-compose build --no-cache

# Check Maven dependencies
docker run --rm ecovale-hr:latest sh -c "mvn dependency:tree"
```

### Container Won't Start

```bash
# Check container logs
docker logs ecovale-hr

# Check health status
docker inspect ecovale-hr | grep Health -A 20

# Check environment variables
docker exec ecovale-hr env

# Test database connection
docker exec ecovale-hr sh -c "wget -O- http://localhost:8080/actuator/health"
```

### Database Connection Issues

```bash
# Check MySQL is running
docker-compose ps mysql

# Check MySQL logs
docker-compose logs mysql

# Test connection from app container
docker exec ecovale-hr sh -c "nc -zv mysql 3306"

# Connect to MySQL manually
docker exec -it ecovale-mysql mysql -u root -p
```

### GitHub Actions Fails

```bash
# Check workflow syntax
gh workflow view backend-ci-cd.yml

# View failed run
gh run view --log

# Re-run failed jobs
gh run rerun --failed
```

---

## ✅ Deployment Checklist

### Before Deploying

- [ ] Environment variables configured in `.env`
- [ ] JWT secret is strong (64+ characters)
- [ ] Database credentials are secure
- [ ] CORS origins include production domain
- [ ] Health check endpoint accessible
- [ ] Docker image built successfully
- [ ] Tests passing in CI/CD
- [ ] Security scan completed

### After Deploying

- [ ] Health check returns 200 OK
- [ ] Application logs show no errors
- [ ] Database migrations applied
- [ ] API endpoints accessible
- [ ] Authentication working
- [ ] Monitoring configured
- [ ] Backup strategy implemented

---

## 🎉 Success!

Your application now has:
- ✅ Docker containerization with multi-stage build
- ✅ Docker Compose for local development
- ✅ Complete CI/CD pipeline with GitHub Actions
- ✅ Automated testing and security scanning
- ✅ Docker image publishing to GHCR
- ✅ Production-ready deployment workflow

**Next Steps:**
1. Push code to GitHub to trigger pipeline
2. View workflow runs in Actions tab
3. Pull Docker image from registry
4. Deploy to your production environment

For questions, check the inline comments in each configuration file!
