# =================================================================
# Multi-Stage Dockerfile for Spring Boot Backend - Production Ready
# =================================================================
# Optimized for: Railway, Render, Fly.io, or any cloud provider
# Features: Multi-stage build, non-root user, minimal image size
# =================================================================

# =================================================================
# Stage 1: BUILD
# =================================================================
FROM maven:3.9-eclipse-temurin-17-alpine AS builder

# Set working directory
WORKDIR /build

# Copy pom.xml first for better layer caching
COPY pom.xml .

# Download dependencies (cached if pom.xml unchanged)
RUN mvn dependency:go-offline -B

# Copy source code
COPY src ./src

# Build the application with annotation processing enabled
# -X flag for debug output (remove after fixing)
RUN mvn clean package -DskipTests -B -e \
    && echo "Build completed successfully" \
    && ls -lh target/

# =================================================================
# Stage 2: RUNTIME - Production
# =================================================================
FROM eclipse-temurin:17-jre-alpine

# Metadata
LABEL maintainer="Ecovale HR Team"
LABEL description="Ecovale HR Management Backend API"
LABEL version="1.0.0"

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# Create non-root user for security
RUN addgroup -S spring && adduser -S spring -G spring

# Set working directory
WORKDIR /app

# Copy the JAR from builder stage
COPY --from=builder /build/target/hr-backend-*.jar app.jar

# Change ownership to spring user
RUN chown -R spring:spring /app

# Switch to non-root user
USER spring:spring

# Expose port (will be overridden by $PORT on Railway/Render)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/actuator/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application with optimized JVM settings
CMD ["java", \
     "-XX:+UseContainerSupport", \
     "-XX:MaxRAMPercentage=75.0", \
     "-Djava.security.egd=file:/dev/./urandom", \
     "-Dserver.port=${PORT:-8080}", \
     "-jar", \
     "app.jar"]
