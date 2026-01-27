// k6 Load Testing Script - CRUD Operations
// Tests create, read, update, delete operations on employee endpoints

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Custom metrics
const createSuccessRate = new Rate('create_success_rate');
const updateSuccessRate = new Rate('update_success_rate');
const deleteSuccessRate = new Rate('delete_success_rate');
const crudDuration = new Trend('crud_operation_duration');
const databaseErrors = new Counter('database_errors');

// Test configuration
export const options = {
  scenarios: {
    crud_operations: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 200 },   // Ramp-up
        { duration: '5m', target: 200 },   // Steady state
        { duration: '2m', target: 500 },   // Increase load
        { duration: '5m', target: 500 },   // Peak load
        { duration: '2m', target: 0 },     // Ramp-down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<800', 'p(99)<1500'],
    'http_req_failed': ['rate<0.02'],
    'create_success_rate': ['rate>0.95'],
    'update_success_rate': ['rate>0.95'],
    'delete_success_rate': ['rate>0.90'],
    'crud_operation_duration': ['p(95)<600'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Test data for creating employees
const employeeData = new SharedArray('employees', function() {
  return [
    { fullName: 'John Doe', email: 'john.doe@ecovale.com', designation: 'Developer' },
    { fullName: 'Jane Smith', email: 'jane.smith@ecovale.com', designation: 'Manager' },
    { fullName: 'Bob Johnson', email: 'bob.johnson@ecovale.com', designation: 'Analyst' },
    { fullName: 'Alice Brown', email: 'alice.brown@ecovale.com', designation: 'Designer' },
    { fullName: 'Charlie Wilson', email: 'charlie.wilson@ecovale.com', designation: 'Tester' },
  ];
});

// Get authentication token
function getAuthToken() {
  const loginPayload = JSON.stringify({
    username: 'admin',
    password: 'admin123',
  });
  
  const loginResponse = http.post(
    `${BASE_URL}/api/auth/login`,
    loginPayload,
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  if (loginResponse.status === 200) {
    return loginResponse.json('token');
  }
  return null;
}

// Setup
export function setup() {
  console.log('Starting CRUD load test...');
  const token = getAuthToken();
  return { token: token };
}

// Main test
export default function(data) {
  if (!data.token) {
    console.error('No authentication token available');
    return;
  }
  
  const authHeaders = {
    headers: {
      'Authorization': `Bearer ${data.token}`,
      'Content-Type': 'application/json',
      'X-Correlation-ID': `crud-test-${__VU}-${__ITER}`,
    },
  };
  
  // CREATE
  group('Create Employee', function() {
    const employee = employeeData[Math.floor(Math.random() * employeeData.length)];
    const uniqueEmployee = {
      ...employee,
      email: `${__VU}.${__ITER}.${employee.email}`,
    };
    
    const createStart = Date.now();
    const createResponse = http.post(
      `${BASE_URL}/api/employees`,
      JSON.stringify(uniqueEmployee),
      authHeaders
    );
    crudDuration.add(Date.now() - createStart);
    
    const createSuccess = check(createResponse, {
      'Create status is 201': (r) => r.status === 201,
      'Created employee has ID': (r) => r.json('id') !== undefined,
      'Create response < 800ms': (r) => r.timings.duration < 800,
    });
    
    createSuccessRate.add(createSuccess);
    
    if (!createSuccess && createResponse.status >= 500) {
      databaseErrors.add(1);
    }
    
    if (createSuccess) {
      const employeeId = createResponse.json('id');
      sleep(0.5);
      
      // READ
      group('Read Employee', function() {
        const readResponse = http.get(
          `${BASE_URL}/api/employees/${employeeId}`,
          authHeaders
        );
        
        check(readResponse, {
          'Read status is 200': (r) => r.status === 200,
          'Read returns correct ID': (r) => r.json('id') === employeeId,
        });
        
        sleep(0.5);
      });
      
      // UPDATE
      group('Update Employee', function() {
        const updateData = {
          ...uniqueEmployee,
          fullName: `${uniqueEmployee.fullName} (Updated)`,
        };
        
        const updateStart = Date.now();
        const updateResponse = http.put(
          `${BASE_URL}/api/employees/${employeeId}`,
          JSON.stringify(updateData),
          authHeaders
        );
        crudDuration.add(Date.now() - updateStart);
        
        const updateSuccess = check(updateResponse, {
          'Update status is 200': (r) => r.status === 200,
          'Updated employee name changed': (r) => r.json('fullName').includes('Updated'),
        });
        
        updateSuccessRate.add(updateSuccess);
        
        if (!updateSuccess && updateResponse.status >= 500) {
          databaseErrors.add(1);
        }
        
        sleep(0.5);
      });
      
      // DELETE
      group('Delete Employee', function() {
        const deleteStart = Date.now();
        const deleteResponse = http.del(
          `${BASE_URL}/api/employees/${employeeId}`,
          null,
          authHeaders
        );
        crudDuration.add(Date.now() - deleteStart);
        
        const deleteSuccess = check(deleteResponse, {
          'Delete status is 204 or 200': (r) => r.status === 204 || r.status === 200,
        });
        
        deleteSuccessRate.add(deleteSuccess);
        
        if (!deleteSuccess && deleteResponse.status >= 500) {
          databaseErrors.add(1);
        }
      });
    }
  });
  
  sleep(Math.random() * 2 + 1);
}

export function teardown(data) {
  console.log('CRUD load test completed');
}
