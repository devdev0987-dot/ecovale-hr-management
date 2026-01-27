# ⚠️ IMPORTANT: Vite vs Create React App

## 🚨 This Project Uses VITE, Not Create React App!

Many developers are familiar with Create React App (CRA) conventions. **This project uses Vite**, which has different syntax for environment variables.

---

## ❌ Create React App (DON'T USE)

```bash
# .env file
REACT_APP_API_BASE_URL=http://localhost:8080
REACT_APP_TIMEOUT=30000
```

```javascript
// JavaScript code
const apiUrl = process.env.REACT_APP_API_BASE_URL;
const timeout = process.env.REACT_APP_TIMEOUT;
const isDev = process.env.NODE_ENV === 'development';
```

**Result:** `undefined` - Won't work in Vite!

---

## ✅ Vite (USE THIS)

```bash
# .env file
VITE_API_BASE_URL=http://localhost:8080
VITE_API_TIMEOUT=30000
```

```javascript
// JavaScript code
const apiUrl = import.meta.env.VITE_API_BASE_URL;
const timeout = import.meta.env.VITE_API_TIMEOUT;
const isDev = import.meta.env.DEV;
```

**Result:** Works correctly! ✅

---

## 📊 Quick Comparison

| Feature | Create React App | Vite (This Project) |
|---------|-----------------|---------------------|
| **Prefix** | `REACT_APP_` | `VITE_` |
| **Access** | `process.env.*` | `import.meta.env.*` |
| **Dev Mode** | `process.env.NODE_ENV === 'development'` | `import.meta.env.DEV` |
| **Prod Mode** | `process.env.NODE_ENV === 'production'` | `import.meta.env.PROD` |
| **Mode** | `process.env.NODE_ENV` | `import.meta.env.MODE` |
| **Base URL** | `process.env.PUBLIC_URL` | `import.meta.env.BASE_URL` |

---

## 🔄 Migration Examples

### Environment File

**Before (CRA):**
```env
REACT_APP_API_BASE_URL=http://localhost:8080
REACT_APP_API_KEY=abc123
REACT_APP_ENABLE_FEATURE=true
```

**After (Vite):**
```env
VITE_API_BASE_URL=http://localhost:8080
VITE_API_KEY=abc123
VITE_ENABLE_FEATURE=true
```

### API Client Configuration

**Before (CRA):**
```javascript
// apiClient.js
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const API_TIMEOUT = process.env.REACT_APP_TIMEOUT || 30000;

if (process.env.NODE_ENV === 'development') {
  console.log('Dev mode');
}
```

**After (Vite):**
```javascript
// apiClient.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000;

if (import.meta.env.DEV) {
  console.log('Dev mode');
}
```

### Component Usage

**Before (CRA):**
```javascript
// Component.jsx
const MyComponent = () => {
  const apiUrl = process.env.REACT_APP_API_BASE_URL;
  const isProduction = process.env.NODE_ENV === 'production';
  
  return <div>API: {apiUrl}</div>;
};
```

**After (Vite):**
```javascript
// Component.jsx
const MyComponent = () => {
  const apiUrl = import.meta.env.VITE_API_BASE_URL;
  const isProduction = import.meta.env.PROD;
  
  return <div>API: {apiUrl}</div>;
};
```

---

## 🧪 Testing Your Environment

### ✅ Correct (Will Work)

```javascript
// This will show your environment variables
console.log('All env vars:', import.meta.env);
console.log('API URL:', import.meta.env.VITE_API_BASE_URL);
console.log('Is Dev:', import.meta.env.DEV);
console.log('Mode:', import.meta.env.MODE);
```

### ❌ Incorrect (Won't Work)

```javascript
// These will all be undefined
console.log('API URL:', process.env.REACT_APP_API_BASE_URL);  // undefined
console.log('API URL:', process.env.VITE_API_BASE_URL);       // undefined
console.log('NODE_ENV:', process.env.NODE_ENV);               // undefined
```

---

## 🔍 How to Identify Your Build Tool

### Check `package.json` Scripts

**Create React App:**
```json
{
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test"
  }
}
```

**Vite (This Project):**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### Check Config Files

**Create React App:**
- No `vite.config.ts` or `vite.config.js`
- Has `react-scripts` in dependencies
- May have `config-overrides.js` for customization

**Vite (This Project):**
- Has `vite.config.ts` or `vite.config.js` ✅
- Has `vite` in devDependencies ✅
- No `react-scripts`

---

## 💡 Why Use Vite?

| Feature | Vite | Create React App |
|---------|------|------------------|
| **Dev Server Speed** | ⚡ Instant (ESM) | 🐢 Slower (bundled) |
| **HMR Speed** | ⚡ Instant | 🐢 Slower |
| **Build Speed** | ⚡ Fast (esbuild) | 🐢 Slower (webpack) |
| **Bundle Size** | 📦 Smaller | 📦 Larger |
| **Modern** | ✅ Active development | ⚠️ Maintenance mode |

---

## 📝 Checklist: Am I Using the Right Syntax?

- [ ] My `.env` variables start with `VITE_` (not `REACT_APP_`)
- [ ] I use `import.meta.env.VITE_*` (not `process.env.REACT_APP_*`)
- [ ] I use `import.meta.env.DEV` (not `process.env.NODE_ENV === 'development'`)
- [ ] I restart dev server after changing `.env`
- [ ] My `package.json` has `vite` (not `react-scripts`)

---

## 🚨 Common Mistakes

### Mistake 1: Using CRA Syntax in Vite Project

```javascript
// ❌ Won't work
const apiUrl = process.env.REACT_APP_API_BASE_URL;

// ✅ Correct
const apiUrl = import.meta.env.VITE_API_BASE_URL;
```

### Mistake 2: Wrong Environment Variable Prefix

```env
# ❌ Won't work in Vite
REACT_APP_API_BASE_URL=http://localhost:8080

# ✅ Correct
VITE_API_BASE_URL=http://localhost:8080
```

### Mistake 3: Not Restarting Dev Server

```bash
# After changing .env:

# ❌ Won't work (old values cached)
# Just save .env and expect changes

# ✅ Correct (restart required)
# Ctrl+C to stop
npm run dev
```

### Mistake 4: Using `process.env` Instead of `import.meta.env`

```javascript
// ❌ Won't work in Vite
if (process.env.NODE_ENV === 'production') {
  // This condition will never be true
}

// ✅ Correct
if (import.meta.env.PROD) {
  // This works!
}
```

---

## 🎓 Remember

| When You See | Think | Use Instead |
|--------------|-------|-------------|
| `REACT_APP_*` | CRA | `VITE_*` |
| `process.env.*` | Node.js/CRA | `import.meta.env.*` |
| `react-scripts` | CRA | `vite` |
| `NODE_ENV` | Node.js/CRA | `MODE`, `DEV`, or `PROD` |

---

## 📚 Learn More

- **Vite Env Docs:** https://vitejs.dev/guide/env-and-mode.html
- **CRA to Vite Migration:** https://vitejs.dev/guide/migration.html
- **This Project's Guide:** [ENVIRONMENT-SETUP.md](ENVIRONMENT-SETUP.md)

---

## ✅ Quick Test

Add this to any component to verify:

```javascript
useEffect(() => {
  console.log('=== Environment Test ===');
  console.log('Build Tool:', import.meta.env.DEV ? 'Vite (Dev)' : 'Vite (Prod)');
  console.log('API URL:', import.meta.env.VITE_API_BASE_URL);
  console.log('All vars:', import.meta.env);
}, []);
```

**Expected Output:**
```
=== Environment Test ===
Build Tool: Vite (Dev)
API URL: http://localhost:8080
All vars: {BASE_URL: "/", DEV: true, MODE: "development", ...}
```

---

**Remember: This project uses VITE, not Create React App!** 🚀

Always use:
- ✅ `VITE_*` prefix
- ✅ `import.meta.env.*` syntax
- ✅ Restart after `.env` changes
