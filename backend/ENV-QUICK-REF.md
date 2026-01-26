# 🚀 Quick Reference: Environment Variables

## TL;DR

```bash
# Copy template
cp .env.example .env

# Edit credentials
nano .env

# Run
mvn spring-boot:run
```

---

## 📋 Required Variables

| Variable | Local Dev | AWS RDS Prod |
|----------|-----------|--------------|
| `DB_HOST` | `localhost` | `rds-endpoint.rds.amazonaws.com` |
| `DB_PORT` | `3306` | `3306` |
| `DB_NAME` | `ecovale_hr` | `ecovale_hr` |
| `DB_USERNAME` | `root` | `admin` |
| `DB_PASSWORD` | `yourpassword` | `SecurePass123!` |
| `DB_USE_SSL` | `false` | `true` |
| `JPA_DDL_AUTO` | `update` | `validate` |

---

## 🔧 Quick Commands

### Local Development
```bash
export DB_HOST=localhost
export DB_PASSWORD=yourpassword
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

### Production
```bash
export DB_HOST=rds-endpoint.rds.amazonaws.com
export DB_PASSWORD=secure-password
export DB_USE_SSL=true
export JPA_DDL_AUTO=validate
export SPRING_PROFILES_ACTIVE=prod
java -jar target/ecovale-hr-backend.jar
```

### Test Connection
```bash
curl http://localhost:8080/actuator/health
```

---

## 📚 Docs

- **Setup:** [README.md](README.md)
- **AWS Deployment:** [AWS-RDS-DEPLOYMENT.md](AWS-RDS-DEPLOYMENT.md)
- **Summary:** [RDS-CONFIG-SUMMARY.md](RDS-CONFIG-SUMMARY.md)
- **Template:** [.env.example](.env.example)

---

## ⚠️ Important

- ❌ Never commit `.env` files
- ✅ Always use `JPA_DDL_AUTO=validate` in production
- ✅ Enable SSL for AWS RDS (`DB_USE_SSL=true`)
- ✅ Use strong passwords in production

---

**Need help?** Check [AWS-RDS-DEPLOYMENT.md](AWS-RDS-DEPLOYMENT.md) for troubleshooting.
