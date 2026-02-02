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

# Build the application (skip tests for faster builds)
RUN mvn clean package -DskipTests -B

# =================================================================
# Stage 2: RUNTIME - Production
# =================================================================
FROM eclipse-temurin:17-jre-alpine

# Metadata
LABEL maintainer="Ecovale HR Team"
LABEL description="Ecovale HR Management Backend API"
LABEL version="1.0.0"

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

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

# Health check (optional - some platforms handle this automatically)
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-8080}/actuator/health || exit 1

# Use dumb-init to handle signals properly
# This ensures graceful shutdown when container stops
ENTRYPOINT ["dumb-init", "--"]

# Start the application with optimized JVM settings
# -XX:+UseContainerSupport: Auto-detect container memory limits
# -XX:MaxRAMPercentage=75.0: Use 75% of available memory
# -Djava.security.egd=file:/dev/./urandom: Faster startup
CMD ["java", \
     "-XX:+UseContainerSupport", \
     "-XX:MaxRAMPercentage=75.0", \
     "-Djava.security.egd=file:/dev/./urandom", \
     "-Dserver.port=${PORT:-8080}", \
     "-jar", \
     "app.jar"]
USER spring

# Expose application port
EXPOSE 8080

# Health check (optional but recommended)
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

# Environment variables with defaults
ENV JAVA_OPTS="-Xms512m -Xmx1024m" \
    SPRING_PROFILES_ACTIVE="prod" \
    DB_HOST="mysql" \
    DB_PORT="3306" \
    DB_NAME="ecovale_hr" \
    DB_USERNAME="root" \
    DB_PASSWORD="password" \
    DB_USE_SSL="false" \
    JPA_DDL_AUTO="update" \
    JPA_SHOW_SQL="false" \
    JPA_FORMAT_SQL="false"

# Run the application
# Use exec form to ensure proper signal handling
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -Djava.security.egd=file:/dev/./urandom -jar app.jar"]
