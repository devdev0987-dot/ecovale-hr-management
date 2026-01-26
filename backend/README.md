# Ecovale HR Backend - Spring Boot REST API

## Overview
Complete production-ready backend REST API for the Ecovale HR Management System built with **Java Spring Boot**, **Spring Data JPA**, **MySQL**, and **Spring Security with JWT Authentication**.

## 🔒 Security
This backend uses **JWT (JSON Web Token)** authentication to secure all API endpoints.

### Quick Security Setup
1. All endpoints except `/api/auth/**` require authentication
2. Login at `/api/auth/login` to get JWT token
3. Include token in `Authorization: Bearer <token>` header
4. Two roles: `ROLE_ADMIN` (full access) and `ROLE_USER` (read-only)

📚 **Full Security Documentation**: See [SECURITY-JWT-GUIDE.md](./SECURITY-JWT-GUIDE.md)  
⚡ **Quick Reference**: See [SECURITY-QUICK-REF.md](./SECURITY-QUICK-REF.md)

## Technology Stack
- **Java 17**
- **Spring Boot 3.2.1**
- **Spring Web** (REST API)
- **Spring Data JPA** (Database ORM)
- **Spring Security** (Authentication & Authorization)
- **JWT (jjwt 0.12.3)** (Token-based authentication)
- **MySQL 8.0+** (Database)
- **Hibernate** (ORM Framework)
- **Lombok** (Code reduction)
- **Bean Validation** (Input validation)
- **Maven** (Build tool)

## Project Structure
```
backend/
├── src/
│   └── main/
│       ├── java/com/ecovale/hr/
│       │   ├── EcovaleHrBackendApplication.java   # Main application entry point
│       │   ├── config/
│       │   │   ├── CorsConfig.java                # CORS configuration
│       │   │   └── SecurityConfig.java            # Spring Security & JWT config
│       │   ├── controller/
│       │   │   ├── AuthController.java            # Login/Register endpoints (NEW)
│       │   │   ├── EmployeeController.java        # Employee REST endpoints
│       │   │   ├── DesignationController.java     # Designation endpoints
│       │   │   ├── AttendanceController.java      # Attendance endpoints
│       │   │   ├── AdvanceController.java         # Advance endpoints
│       │   │   └── LoanController.java            # Loan endpoints
│       │   ├── dto/
│       │   │   ├── ApiResponse.java               # Standard API response wrapper
│       │   │   ├── LoginRequest.java              # Login DTO (NEW)
│       │   │   ├── LoginResponse.java             # Login response DTO (NEW)
│       │   │   ├── RegisterRequest.java           # Registration DTO (NEW)
│       │   │   ├── EmployeeRequestDTO.java        # Employee request DTO
│       │   │   ├── EmployeeResponseDTO.java       # Employee response DTO
│       │   │   └── ... (other DTOs)
│       │   ├── entity/
│       │   │   ├── User.java                      # User entity (NEW)
│       │   │   ├── Role.java                      # Role entity (NEW)
│       │   │   ├── Employee.java                  # Employee entity
│       │   │   ├── Designation.java               # Designation entity
│       │   │   ├── AttendanceRecord.java          # Attendance entity
│       │   │   ├── AdvanceRecord.java             # Advance entity
│       │   │   └── LoanRecord.java                # Loan entity
│       │   ├── exception/
│       │   │   ├── ResourceNotFoundException.java
│       │   │   ├── DuplicateResourceException.java
│       │   │   └── GlobalExceptionHandler.java    # Global error handling
│       │   ├── repository/
│       │   │   ├── UserRepository.java            # User data access (NEW)
│       │   │   ├── RoleRepository.java            # Role data access (NEW)
│       │   │   ├── EmployeeRepository.java        # Employee data access
│       │   │   ├── DesignationRepository.java
│       │   │   └── ... (other repositories)
│       │   ├── security/
│       │   │   ├── JwtUtil.java                   # JWT token generation/validation (NEW)
│       │   │   ├── CustomUserDetailsService.java  # Load user for auth (NEW)
│       │   │   └── JwtAuthenticationFilter.java   # JWT filter (NEW)
│       │   └── service/
│       │       ├── EmployeeService.java           # Employee business logic
│       │       ├── DesignationService.java
│       │       └── ... (other services)
│       └── resources/
│           └── application.properties             # Configuration
└── pom.xml                                         # Maven dependencies
```

## Prerequisites
1. **Java 17** or higher
2. **Maven 3.6+**
3. **MySQL 8.0+** (Local or AWS RDS)
4. **Git** (for version control)

## Database Setup

### Option 1: Local MySQL
```bash
# Install MySQL (Ubuntu/Debian)
sudo apt update
sudo apt install mysql-server

# Start MySQL service
sudo systemctl start mysql

# Login to MySQL
sudo mysql -u root -p

# Create database
CREATE DATABASE ecovale_hr;

# Create user (optional)
CREATE USER 'hruser'@'localhost' IDENTIFIED BY 'yourpassword';
GRANT ALL PRIVILEGES ON ecovale_hr.* TO 'hruser'@'localhost';
FLUSH PRIVILEGES;
```

### Option 2: AWS RDS MySQL
1. Create MySQL RDS instance on AWS Console
2. Note the endpoint URL (e.g., `ecovale-hr.xxxx.us-east-1.rds.amazonaws.com`)
3. Create database: `ecovale_hr`
4. Set environment variables (see Configuration section below)
5. Ensure security group allows access from your application server

## Configuration

### Environment Variables Setup

This backend uses **environment variables** for database configuration (no hardcoded credentials).

#### Step 1: Create `.env` file (Local Development)
```bash
# Copy the example file
cp .env.example .env

# Edit with your database credentials
nano .env
```

#### Step 2: Set Environment Variables

**For Local Development:**
```bash
# .env file (or export in terminal)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ecovale_hr
DB_USERNAME=root
DB_PASSWORD=yourpassword
DB_USE_SSL=false
JPA_DDL_AUTO=update
JPA_SHOW_SQL=true
JPA_FORMAT_SQL=true

# JWT Configuration (IMPORTANT: Change in production!)
JWT_SECRET=ecovale-hr-secret-key-change-in-production-minimum-32-characters
JWT_EXPIRATION=86400000
```

**For AWS RDS Production:**
```bash
# Set as environment variables in EC2/ECS/Elastic Beanstalk
DB_HOST=your-rds-endpoint.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_NAME=ecovale_hr_prod
DB_USERNAME=admin
DB_PASSWORD=your-secure-password
DB_USE_SSL=true
JPA_DDL_AUTO=validate
JPA_SHOW_SQL=false
JPA_FORMAT_SQL=false

# JWT Configuration (Use strong random value!)
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRATION=86400000
```

#### Step 3: Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_HOST` | Yes | `localhost` | Database host (RDS endpoint for AWS) |
| `DB_PORT` | No | `3306` | Database port |
| `DB_NAME` | Yes | `ecovale_hr` | Database name |
| `DB_USERNAME` | Yes | `root` | Database username |
| `DB_PASSWORD` | Yes | `yourpassword` | Database password |
| `DB_USE_SSL` | No | `false` | Enable SSL (set `true` for AWS RDS) |
| `JPA_DDL_AUTO` | No | `update` | Hibernate DDL mode (`validate` for prod) |
| `JPA_SHOW_SQL` | No | `false` | Show SQL in logs |
| `JPA_FORMAT_SQL` | No | `false` | Format SQL in logs |
| `JWT_SECRET` | Yes | (default) | JWT secret key (min 32 chars, change in prod!) |
| `JWT_EXPIRATION` | No | `86400000` | Token expiration in ms (24 hours default) |

### Spring Profiles

Use profiles for different environments:

**Development Profile:**
```bash
mvn spring-boot:run -Dspring-boot.run.profiles=dev
# Uses application-dev.properties
```

**Production Profile:**
```bash
java -jar target/ecovale-hr-backend.jar --spring.profiles.active=prod
# Uses application-prod.properties
```

### Configuration Files

| File | Purpose | Credentials |
|------|---------|-------------|
| `application.properties` | Base configuration with env vars | ✅ Uses env variables |
| `application-dev.properties` | Development overrides | ⚠️ Has defaults (override with .env) |
| `application-prod.properties` | Production settings | ✅ Requires env variables |
| `.env.example` | Template for local .env | ✅ Safe to commit |
| `.env` | Your local configuration | ❌ Git ignored |

## Build and Run

### Quick Start (Local Development)

```bash
# 1. Navigate to backend directory
cd backend

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env with your MySQL credentials (if different from defaults)
nano .env

# 4. Build and run
mvn clean spring-boot:run
```

The application will:
- Load environment variables from `.env` (if using direnv or similar)
- Connect to MySQL database
- Auto-create tables (JPA DDL auto=update)
- Start on http://localhost:8080

### 1. Clone and Navigate
```bash
cd /home/mithun/Downloads/ecovale-hr-web-app/backend
```

### 2. Set Environment Variables

**Option A: Export in Terminal (Temporary)**
```bash
export DB_HOST=localhost
export DB_PORT=3306
export DB_NAME=ecovale_hr
export DB_USERNAME=root
export DB_PASSWORD=yourpassword
```

**Option B: Use .env file with direnv**
```bash
# Install direnv
sudo apt install direnv

# Allow .env loading
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
source ~/.bashrc

# Create .env from example
cp .env.example .env

# Edit .env
nano .env

# Allow direnv to load .env
direnv allow .
```

**Option C: IDE Configuration**
- IntelliJ IDEA: Run → Edit Configurations → Environment Variables
- Eclipse: Run → Run Configurations → Environment tab
- VS Code: Create `.vscode/launch.json` with env vars

### 3. Build the Project
```bash
mvn clean install
```

### 4. Run the Application

**Option A: Maven (Development)**
```bash
mvn spring-boot:run
```

**Option B: JAR (Production)**
```bash
java -jar target/ecovale-hr-backend.jar
```

**Option C: Docker (Recommended)**
See [Docker Deployment](#docker-deployment) section below.

### 5. Verify Server is Running
Open browser: `http://localhost:8080/actuator/health`

Expected response:
```json
{
  "status": "UP"
}
```

---

## Docker Deployment

### Prerequisites
- Docker 20.10+ installed
- Docker Compose 2.0+ installed

### Quick Start with Docker Compose

#### Development Environment (with MySQL container)

```bash
# Navigate to backend directory
cd backend

# Start all services (backend + MySQL)
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop all services
docker-compose down

# Stop and remove volumes (clears database)
docker-compose down -v
```

**Services Started:**
- MySQL 8.0 on port `3306`
- Backend API on port `8080`

**Default Credentials:**
- Database: `ecovale_hr`
- Username: `hruser`
- Password: `hrpassword`

#### Production Environment (with external database)

```bash
# Create .env file for production
cat > .env << EOF
DB_HOST=your-rds-endpoint.rds.amazonaws.com
DB_PORT=3306
DB_NAME=ecovale_hr
DB_USERNAME=admin
DB_PASSWORD=your-secure-password
DB_USE_SSL=true
JPA_DDL_AUTO=validate
SPRING_PROFILES_ACTIVE=prod
EOF

# Start with production config
docker-compose -f docker-compose.prod.yml up -d
```

### Build Docker Image Manually

```bash
# Build image
docker build -t ecovale-hr-backend:latest .

# Run container
docker run -d \
  --name ecovale-hr-backend \
  -p 8080:8080 \
  -e DB_HOST=mysql \
  -e DB_USERNAME=root \
  -e DB_PASSWORD=password \
  ecovale-hr-backend:latest
```

### Docker Image Details

- **Base Image:** OpenJDK 17 (Eclipse Temurin)
- **Size:** ~280MB (multi-stage build)
- **Non-root User:** Runs as `spring` user for security
- **Health Check:** Built-in health endpoint monitoring

### Docker Commands Reference

```bash
# Build image
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose stop

# Remove containers
docker-compose down

# Remove containers and volumes
docker-compose down -v

# Restart a service
docker-compose restart backend

# Scale backend (multiple instances)
docker-compose up -d --scale backend=3

# Execute command in container
docker-compose exec backend sh

# Check container health
docker-compose ps
```

### Accessing Services

When running with Docker Compose:

| Service | URL | Credentials |
|---------|-----|-------------|
| Backend API | http://localhost:8080 | - |
| Health Check | http://localhost:8080/actuator/health | - |
| MySQL Database | localhost:3306 | User: `hruser` / Pass: `hrpassword` |

### Environment Variables for Docker

Set in `docker-compose.yml` or pass via `-e`:

```bash
docker run -d \
  -e DB_HOST=mysql \
  -e DB_PORT=3306 \
  -e DB_NAME=ecovale_hr \
  -e DB_USERNAME=hruser \
  -e DB_PASSWORD=hrpassword \
  -e JPA_DDL_AUTO=update \
  -e SPRING_PROFILES_ACTIVE=dev \
  -p 8080:8080 \
  ecovale-hr-backend:latest
```

### Troubleshooting Docker

**Container won't start:**
```bash
# Check logs
docker-compose logs backend

# Check if MySQL is healthy
docker-compose ps
```

**Database connection failed:**
```bash
# Ensure MySQL is healthy
docker-compose logs mysql

# Restart backend after MySQL is ready
docker-compose restart backend
```

**Port already in use:**
```bash
# Stop conflicting service or change port in docker-compose.yml
ports:
  - "8081:8080"  # Use 8081 instead
```

**Clear everything and restart:**
```bash
docker-compose down -v
docker-compose up -d --build
```

---

## API Endpoints

### Base URL
```
http://localhost:8080/api
```

### 1. Employee Management

#### Create Employee
**POST** `/api/employees`

**Sample Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "gender": "Male",
  "contactNumber": "9876543210",
  "personalEmail": "john.doe@gmail.com",
  "currentAddress": "123 Main Street, Bangalore",
  "type": "full-time",
  "department": "IT",
  "designation": "Software Engineer",
  "joinDate": "2024-01-15",
  "officialEmail": "john.doe@ecovale.com",
  "workLocation": "Bangalore",
  "probationPeriod": 6,
  "ctc": 1200000,
  "basic": 50000,
  "hraPercentage": 40,
  "hra": 20000,
  "conveyance": 1600,
  "telephone": 500,
  "medicalAllowance": 1250,
  "specialAllowance": 26650,
  "gross": 100000,
  "includePF": true,
  "includeESI": false,
  "pfDeduction": 6000,
  "employerPF": 6000,
  "professionalTax": 200,
  "tds": 5000,
  "net": 88800,
  "paymentMode": "Bank",
  "bankName": "HDFC Bank",
  "accountHolder": "John Doe",
  "accountNumber": "50100123456789",
  "ifscCode": "HDFC0001234",
  "branch": "Bangalore Main",
  "status": "active"
}
```

**Sample Response:**
```json
{
  "success": true,
  "message": "Employee created successfully",
  "data": {
    "id": "EMP12A3B4C5",
    "firstName": "John",
    "lastName": "Doe",
    "officialEmail": "john.doe@ecovale.com",
    "department": "IT",
    "designation": "Software Engineer",
    "status": "ACTIVE",
    "createdAt": "2026-01-26T10:30:00",
    "updatedAt": "2026-01-26T10:30:00"
  }
}
```

#### Get All Employees
**GET** `/api/employees`

#### Get Employee by ID
**GET** `/api/employees/{id}`

#### Get Active Employees
**GET** `/api/employees/active`

#### Get Employees by Department
**GET** `/api/employees/department/IT`

#### Search Employees by Name
**GET** `/api/employees/search?name=John`

#### Update Employee
**PUT** `/api/employees/{id}`

#### Delete Employee
**DELETE** `/api/employees/{id}`

---

### 2. Designation Management

#### Create Designation
**POST** `/api/designations`

**Sample Request:**
```json
{
  "title": "Senior Software Engineer",
  "department": "IT",
  "description": "Leads development team and mentors junior developers",
  "reportingTo": "Tech Lead",
  "level": 4
}
```

#### Get All Designations
**GET** `/api/designations`

#### Get Designations by Department
**GET** `/api/designations/department/IT`

#### Update Designation
**PUT** `/api/designations/{id}`

#### Delete Designation
**DELETE** `/api/designations/{id}`

---

### 3. Attendance Management

#### Create Attendance Record
**POST** `/api/attendance`

**Sample Request:**
```json
{
  "employeeId": "EMP12A3B4C5",
  "employeeName": "John Doe",
  "month": "January",
  "year": "2026",
  "totalWorkingDays": 26,
  "presentDays": 24,
  "absentDays": 2,
  "paidLeave": 1,
  "unpaidLeave": 1,
  "payableDays": 25,
  "lossOfPayDays": 1,
  "remarks": "Good attendance"
}
```

#### Get Attendance by Employee
**GET** `/api/attendance/employee/{employeeId}`

#### Get Attendance by Month and Year
**GET** `/api/attendance/period?month=January&year=2026`

#### Update Attendance
**PUT** `/api/attendance/{id}`

#### Delete Attendance
**DELETE** `/api/attendance/{id}`

---

### 4. Advance Management

#### Create Advance Record
**POST** `/api/advances`

**Sample Request:**
```json
{
  "employeeId": "EMP12A3B4C5",
  "employeeName": "John Doe",
  "advanceMonth": "January 2026",
  "advanceYear": "2026",
  "advancePaidAmount": 15000,
  "advanceDeductionMonth": "February 2026",
  "advanceDeductionYear": "2026",
  "remarks": "Emergency advance",
  "status": "pending",
  "remainingAmount": 15000
}
```

#### Get Advances by Employee
**GET** `/api/advances/employee/{employeeId}`

#### Get Advances by Status
**GET** `/api/advances/status/pending`

#### Update Advance
**PUT** `/api/advances/{id}`

#### Delete Advance
**DELETE** `/api/advances/{id}`

---

### 5. Loan Management

#### Create Loan Record
**POST** `/api/loans`

**Sample Request:**
```json
{
  "employeeId": "EMP12A3B4C5",
  "employeeName": "John Doe",
  "loanAmount": 100000,
  "interestRate": 10,
  "numberOfEMIs": 12,
  "emiAmount": 8792,
  "totalAmount": 105500,
  "startMonth": "February 2026",
  "startYear": "2026",
  "totalPaidEMIs": 0,
  "remainingBalance": 105500,
  "status": "active",
  "remarks": "Home improvement loan"
}
```

#### Get Loans by Employee
**GET** `/api/loans/employee/{employeeId}`

#### Get Loans by Status
**GET** `/api/loans/status/active`

#### Update Loan
**PUT** `/api/loans/{id}`

#### Delete Loan
**DELETE** `/api/loans/{id}`

---

## Standard API Response Format

All endpoints return a standard response structure:

**Success Response:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* actual data */ }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error description",
  "data": null
}
```

**Validation Error Response:**
```json
{
  "success": false,
  "message": "Validation failed",
  "data": {
    "firstName": "First name is required",
    "contactNumber": "Contact number must be 10 digits"
  }
}
```

## Error Codes
- **200** - Success
- **201** - Created
- **400** - Bad Request (Validation errors)
- **404** - Resource Not Found
- **409** - Conflict (Duplicate resource)
- **500** - Internal Server Error

## CORS Configuration
CORS is enabled for the following origins:
- `http://localhost:3000` (React default)
- `http://localhost:5173` (Vite default)
- `http://localhost:5174`
- `*` (all origins - configure for production)

## Database Schema Auto-creation
Spring Boot automatically creates database tables based on entities when you run the application for the first time. The `spring.jpa.hibernate.ddl-auto=update` setting ensures schema is created/updated automatically.

## Testing with cURL

### Create Employee
```bash
curl -X POST http://localhost:8080/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "gender": "Female",
    "contactNumber": "9876543211",
    "personalEmail": "jane.smith@gmail.com",
    "currentAddress": "456 Park Avenue, Bangalore",
    "type": "full-time",
    "department": "HR",
    "designation": "HR Manager",
    "joinDate": "2024-02-01",
    "officialEmail": "jane.smith@ecovale.com",
    "workLocation": "Bangalore",
    "probationPeriod": 3,
    "ctc": 900000,
    "basic": 37500,
    "net": 67000,
    "paymentMode": "Bank",
    "status": "active"
  }'
```

### Get All Employees
```bash
curl http://localhost:8080/api/employees
```

### Get Employee by ID
```bash
curl http://localhost:8080/api/employees/EMP12A3B4C5
```

## Testing with Postman
1. Import the API endpoints into Postman
2. Set base URL: `http://localhost:8080/api`
3. Use JSON body for POST/PUT requests
4. Check response status and data

## Deployment to Production

### 1. AWS RDS Setup
1. Create MySQL RDS instance
2. Configure security groups
3. Update `application.properties` with RDS endpoint

### 2. AWS Elastic Beanstalk
```bash
# Create JAR file
mvn clean package

# Deploy to Elastic Beanstalk
eb init
eb create
eb deploy
```

### 3. Docker Deployment
```dockerfile
# Dockerfile
FROM openjdk:17-jdk-slim
COPY target/hr-backend-1.0.0.jar app.jar
ENTRYPOINT ["java", "-jar", "/app.jar"]
```

```bash
# Build and run Docker container
docker build -t ecovale-hr-backend .
docker run -p 8080:8080 ecovale-hr-backend
```

## Environment Variables (Production)
```bash
export DB_PASSWORD=your_secure_password
export SPRING_PROFILES_ACTIVE=production
```

## Monitoring and Health Checks
- **Health Check:** `http://localhost:8080/actuator/health`
- **Metrics:** `http://localhost:8080/actuator/metrics`
- **Info:** `http://localhost:8080/actuator/info`

## Frontend Integration

Update your frontend to call the backend API:

```javascript
// Example: Create Employee from React Frontend
const createEmployee = async (employeeData) => {
  const response = await fetch('http://localhost:8080/api/employees', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(employeeData)
  });
  
  const result = await response.json();
  return result;
};
```

## Troubleshooting

### Issue: Port 8080 already in use
```bash
# Find process using port 8080
lsof -i :8080

# Kill the process
kill -9 <PID>
```

### Issue: Database connection failed
- Verify MySQL is running: `sudo systemctl status mysql`
- Check credentials in `application.properties`
- Ensure database `ecovale_hr` exists

### Issue: Bean validation not working
- Ensure `spring-boot-starter-validation` is in `pom.xml`
- Use `@Valid` annotation in controller methods

## Support
For issues or questions, contact: development@ecovale.com

## License
© 2026 Ecovale. All rights reserved.
