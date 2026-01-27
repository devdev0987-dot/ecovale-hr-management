# Backend (be/) Directory

This directory contains the Express.js + MongoDB backend API for the EcoVale HR Management System.

---

## Quick Start

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Run development server
npm run dev

# Run production server
npm start
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with nodemon |
| `npm start` | Start production server |
| `npm test` | Run tests with Jest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run seed` | Seed database with initial data |

---

## Environment Variables

Create a `.env` file in the `be/` directory:

```bash
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/ecovale_hr

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000
```

---

## API Documentation

Base URL: `http://localhost:5000/api`

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Employees
- `GET /api/employees` - List all employees
- `GET /api/employees/:id` - Get employee by ID
- `POST /api/employees` - Create employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee

### Departments
- `GET /api/departments` - List departments
- `POST /api/departments` - Create department

### Designations
- `GET /api/designations` - List designations
- `POST /api/designations` - Create designation

### Attendance
- `GET /api/attendances` - List attendance records
- `POST /api/attendances` - Create attendance record

### Pay Runs
- `GET /api/payruns` - List pay runs
- `POST /api/payruns/generate` - Generate pay run

### Advances
- `GET /api/advances` - List advances
- `POST /api/advances` - Create advance

### Loans
- `GET /api/loans` - List loans
- `POST /api/loans` - Create loan

See [05-api-design.md](docs/05-api-design.md) for complete API documentation.

---

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=auth
```

---

## Project Dependencies

### Production Dependencies
- `express` - Web framework
- `mongoose` - MongoDB ODM
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT authentication
- `cors` - Cross-origin resource sharing
- `helmet` - Security headers
- `express-validator` - Input validation
- `express-rate-limit` - Rate limiting
- `morgan` - HTTP request logger
- `dotenv` - Environment variables

### Development Dependencies
- `nodemon` - Auto-reload on changes
- `jest` - Testing framework
- `supertest` - HTTP testing
- `eslint` - Linting
