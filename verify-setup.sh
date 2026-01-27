#!/bin/bash

# =============================================
# Ecovale HR Backend - Startup Verification Script
# =============================================

echo "=================================="
echo "🔍 Ecovale HR Backend - Pre-Flight Check"
echo "=================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Java
echo -n "Checking Java installation... "
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d'.' -f1)
    if [ "$JAVA_VERSION" -ge 17 ]; then
        echo -e "${GREEN}✓ Java $JAVA_VERSION installed${NC}"
    else
        echo -e "${RED}✗ Java 17+ required (found Java $JAVA_VERSION)${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Java not found${NC}"
    exit 1
fi

# Check Maven
echo -n "Checking Maven installation... "
if command -v mvn &> /dev/null; then
    MVN_VERSION=$(mvn -version | grep "Apache Maven" | cut -d' ' -f3)
    echo -e "${GREEN}✓ Maven $MVN_VERSION installed${NC}"
else
    echo -e "${RED}✗ Maven not found${NC}"
    exit 1
fi

# Check MySQL
echo -n "Checking MySQL service... "
if command -v mysql &> /dev/null; then
    if systemctl is-active --quiet mysql || systemctl is-active --quiet mysqld; then
        echo -e "${GREEN}✓ MySQL is running${NC}"
    else
        echo -e "${YELLOW}⚠ MySQL service is not running${NC}"
        echo "  Start with: sudo systemctl start mysql"
    fi
else
    echo -e "${YELLOW}⚠ MySQL not found${NC}"
fi

# Check if pom.xml exists
echo -n "Checking project structure... "
if [ -f "pom.xml" ]; then
    echo -e "${GREEN}✓ pom.xml found${NC}"
else
    echo -e "${RED}✗ pom.xml not found. Are you in the backend directory?${NC}"
    exit 1
fi

# Check if application.properties exists
echo -n "Checking configuration... "
if [ -f "src/main/resources/application.properties" ]; then
    echo -e "${GREEN}✓ application.properties found${NC}"
else
    echo -e "${RED}✗ application.properties not found${NC}"
    exit 1
fi

# Check port 8080
echo -n "Checking port 8080 availability... "
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Port 8080 is already in use${NC}"
    echo "  Kill process with: lsof -ti:8080 | xargs kill -9"
else
    echo -e "${GREEN}✓ Port 8080 is available${NC}"
fi

echo ""
echo "=================================="
echo "📋 Summary"
echo "=================================="
echo ""

# Summary
echo "All checks completed!"
echo ""
echo "🚀 Next steps:"
echo "  1. Configure database in application.properties"
echo "  2. Run: mvn clean install"
echo "  3. Run: mvn spring-boot:run"
echo "  4. Test: curl http://localhost:8080/actuator/health"
echo ""
echo "📖 Documentation:"
echo "  - README.md for full API documentation"
echo "  - QUICKSTART.md for quick setup guide"
echo "  - PROJECT-SUMMARY.md for implementation details"
echo ""
echo "=================================="
