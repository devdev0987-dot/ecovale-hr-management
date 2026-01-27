# =================================================================
# Multi-Stage Dockerfile for Ecovale HR Backend
# =================================================================
# Stage 1: Build the application using Maven
# Stage 2: Run the application using OpenJDK 17 slim

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
# Use -DskipTests to skip running tests during build
RUN mvn clean package -DskipTests -B

# =================================================================
# Stage 2: RUNTIME
# =================================================================
FROM eclipse-temurin:17-jre-alpine

# Metadata
LABEL maintainer="Ecovale HR Team"
LABEL description="Ecovale HR Management Backend API"
LABEL version="1.0"

# Create non-root user for security
RUN addgroup -S spring && adduser -S spring -G spring

# Set working directory
WORKDIR /app

# Copy the JAR from builder stage
COPY --from=builder /build/target/*.jar app.jar

# Change ownership to spring user
RUN chown -R spring:spring /app

# Switch to non-root user
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
