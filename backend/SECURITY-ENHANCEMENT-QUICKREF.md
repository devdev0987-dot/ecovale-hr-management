# Security Enhancements - Quick Reference Card

## 🎯 What's New

| Feature | Status | File |
|---------|--------|------|
| **JWT Expiration** | ✅ | JwtUtil.java, JwtAuthenticationFilter.java |
| **Error Responses** | ✅ | JwtAuthenticationEntryPoint.java |
| **Request Logging** | ✅ | RequestLoggingFilter.java |
| **CSRF Protection** | ✅ | SecurityConfig.java |
| **Rate Limiting** | ✅ | RateLimitingFilter.java |
| **Password Security** | ✅ | All filters |

---

## 🔑 Rate Limits

| Endpoint | Limit | Retry After |
|----------|-------|-------------|
| `/api/auth/login` | 5/min | 60s |
| `/api/auth/register` | 3/5min | 300s |
| `/api/auth/*` | 20/min | 60s |

---

## 🔒 JWT Tokens

| Type | Expiration | Property |
|------|------------|----------|
| Access | 24h | `jwt.expiration=86400000` |
| Refresh | 7d | `jwt.refresh.expiration=604800000` |

---

## 📝 Never Logged

✅ password  
✅ token  
✅ secret  
✅ apiKey  
✅ Authorization header  
✅ Cookie header  

---

## 🧪 Quick Test

```bash
# Rate limit test
for i in {1..6}; do 
  curl -X POST localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}'; 
done
# 6th returns 429
```

---

## 🔧 Config

```properties
jwt.secret=minimum-32-characters-long
jwt.expiration=86400000
logging.level.com.ecovale.hr.security=DEBUG
```

---

## 📊 Filter Order

1. RateLimiting → 2. RequestLogging → 3. JwtAuth

---

## ✅ Checklist

- [ ] Test rate limiting
- [ ] Test expired token
- [ ] Verify password not logged
- [ ] Set production JWT_SECRET

See **SECURITY-ENHANCEMENTS.md** for details!
