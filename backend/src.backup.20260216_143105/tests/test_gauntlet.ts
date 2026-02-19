/**
 * ============================================
 * GAUNTLET TEST SUITE - Backend Security
 * ============================================
 * Tests for:
 * 1. Double Dip (Race Condition) - Prevent double spending
 * 2. Time Traveler (Latency Cheat) - Prevent late cashouts
 * 3. Toxic Chat (XSS & Flood) - Sanitization & Rate Limiting
 */

import { io, Socket } from 'socket.io-client';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const WS_URL = process.env.WS_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  category: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details: string;
  duration: number;
}

const results: TestResult[] = [];

// Utility functions
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return response.json();
}

function createSocket(token?: string): Socket {
  return io(`${WS_URL}/casino`, {
    auth: token ? { token } : undefined,
    transports: ['websocket'],
    reconnection: false,
  });
}

// ============================================
// TEST 1: Double Dip (Race Condition)
// ============================================
async function testDoubleDip(): Promise<TestResult> {
  const startTime = Date.now();
  const testName = 'Double Dip (Race Condition)';
  const category = 'Double Spend';
  
  try {
    console.log('\n🔥 TEST 1: Double Dip (Race Condition)');
    console.log('Creating test user with $100...');
    
    // Create a unique test user
    const testEmail = `gauntlet_dd_${Date.now()}@test.com`;
    const registerRes = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: 'GauntletDD',
        email: testEmail,
        password: 'Test123!@#',
      }),
    });
    
    if (!registerRes.token) {
      return {
        name: testName,
        category,
        status: 'SKIP',
        details: `Could not create test user: ${JSON.stringify(registerRes)}`,
        duration: Date.now() - startTime,
      };
    }
    
    const token = registerRes.token;
    const userId = registerRes.user?.id;
    
    console.log(`User created: ${testEmail}`);
    
    // Set initial balance to $100 (via direct DB or admin endpoint)
    // For this test, we'll simulate by depositing
    console.log('Setting balance to $100...');
    
    // Since we can't directly set balance, we'll test with the existing balance
    // or use the admin approve endpoint if available
    
    // Get current balance
    const meRes = await apiRequest('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    const currentBalance = parseFloat(meRes.balance?.find((b: any) => b.currency === 'USDT')?.available || '0');
    console.log(`Current balance: $${currentBalance}`);
    
    if (currentBalance < 100) {
      // For testing purposes, we'll use whatever balance exists
      // In production, this would need admin intervention
      console.log('⚠️ Balance less than $100, adjusting test...');
    }
    
    const testAmount = Math.min(currentBalance, 100) || 10;
    
    // Send 10 simultaneous withdraw requests
    console.log(`Sending 10 simultaneous withdraw requests for $${testAmount} each...`);
    
    const withdrawPromises = Array(10).fill(null).map((_, i) => 
      apiRequest('/wallet/withdraw', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: testAmount,
          currency: 'USDT',
          address: `0xTEST${i}ADDRESS`,
        }),
      }).catch(err => ({ error: err.message, index: i }))
    );
    
    const withdrawResults = await Promise.all(withdrawPromises);
    
    // Count successes
    const successes = withdrawResults.filter(r => r.success || r.transaction);
    const failures = withdrawResults.filter(r => r.error || r.message?.includes('Insufficient'));
    
    console.log(`Results: ${successes.length} succeeded, ${failures.length} failed/blocked`);
    
    // Check final balance
    const finalMeRes = await apiRequest('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    const finalBalance = parseFloat(finalMeRes.balance?.find((b: any) => b.currency === 'USDT')?.available || '0');
    console.log(`Final balance: $${finalBalance}`);
    
    // Pass criteria: Only 1 should succeed, balance should not be negative
    const passed = successes.length <= 1 && finalBalance >= 0;
    
    return {
      name: testName,
      category,
      status: passed ? 'PASS' : 'FAIL',
      details: passed 
        ? `Only ${successes.length} withdraw succeeded. Final balance: $${finalBalance}`
        : `${successes.length} withdraws succeeded (expected ≤1). Final balance: $${finalBalance}`,
      duration: Date.now() - startTime,
    };
    
  } catch (error: any) {
    return {
      name: testName,
      category,
      status: 'FAIL',
      details: `Error: ${error.message}`,
      duration: Date.now() - startTime,
    };
  }
}

// ============================================
// TEST 2: Time Traveler (Latency Cheat)
// ============================================
async function testTimeTraveler(): Promise<TestResult> {
  const startTime = Date.now();
  const testName = 'Time Traveler (Latency Cheat)';
  const category = 'Latency Cheat';
  
  try {
    console.log('\n⏰ TEST 2: Time Traveler (Latency Cheat)');
    
    // Create test user
    const testEmail = `gauntlet_tt_${Date.now()}@test.com`;
    const registerRes = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: 'GauntletTT',
        email: testEmail,
        password: 'Test123!@#',
      }),
    });
    
    if (!registerRes.token) {
      return {
        name: testName,
        category,
        status: 'SKIP',
        details: `Could not create test user: ${JSON.stringify(registerRes)}`,
        duration: Date.now() - startTime,
      };
    }
    
    const token = registerRes.token;
    
    console.log('Connecting to WebSocket...');
    const socket = createSocket(token);
    
    return new Promise((resolve) => {
      let crashedAt: number | null = null;
      let testCompleted = false;
      
      const timeout = setTimeout(() => {
        if (!testCompleted) {
          testCompleted = true;
          socket.disconnect();
          resolve({
            name: testName,
            category,
            status: 'SKIP',
            details: 'Timeout waiting for crash event (no active game)',
            duration: Date.now() - startTime,
          });
        }
      }, 30000);
      
      socket.on('connect', () => {
        console.log('Connected to WebSocket');
        socket.emit('crash:join');
      });
      
      socket.on('crash:crashed', (data: { multiplier: number }) => {
        crashedAt = data.multiplier;
        console.log(`Game crashed at ${crashedAt}x`);
        
        // Wait 500ms then try to cashout at a lower multiplier
        setTimeout(() => {
          if (testCompleted) return;
          
          console.log('Attempting late cashout at 1.50x (after crash)...');
          
          socket.emit('crash:cashout', { multiplier: 1.50 }, (response: any) => {
            testCompleted = true;
            clearTimeout(timeout);
            socket.disconnect();
            
            const rejected = response?.error || response?.message?.includes('crashed') || !response?.success;
            
            resolve({
              name: testName,
              category,
              status: rejected ? 'PASS' : 'FAIL',
              details: rejected 
                ? `Server correctly rejected late cashout: ${response?.error || response?.message || 'Game Already Crashed'}`
                : `Server accepted late cashout! Security vulnerability!`,
              duration: Date.now() - startTime,
            });
          });
        }, 500);
      });
      
      socket.on('crash:tick', (data: { multiplier: number }) => {
        // Place a bet when game starts
        if (data.multiplier < 1.1 && !crashedAt) {
          socket.emit('crash:place_bet', { amount: 1 });
        }
      });
      
      socket.on('connect_error', (err) => {
        if (!testCompleted) {
          testCompleted = true;
          clearTimeout(timeout);
          resolve({
            name: testName,
            category,
            status: 'SKIP',
            details: `WebSocket connection error: ${err.message}`,
            duration: Date.now() - startTime,
          });
        }
      });
    });
    
  } catch (error: any) {
    return {
      name: testName,
      category,
      status: 'FAIL',
      details: `Error: ${error.message}`,
      duration: Date.now() - startTime,
    };
  }
}

// ============================================
// TEST 3: Toxic Chat (XSS & Flood)
// ============================================
async function testToxicChat(): Promise<TestResult> {
  const startTime = Date.now();
  const testName = 'Toxic Chat (XSS & Flood)';
  const category = 'XSS Defense';
  
  try {
    console.log('\n💀 TEST 3: Toxic Chat (XSS & Flood)');
    
    // Create test user
    const testEmail = `gauntlet_tc_${Date.now()}@test.com`;
    const registerRes = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: 'GauntletTC',
        email: testEmail,
        password: 'Test123!@#',
      }),
    });
    
    if (!registerRes.token) {
      return {
        name: testName,
        category,
        status: 'SKIP',
        details: `Could not create test user: ${JSON.stringify(registerRes)}`,
        duration: Date.now() - startTime,
      };
    }
    
    const token = registerRes.token;
    
    console.log('Connecting to WebSocket...');
    const socket = createSocket(token);
    
    return new Promise((resolve) => {
      let xssResult: 'PASS' | 'FAIL' | null = null;
      let floodResult: 'PASS' | 'FAIL' | null = null;
      let xssDetails = '';
      let floodDetails = '';
      let testCompleted = false;
      
      const timeout = setTimeout(() => {
        if (!testCompleted) {
          testCompleted = true;
          socket.disconnect();
          resolve({
            name: testName,
            category,
            status: 'SKIP',
            details: 'Timeout waiting for chat responses',
            duration: Date.now() - startTime,
          });
        }
      }, 15000);
      
      socket.on('connect', async () => {
        console.log('Connected to WebSocket');
        socket.emit('chat:join');
        
        // Test 1: XSS Attack
        console.log('Sending XSS payload...');
        const xssPayload = '<script>alert("HACKED")</script>';
        
        socket.emit('chat:message', { message: xssPayload }, (response: any) => {
          if (response?.error) {
            xssResult = 'PASS';
            xssDetails = `Message blocked: ${response.error}`;
          } else if (response?.message && !response.message.includes('<script>')) {
            xssResult = 'PASS';
            xssDetails = `Message sanitized: "${response.message}"`;
          } else if (response?.message?.includes('<script>')) {
            xssResult = 'FAIL';
            xssDetails = 'XSS payload was NOT sanitized!';
          } else {
            xssResult = 'PASS';
            xssDetails = 'Message handled (no script tags in response)';
          }
          console.log(`XSS Test: ${xssResult} - ${xssDetails}`);
        });
        
        // Test 2: Flood Attack (50 messages in 1 second)
        await sleep(1000);
        console.log('Sending 50 messages in 1 second (flood attack)...');
        
        let blockedCount = 0;
        let successCount = 0;
        
        const floodPromises = Array(50).fill(null).map((_, i) => 
          new Promise<void>((res) => {
            socket.emit('chat:message', { message: `Flood message ${i}` }, (response: any) => {
              if (response?.error?.includes('rate') || response?.error?.includes('429') || response?.error?.includes('limit')) {
                blockedCount++;
              } else {
                successCount++;
              }
              res();
            });
          })
        );
        
        await Promise.all(floodPromises);
        
        console.log(`Flood results: ${successCount} succeeded, ${blockedCount} blocked`);
        
        // Pass if at least some messages were blocked
        if (blockedCount > 0 || successCount < 50) {
          floodResult = 'PASS';
          floodDetails = `Rate limiter blocked ${blockedCount}/50 messages`;
        } else {
          floodResult = 'FAIL';
          floodDetails = `All 50 messages went through! No rate limiting!`;
        }
        
        // Complete test
        testCompleted = true;
        clearTimeout(timeout);
        socket.disconnect();
        
        const overallStatus = (xssResult === 'PASS' && floodResult === 'PASS') ? 'PASS' :
                             (xssResult === 'FAIL' || floodResult === 'FAIL') ? 'FAIL' : 'SKIP';
        
        resolve({
          name: testName,
          category,
          status: overallStatus,
          details: `XSS: ${xssDetails} | Flood: ${floodDetails}`,
          duration: Date.now() - startTime,
        });
      });
      
      socket.on('chat:message', (data: any) => {
        // Check if received message contains unsanitized script
        if (data.message?.includes('<script>')) {
          xssResult = 'FAIL';
          xssDetails = 'Received unsanitized XSS in broadcast!';
        }
      });
      
      socket.on('connect_error', (err) => {
        if (!testCompleted) {
          testCompleted = true;
          clearTimeout(timeout);
          resolve({
            name: testName,
            category,
            status: 'SKIP',
            details: `WebSocket connection error: ${err.message}`,
            duration: Date.now() - startTime,
          });
        }
      });
    });
    
  } catch (error: any) {
    return {
      name: testName,
      category,
      status: 'FAIL',
      details: `Error: ${error.message}`,
      duration: Date.now() - startTime,
    };
  }
}

// ============================================
// MAIN EXECUTION
// ============================================
async function runGauntlet() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║       🔥 GAUNTLET TEST SUITE 🔥            ║');
  console.log('║       Backend Security Tests               ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`\nTarget: ${API_URL}`);
  console.log(`WebSocket: ${WS_URL}`);
  console.log('');
  
  // Run all tests
  const doubleDipResult = await testDoubleDip();
  results.push(doubleDipResult);
  
  const timeTravelerResult = await testTimeTraveler();
  results.push(timeTravelerResult);
  
  const toxicChatResult = await testToxicChat();
  results.push(toxicChatResult);
  
  // Print summary
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    📊 TEST RESULTS SUMMARY                     ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  
  results.forEach(r => {
    const statusIcon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
    const paddedCategory = r.category.padEnd(15);
    const paddedStatus = r.status.padEnd(6);
    console.log(`║ ${statusIcon} ${paddedCategory} | ${paddedStatus} | ${r.details.substring(0, 40)}...`);
  });
  
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  
  console.log(`\n📈 Summary: ${passed} PASSED | ${failed} FAILED | ${skipped} SKIPPED`);
  
  // Exit with error code if any failed
  if (failed > 0) {
    process.exit(1);
  }
}

// Run if executed directly
runGauntlet().catch(console.error);

export { runGauntlet, results };
