# 🔌 Environment Variables - Quick Reference

## 🎯 TL;DR

```bash
# 1. Copy template
cp .env.example .env

# 2. Edit (optional - defaults work for local dev)
nano .env

# 3. Run
npm install
npm run dev
```

---

## 📋 Available Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | ✅ Yes | `http://localhost:8080` | Backend API URL |
| `VITE_API_TIMEOUT` | No | `30000` | Request timeout (ms) |
| `VITE_ENABLE_DEBUG` | No | `false` | Debug logging |

---

## 📁 Files Overview

| File | Purpose | Git |
|------|---------|-----|
| `.env.example` | Template for team | ✅ Committed |
| `.env` | Your local config | ❌ Ignored |
| `.env.local` | Personal overrides | ❌ Ignored |
| `.env.production` | Production defaults | ✅ Committed |

---

## 💡 Examples

### Local Development
```env
VITE_API_BASE_URL=http://localhost:8080
VITE_API_TIMEOUT=30000
VITE_ENABLE_DEBUG=true
```

### Production
```env
VITE_API_BASE_URL=https://api.ecovale.com
VITE_API_TIMEOUT=45000
VITE_ENABLE_DEBUG=false
```

---

## 🔧 Usage in Code

```javascript
// ✅ Correct (Vite)
const apiUrl = import.meta.env.VITE_API_BASE_URL;

// ❌ Wrong (Create React App)
const apiUrl = process.env.REACT_APP_API_BASE_URL;
```

---

## 🚨 Important Notes

⚠️ **This is a Vite project - use `VITE_` prefix, NOT `REACT_APP_`**

⚠️ **Restart dev server after changing `.env` files**

⚠️ **All `VITE_` variables are public (visible in browser)**

⚠️ **Never commit `.env` or `.env.local` to git**

---

## 📚 Full Documentation

- **Comprehensive Guide:** [ENVIRONMENT-SETUP.md](ENVIRONMENT-SETUP.md)
- **API Integration:** [FRONTEND-API-INTEGRATION.md](FRONTEND-API-INTEGRATION.md)
- **Backend Setup:** [backend/README.md](backend/README.md)

---

## ✅ Verify Setup

```bash
npm run dev
```

Open browser console - you should see:
```
🔧 API Client Configuration:
  Base URL: http://localhost:8080
  Timeout: 30000 ms
```

---

**Questions?** Check [ENVIRONMENT-SETUP.md](ENVIRONMENT-SETUP.md) for troubleshooting.
