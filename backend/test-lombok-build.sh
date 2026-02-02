#!/bin/bash
# =================================================================
# Lombok Build Fix Test Script
# =================================================================
# This script tests if the Lombok annotation processing is working
# Run this to verify the fix: ./test-lombok-build.sh
# =================================================================

set -e  # Exit on error

echo "======================================"
echo "Testing Lombok Build Configuration"
echo "======================================"
echo ""

cd "$(dirname "$0")"

echo "✅ Step 1: Checking pom.xml for Lombok dependency..."
if grep -q "lombok" pom.xml; then
    echo "   ✓ Lombok dependency found in pom.xml"
else
    echo "   ✗ ERROR: Lombok dependency not found!"
    exit 1
fi

echo ""
echo "✅ Step 2: Checking Maven compiler plugin configuration..."
if grep -q "annotationProcessorPaths" pom.xml; then
    echo "   ✓ Annotation processor configuration found"
else
    echo "   ✗ ERROR: Annotation processor not configured!"
    exit 1
fi

echo ""
echo "✅ Step 3: Checking lombok.config file..."
if [ -f "lombok.config" ]; then
    echo "   ✓ lombok.config exists"
    cat lombok.config
else
    echo "   ⚠ WARNING: lombok.config not found (optional but recommended)"
fi

echo ""
echo "✅ Step 4: Testing Maven build..."
if command -v mvn &> /dev/null; then
    echo "   Maven found, running clean compile..."
    mvn clean compile -DskipTests -e || {
        echo "   ✗ ERROR: Build failed!"
        echo ""
        echo "Common fixes:"
        echo "   1. Delete ~/.m2/repository/org/projectlombok"
        echo "   2. Run: mvn dependency:purge-local-repository"
        echo "   3. Ensure Java 17 is installed"
        exit 1
    }
    echo "   ✓ Build successful!"
else
    echo "   ⚠ Maven not installed locally"
    echo "   Will be tested in Docker build"
fi

echo ""
echo "✅ Step 5: Checking for Lombok-annotated files..."
LOMBOK_FILES=$(find src -name "*.java" -exec grep -l "@Data\|@Getter\|@Setter" {} \; | wc -l)
echo "   Found $LOMBOK_FILES files using Lombok annotations"

echo ""
echo "======================================"
echo "✅ All checks passed!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Rebuild your Docker image: docker build -t ecovale-backend ."
echo "2. Or push to Railway/cloud and let CI/CD rebuild"
echo ""
