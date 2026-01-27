# Deployment Guide

This document provides comprehensive deployment instructions for the EcoVale HR Management System, covering local development, Docker containerization, and cloud deployment strategies.

---

## Table of Contents

1. [Development Environment Setup](#1-development-environment-setup)
2. [Docker Containerization](#2-docker-containerization)
3. [Cloud Deployment Options](#3-cloud-deployment-options)
4. [CI/CD with GitHub Actions](#4-cicd-with-github-actions)
5. [Environment Configuration](#5-environment-configuration)
6. [Database Management](#6-database-management)
7. [Monitoring and Logging](#7-monitoring-and-logging)
8. [Security Considerations](#8-security-considerations)

---

## 1. Development Environment Setup

### 1.1 Prerequisites

- **Node.js**: v18.x LTS or higher
- **npm**: v9.x or higher (comes with Node.js)
- **MongoDB**: v7.x (local installation or Docker)
- **Git**: Latest version

### 1.2 Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-org/ecovale-hr.git
cd ecovale-hr

# Install backend dependencies
cd be
npm install

# Install frontend dependencies
cd ../fe
npm install
```

### 1.3 Environment Files

**Backend (.env):**
```bash
# be/.env
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/ecovale_hr

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000
```

**Frontend (.env):**
```bash
# fe/.env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=EcoVale HR
```

### 1.4 Running Locally

```bash
# Terminal 1: Start MongoDB (if not using Docker)
mongod --dbpath /path/to/data/db

# Terminal 2: Start backend
cd be
npm run dev

# Terminal 3: Start frontend
cd fe
npm run dev
```

**Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api
- API Health: http://localhost:5000/api/health

---

## 2. Docker Containerization

### 2.1 Project Docker Structure

```
ecovale-hr/
├── docker-compose.yml
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── be/
│   ├── Dockerfile
│   └── .dockerignore
└── fe/
    ├── Dockerfile
    ├── Dockerfile.dev
    └── .dockerignore
```

### 2.2 Backend Dockerfile

```dockerfile
# be/Dockerfile
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS production
ENV NODE_ENV=production
RUN npm ci --only=production
COPY . .
EXPOSE 5000
USER node
CMD ["node", "src/server.js"]
```

### 2.3 Backend .dockerignore

```
# be/.dockerignore
node_modules
npm-debug.log
.env
.env.*
.git
.gitignore
README.md
Dockerfile
docker-compose*.yml
coverage
.nyc_output
logs
*.log
```

### 2.4 Frontend Dockerfile (Production)

```dockerfile
# fe/Dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 2.5 Frontend Nginx Configuration

```nginx
# fe/nginx.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy (if frontend serves API)
    location /api {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

### 2.6 Docker Compose (Development)

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  mongodb:
    image: mongo:7
    container_name: ecovale-mongodb-dev
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data_dev:/data/db
    networks:
      - ecovale-network

  backend:
    build:
      context: ./be
      target: development
    container_name: ecovale-backend-dev
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb://mongodb:27017/ecovale_hr
      - JWT_SECRET=dev-secret-key
      - JWT_REFRESH_SECRET=dev-refresh-secret
      - CORS_ORIGIN=http://localhost:3000
    volumes:
      - ./be:/app
      - /app/node_modules
    depends_on:
      - mongodb
    networks:
      - ecovale-network

  frontend:
    build:
      context: ./fe
      dockerfile: Dockerfile.dev
    container_name: ecovale-frontend-dev
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:5000/api
    volumes:
      - ./fe:/app
      - /app/node_modules
    depends_on:
      - backend
    networks:
      - ecovale-network

volumes:
  mongodb_data_dev:

networks:
  ecovale-network:
    driver: bridge
```

### 2.7 Docker Compose (Production)

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  mongodb:
    image: mongo:7
    container_name: ecovale-mongodb
    restart: always
    volumes:
      - mongodb_data:/data/db
    networks:
      - ecovale-network
    # No exposed ports in production - internal only

  backend:
    build:
      context: ./be
      target: production
    container_name: ecovale-backend
    restart: always
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongodb:27017/ecovale_hr
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - CORS_ORIGIN=${CORS_ORIGIN}
    depends_on:
      - mongodb
    networks:
      - ecovale-network
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./fe
      args:
        - VITE_API_URL=${VITE_API_URL}
    container_name: ecovale-frontend
    restart: always
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - ecovale-network

volumes:
  mongodb_data:

networks:
  ecovale-network:
    driver: bridge
```

### 2.8 Docker Commands

```bash
# Development
docker-compose -f docker-compose.dev.yml up --build
docker-compose -f docker-compose.dev.yml down

# Production
docker-compose -f docker-compose.prod.yml up -d --build
docker-compose -f docker-compose.prod.yml down

# View logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend

# Access container shell
docker exec -it ecovale-backend sh
docker exec -it ecovale-mongodb mongosh

# Clean up
docker system prune -a
docker volume prune
```

---

## 3. Cloud Deployment Options

### 3.1 MongoDB Atlas (Database)

1. **Create Atlas Account**: https://www.mongodb.com/cloud/atlas
2. **Create Cluster**: Choose M0 (free) or M10+ for production
3. **Configure Network Access**: Add IP whitelist or allow from anywhere (0.0.0.0/0)
4. **Create Database User**: Username and strong password
5. **Get Connection String**: 
   ```
   mongodb+srv://<username>:<password>@cluster.xxxxx.mongodb.net/ecovale_hr?retryWrites=true&w=majority
   ```

### 3.2 Railway (Full Stack)

Railway offers easy deployment for both frontend and backend.

**Backend Deployment:**
1. Connect GitHub repository
2. Select `/be` as root directory
3. Add environment variables:
   - `MONGODB_URI` (from Atlas)
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `NODE_ENV=production`
   - `CORS_ORIGIN=https://your-frontend-domain.railway.app`
4. Deploy

**Frontend Deployment:**
1. Create new project
2. Select `/fe` as root directory
3. Add build command: `npm run build`
4. Add environment variable:
   - `VITE_API_URL=https://your-backend-domain.railway.app/api`
5. Deploy

### 3.3 Render (Backend + Static Site)

**Backend (Web Service):**
1. Connect repository
2. Root directory: `be`
3. Build command: `npm install`
4. Start command: `node src/server.js`
5. Add environment variables

**Frontend (Static Site):**
1. Connect repository
2. Root directory: `fe`
3. Build command: `npm install && npm run build`
4. Publish directory: `dist`
5. Add environment variables for build

### 3.4 Vercel (Frontend) + Render (Backend)

**Frontend on Vercel:**
```json
// fe/vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

1. Import project from GitHub
2. Root directory: `fe`
3. Add environment variables
4. Deploy

### 3.5 AWS (Production Scale)

**Architecture:**
```
┌──────────────────────────────────────────────────────────────┐
│                        AWS Cloud                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                   Route 53 (DNS)                         │ │
│  └────────────────────────┬────────────────────────────────┘ │
│                           │                                   │
│  ┌────────────────────────▼────────────────────────────────┐ │
│  │              CloudFront (CDN)                            │ │
│  └────────────────────────┬────────────────────────────────┘ │
│                           │                                   │
│  ┌────────────────────────▼────────────────────────────────┐ │
│  │                  ALB (Load Balancer)                     │ │
│  └──────────┬─────────────────────────────┬────────────────┘ │
│             │                             │                   │
│  ┌──────────▼──────────┐      ┌──────────▼──────────┐       │
│  │   S3 (Frontend)     │      │  ECS/Fargate        │       │
│  │   Static Assets     │      │  (Backend)          │       │
│  └─────────────────────┘      └──────────┬──────────┘       │
│                                          │                   │
│                         ┌────────────────▼────────────────┐  │
│                         │   DocumentDB / MongoDB Atlas    │  │
│                         └─────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. CI/CD with GitHub Actions

### 4.1 Workflow Structure

```
.github/
└── workflows/
    ├── ci.yml           # Run on every PR
    ├── deploy-staging.yml
    └── deploy-production.yml
```

### 4.2 CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  lint-and-test-backend:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: be/package-lock.json
      
      - name: Install dependencies
        run: |
          cd be
          npm ci
      
      - name: Run linter
        run: |
          cd be
          npm run lint
      
      - name: Run tests
        run: |
          cd be
          npm test
        env:
          NODE_ENV: test
          MONGODB_URI: mongodb://localhost:27017/ecovale_hr_test
          JWT_SECRET: test-secret
          JWT_REFRESH_SECRET: test-refresh-secret

    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017

  lint-and-test-frontend:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: fe/package-lock.json
      
      - name: Install dependencies
        run: |
          cd fe
          npm ci
      
      - name: Run linter
        run: |
          cd fe
          npm run lint
      
      - name: Run tests
        run: |
          cd fe
          npm test
      
      - name: Build
        run: |
          cd fe
          npm run build
        env:
          VITE_API_URL: http://localhost:5000/api

  build-docker:
    runs-on: ubuntu-latest
    needs: [lint-and-test-backend, lint-and-test-frontend]
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Build backend image
        uses: docker/build-push-action@v5
        with:
          context: ./be
          push: false
          tags: ecovale-hr-backend:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - name: Build frontend image
        uses: docker/build-push-action@v5
        with:
          context: ./fe
          push: false
          tags: ecovale-hr-frontend:${{ github.sha }}
          build-args: |
            VITE_API_URL=${{ secrets.VITE_API_URL }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 4.3 Deploy to Railway

```yaml
# .github/workflows/deploy-railway.yml
name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Railway CLI
        run: npm i -g @railway/cli
      
      - name: Deploy Backend
        run: |
          cd be
          railway up --service backend
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

  deploy-frontend:
    runs-on: ubuntu-latest
    needs: deploy-backend
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Railway CLI
        run: npm i -g @railway/cli
      
      - name: Deploy Frontend
        run: |
          cd fe
          railway up --service frontend
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

### 4.4 Deploy to Vercel (Frontend)

```yaml
# .github/workflows/deploy-vercel.yml
name: Deploy Frontend to Vercel

on:
  push:
    branches: [main]
    paths:
      - 'fe/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install Vercel CLI
        run: npm i -g vercel@latest
      
      - name: Pull Vercel Environment
        run: |
          cd fe
          vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
      
      - name: Build
        run: |
          cd fe
          vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
      
      - name: Deploy
        run: |
          cd fe
          vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

---

## 5. Environment Configuration

### 5.1 Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment (development/production/test) | Yes | development |
| `PORT` | Backend server port | No | 5000 |
| `MONGODB_URI` | MongoDB connection string | Yes | - |
| `JWT_SECRET` | Secret for access tokens | Yes | - |
| `JWT_EXPIRES_IN` | Access token expiry | No | 15m |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | Yes | - |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | No | 7d |
| `CORS_ORIGIN` | Allowed CORS origin | Yes | - |
| `VITE_API_URL` | API URL for frontend | Yes | - |

### 5.2 Secrets Management

**Development:**
- Use `.env` files (not committed to git)
- Use `.env.example` as template

**Production:**
- Use platform-provided secrets (Railway, Vercel, etc.)
- Use AWS Secrets Manager or HashiCorp Vault for AWS
- Never commit secrets to repository

### 5.3 Environment-Specific Config

```javascript
// be/src/config/index.js
const config = {
  development: {
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ecovale_hr',
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'dev-secret',
      expiresIn: '1h', // Longer for dev
    },
    cors: {
      origin: 'http://localhost:3000',
    },
  },
  production: {
    mongodb: {
      uri: process.env.MONGODB_URI, // Required
    },
    jwt: {
      secret: process.env.JWT_SECRET, // Required
      expiresIn: '15m',
    },
    cors: {
      origin: process.env.CORS_ORIGIN, // Required
    },
  },
  test: {
    mongodb: {
      uri: 'mongodb://localhost:27017/ecovale_hr_test',
    },
    jwt: {
      secret: 'test-secret',
      expiresIn: '1h',
    },
    cors: {
      origin: '*',
    },
  },
};

const env = process.env.NODE_ENV || 'development';
module.exports = config[env];
```

---

## 6. Database Management

### 6.1 MongoDB Backup Script

```bash
#!/bin/bash
# scripts/backup-mongodb.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
DB_NAME="ecovale_hr"

# Create backup directory
mkdir -p $BACKUP_DIR

# Local backup
mongodump --db $DB_NAME --out $BACKUP_DIR/$TIMESTAMP

# Compress
tar -czvf $BACKUP_DIR/backup_$TIMESTAMP.tar.gz -C $BACKUP_DIR $TIMESTAMP

# Clean up uncompressed
rm -rf $BACKUP_DIR/$TIMESTAMP

# Keep only last 7 backups
ls -t $BACKUP_DIR/*.tar.gz | tail -n +8 | xargs -r rm

echo "Backup completed: $BACKUP_DIR/backup_$TIMESTAMP.tar.gz"
```

### 6.2 MongoDB Restore Script

```bash
#!/bin/bash
# scripts/restore-mongodb.sh

if [ -z "$1" ]; then
    echo "Usage: ./restore-mongodb.sh <backup_file.tar.gz>"
    exit 1
fi

BACKUP_FILE=$1
TEMP_DIR="./temp_restore"
DB_NAME="ecovale_hr"

# Extract backup
mkdir -p $TEMP_DIR
tar -xzvf $BACKUP_FILE -C $TEMP_DIR

# Get extracted folder name
EXTRACTED=$(ls $TEMP_DIR)

# Restore
mongorestore --db $DB_NAME --drop $TEMP_DIR/$EXTRACTED/$DB_NAME

# Clean up
rm -rf $TEMP_DIR

echo "Restore completed from $BACKUP_FILE"
```

### 6.3 Database Seeding

```javascript
// be/src/scripts/seed.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Department = require('../models/Department');
require('dotenv').config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Department.deleteMany({});

    // Seed admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await User.create({
      email: 'admin@ecovale.com',
      password: hashedPassword,
      fullName: 'System Administrator',
      role: 'admin',
    });
    console.log('Admin user created');

    // Seed departments
    const departments = [
      { name: 'IT', description: 'Information Technology' },
      { name: 'HR', description: 'Human Resources' },
      { name: 'Finance', description: 'Finance and Accounting' },
      { name: 'Sales', description: 'Sales and Business Development' },
      { name: 'Marketing', description: 'Marketing and Communications' },
    ];
    await Department.insertMany(departments);
    console.log('Departments seeded');

    console.log('Seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedData();
```

---

## 7. Monitoring and Logging

### 7.1 Application Logging

```javascript
// be/src/utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ecovale-hr-api' },
  transports: [
    // Console for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({ 
    filename: 'logs/error.log', 
    level: 'error' 
  }));
  logger.add(new winston.transports.File({ 
    filename: 'logs/combined.log' 
  }));
}

module.exports = logger;
```

### 7.2 Request Logging Middleware

```javascript
// be/src/middleware/requestLogger.js
const morgan = require('morgan');
const logger = require('../utils/logger');

// Custom morgan token for user ID
morgan.token('user-id', (req) => req.user?._id || 'anonymous');

// Stream for winston
const stream = {
  write: (message) => logger.http(message.trim()),
};

// Morgan middleware
const requestLogger = morgan(
  ':remote-addr - :user-id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms',
  { stream }
);

module.exports = requestLogger;
```

### 7.3 Health Check Endpoint

```javascript
// be/src/routes/health.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

router.get('/health', async (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  };

  try {
    // Check MongoDB connection
    await mongoose.connection.db.admin().ping();
    res.status(200).json(healthcheck);
  } catch (error) {
    healthcheck.message = error.message;
    healthcheck.mongodb = 'error';
    res.status(503).json(healthcheck);
  }
});

module.exports = router;
```

### 7.4 Error Tracking (Sentry)

```bash
npm install @sentry/node
```

```javascript
// be/src/utils/sentry.js
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

module.exports = Sentry;
```

---

## 8. Security Considerations

### 8.1 Security Checklist

- [ ] Use HTTPS everywhere (SSL/TLS certificates)
- [ ] Set secure HTTP headers (Helmet.js)
- [ ] Enable CORS with specific origins
- [ ] Implement rate limiting
- [ ] Validate and sanitize all inputs
- [ ] Use parameterized queries (Mongoose handles this)
- [ ] Hash passwords with bcrypt (10+ rounds)
- [ ] Implement JWT token rotation
- [ ] Store secrets in environment variables
- [ ] Keep dependencies updated
- [ ] Enable MongoDB authentication
- [ ] Use least-privilege database users
- [ ] Implement request logging
- [ ] Set up error monitoring

### 8.2 Security Headers (Helmet)

```javascript
// be/src/app.js
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-site" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));
```

### 8.3 Rate Limiting

```javascript
// be/src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per window
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
  },
  skipSuccessfulRequests: true,
});

module.exports = { apiLimiter, authLimiter };
```

### 8.4 Input Validation

```javascript
// be/src/middleware/validate.js
const { validationResult } = require('express-validator');

const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
      })),
    });
  };
};

module.exports = validate;
```

---

## Quick Deployment Commands

### Local Development
```bash
docker-compose -f docker-compose.dev.yml up --build
```

### Production with Docker
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

### Railway CLI
```bash
railway up
```

### Vercel CLI
```bash
vercel --prod
```

---

## Troubleshooting

### Common Issues

1. **MongoDB connection refused**
   - Check if MongoDB is running
   - Verify connection string
   - Check network access (Atlas whitelist)

2. **CORS errors**
   - Verify `CORS_ORIGIN` matches frontend URL
   - Check for trailing slashes

3. **JWT errors**
   - Ensure secrets match between restarts
   - Check token expiration times

4. **Docker build failures**
   - Clear Docker cache: `docker system prune -a`
   - Check Dockerfile paths

5. **Deployment failures**
   - Check environment variables are set
   - Verify build commands
   - Check logs for specific errors
