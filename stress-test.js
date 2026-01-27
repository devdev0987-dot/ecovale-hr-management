// k6 Stress Testing Script
// Gradually increases load to find system breaking point

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const systemStability = new Rate('system_stability');
const peakCapacity = new Counter('peak_capacity_reached');
const errorRate = new Rate('error_rate');

export const options = {
  stages: [
    { duration: '2m', target: 200 },
    { duration: '3m', target: 400 },
    { duration: '3m', target: 600 },
    { duration: '3m', target: 800 },
    { duration: '3m', target: 1000 },
    { duration: '3m', target: 1200 },
    { duration: '3m', target: 1500 }, // Push beyond expected capacity
    { duration: '5m', target: 2000 }, // Find breaking point
    { duration: '3m', target: 0 },
  ],
  thresholds: {
    'http_req_duration': ['p(95)<2000'],
    'http_req_failed': ['rate<0.10'], // Allow up to 10% failures under stress
    'system_stability': ['rate>0.70'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export function setup() {
  console.log('Starting stress test to find breaking point...');
  
  const loginResponse = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: 'admin', password: 'admin123' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  return { token: loginResponse.json('token') };
}

export default function(data) {
  const authHeaders = {
    headers: {
      'Authorization': `Bearer ${data.token}`,
      'X-Correlation-ID': `stress-test-${__VU}-${__ITER}`,
    },
  };
  
  const response = http.get(
    `${BASE_URL}/api/employees?page=0&size=20`,
    authHeaders
  );
  
  const success = check(response, {
    'Status is 200': (r) => r.status === 200,
    'Response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  systemStability.add(success);
  
  if (!success) {
    errorRate.add(1);
  }
  
  if (__VU > 1000) {
    peakCapacity.add(1);
  }
  
  sleep(Math.random() * 2);
}

export function teardown(data) {
  console.log('Stress test completed - check results to identify breaking point');
}
