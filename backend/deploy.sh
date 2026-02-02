#!/bin/bash

# =================================================================
# Railway Deployment Script
# =================================================================
# Works from both root directory and backend directory
# Usage: ./deploy.sh or bash deploy.sh
# =================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Railway Deployment Script${NC}"
echo "=================================="
echo ""

# Detect if we're in backend directory or root
if [ -f "pom.xml" ]; then
    echo -e "${GREEN}✓${NC} Detected: Running from backend directory"
    BACKEND_DIR="."
elif [ -d "backend" ] && [ -f "backend/pom.xml" ]; then
    echo -e "${GREEN}✓${NC} Detected: Running from root directory"
    BACKEND_DIR="backend"
else
    echo -e "${RED}✗${NC} Error: Cannot find backend directory or pom.xml"
    echo "Please run this script from either:"
    echo "  - Project root directory (where backend/ folder exists)"
    echo "  - backend/ directory (where pom.xml exists)"
    exit 1
fi

# Change to backend directory
cd "$BACKEND_DIR"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${YELLOW}!${NC} Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Check if logged in to Railway
echo ""
echo "Checking Railway authentication..."
if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}!${NC} Not logged in to Railway. Please login:"
    railway login
fi

# Check if project is linked
echo ""
echo "Checking Railway project link..."
if ! railway status &> /dev/null; then
    echo -e "${YELLOW}!${NC} No project linked. Linking to Railway project..."
    railway link
fi

# Show current project info
echo ""
echo -e "${GREEN}📋 Current Railway Configuration:${NC}"
railway status

# Ask for confirmation
echo ""
read -p "Deploy to Railway? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Deploy to Railway
echo ""
echo -e "${GREEN}🚀 Deploying to Railway...${NC}"
railway up

# Check deployment status
echo ""
echo -e "${GREEN}✓ Deployment initiated!${NC}"
echo ""
echo "Check deployment status:"
echo "  $ railway logs"
echo ""
echo "View service URL:"
echo "  $ railway open"
echo ""
echo -e "${GREEN}✓ Done!${NC}"
