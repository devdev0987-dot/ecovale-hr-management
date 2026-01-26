// k6 Load Testing Script - Authentication Flow
// Tests login, JWT token validation, and protected endpoints

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const loginSuccessRate = new Rate('login_success_rate');
const loginDuration = new Trend('login_duration');
const protectedEndpointDuration = new Trend('protected_endpoint_duration');
const authFailures = new Counter('auth_failures');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 100 },   // Ramp-up to 100 users
    { duration: '3m', target: 100 },   // Stay at 100 users
    { duration: '1m', target: 500 },   // Ramp-up to 500 users
    { duration: '3m', target: 500 },   // Stay at 500 users
    { duration: '1m', target: 1000 },  // Ramp-up to 1000 users
    { duration: '5m', target: 1000 },  // Stay at 1000 users (peak load)
    { duration: '2m', target: 0 },     // Ramp-down to 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],  // 95% of requests under 500ms
    'http_req_failed': ['rate<0.01'],                   // Less than 1% failures
    'login_success_rate': ['rate>0.95'],                // 95% login success
    'login_duration': ['p(95)<300'],                    // Login under 300ms (95%)
    'protectedEndpointDuration': ['p(95)<200'],         // Protected endpoints under 200ms
  },
};

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const USERS_PER_ITERATION = 10;

// Test data
const testUsers = [
  { username: 'admin', password: 'admin123' },
  { username: 'user1', password: 'password123' },
  { username: 'user2', password: 'password123' },
  { username: 'hr_manager', password: 'hr123' },
  { username: 'employee1', password: 'emp123' },
];

// Helper function to get random user
function getRandomUser() {
  return testUsers[Math.floor(Math.random() * testUsers.length)];
}

// Setup function - runs once per VU
export function setup() {
  console.log('Starting load test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Target: 1000 concurrent users`);
  
  // Health check
  const healthResponse = http.get(`${BASE_URL}/actuator/health`);
  check(healthResponse, {
    'Health check passed': (r) => r.status === 200,
  });
  
  return { startTime: Date.now() };
}

// Main test function
export default function(data) {
  const user = getRandomUser();
  
  // Group 1: Authentication
  group('Authentication Flow', function() {
    // Login request
    const loginStart = Date.now();
    const loginPayload = JSON.stringify({
      username: user.username,
      password: user.password,
    });
    
    const loginParams = {
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': `load-test-${__VU}-${__ITER}`,
      },
    };
    
    const loginResponse = http.post(
      `${BASE_URL}/api/auth/login`,
      loginPayload,
      loginParams
    );
    
    const loginTime = Date.now() - loginStart;
    loginDuration.add(loginTime);
    
    const loginSuccess = check(loginResponse, {
      'Login status is 200': (r) => r.status === 200,
      'Login returns token': (r) => r.json('token') !== undefined,
      'Login response time < 500ms': () => loginTime < 500,
    });
    
    loginSuccessRate.add(loginSuccess);
    
    if (!loginSuccess) {
      authFailures.add(1);
      return; // Skip rest if login fails
    }
    
    // Extract token
    const token = loginResponse.json('token');
    
    // Short pause to simulate user think time
    sleep(1);
    
    // Group 2: Protected Endpoints
    group('Protected Endpoints', function() {
      const authHeaders = {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Correlation-ID': `load-test-${__VU}-${__ITER}`,
        },
      };
      
      // Test: Get current user profile
      const profileStart = Date.now();
      const profileResponse = http.get(
        `${BASE_URL}/api/auth/me`,
        authHeaders
      );
      protectedEndpointDuration.add(Date.now() - profileStart);
      
      check(profileResponse, {
        'Profile status is 200': (r) => r.status === 200,
        'Profile has username': (r) => r.json('username') !== undefined,
      });
      
      sleep(0.5);
      
      // Test: Get employees list
      const employeesStart = Date.now();
      const employeesResponse = http.get(
        `${BASE_URL}/api/employees?page=0&size=20`,
        authHeaders
      );
      protectedEndpointDuration.add(Date.now() - employeesStart);
      
      check(employeesResponse, {
        'Employees status is 200': (r) => r.status === 200,
        'Employees returns data': (r) => r.json('content') !== undefined,
      });
      
      sleep(0.5);
      
      // Test: Get audit logs (admin only)
      if (user.username === 'admin') {
        const auditStart = Date.now();
        const auditResponse = http.get(
          `${BASE_URL}/api/admin/audit-logs?page=0&size=10`,
          authHeaders
        );
        protectedEndpointDuration.add(Date.now() - auditStart);
        
        check(auditResponse, {
          'Audit logs accessible': (r) => r.status === 200 || r.status === 403,
        });
      }
    });
  });
  
  // Group 3: Token Refresh
  group('Token Refresh', function() {
    const user = getRandomUser();
    const loginPayload = JSON.stringify({
      username: user.username,
      password: user.password,
    });
    
    const loginResponse = http.post(
      `${BASE_URL}/api/auth/login`,
      loginPayload,
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    if (loginResponse.status === 200) {
      const refreshToken = loginResponse.json('refreshToken');
      
      sleep(1);
      
      // Test refresh token
      const refreshPayload = JSON.stringify({
        refreshToken: refreshToken,
      });
      
      const refreshResponse = http.post(
        `${BASE_URL}/api/auth/refresh`,
        refreshPayload,
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      check(refreshResponse, {
        'Token refresh successful': (r) => r.status === 200,
        'New token received': (r) => r.json('token') !== undefined,
      });
    }
  });
  
  // Simulate realistic user behavior
  sleep(Math.random() * 3 + 1); // Random sleep between 1-4 seconds
}

// Teardown function - runs once after all VUs finish
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration.toFixed(2)} seconds`);
}
