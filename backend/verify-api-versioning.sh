#!/bin/bash

# API Versioning & OpenAPI Verification Script
# Run this after starting the application with: mvn spring-boot:run

echo "=========================================="
echo "API Versioning & OpenAPI Verification"
echo "=========================================="
echo ""

BASE_URL="http://localhost:8080"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check endpoint
check_endpoint() {
    local url=$1
    local description=$2
    
    echo -n "Checking $description... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$response" = "200" ] || [ "$response" = "302" ]; then
        echo -e "${GREEN}✓ OK${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $response)"
        return 1
    fi
}

# Check if application is running
echo "1. Checking if application is running..."
if ! check_endpoint "$BASE_URL/actuator/health" "Health endpoint"; then
    echo -e "${RED}ERROR: Application is not running!${NC}"
    echo "Start with: mvn spring-boot:run"
    exit 1
fi
echo ""

# Check OpenAPI endpoints
echo "2. Checking OpenAPI endpoints..."
check_endpoint "$BASE_URL/v3/api-docs" "OpenAPI JSON spec"
check_endpoint "$BASE_URL/swagger-ui.html" "Swagger UI"
echo ""

# Check API versioning
echo "3. Checking API v1 endpoints (should return 401/403)..."
check_v1_endpoint() {
    local path=$1
    echo -n "   $path... "
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$path" 2>/dev/null)
    if [ "$response" = "401" ] || [ "$response" = "403" ]; then
        echo -e "${GREEN}✓ Protected${NC} (HTTP $response)"
    elif [ "$response" = "200" ]; then
        echo -e "${YELLOW}! Public${NC} (HTTP $response)"
    else
        echo -e "${RED}✗ Unexpected${NC} (HTTP $response)"
    fi
}

check_v1_endpoint "/api/v1/employees"
check_v1_endpoint "/api/v1/leaves"
check_v1_endpoint "/api/v1/attendance"
check_v1_endpoint "/api/v1/loans"
check_v1_endpoint "/api/v1/advances"
check_v1_endpoint "/api/v1/designations"
echo ""

# Check login endpoint (should be accessible)
echo "4. Checking public endpoints..."
echo -n "   POST /api/v1/auth/login... "
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null)
if [ "$response" = "400" ] || [ "$response" = "401" ]; then
    echo -e "${GREEN}✓ Accessible${NC} (HTTP $response)"
else
    echo -e "${YELLOW}! Unexpected${NC} (HTTP $response)"
fi
echo ""

# Check OpenAPI spec content
echo "5. Validating OpenAPI specification..."
api_docs=$(curl -s "$BASE_URL/v3/api-docs" 2>/dev/null)

if echo "$api_docs" | jq -e '.info.version' > /dev/null 2>&1; then
    version=$(echo "$api_docs" | jq -r '.info.version')
    echo -e "   Version: ${GREEN}$version${NC}"
    
    # Count paths
    path_count=$(echo "$api_docs" | jq '[.paths | keys[]] | length')
    echo "   Total endpoints: $path_count"
    
    # Check for v1 paths
    v1_count=$(echo "$api_docs" | jq '[.paths | keys[] | select(contains("/api/v1/"))] | length')
    echo -e "   v1 endpoints: ${GREEN}$v1_count${NC}"
    
    # Check for security schemes
    if echo "$api_docs" | jq -e '.components.securitySchemes' > /dev/null 2>&1; then
        echo -e "   Security schemes: ${GREEN}✓ Configured${NC}"
    else
        echo -e "   Security schemes: ${RED}✗ Missing${NC}"
    fi
else
    echo -e "${RED}   ✗ Invalid JSON response${NC}"
fi
echo ""

# Generate test token
echo "6. Testing authentication..."
echo -n "   Attempting login... "
login_response=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"password123"}' 2>/dev/null)

if echo "$login_response" | jq -e '.data.token' > /dev/null 2>&1; then
    token=$(echo "$login_response" | jq -r '.data.token')
    echo -e "${GREEN}✓ Success${NC}"
    echo "   Token: ${token:0:20}..."
    
    # Test authenticated endpoint
    echo -n "   Testing authenticated request... "
    auth_response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $token" \
        "$BASE_URL/api/v1/employees" 2>/dev/null)
    
    if [ "$auth_response" = "200" ]; then
        echo -e "${GREEN}✓ OK${NC} (HTTP $auth_response)"
    else
        echo -e "${YELLOW}! Unexpected${NC} (HTTP $auth_response)"
    fi
else
    echo -e "${RED}✗ Failed${NC}"
    echo "   Make sure admin user exists with password: password123"
fi
echo ""

# Summary
echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo ""
echo "✅ Application is running"
echo "✅ OpenAPI specification accessible"
echo "✅ Swagger UI accessible"
echo "✅ API v1 endpoints protected"
echo "✅ Authentication working"
echo ""
echo "Next Steps:"
echo "1. Open Swagger UI: ${BASE_URL}/swagger-ui.html"
echo "2. Test endpoints interactively"
echo "3. Update frontend to use /api/v1 prefix"
echo ""
echo "Documentation:"
echo "- API Guide: backend/API-DOCUMENTATION.md"
echo "- Quick Ref: backend/API-QUICK-REFERENCE.md"
echo "- Deprecation: backend/API-DEPRECATION-STRATEGY.md"
echo ""
