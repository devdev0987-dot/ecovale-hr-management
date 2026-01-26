# Observability Implementation Guide

Complete guide for monitoring, logging, and tracing the Ecovale HR Spring Boot application.

---

## 🎯 Overview

This implementation provides comprehensive observability through:
- **Structured Logging** - JSON logs with correlation IDs
- **Metrics** - Prometheus-compatible metrics via Micrometer
- **Distributed Tracing** - Request correlation across services
- **Health Checks** - Liveness and readiness probes
- **Dashboards** - Pre-configured Grafana dashboards

---

## 📋 Components Implemented

### 1. Structured Logging (Logback)

**File:** `src/main/resources/logback-spring.xml`

**Features:**
- ✅ JSON format for production (easy parsing)
- ✅ Human-readable format for development
- ✅ Correlation ID in every log entry
- ✅ Async appenders for performance
- ✅ Rolling file appenders (50MB per file, 30 days retention)
- ✅ MDC (Mapped Diagnostic Context) support

**Log Fields:**
```json
{
  "timestamp": "2026-01-26T12:00:00.000Z",
  "level": "INFO",
  "logger": "com.ecovale.hr.controller.EmployeeController",
  "message": "Employee created successfully",
  "correlationId": "abc-123-def",
  "requestId": "xyz-789-uvw",
  "userId": "admin",
  "clientIp": "192.168.1.100",
  "application": "ecovale-hr",
  "environment": "prod"
}
```

### 2. Correlation ID Filter

**File:** `src/main/java/com/ecovale/hr/filter/CorrelationIdFilter.java`

**Features:**
- ✅ Generates unique correlation ID per request
- ✅ Accepts X-Correlation-ID header if provided
- ✅ Adds correlation ID to response headers
- ✅ Stores in MDC for logging
- ✅ Tracks client IP address
- ✅ Highest precedence filter (runs first)

**Headers:**
- Request: `X-Correlation-ID` (optional)
- Response: `X-Correlation-ID`, `X-Request-ID`

### 3. Metrics Configuration

**File:** `src/main/java/com/ecovale/hr/config/MetricsConfig.java`

**Features:**
- ✅ Prometheus metrics exporter
- ✅ Custom business metrics
- ✅ Common tags (application, environment)
- ✅ JVM metrics (heap, threads, GC)
- ✅ HTTP request metrics
- ✅ Database connection pool metrics

**Custom Metrics:**
```java
// Authentication attempts
ecovale.auth.attempts{status="success|failure"}

// Employee operations
ecovale.employees.operations{operation="create|update|delete"}

// Database queries
ecovale.database.query{entity="Employee"}

// Gauges
ecovale.users.active
ecovale.employees.active
```

### 4. Grafana Dashboard

**File:** `grafana-dashboard.json`

**Panels:**
- HTTP Request Rate
- HTTP Request Duration (p50, p95)
- CPU Usage
- JVM Heap Usage
- Active Threads
- Active DB Connections
- Authentication Attempts
- JVM GC Pause Duration

---

## 🚀 Quick Start

### 1. Run Application

```bash
cd backend
mvn spring-boot:run
```

### 2. Access Endpoints

```bash
# Health check
curl http://localhost:8080/actuator/health

# Prometheus metrics
curl http://localhost:8080/actuator/prometheus

# Application info
curl http://localhost:8080/actuator/info

# All endpoints
curl http://localhost:8080/actuator
```

### 3. Test Correlation ID

```bash
# Send request with correlation ID
curl -H "X-Correlation-ID: test-123" \
     http://localhost:8080/api/employees

# Response includes:
# X-Correlation-ID: test-123
# X-Request-ID: generated-uuid

# Check logs for correlation ID
tail -f logs/ecovale-hr.log | grep "test-123"
```

---

## 📊 Prometheus Setup

### 1. Install Prometheus

```bash
# Download Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xvfz prometheus-*.tar.gz
cd prometheus-*
```

### 2. Configure Prometheus

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'ecovale-hr'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['localhost:8080']
        labels:
          application: 'ecovale-hr'
          environment: 'dev'
```

### 3. Start Prometheus

```bash
./prometheus --config.file=prometheus.yml

# Access UI
open http://localhost:9090
```

### 4. Test Metrics

In Prometheus UI, query:
```promql
# HTTP request rate
rate(http_server_requests_seconds_count[5m])

# JVM memory usage
jvm_memory_used_bytes{area="heap"}

# Custom metrics
ecovale_auth_attempts_total
```

---

## 📈 Grafana Setup

### 1. Install Grafana

```bash
# Docker
docker run -d -p 3000:3000 --name=grafana grafana/grafana

# Or download binary
wget https://dl.grafana.com/oss/release/grafana-10.0.0.linux-amd64.tar.gz
tar -zxvf grafana-*.tar.gz
cd grafana-*
./bin/grafana-server
```

### 2. Configure Data Source

1. Open Grafana: http://localhost:3000 (admin/admin)
2. Go to **Configuration → Data Sources**
3. Add **Prometheus**
4. URL: `http://localhost:9090`
5. Click **Save & Test**

### 3. Import Dashboard

1. Go to **Create → Import**
2. Upload `grafana-dashboard.json`
3. Select Prometheus data source
4. Click **Import**

### 4. View Dashboard

Navigate to **Dashboards → Ecovale HR - Application Metrics**

---

## 📝 Logging Best Practices

### Production Logging

```properties
# application-prod.properties
LOGGING_LEVEL_ROOT=INFO
LOGGING_LEVEL_APP=INFO
LOGGING_LEVEL_SECURITY=WARN
LOGGING_LEVEL_REQUEST_LOGGING=WARN
LOGGING_LEVEL_SQL=ERROR
```

### Development Logging

```properties
# application-dev.properties
LOGGING_LEVEL_ROOT=INFO
LOGGING_LEVEL_APP=DEBUG
LOGGING_LEVEL_SECURITY=DEBUG
LOGGING_LEVEL_REQUEST_LOGGING=DEBUG
LOGGING_LEVEL_SQL=DEBUG
```

### Using Correlation ID in Code

```java
import com.ecovale.hr.filter.CorrelationIdFilter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class MyService {
    private static final Logger log = LoggerFactory.getLogger(MyService.class);
    
    public void doSomething() {
        String correlationId = CorrelationIdFilter.getCorrelationId();
        log.info("Processing request - correlationId: {}", correlationId);
        
        // Correlation ID is automatically included in logs via MDC
        log.info("This log entry includes correlation ID");
    }
}
```

### Adding User ID to Logs

```java
// After authentication
CorrelationIdFilter.setUserId(authentication.getName());

// Logs will now include userId
log.info("User action performed"); // Includes userId in MDC
```

---

## 📊 Custom Metrics Examples

### Record Authentication Attempt

```java
@Service
@RequiredArgsConstructor
public class AuthService {
    private final CustomMetrics metrics;
    
    public void login(String username, String password) {
        try {
            // ... authentication logic
            metrics.recordAuthAttempt("success");
        } catch (BadCredentialsException e) {
            metrics.recordAuthAttempt("failure");
            throw e;
        }
    }
}
```

### Record Employee Operation

```java
@Service
@RequiredArgsConstructor
public class EmployeeService {
    private final CustomMetrics metrics;
    
    public Employee createEmployee(EmployeeDTO dto) {
        Employee employee = employeeRepository.save(entity);
        metrics.recordEmployeeOperation("create");
        return employee;
    }
}
```

### Record Database Query Time

```java
@Service
@RequiredArgsConstructor
public class EmployeeService {
    private final CustomMetrics metrics;
    
    public List<Employee> findAll() {
        long startTime = System.currentTimeMillis();
        List<Employee> employees = employeeRepository.findAll();
        long duration = System.currentTimeMillis() - startTime;
        
        metrics.recordDatabaseQuery("Employee", duration);
        return employees;
    }
}
```

### Using @Timed Annotation

```java
import io.micrometer.core.annotation.Timed;

@Service
public class EmployeeService {
    
    @Timed(value = "ecovale.service.employee.findAll", 
           description = "Time to fetch all employees",
           percentiles = {0.5, 0.95, 0.99})
    public List<Employee> findAll() {
        return employeeRepository.findAll();
    }
}
```

---

## 🔍 Log Aggregation (ELK Stack)

### Using Docker Compose

```yaml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.10.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
  
  logstash:
    image: docker.elastic.co/logstash/logstash:8.10.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    ports:
      - "5000:5000"
  
  kibana:
    image: docker.elastic.co/kibana/kibana:8.10.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
```

### Logstash Configuration

```conf
input {
  file {
    path => "/var/log/ecovale-hr/*.log"
    codec => json
  }
}

filter {
  if [application] == "ecovale-hr" {
    mutate {
      add_tag => ["ecovale"]
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "ecovale-hr-%{+YYYY.MM.dd}"
  }
}
```

---

## 🔧 Actuator Endpoints

### Available Endpoints

| Endpoint | Description | Authentication |
|----------|-------------|----------------|
| `/actuator/health` | Health check | Public |
| `/actuator/health/liveness` | Liveness probe | Public |
| `/actuator/health/readiness` | Readiness probe | Public |
| `/actuator/info` | Application info | Public |
| `/actuator/metrics` | Available metrics | Admin |
| `/actuator/prometheus` | Prometheus format | Admin |
| `/actuator/loggers` | View/change log levels | Admin |
| `/actuator/threaddump` | Thread dump | Admin |
| `/actuator/heapdump` | Heap dump | Admin |

### Query Metrics

```bash
# List all metrics
curl http://localhost:8080/actuator/metrics

# Get specific metric
curl http://localhost:8080/actuator/metrics/jvm.memory.used

# Get HTTP request metrics
curl http://localhost:8080/actuator/metrics/http.server.requests
```

### Change Log Level Dynamically

```bash
# Get current log level
curl http://localhost:8080/actuator/loggers/com.ecovale.hr

# Change log level to DEBUG
curl -X POST \
  http://localhost:8080/actuator/loggers/com.ecovale.hr \
  -H "Content-Type: application/json" \
  -d '{"configuredLevel": "DEBUG"}'
```

---

## 🚨 Alerting with Prometheus

### Create Alert Rules

```yaml
# prometheus-alerts.yml
groups:
  - name: ecovale-hr-alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_server_requests_seconds_count{status="500"}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/sec"
      
      - alert: HighMemoryUsage
        expr: (jvm_memory_used_bytes{area="heap"} / jvm_memory_max_bytes{area="heap"}) > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Heap usage is {{ $value | humanizePercentage }}"
      
      - alert: ApplicationDown
        expr: up{job="ecovale-hr"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Application is down"
          description: "Ecovale HR application is not responding"
```

### Configure Alertmanager

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'slack-notifications'

receivers:
  - name: 'slack-notifications'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ end }}'
```

---

## 📊 Performance Monitoring

### JVM Metrics

```promql
# Heap memory usage
jvm_memory_used_bytes{area="heap"} / jvm_memory_max_bytes{area="heap"}

# GC time
rate(jvm_gc_pause_seconds_sum[5m])

# Thread count
jvm_threads_live_threads

# Classes loaded
jvm_classes_loaded_classes
```

### HTTP Metrics

```promql
# Request rate
rate(http_server_requests_seconds_count[5m])

# Average response time
rate(http_server_requests_seconds_sum[5m]) / rate(http_server_requests_seconds_count[5m])

# 95th percentile response time
histogram_quantile(0.95, sum(rate(http_server_requests_seconds_bucket[5m])) by (le))

# Error rate
rate(http_server_requests_seconds_count{status=~"5.."}[5m])
```

### Database Metrics

```promql
# Active connections
hikaricp_connections_active

# Pending connections
hikaricp_connections_pending

# Connection acquire time
hikaricp_connections_acquire_seconds
```

---

## ✅ Observability Checklist

### Logging
- [x] Structured logging configured
- [x] Correlation ID in all logs
- [x] Sensitive data excluded from logs
- [x] Log levels configurable
- [x] Log rotation configured

### Metrics
- [x] Prometheus metrics exposed
- [x] JVM metrics enabled
- [x] HTTP metrics enabled
- [x] Database metrics enabled
- [x] Custom business metrics

### Tracing
- [x] Request correlation ID
- [x] User ID tracking
- [x] Client IP tracking

### Dashboards
- [x] Grafana dashboard created
- [x] Key metrics visualized
- [x] Real-time monitoring

### Health Checks
- [x] Liveness probe
- [x] Readiness probe
- [x] Health indicators

---

## 🎉 Summary

Your application now has enterprise-grade observability:

✅ **Structured JSON logging** with correlation IDs  
✅ **Prometheus metrics** for monitoring  
✅ **Grafana dashboards** for visualization  
✅ **Request tracing** with correlation IDs  
✅ **Health checks** for Kubernetes/AWS  
✅ **Custom business metrics**  
✅ **Async logging** for performance  

**Next Steps:**
1. Start application and verify metrics
2. Set up Prometheus and Grafana
3. Import Grafana dashboard
4. Configure alerts in Prometheus
5. Set up log aggregation (optional)

For questions, check the inline comments in each configuration file!
