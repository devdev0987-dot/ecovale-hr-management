# 🐋 Docker Quick Reference

## TL;DR

```bash
cd backend
docker-compose up -d
```

**Done!** Backend: http://localhost:8080 | MySQL: localhost:3306

---

## 📦 Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build (OpenJDK 17) |
| `docker-compose.yml` | Dev environment (backend + MySQL) |
| `docker-compose.prod.yml` | Production (backend only) |
| `.dockerignore` | Build optimization |

---

## 🚀 Common Commands

### Start/Stop

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart
docker-compose restart

# Stop and remove data
docker-compose down -v
```

### Logs

```bash
# View logs
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100
```

### Rebuild

```bash
# Rebuild after code changes
docker-compose up -d --build
```

### Shell Access

```bash
# Backend container
docker-compose exec backend sh

# MySQL container
docker-compose exec mysql mysql -u hruser -phrpassword
```

---

## 🌐 Services

| Service | URL | Credentials |
|---------|-----|-------------|
| Backend | http://localhost:8080 | - |
| Health | http://localhost:8080/actuator/health | - |
| MySQL | localhost:3306 | hruser / hrpassword |

---

## 🔧 Configuration

### Change Database Password

Edit `docker-compose.yml`:
```yaml
environment:
  DB_PASSWORD: your-new-password
```

### Use External Database

```bash
docker-compose up backend -d
# Don't start MySQL service
```

Edit environment:
```yaml
environment:
  DB_HOST: your-external-host
  DB_USERNAME: your-username
  DB_PASSWORD: your-password
```

---

## 🐛 Troubleshooting

### Application won't start
```bash
docker-compose logs backend
# Wait for MySQL health check (~30s)
```

### Port already in use
Edit `docker-compose.yml`:
```yaml
ports:
  - "8081:8080"  # Change 8080 to 8081
```

### Clear everything
```bash
docker-compose down -v
docker system prune -a
docker-compose up -d
```

---

## 📚 Full Documentation

- **Complete Guide:** [DOCKER-GUIDE.md](DOCKER-GUIDE.md)
- **Backend Setup:** [README.md](README.md)
- **AWS Deployment:** [AWS-RDS-DEPLOYMENT.md](AWS-RDS-DEPLOYMENT.md)

---

**Need help?** Run `docker-compose ps` to check status
