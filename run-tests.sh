#!/bin/bash
# Performance Test Runner Script
# Runs all k6 performance tests and generates reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8080}"
RESULTS_DIR="./results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Ecovale HR - Performance Test Suite${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Base URL: $BASE_URL"
echo "Results Directory: $RESULTS_DIR"
echo "Timestamp: $TIMESTAMP"
echo ""

# Create results directory
mkdir -p "$RESULTS_DIR"

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}Error: k6 is not installed${NC}"
    echo "Install k6: https://k6.io/docs/getting-started/installation/"
    echo ""
    echo "Quick install (Linux):"
    echo "  sudo gpg -k"
    echo "  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69"
    echo "  echo \"deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main\" | sudo tee /etc/apt/sources.list.d/k6.list"
    echo "  sudo apt-get update"
    echo "  sudo apt-get install k6"
    exit 1
fi

# Check if application is running
echo -e "${YELLOW}Checking if application is running...${NC}"
if ! curl -s "$BASE_URL/actuator/health" > /dev/null; then
    echo -e "${RED}Error: Application is not running at $BASE_URL${NC}"
    echo "Please start the application first: mvn spring-boot:run"
    exit 1
fi
echo -e "${GREEN}✓ Application is running${NC}"
echo ""

# Function to run a test
run_test() {
    local test_name=$1
    local test_file=$2
    local description=$3
    
    echo -e "${YELLOW}======================================${NC}"
    echo -e "${YELLOW}Running: $test_name${NC}"
    echo -e "${YELLOW}Description: $description${NC}"
    echo -e "${YELLOW}======================================${NC}"
    
    local output_file="$RESULTS_DIR/${test_name}_${TIMESTAMP}"
    
    # Run k6 test with JSON output and HTML report
    k6 run \
        --out json="${output_file}.json" \
        --summary-export="${output_file}_summary.json" \
        -e BASE_URL="$BASE_URL" \
        "$test_file"
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ $test_name completed successfully${NC}"
    else
        echo -e "${RED}✗ $test_name failed${NC}"
    fi
    
    echo ""
    return $exit_code
}

# Track test results
total_tests=0
passed_tests=0
failed_tests=0

# Test 1: Authentication Load Test
if [ -f "load-test-auth.js" ]; then
    total_tests=$((total_tests + 1))
    if run_test "load-test-auth" "load-test-auth.js" "Tests authentication with 1000 concurrent users"; then
        passed_tests=$((passed_tests + 1))
    else
        failed_tests=$((failed_tests + 1))
    fi
fi

# Test 2: CRUD Operations Load Test
if [ -f "load-test-crud.js" ]; then
    total_tests=$((total_tests + 1))
    if run_test "load-test-crud" "load-test-crud.js" "Tests CRUD operations under load"; then
        passed_tests=$((passed_tests + 1))
    else
        failed_tests=$((failed_tests + 1))
    fi
fi

# Test 3: Spike Test
if [ -f "spike-test.js" ]; then
    total_tests=$((total_tests + 1))
    if run_test "spike-test" "spike-test.js" "Tests sudden traffic spikes (2000 users)"; then
        passed_tests=$((passed_tests + 1))
    else
        failed_tests=$((failed_tests + 1))
    fi
fi

# Test 4: Stress Test (optional - comment out for faster runs)
# if [ -f "stress-test.js" ]; then
#     total_tests=$((total_tests + 1))
#     if run_test "stress-test" "stress-test.js" "Finds system breaking point"; then
#         passed_tests=$((passed_tests + 1))
#     else
#         failed_tests=$((failed_tests + 1))
#     fi
# fi

# Test 5: Soak Test (optional - takes 1+ hour)
# if [ -f "soak-test.js" ]; then
#     total_tests=$((total_tests + 1))
#     if run_test "soak-test" "soak-test.js" "Tests stability over 1 hour"; then
#         passed_tests=$((passed_tests + 1))
#     else
#         failed_tests=$((failed_tests + 1))
#     fi
# fi

# Generate summary report
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Test Suite Summary${NC}"
echo -e "${GREEN}======================================${NC}"
echo "Total Tests: $total_tests"
echo -e "${GREEN}Passed: $passed_tests${NC}"
echo -e "${RED}Failed: $failed_tests${NC}"
echo ""
echo "Results saved to: $RESULTS_DIR"
echo ""

# Generate HTML report (if k6-reporter is installed)
if command -v k6-to-junit &> /dev/null; then
    echo "Generating JUnit report..."
    for json_file in "$RESULTS_DIR"/*_${TIMESTAMP}.json; do
        if [ -f "$json_file" ]; then
            k6-to-junit "$json_file" > "${json_file%.json}.xml"
        fi
    done
fi

echo -e "${GREEN}Performance testing completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Review test results in $RESULTS_DIR"
echo "2. Check summary JSON files for detailed metrics"
echo "3. Compare results with previous test runs"
echo "4. Analyze failures and optimize application"
echo ""

# Exit with appropriate code
if [ $failed_tests -gt 0 ]; then
    exit 1
else
    exit 0
fi
