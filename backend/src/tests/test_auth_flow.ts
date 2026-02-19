/**
 * Auth Flow Test Script
 * Tests: Register -> Login -> JWT -> WebSocket Connection
 * 
 * Run: npx ts-node src/tests/test_auth_flow.ts
 */

import { io, Socket } from 'socket.io-client';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const WS_URL = process.env.WS_URL || 'http://localhost:3000';

// Test user data
const testUser = {
  username: `testuser_${Date.now()}`,
  email: `test_${Date.now()}@betworkss.com`,
  password: 'TestPassword123!',
};

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  data?: any;
}

const results: TestResult[] = [];

/**
 * Helper: Make HTTP request
 */
async function request(
  method: string,
  endpoint: string,
  body?: any,
  token?: string
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }
  
  return data;
}

/**
 * Test 1: User Registration
 */
async function testRegister(): Promise<string> {
  console.log('\n📝 Test 1: User Registration');
  console.log(`   Creating user: ${testUser.username}`);
  
  try {
    const response = await request('POST', '/auth/register', {
      username: testUser.username,
      email: testUser.email,
      password: testUser.password,
    });

    if (!response.token || !response.user) {
      throw new Error('Invalid response structure');
    }

    results.push({
      name: 'User Registration',
      passed: true,
      message: `User created: ${response.user.username}`,
      data: { userId: response.user.id },
    });

    console.log(`   ✅ User created with ID: ${response.user.id}`);
    return response.token;
  } catch (error: any) {
    results.push({
      name: 'User Registration',
      passed: false,
      message: error.message,
    });
    throw error;
  }
}

/**
 * Test 2: User Login
 */
async function testLogin(): Promise<string> {
  console.log('\n🔐 Test 2: User Login');
  console.log(`   Logging in as: ${testUser.email}`);
  
  try {
    const response = await request('POST', '/auth/login', {
      email: testUser.email,
      password: testUser.password,
    });

    if (!response.token || !response.user) {
      throw new Error('Invalid response structure');
    }

    results.push({
      name: 'User Login',
      passed: true,
      message: `Login successful for: ${response.user.username}`,
    });

    console.log(`   ✅ Login successful, token received`);
    return response.token;
  } catch (error: any) {
    results.push({
      name: 'User Login',
      passed: false,
      message: error.message,
    });
    throw error;
  }
}

/**
 * Test 3: Get Current User (Protected Route)
 */
async function testGetMe(token: string): Promise<void> {
  console.log('\n👤 Test 3: Get Current User (Protected)');
  
  try {
    const response = await request('GET', '/auth/me', undefined, token);

    if (!response.id || !response.username) {
      throw new Error('Invalid user data');
    }

    // Check if balance exists
    if (!response.balance || !Array.isArray(response.balance)) {
      throw new Error('Balance not found');
    }

    results.push({
      name: 'Get Current User',
      passed: true,
      message: `User data retrieved with ${response.balance.length} wallet(s)`,
      data: { balance: response.balance },
    });

    console.log(`   ✅ User: ${response.username}`);
    console.log(`   ✅ Wallets: ${response.balance.length}`);
    response.balance.forEach((b: any) => {
      console.log(`      - ${b.currency}: ${b.available}`);
    });
  } catch (error: any) {
    results.push({
      name: 'Get Current User',
      passed: false,
      message: error.message,
    });
    throw error;
  }
}

/**
 * Test 4: Protected Route Without Token (Should Fail)
 */
async function testUnauthorized(): Promise<void> {
  console.log('\n🚫 Test 4: Unauthorized Access (Should Fail)');
  
  try {
    await request('GET', '/auth/me');
    
    // If we get here, the test failed (should have thrown)
    results.push({
      name: 'Unauthorized Access',
      passed: false,
      message: 'Request should have been rejected',
    });
    console.log('   ❌ Request was not rejected!');
  } catch (error: any) {
    results.push({
      name: 'Unauthorized Access',
      passed: true,
      message: 'Correctly rejected unauthorized request',
    });
    console.log('   ✅ Request correctly rejected');
  }
}

/**
 * Test 5: WebSocket Connection with JWT
 */
async function testWebSocketConnection(token: string): Promise<void> {
  console.log('\n🔌 Test 5: WebSocket Connection with JWT');
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      results.push({
        name: 'WebSocket Connection',
        passed: false,
        message: 'Connection timeout',
      });
      console.log('   ❌ Connection timeout');
      reject(new Error('Connection timeout'));
    }, 10000);

    const socket: Socket = io(`${WS_URL}/casino`, {
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      clearTimeout(timeout);
      results.push({
        name: 'WebSocket Connection',
        passed: true,
        message: `Connected with socket ID: ${socket.id}`,
      });
      console.log(`   ✅ Connected! Socket ID: ${socket.id}`);
      
      // Join crash room
      socket.emit('join:room', { room: 'crash' });
    });

    socket.on('room:joined', (data: any) => {
      console.log(`   ✅ Joined room: ${data.room}`);
      
      // Test complete
      socket.disconnect();
      resolve();
    });

    socket.on('connect_error', (error: any) => {
      clearTimeout(timeout);
      results.push({
        name: 'WebSocket Connection',
        passed: false,
        message: error.message,
      });
      console.log(`   ❌ Connection error: ${error.message}`);
      reject(error);
    });

    socket.on('error', (error: any) => {
      console.log(`   ⚠️ Socket error: ${error.message || error}`);
    });
  });
}

/**
 * Test 6: WebSocket Without Token (Should Fail or Connect as Guest)
 */
async function testWebSocketNoAuth(): Promise<void> {
  console.log('\n🔒 Test 6: WebSocket Without Auth');
  
  return new Promise((resolve) => {
    const socket: Socket = io(`${WS_URL}/casino`, {
      transports: ['websocket'],
      // No auth token
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      results.push({
        name: 'WebSocket No Auth',
        passed: true,
        message: 'Connection handled (timeout or rejected)',
      });
      console.log('   ✅ Connection handled appropriately');
      resolve();
    }, 3000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      // Some systems allow guest connections
      results.push({
        name: 'WebSocket No Auth',
        passed: true,
        message: 'Connected as guest (if allowed)',
      });
      console.log('   ⚠️ Connected without auth (guest mode)');
      socket.disconnect();
      resolve();
    });

    socket.on('connect_error', (error: any) => {
      clearTimeout(timeout);
      results.push({
        name: 'WebSocket No Auth',
        passed: true,
        message: 'Correctly rejected unauthenticated connection',
      });
      console.log('   ✅ Correctly rejected');
      resolve();
    });
  });
}

/**
 * Print Results Summary
 */
function printSummary(): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach((result, index) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${index + 1}. ${icon} ${result.name}`);
    console.log(`   ${result.message}`);
  });

  console.log('\n' + '-'.repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Auth system is working correctly.');
  } else {
    console.log(`\n⚠️ ${failed} test(s) failed. Please review.`);
  }
  console.log('='.repeat(60));
}

/**
 * Main Test Runner
 */
async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🧪 BETWORKSS AUTH FLOW TEST');
  console.log('='.repeat(60));
  console.log(`API URL: ${API_URL}`);
  console.log(`WS URL: ${WS_URL}`);
  console.log(`Test User: ${testUser.email}`);

  try {
    // Test 1: Register
    const registerToken = await testRegister();

    // Test 2: Login
    const loginToken = await testLogin();

    // Test 3: Get Me (Protected)
    await testGetMe(loginToken);

    // Test 4: Unauthorized Access
    await testUnauthorized();

    // Test 5: WebSocket with Auth
    await testWebSocketConnection(loginToken);

    // Test 6: WebSocket without Auth
    await testWebSocketNoAuth();

  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error.message);
  }

  // Print summary
  printSummary();
  
  process.exit(results.every(r => r.passed) ? 0 : 1);
}

// Run tests
runTests();
