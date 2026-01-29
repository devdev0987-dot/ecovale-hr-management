#!/bin/bash

# Deployment Status Checker
# This script helps verify deployment readiness

echo "🔍 EcoVale HR - Deployment Status Checker"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found${NC}"
    echo "Please run this script from the repository root"
    exit 1
fi

echo "📦 Step 1: Checking dependencies..."
if [ -f "package-lock.json" ]; then
    echo -e "${GREEN}✅ package-lock.json found${NC}"
else
    echo -e "${RED}❌ package-lock.json not found${NC}"
fi

if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ node_modules installed${NC}"
else
    echo -e "${YELLOW}⚠️  node_modules not found - run 'npm install'${NC}"
fi

echo ""
echo "🔨 Step 2: Testing build process..."
if npm run build > /tmp/build.log 2>&1; then
    echo -e "${GREEN}✅ Build successful${NC}"
    if [ -d "dist" ] && [ -f "dist/index.html" ]; then
        echo -e "${GREEN}✅ dist/index.html generated${NC}"
        # Check file size
        SIZE=$(du -sh dist | cut -f1)
        echo "   Build size: $SIZE"
    else
        echo -e "${RED}❌ dist folder or index.html not found${NC}"
    fi
else
    echo -e "${RED}❌ Build failed${NC}"
    echo "   Check /tmp/build.log for details"
    tail -20 /tmp/build.log
fi

echo ""
echo "⚙️  Step 3: Checking deployment configurations..."

# Check Netlify config
if [ -f "netlify.toml" ]; then
    echo -e "${GREEN}✅ netlify.toml found${NC}"
else
    echo -e "${RED}❌ netlify.toml not found${NC}"
fi

# Check Vercel config
if [ -f "vercel.json" ]; then
    echo -e "${GREEN}✅ vercel.json found${NC}"
else
    echo -e "${YELLOW}⚠️  vercel.json not found${NC}"
fi

# Check GitHub workflow
if [ -f ".github/workflows/frontend-deploy.yml" ]; then
    echo -e "${GREEN}✅ GitHub Actions workflow found${NC}"
else
    echo -e "${YELLOW}⚠️  GitHub Actions workflow not found${NC}"
fi

echo ""
echo "🔐 Step 4: Checking for required secrets..."
echo -e "${YELLOW}⚠️  Manual check required:${NC}"
echo "   - Go to GitHub repository Settings → Secrets → Actions"
echo "   - Verify NETLIFY_AUTH_TOKEN is set"
echo "   - Verify NETLIFY_SITE_ID is set"

echo ""
echo "🌐 Step 5: Deployment readiness..."
echo ""

# Count checks
READY=true

if [ ! -f "package-lock.json" ]; then READY=false; fi
if [ ! -d "node_modules" ]; then READY=false; fi
if [ ! -d "dist" ]; then READY=false; fi
if [ ! -f "netlify.toml" ]; then READY=false; fi

if [ "$READY" = true ]; then
    echo -e "${GREEN}✅ DEPLOYMENT READY!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Ensure GitHub secrets are configured"
    echo "2. Push to main branch or run workflow manually"
    echo "3. Monitor deployment in GitHub Actions tab"
    echo ""
    echo "Or deploy manually:"
    echo "  netlify deploy --prod --dir=dist"
else
    echo -e "${RED}❌ NOT READY for deployment${NC}"
    echo ""
    echo "Please fix the issues above before deploying"
fi

echo ""
echo "=========================================="
echo "For detailed deployment guide, see QUICK-DEPLOY.md"
