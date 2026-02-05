/**
 * ============================================
 * INTEGRATION API LOAD TEST SCRIPT
 * ============================================
 * 
 * This script performs heavy load testing on the Integration API
 * to verify it can handle production-level traffic.
 * 
 * Run: npx ts-node integration-load-test.ts
 */

const API_URL = 'http://localhost:3000/api/integration';
const API_KEY = '1de51fcb05661780cd7f41a5313b9513042c837d5e88372be452851b8c45b657';

interface TestResult {
  endpoint: string;
  totalRequests: number;
  successCount: number;
  failCount: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
}

async function makeRequest(endpoint: string, body: any): Promise<{ success: boolean; time: number }> {
  const start = Date.now();
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    const time = Date.now() - start;
    return { success: response.ok && data.status !== 'ERROR', time };
  } catch (error) {
    return { success: false, time: Date.now() - start };
  }
}

async function runLoadTest(
  testName: string,
  endpoint: string,
  bodyGenerator: () => any,
  concurrency: number,
  totalRequests: number
): Promise<TestResult> {
  console.log(`\n🚀 Starting: ${testName}`);
  console.log(`   Concurrency: ${concurrency}, Total Requests: ${totalRequests}`);

  const results: { success: boolean; time: number }[] = [];
  const startTime = Date.now();

  // Process in batches
  for (let i = 0; i < totalRequests; i += concurrency) {
    const batchSize = Math.min(concurrency, totalRequests - i);
    const promises = Array(batchSize)
      .fill(null)
      .map(() => makeRequest(endpoint, bodyGenerator()));
    
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
    
    // Progress indicator
    if ((i + batchSize) % 100 === 0) {
      process.stdout.write(`   Progress: ${i + batchSize}/${totalRequests}\r`);
    }
  }

  const totalTime = Date.now() - startTime;
  const times = results.map(r => r.time);
  const successCount = results.filter(r => r.success).length;

  const result: TestResult = {
    endpoint,
    totalRequests,
    successCount,
    failCount: totalRequests - successCount,
    avgResponseTime: times.reduce((a, b) => a + b, 0) / times.length,
    minResponseTime: Math.min(...times),
    maxResponseTime: Math.max(...times),
    requestsPerSecond: (totalRequests / totalTime) * 1000,
  };

  console.log(`\n   ✅ Success: ${result.successCount}/${result.totalRequests} (${((result.successCount/result.totalRequests)*100).toFixed(1)}%)`);
  console.log(`   ⏱️  Avg Response: ${result.avgResponseTime.toFixed(2)}ms`);
  console.log(`   📊 RPS: ${result.requestsPerSecond.toFixed(2)}`);

  return result;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     INTEGRATION API LOAD TEST                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const testUserId = '02c662a1-fc1b-4350-9b72-dfd9217668ab'; // Use a real user ID
  const results: TestResult[] = [];

  // Test 1: Health Check - Light load
  results.push(await runLoadTest(
    'Health Check - 500 requests',
    '/health',
    () => ({}),
    50,
    500
  ));

  // Test 2: Balance Check - Medium load
  results.push(await runLoadTest(
    'Balance Check - 1000 requests',
    '/balance',
    () => ({ userId: testUserId, currency: 'USDT' }),
    100,
    1000
  ));

  // Test 3: Transactions - Heavy load
  let txCounter = 0;
  results.push(await runLoadTest(
    'BET Transactions - 500 requests',
    '/transaction',
    () => ({
      userId: testUserId,
      amount: 0.01,
      type: 'BET',
      gameId: 'load-test',
      transactionId: `load-test-${Date.now()}-${txCounter++}`,
      currency: 'USDT',
    }),
    25,
    500
  ));

  // Test 4: Mixed operations - Realistic load
  console.log('\n🔄 Mixed Operations Test (simulating real traffic)...');
  const mixedStart = Date.now();
  const mixedResults: boolean[] = [];
  
  for (let i = 0; i < 200; i++) {
    const rand = Math.random();
    let result: { success: boolean; time: number };
    
    if (rand < 0.4) {
      // 40% balance checks
      result = await makeRequest('/balance', { userId: testUserId, currency: 'USDT' });
    } else if (rand < 0.7) {
      // 30% bets
      result = await makeRequest('/transaction', {
        userId: testUserId,
        amount: 0.01,
        type: 'BET',
        gameId: 'mixed-test',
        transactionId: `mixed-${Date.now()}-${i}`,
        currency: 'USDT',
      });
    } else if (rand < 0.95) {
      // 25% wins
      result = await makeRequest('/transaction', {
        userId: testUserId,
        amount: 0.01,
        type: 'WIN',
        gameId: 'mixed-test',
        transactionId: `mixed-win-${Date.now()}-${i}`,
        currency: 'USDT',
      });
    } else {
      // 5% health checks
      result = await makeRequest('/health', {});
    }
    
    mixedResults.push(result.success);
  }
  
  const mixedTime = Date.now() - mixedStart;
  const mixedSuccess = mixedResults.filter(r => r).length;
  console.log(`   ✅ Mixed Test: ${mixedSuccess}/200 (${((mixedSuccess/200)*100).toFixed(1)}%)`);
  console.log(`   ⏱️  Total Time: ${mixedTime}ms`);
  console.log(`   📊 RPS: ${((200 / mixedTime) * 1000).toFixed(2)}`);

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  console.log('\n┌─────────────────────┬──────────┬──────────┬──────────┬──────────┐');
  console.log('│ Test                │ Success  │ Fail     │ Avg(ms)  │ RPS      │');
  console.log('├─────────────────────┼──────────┼──────────┼──────────┼──────────┤');
  
  for (const r of results) {
    const name = r.endpoint.padEnd(19);
    const success = r.successCount.toString().padStart(8);
    const fail = r.failCount.toString().padStart(8);
    const avg = r.avgResponseTime.toFixed(1).padStart(8);
    const rps = r.requestsPerSecond.toFixed(1).padStart(8);
    console.log(`│ ${name} │ ${success} │ ${fail} │ ${avg} │ ${rps} │`);
  }
  
  console.log('└─────────────────────┴──────────┴──────────┴──────────┴──────────┘');

  // Overall assessment
  const totalSuccess = results.reduce((a, r) => a + r.successCount, 0);
  const totalRequests = results.reduce((a, r) => a + r.totalRequests, 0);
  const overallSuccessRate = (totalSuccess / totalRequests) * 100;

  console.log(`\n📈 Overall Success Rate: ${overallSuccessRate.toFixed(2)}%`);
  
  if (overallSuccessRate >= 99) {
    console.log('🏆 EXCELLENT - API is production ready!');
  } else if (overallSuccessRate >= 95) {
    console.log('✅ GOOD - API is stable with minor issues');
  } else if (overallSuccessRate >= 90) {
    console.log('⚠️  WARNING - API needs optimization');
  } else {
    console.log('❌ CRITICAL - API has serious issues');
  }
}

main().catch(console.error);
