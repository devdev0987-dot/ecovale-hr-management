// k6 Spike Testing Script
// Tests system behavior under sudden traffic spikes

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const spikeRecoveryRate = new Rate('spike_recovery_rate');
const responseTimeSpike = new Trend('response_time_during_spike');

export const options = {
  stages: [
    { duration: '2m', target: 100 },    // Normal load
    { duration: '1m', target: 2000 },   // Sudden spike to 2000 users
    { duration: '3m', target: 2000 },   // Maintain spike
    { duration: '2m', target: 100 },    // Drop back to normal
    { duration: '2m', target: 100 },    // Recovery period
    { duration: '1m', target: 0 },      // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(99)<3000'], // Allow higher latency during spike
    'http_req_failed': ['rate<0.05'],    // Allow up to 5% failures
    'spike_recovery_rate': ['rate>0.80'], // 80% recovery rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export function setup() {
  console.log('Starting spike test...');
  
  // Get auth token
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
      'X-Correlation-ID': `spike-test-${__VU}-${__ITER}`,
    },
  };
  
  const start = Date.now();
  
  // Test various endpoints
  const responses = http.batch([
    ['GET', `${BASE_URL}/actuator/health`, null, {}],
    ['GET', `${BASE_URL}/api/employees?page=0&size=10`, null, authHeaders],
    ['GET', `${BASE_URL}/actuator/metrics`, null, authHeaders],
  ]);
  
  const duration = Date.now() - start;
  responseTimeSpike.add(duration);
  
  const success = responses.every(r => r.status === 200 || r.status === 403);
  spikeRecoveryRate.add(success);
  
  check(responses[0], {
    'Health check passed': (r) => r.status === 200,
  });
  
  sleep(0.1); // Minimal sleep during spike
}

export function teardown(data) {
  console.log('Spike test completed');
}
