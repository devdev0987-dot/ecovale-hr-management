# Performance Testing Guide

Complete guide for load testing and performance benchmarking of the Ecovale HR System.

---

## 🎯 Overview

This performance testing suite uses **k6** (modern load testing tool) to simulate realistic user traffic and measure system performance under various conditions.

### Test Scenarios

1. **Load Test (Auth)** - 1000 concurrent users testing authentication
2. **Load Test (CRUD)** - 500 users performing CRUD operations
3. **Spike Test** - Sudden traffic spike to 2000 users
4. **Stress Test** - Gradually increase load to find breaking point
5. **Soak Test** - 300 users for 1 hour (memory leak detection)

---

## 📋 Prerequisites

### 1. Install k6

**Linux (Ubuntu/Debian):**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**macOS:**
```bash
brew install k6
```

**Windows:**
```powershell
choco install k6
# Or download from: https://k6.io/docs/getting-started/installation/
```

**Docker:**
```bash
docker pull grafana/k6:latest
```

### 2. Start Application

```bash
cd backend
mvn spring-boot:run

# Verify running
curl http://localhost:8080/actuator/health
```

### 3. Configure Test Users

Ensure these test users exist in your database:
- `admin` / `admin123`
- `user1` / `password123`
- `hr_manager` / `hr123`

---

## 🚀 Running Tests

### Quick Start - Run All Tests

```bash
cd backend/performance-tests

# Make script executable
chmod +x run-tests.sh

# Run test suite
./run-tests.sh

# View results
ls -lh results/
```

### Run Individual Tests

#### 1. Authentication Load Test (1000 users)

```bash
k6 run load-test-auth.js

# With custom base URL
k6 run -e BASE_URL=http://your-server:8080 load-test-auth.js

# With JSON output
k6 run --out json=results/load-test-auth.json load-test-auth.js
```

**What it tests:**
- Login endpoint performance
- JWT token generation
- Protected endpoint access
- Token refresh flow
- Correlation ID tracking

**Duration:** ~16 minutes

**Expected Results:**
- p95 response time < 500ms
- Login success rate > 95%
- Error rate < 1%

#### 2. CRUD Operations Load Test (500 users)

```bash
k6 run load-test-crud.js
```

**What it tests:**
- Create employee
- Read employee
- Update employee
- Delete employee
- Database performance

**Duration:** ~16 minutes

**Expected Results:**
- p95 response time < 800ms
- CRUD success rates > 95%
- No database connection leaks

#### 3. Spike Test (2000 users)

```bash
k6 run spike-test.js
```

**What it tests:**
- System behavior under sudden load
- Recovery after spike
- Error handling under stress

**Duration:** ~11 minutes

**Expected Results:**
- System remains stable
- Recovery rate > 80%
- No crashes or timeouts

#### 4. Stress Test (Find Breaking Point)

```bash
k6 run stress-test.js
```

**What it tests:**
- Maximum capacity
- System breaking point
- Graceful degradation

**Duration:** ~25 minutes

**Expected Results:**
- Identifies max concurrent users
- Documents failure patterns

#### 5. Soak Test (Endurance - 1 hour)

```bash
k6 run soak-test.js
```

**What it tests:**
- Memory leaks
- Resource exhaustion
- Long-term stability

**Duration:** ~70 minutes

**Expected Results:**
- Response times remain stable
- No memory growth
- No resource leaks

---

## 📊 Understanding Results

### Console Output

```
     ✓ Login status is 200
     ✓ Login returns token
     ✓ Login response time < 500ms

     checks.........................: 99.2%  ✓ 29760      ✗ 240
     data_received..................: 15 MB  250 kB/s
     data_sent......................: 5.2 MB 87 kB/s
     http_req_duration..............: avg=125ms min=45ms med=98ms max=2.1s p(90)=210ms p(95)=315ms
     http_req_failed................: 0.80%  ✓ 240       ✗ 29760
     http_reqs......................: 30000  500/s
     iteration_duration.............: avg=1.2s  min=1s   med=1.1s max=3.2s p(90)=1.4s p(95)=1.6s
     iterations.....................: 10000  166.67/s
     vus............................: 1000   min=0       max=1000
     vus_max........................: 1000   min=1000    max=1000
```

### Key Metrics Explained

| Metric | Description | Good Target |
|--------|-------------|-------------|
| `checks` | Percentage of passed checks | > 95% |
| `http_req_duration` | Request response time | p95 < 500ms |
| `http_req_failed` | Failed request rate | < 1% |
| `http_reqs` | Total requests | Higher is better |
| `iterations` | Complete test cycles | - |
| `vus` | Virtual users (concurrent) | As configured |

### Custom Metrics

```
login_success_rate.............: 98.5%  ✓ 9850       ✗ 150
login_duration.................: avg=78ms p(95)=185ms
protected_endpoint_duration....: avg=42ms p(95)=95ms
auth_failures..................: 150
```

---

## 📈 Analyzing Results

### 1. Response Time Analysis

```bash
# Extract response times from JSON
jq '.metrics.http_req_duration' results/load-test-auth_summary.json
```

**Good:**
- p50 < 200ms
- p95 < 500ms
- p99 < 1000ms

**Warning:**
- p95 > 500ms (optimize slow endpoints)
- p99 > 2000ms (investigate bottlenecks)

### 2. Error Rate Analysis

```bash
# Check error rate
jq '.metrics.http_req_failed.rate' results/load-test-auth_summary.json
```

**Acceptable:** < 1%  
**Warning:** 1-5%  
**Critical:** > 5%

### 3. Throughput Analysis

```bash
# Requests per second
jq '.metrics.http_reqs.rate' results/load-test-auth_summary.json
```

Higher is better. Compare across test runs.

---

## 🔍 Monitoring During Tests

### 1. Watch Logs

```bash
# Application logs
tail -f logs/ecovale-hr.log | grep -E "ERROR|WARN|correlationId"

# JVM metrics
watch -n 1 "curl -s http://localhost:8080/actuator/metrics/jvm.memory.used | jq"
```

### 2. Prometheus Queries

If Prometheus is running:

```promql
# Request rate
rate(http_server_requests_seconds_count[1m])

# Response time p95
histogram_quantile(0.95, rate(http_server_requests_seconds_bucket[5m]))

# Error rate
rate(http_server_requests_seconds_count{status="500"}[1m])

# JVM heap usage
jvm_memory_used_bytes{area="heap"} / jvm_memory_max_bytes{area="heap"}
```

### 3. Grafana Dashboard

Import the provided dashboard and watch metrics in real-time:
```bash
# Dashboard location
backend/grafana-dashboard.json
```

---

## 🐛 Troubleshooting

### Issue: Tests fail immediately

```bash
# Check application is running
curl http://localhost:8080/actuator/health

# Check database connection
curl http://localhost:8080/actuator/health/db
```

### Issue: High error rate

**Possible causes:**
1. Database connection pool exhausted
2. JVM heap memory full
3. Too many threads
4. Slow database queries

**Solutions:**
```properties
# Increase connection pool
spring.datasource.hikari.maximum-pool-size=50

# Increase JVM heap
java -Xmx2048m -jar app.jar

# Enable query logging
logging.level.org.hibernate.SQL=DEBUG
```

### Issue: Response times increasing

**Check for:**
1. Memory leaks (run soak test)
2. Database query performance
3. GC pause times
4. Connection pool exhaustion

```bash
# Check JVM metrics
curl http://localhost:8080/actuator/metrics/jvm.gc.pause

# Check database connections
curl http://localhost:8080/actuator/metrics/hikaricp.connections.active
```

### Issue: System crashes under load

**Increase system limits:**
```bash
# Increase file descriptors
ulimit -n 65536

# Increase max threads
echo 4096 > /proc/sys/kernel/threads-max
```

---

## 📊 Generating Reports

### 1. HTML Report (with k6-reporter)

```bash
npm install -g k6-html-reporter

k6 run --out json=results/test.json load-test-auth.js
k6-html-reporter results/test.json
```

### 2. JUnit XML (for CI/CD)

```bash
npm install -g k6-to-junit

k6 run --out json=results/test.json load-test-auth.js
k6-to-junit results/test.json > results/test.xml
```

### 3. Custom Report

Use the provided template:
```bash
cp PERFORMANCE-REPORT-TEMPLATE.md results/report-$(date +%Y%m%d).md
# Fill in the template with your results
```

---

## 🎯 Performance Goals

### Target Metrics (Baseline)

| Metric | Target |
|--------|--------|
| Concurrent Users | 1000 |
| Response Time (p95) | < 500ms |
| Response Time (p99) | < 1000ms |
| Error Rate | < 1% |
| Throughput | > 500 req/s |
| Uptime | 99.9% |

### Optimization Targets

After optimization, aim for:
- p95 < 300ms
- Error rate < 0.5%
- Throughput > 1000 req/s

---

## 🔧 Performance Tuning Tips

### 1. Database Optimization

```properties
# Connection pool
spring.datasource.hikari.maximum-pool-size=50
spring.datasource.hikari.minimum-idle=10

# Query optimization
spring.jpa.properties.hibernate.jdbc.batch_size=20
spring.jpa.properties.hibernate.order_inserts=true
spring.jpa.properties.hibernate.order_updates=true
```

### 2. JVM Tuning

```bash
java -Xms1024m -Xmx2048m \
     -XX:+UseG1GC \
     -XX:MaxGCPauseMillis=200 \
     -XX:+HeapDumpOnOutOfMemoryError \
     -jar app.jar
```

### 3. Caching

```java
@Cacheable("employees")
public List<Employee> findAll() { ... }
```

### 4. Async Processing

```java
@Async
public CompletableFuture<Result> processAsync() { ... }
```

---

## 📝 CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Performance Tests
  run: |
    cd backend/performance-tests
    chmod +x run-tests.sh
    ./run-tests.sh
  
- name: Upload Results
  uses: actions/upload-artifact@v3
  with:
    name: performance-results
    path: backend/performance-tests/results/
```

---

## ✅ Testing Checklist

Before production deployment:

- [ ] Load test passes (1000 users)
- [ ] CRUD operations test passes
- [ ] Spike test passes (system recovers)
- [ ] No memory leaks (soak test)
- [ ] Error rate < 1%
- [ ] p95 response time < 500ms
- [ ] Database queries optimized
- [ ] Caching implemented
- [ ] Monitoring configured
- [ ] Alerts set up

---

## 🎉 Success Criteria

Your application is production-ready when:

✅ Handles 1000+ concurrent users  
✅ Response time p95 < 500ms  
✅ Error rate < 1%  
✅ Recovers from traffic spikes  
✅ No memory leaks over 1 hour  
✅ Database queries < 100ms  
✅ JVM heap usage < 80%  
✅ Connection pool stable  

---

## 📚 Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/api-load-testing/)
- [Prometheus Metrics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [JVM Performance Tuning](https://docs.oracle.com/en/java/javase/17/gctuning/)

---

**Happy Load Testing! 🚀**
