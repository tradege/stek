/**
 * ⚔️ PHASE 48 - STEP 3: Stress Testing Script
 * 
 * File: k6/load-test.js (Node.js implementation)
 * 
 * OBJECTIVE: Simulate 500 users betting on Crash simultaneously.
 * 
 * Stages:
 *   - Ramp up to 100 users in 30s
 *   - Stay at 500 users for 1m
 *   - Ramp down to 0 in 10s
 * 
 * Usage: node phase48_step3_load_test.js
 */

const http = require('http');
const https = require('https');

const CONFIG = {
  BASE_URL: process.env.TEST_URL || 'http://146.190.21.113:3000',
  API_KEY: '1de51fcb05661780cd7f41a5313b9513042c837d5e88372be452851b8c45b657',
  STAGES: [
    { duration: 30, target: 100, label: 'Ramp Up to 100' },
    { duration: 60, target: 500, label: 'Peak at 500' },
    { duration: 10, target: 0, label: 'Ramp Down' },
  ],
};

// ═══════════════════════════════════════════════════
// METRICS COLLECTOR
// ═══════════════════════════════════════════════════

class MetricsCollector {
  constructor() {
    this.requests = 0;
    this.successes = 0;
    this.failures = 0;
    this.latencies = [];
    this.errors = {};
    this.startTime = Date.now();
    this.statusCodes = {};
  }

  record(statusCode, latency, error = null) {
    this.requests++;
    this.latencies.push(latency);
    this.statusCodes[statusCode] = (this.statusCodes[statusCode] || 0) + 1;

    if (statusCode >= 200 && statusCode < 400) {
      this.successes++;
    } else {
      this.failures++;
      if (error) {
        this.errors[error] = (this.errors[error] || 0) + 1;
      }
    }
  }

  recordError(error) {
    this.requests++;
    this.failures++;
    const msg = error.message || 'Unknown';
    this.errors[msg] = (this.errors[msg] || 0) + 1;
  }

  getReport() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
    const avg = sorted.length > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;

    return {
      duration: `${elapsed.toFixed(1)}s`,
      totalRequests: this.requests,
      successes: this.successes,
      failures: this.failures,
      successRate: `${((this.successes / Math.max(this.requests, 1)) * 100).toFixed(1)}%`,
      rps: (this.requests / elapsed).toFixed(1),
      latency: {
        avg: `${avg.toFixed(0)}ms`,
        p50: `${p50}ms`,
        p95: `${p95}ms`,
        p99: `${p99}ms`,
        min: `${sorted[0] || 0}ms`,
        max: `${sorted[sorted.length - 1] || 0}ms`,
      },
      statusCodes: this.statusCodes,
      errors: this.errors,
    };
  }
}

// ═══════════════════════════════════════════════════
// HTTP REQUEST HELPER
// ═══════════════════════════════════════════════════

function makeRequest(path, body) {
  return new Promise((resolve) => {
    const start = Date.now();
    const url = new URL(path, CONFIG.BASE_URL);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const data = JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': CONFIG.API_KEY,
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 10000,
    };

    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const latency = Date.now() - start;
        let parsed;
        try { parsed = JSON.parse(body); } catch { parsed = {}; }
        resolve({ status: res.statusCode, latency, body: parsed });
      });
    });

    req.on('error', (err) => {
      const latency = Date.now() - start;
      resolve({ status: 0, latency, body: {}, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      const latency = Date.now() - start;
      resolve({ status: 0, latency, body: {}, error: 'TIMEOUT' });
    });

    req.write(data);
    req.end();
  });
}

// ═══════════════════════════════════════════════════
// VIRTUAL USER SIMULATION
// ═══════════════════════════════════════════════════

async function simulateUser(userId, metrics) {
  const uid = `stress_${Date.now()}_${userId}`;

  // 1. Health Check
  const healthRes = await makeRequest('/api/integration/health', {});
  metrics.record(healthRes.status, healthRes.latency, healthRes.error);

  // 2. Check Balance
  const balRes = await makeRequest('/api/integration/balance', {
    userId: `virtual_user_${userId}`,
    currency: 'USDT',
  });
  metrics.record(balRes.status, balRes.latency, balRes.error);

  // 3. Place BET
  const betRes = await makeRequest('/api/integration/transaction', {
    transactionId: `stress_bet_${uid}`,
    userId: `virtual_user_${userId}`,
    amount: 10,
    gameId: 'crash',
    roundId: `stress_round_${uid}`,
    type: 'BET',
  });
  metrics.record(betRes.status, betRes.latency, betRes.error);

  // Small delay to simulate real user
  await new Promise(r => setTimeout(r, Math.random() * 500));

  // 4. Place WIN (cashout)
  const winRes = await makeRequest('/api/integration/transaction', {
    transactionId: `stress_win_${uid}`,
    userId: `virtual_user_${userId}`,
    amount: 15,
    gameId: 'crash',
    roundId: `stress_round_${uid}`,
    type: 'WIN',
  });
  metrics.record(winRes.status, winRes.latency, winRes.error);

  return true;
}

// ═══════════════════════════════════════════════════
// STAGE RUNNER
// ═══════════════════════════════════════════════════

async function runStage(stage, metrics) {
  console.log(`\n📊 Stage: ${stage.label} (${stage.duration}s, target: ${stage.target} users)`);
  
  const startTime = Date.now();
  const endTime = startTime + (stage.duration * 1000);
  let userCounter = 0;
  let activePromises = [];

  while (Date.now() < endTime) {
    const elapsed = (Date.now() - startTime) / 1000;
    const progress = Math.min(elapsed / stage.duration, 1);
    
    // Calculate current target based on linear interpolation
    const currentTarget = Math.ceil(stage.target * progress);
    
    // Launch new users to reach target
    while (activePromises.length < currentTarget && Date.now() < endTime) {
      userCounter++;
      const promise = simulateUser(userCounter, metrics)
        .catch((err) => metrics.recordError(err))
        .finally(() => {
          activePromises = activePromises.filter(p => p !== promise);
        });
      activePromises.push(promise);
    }

    // Wait a bit before next batch
    await new Promise(r => setTimeout(r, 100));
    
    // Print progress every 10 seconds
    if (Math.floor(elapsed) % 10 === 0 && Math.floor(elapsed) > 0) {
      process.stdout.write(`  ⏱️  ${Math.floor(elapsed)}s - Active: ${activePromises.length}, Total: ${metrics.requests}\r`);
    }
  }

  // Wait for remaining promises
  if (activePromises.length > 0) {
    console.log(`  ⏳ Waiting for ${activePromises.length} remaining requests...`);
    await Promise.allSettled(activePromises);
  }
}

// ═══════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('⚔️  PHASE 48 STEP 3: STRESS TEST - 500 CONCURRENT USERS');
  console.log(`🎯 Target: ${CONFIG.BASE_URL}`);
  console.log('═══════════════════════════════════════════════════');

  const metrics = new MetricsCollector();

  // Pre-flight check
  console.log('\n🔍 Pre-flight health check...');
  const healthCheck = await makeRequest('/api/integration/health', {});
  if (healthCheck.status !== 200 && healthCheck.status !== 201) {
    console.error('❌ Server is not responding! Aborting.');
    process.exit(1);
  }
  console.log('✅ Server is healthy');

  // Run stages
  for (const stage of CONFIG.STAGES) {
    await runStage(stage, metrics);
  }

  // Final report
  const report = metrics.getReport();
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 STRESS TEST RESULTS');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Duration:        ${report.duration}`);
  console.log(`Total Requests:  ${report.totalRequests}`);
  console.log(`Successes:       ${report.successes}`);
  console.log(`Failures:        ${report.failures}`);
  console.log(`Success Rate:    ${report.successRate}`);
  console.log(`Requests/sec:    ${report.rps}`);
  console.log(`\nLatency:`);
  console.log(`  Average:       ${report.latency.avg}`);
  console.log(`  P50:           ${report.latency.p50}`);
  console.log(`  P95:           ${report.latency.p95}`);
  console.log(`  P99:           ${report.latency.p99}`);
  console.log(`  Min:           ${report.latency.min}`);
  console.log(`  Max:           ${report.latency.max}`);
  console.log(`\nStatus Codes:`, JSON.stringify(report.statusCodes, null, 2));
  
  if (Object.keys(report.errors).length > 0) {
    console.log(`\nErrors:`, JSON.stringify(report.errors, null, 2));
  }

  console.log('\n═══════════════════════════════════════════════════');
  
  // Pass/Fail criteria
  const successRate = parseFloat(report.successRate);
  const avgLatency = parseFloat(report.latency.avg);
  const p95Latency = parseFloat(report.latency.p95);
  
  let passed = true;
  
  if (successRate < 80) {
    console.log('❌ FAIL: Success rate below 80%');
    passed = false;
  } else {
    console.log('✅ PASS: Success rate above 80%');
  }
  
  if (p95Latency > 5000) {
    console.log('⚠️  WARNING: P95 latency above 5s');
  } else {
    console.log('✅ PASS: P95 latency under 5s');
  }
  
  if (report.totalRequests < 100) {
    console.log('⚠️  WARNING: Low request count - server may be throttling');
  } else {
    console.log(`✅ PASS: ${report.totalRequests} requests processed`);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(passed ? '🏆 STRESS TEST: PASSED' : '💀 STRESS TEST: FAILED');
  console.log('═══════════════════════════════════════════════════');

  // Write results to JSON file
  const fs = require('fs');
  fs.writeFileSync('/tmp/stress_test_results.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Results saved to /tmp/stress_test_results.json');

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
