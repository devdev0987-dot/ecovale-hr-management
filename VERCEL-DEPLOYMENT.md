# 🚀 Vercel Deployment Guide

Complete step-by-step guide for deploying the Ecovale HR Management System on Vercel.

## 📋 Prerequisites

- GitHub account
- Vercel account (https://vercel.com) - Free tier available
- Git repository pushed to GitHub

---

**ℹ️ Note on Configuration:**  
This project uses `vercel.json` for build configuration. Environment variables are managed through the Vercel Dashboard or CLI (not in vercel.json).

**Required Environment Variable:**
- `VITE_API_BASE_URL` - Your backend API endpoint (see [Environment Variables](#-environment-variables) section below)

---

## 🔧 Quick Deploy (Recommended)

### Method 1: Deploy via Vercel Dashboard

1. **Go to Vercel**
   - Visit https://vercel.com/new
   - Sign in with your GitHub account

2. **Import Git Repository**
   - Click "Import Git Repository"
   - Select this repository from the list
   - Or paste the repository URL

3. **Configure Project**
   - Vercel will auto-detect the Vite framework
   - Configuration is already set in `vercel.json`
   - Default settings:
     - Framework Preset: Vite
     - Build Command: `npm run build`
     - Output Directory: `dist`
     - Install Command: `npm install`

4. **Add Environment Variables** (Required)
   
   In the "Environment Variables" section, add:
   
   ```bash
   VITE_API_BASE_URL=https://your-backend-url.railway.app/api/v1
   ```
   
   Optional variables:
   ```bash
   VITE_API_TIMEOUT=30000
   VITE_ENABLE_DEBUG=false
   ```
   
   **Important:** Replace `your-backend-url.railway.app` with your actual backend URL.

5. **Deploy**
   - Click "Deploy"
   - Wait for the build to complete (usually 1-2 minutes)
   - Your app will be live at: `https://your-project-name.vercel.app`

### Method 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy from Root Directory**
   ```bash
   cd /path/to/ecovale-hr-management
   vercel
   ```

4. **Follow the Prompts**
   - Set up and deploy? Yes
   - Which scope? Select your account
   - Link to existing project? No (first time)
   - What's your project's name? ecovale-hr-management
   - In which directory is your code located? ./ (press Enter)
   - Want to override settings? No (vercel.json will be used)

5. **Add Environment Variables**
   ```bash
   vercel env add VITE_API_BASE_URL production
   # Enter: https://your-backend-url.railway.app/api/v1
   ```

6. **Deploy to Production**
   ```bash
   vercel --prod
   ```

## ⚙️ Environment Variables

### Required Variables

| Variable | Description | Example | Where to Set |
|----------|-------------|---------|--------------|
| `VITE_API_BASE_URL` | Backend API endpoint | `https://api.railway.app/api/v1` | Vercel Dashboard → Settings → Environment Variables |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `VITE_API_TIMEOUT` | API request timeout (ms) | 30000 | 45000 |
| `VITE_ENABLE_DEBUG` | Enable debug mode | false | true |

### How to Add Environment Variables

**Via Dashboard:**
1. Go to your project in Vercel Dashboard
2. Click "Settings" → "Environment Variables"
3. Add each variable:
   - Name: `VITE_API_BASE_URL`
   - Value: `https://your-backend-url.railway.app/api/v1`
   - Environment: Select "Production" (and "Preview" if needed)
4. Click "Save"

**Via CLI:**
```bash
vercel env add VITE_API_BASE_URL production
vercel env add VITE_API_TIMEOUT production
```

## 🔄 Automatic Deployments

Vercel automatically deploys on every push:

- **Production Deployment:** Push to `main` branch
- **Preview Deployment:** Push to any other branch or PR

### Configure Branch for Production

1. Go to Project Settings → Git
2. Set "Production Branch" to your main branch (usually `main` or `master`)
3. Every push to this branch triggers a production deployment

## 📝 Configuration Files

### vercel.json

The project includes a `vercel.json` configuration file:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "devCommand": "npm run dev",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

**What this does:**
- `rewrites`: Routes all non-existent routes to `index.html` for SPA client-side routing. Static files in the `dist` directory (like `/assets/*`, `/index.html`, etc.) are served normally without rewriting. This is the standard pattern for SPAs.
- `headers`: Adds cache headers for optimal performance on static assets (1 year cache for immutable hashed assets)

**Note on Environment Variables:**  
Environment variables are not defined in `vercel.json`. Instead, configure them via the Vercel Dashboard (Settings → Environment Variables) or using the Vercel CLI. See the [Environment Variables](#-environment-variables) section above for required configuration.

### .vercelignore

The `.vercelignore` file excludes unnecessary files from deployment:
- `node_modules` - Dependencies (Vercel installs these)
- `backend` - Backend directory (not needed for frontend)
- `.env` files - Use Vercel dashboard for env vars
- Documentation and metadata files

## 🔗 Custom Domain (Optional)

### Add Custom Domain

1. Go to Project Settings → Domains
2. Click "Add Domain"
3. Enter your domain (e.g., `hr.yourdomain.com`)
4. Follow DNS configuration instructions from Vercel dashboard:
   - **CNAME record (Recommended):** `hr` → `cname.vercel-dns.com`
   - **A record:** Point to Vercel's IP (check Vercel dashboard for current IP)
   
   > **Note:** Always refer to the Vercel dashboard for the most up-to-date DNS configuration values, as IPs and CNAMEs may change over time.

5. Wait for DNS propagation (5-60 minutes)

### SSL Certificate

Vercel automatically provisions SSL certificates for all domains (free).

## 🔒 CORS Configuration

After deploying the frontend, update your backend CORS settings:

**Backend Environment Variable:**
```bash
CORS_ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com
```

If using Railway for backend:
1. Go to Railway Dashboard → Your Service
2. Click "Variables"
3. Update `CORS_ALLOWED_ORIGINS` with your Vercel URL
4. Redeploy backend

## ✅ Deployment Checklist

Before going live:

- [ ] Repository pushed to GitHub
- [ ] Vercel account created
- [ ] Project imported to Vercel
- [ ] `VITE_API_BASE_URL` environment variable set
- [ ] Build successful (check deployment logs)
- [ ] Application accessible at Vercel URL
- [ ] Login functionality working
- [ ] API calls connecting to backend
- [ ] Backend CORS updated with Vercel URL
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active (automatic)

## 🧪 Testing Deployment

### 1. Test the Deployment URL

Visit your Vercel URL: `https://your-project-name.vercel.app`

### 2. Check Health

Open browser console and verify:
```javascript
// Check API base URL
console.log(import.meta.env.VITE_API_BASE_URL)
// Should show your backend URL
```

### 3. Test Login

Use demo credentials (see `DEMO-CREDENTIALS.md`):
- Username: `demo_admin`
- Password: `Demo@2026!Secure`

### 4. Check API Connectivity

Monitor Network tab in browser DevTools:
- API calls should go to your backend URL
- Should return 200 OK (or appropriate status codes)
- No CORS errors

## 🐛 Troubleshooting

### Build Fails

**Error:** `vite: command not found`
- **Solution:** Vercel auto-installs dependencies. Check `package.json` has correct scripts.

**Error:** Build exceeds time limit
- **Solution:** Vite builds are fast. Check for infinite loops or large dependencies.

### Runtime Errors

**Error:** `Failed to fetch` or API calls return 404
- **Solution:** Check `VITE_API_BASE_URL` environment variable in Vercel dashboard
- Make sure it ends with `/api/v1` (no trailing slash)

**Error:** CORS errors in browser console
- **Solution:** Update backend `CORS_ALLOWED_ORIGINS` to include Vercel URL

**Error:** Environment variables not defined
- **Solution:** 
  1. Add variables in Vercel Dashboard → Settings → Environment Variables
  2. Redeploy (Vercel → Deployments → Three dots → Redeploy)

### Blank Page After Deploy

1. **Check browser console** for errors
2. **Verify build output:** 
   - Go to Vercel Dashboard → Deployments → View Build Logs
   - Check for errors during build
3. **Check routing:** 
   - `vercel.json` should have rewrites rule
   - All routes should point to `/index.html`

### API Not Connecting

1. **Check environment variable:**
   ```bash
   # In browser console
   console.log(import.meta.env.VITE_API_BASE_URL)
   ```

2. **Check backend health:**
   ```bash
   curl https://your-backend-url.railway.app/api/v1/health
   ```

3. **Check CORS:**
   - Backend must allow your Vercel domain
   - Update `CORS_ALLOWED_ORIGINS` on backend

## 🚀 Continuous Deployment

Vercel automatically deploys when you push to GitHub:

1. **Make Changes Locally**
   ```bash
   # Edit files
   git add .
   git commit -m "Update feature"
   git push origin main
   ```

2. **Automatic Deployment**
   - Vercel detects the push
   - Builds and deploys automatically
   - New version live in ~2 minutes

3. **Deployment Notifications**
   - Vercel sends email on deployment status
   - Check Dashboard for logs and status

## 📊 Monitoring & Analytics

### View Deployment Logs

1. Go to Vercel Dashboard → Deployments
2. Click on any deployment
3. View build logs and runtime logs

### Analytics (Free Tier)

Vercel provides:
- Page views
- Unique visitors
- Top pages
- Device types
- Geographic distribution

Access via: Dashboard → Analytics

### Error Monitoring

Consider integrating:
- Sentry (error tracking)
- LogRocket (session replay)
- Google Analytics (user behavior)

## 💰 Pricing

**Free Tier Includes:**
- Unlimited deployments
- 100 GB bandwidth/month
- Automatic SSL
- Preview deployments
- Analytics

**Pro Tier ($20/month):**
- 1 TB bandwidth
- Advanced analytics
- Team collaboration
- Priority support

For this demo/prototype, **Free Tier is sufficient**.

## 🔐 Security Best Practices

1. **Environment Variables**
   - Never commit `.env` files
   - Use Vercel dashboard for secrets
   - Different values for preview/production

2. **API Keys**
   - Store in Vercel environment variables
   - Rotate regularly
   - Use different keys for dev/prod

3. **CORS**
   - Only allow specific domains
   - Don't use `*` wildcard in production

4. **HTTPS**
   - Always use HTTPS (Vercel provides free SSL)
   - Ensure backend also uses HTTPS

## 📚 Additional Resources

**Official Documentation:**
- Vercel Vite Guide: https://vercel.com/docs/frameworks/vite
- Vercel CLI: https://vercel.com/docs/cli
- Environment Variables: https://vercel.com/docs/environment-variables

**Project Documentation:**
- [Deployment Guide](./DEPLOYMENT-GUIDE.md) - Multi-platform guide
- [Demo Credentials](./DEMO-CREDENTIALS.md) - Test accounts
- [Architecture](./ARCHITECTURE.md) - System design

## 🆘 Support

**Issues with Vercel:**
- Vercel Documentation: https://vercel.com/docs
- Community Support: https://github.com/vercel/vercel/discussions
- Support: support@vercel.com

**Issues with the App:**
- Check [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)
- Review [Troubleshooting](#troubleshooting) section
- Open GitHub issue in this repository

---

## ✅ Quick Reference

### Deploy to Vercel (Dashboard)
1. Go to https://vercel.com/new
2. Import GitHub repository
3. Add `VITE_API_BASE_URL` environment variable
4. Click Deploy

### Deploy to Vercel (CLI)
```bash
vercel
vercel env add VITE_API_BASE_URL production
vercel --prod
```

### Update Environment Variable
```bash
# Via CLI
vercel env rm VITE_API_BASE_URL production
vercel env add VITE_API_BASE_URL production

# Via Dashboard
Settings → Environment Variables → Edit → Save → Redeploy
```

### Force Redeploy
Dashboard → Deployments → Latest → Three dots → Redeploy

---

**Last Updated:** January 29, 2026  
**Version:** 1.0.0  
**Vercel Platform:** ✅ Fully Compatible
