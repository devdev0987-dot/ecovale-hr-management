# Ecovale HR Backend - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Prerequisites
```bash
# Check Java version (need 17+)
java -version

# Check Maven version (need 3.6+)
mvn -version

# Check MySQL is running
sudo systemctl status mysql
```

### Step 2: Setup Database
```bash
# Login to MySQL
mysql -u root -p

# Create database
CREATE DATABASE ecovale_hr;

# Exit MySQL
exit;
```

### Step 3: Configure Application
Edit `src/main/resources/application.properties`:
```properties
spring.datasource.url=jdbc:mysql://localhost:3306/ecovale_hr?useSSL=false&serverTimezone=UTC
spring.datasource.username=root
spring.datasource.password=YOUR_MYSQL_PASSWORD
```

### Step 4: Build & Run
```bash
cd backend
mvn clean install
mvn spring-boot:run
```

### Step 5: Test API
```bash
# Check health
curl http://localhost:8080/actuator/health

# Get all employees (should return empty array initially)
curl http://localhost:8080/api/employees
```

## 📝 Create Your First Employee

```bash
curl -X POST http://localhost:8080/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "gender": "Male",
    "contactNumber": "9876543210",
    "personalEmail": "test@example.com",
    "currentAddress": "Test Address",
    "type": "FULL_TIME",
    "department": "IT",
    "designation": "Developer",
    "officialEmail": "test@ecovale.com",
    "workLocation": "Bangalore",
    "ctc": 500000,
    "basic": 20000,
    "net": 18000,
    "paymentMode": "Bank",
    "status": "ACTIVE"
  }'
```

## 🔧 Common Commands

### Build without tests
```bash
mvn clean install -DskipTests
```

### Run specific profile
```bash
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

### Package as JAR
```bash
mvn clean package
java -jar target/hr-backend-1.0.0.jar
```

## 🐛 Troubleshooting

### Port already in use?
```bash
# Find and kill process on port 8080
lsof -i :8080
kill -9 <PID>
```

### Database connection error?
- Ensure MySQL is running
- Check username/password in application.properties
- Verify database exists: `SHOW DATABASES;`

### Build error?
```bash
# Clean Maven cache
mvn clean
rm -rf ~/.m2/repository

# Rebuild
mvn clean install
```

## 📚 Next Steps
1. Read full [README.md](README.md) for detailed documentation
2. Test all endpoints using Postman or curl
3. Integrate with your frontend application
4. Deploy to production (AWS, Docker, etc.)

## 🆘 Need Help?
- Check logs: `tail -f logs/spring-boot-application.log`
- Review [README.md](README.md) for detailed API documentation
- Contact: development@ecovale.com
