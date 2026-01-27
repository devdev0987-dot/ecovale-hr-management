// k6 Soak Testing Script (Endurance Test)
// Tests system stability over extended period

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const memoryLeakIndicator = new Trend('response_time_trend');
const longRunStability = new Rate('long_run_stability');

export const options = {
  stages: [
    { duration: '5m', target: 300 },   // Ramp-up
    { duration: '60m', target: 300 },  // Stay at 300 users for 1 hour
    { duration: '5m', target: 0 },     // Ramp-down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<600'],
    'http_req_failed': ['rate<0.01'],
    'long_run_stability': ['rate>0.95'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export function setup() {
  console.log('Starting soak test (1 hour duration)...');
  console.log('This test checks for memory leaks and resource exhaustion');
  
  const loginResponse = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: 'admin', password: 'admin123' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  return { 
    token: loginResponse.json('token'),
    startTime: Date.now(),
  };
}

export default function(data) {
  const authHeaders = {
    headers: {
      'Authorization': `Bearer ${data.token}`,
      'X-Correlation-ID': `soak-test-${__VU}-${__ITER}`,
    },
  };
  
  const response = http.get(
    `${BASE_URL}/api/employees?page=0&size=20`,
    authHeaders
  );
  
  memoryLeakIndicator.add(response.timings.duration);
  
  const success = check(response, {
    'Status is 200': (r) => r.status === 200,
    'Response time stable': (r) => r.timings.duration < 600,
  });
  
  longRunStability.add(success);
  
  // Check JVM metrics periodically
  if (__ITER % 100 === 0) {
    const metricsResponse = http.get(
      `${BASE_URL}/actuator/metrics/jvm.memory.used`,
      authHeaders
    );
    
    check(metricsResponse, {
      'Metrics accessible': (r) => r.status === 200,
    });
  }
  
  sleep(3); // Longer sleep for endurance test
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log(`Soak test completed after ${duration.toFixed(2)} minutes`);
  console.log('Check response time trends for memory leak indicators');
}
