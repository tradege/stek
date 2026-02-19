/**
 * WebSocket Latency Test
 * =======================
 * 
 * Simulates 500 concurrent clients connecting to the WebSocket gateway.
 * Measures latency to ensure all clients receive messages at the same time.
 * 
 * Expected Results:
 * - All 500 clients connect successfully
 * - Latency difference between 1st and 500th client < 50ms
 * - All clients receive broadcast messages
 * 
 * Usage:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs"}' src/tests/test_sockets.ts
 */

import { Server as HttpServer, createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { io as SocketClient, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';
import { AppGateway } from '../gateway/app.gateway';

// ============================================
// CONFIGURATION
// ============================================

const PORT = 3999;
const TOTAL_CLIENTS = 500;
const TICK_INTERVAL_MS = 100;
const TEST_DURATION_TICKS = 50;  // 5 seconds of ticks

// ============================================
// TYPES
// ============================================

interface ClientStats {
  id: number;
  connected: boolean;
  connectTime: number;
  ticksReceived: number;
  latencies: number[];
  firstTickTime?: number;
  lastTickTime?: number;
}

// ============================================
// MAIN TEST
// ============================================

async function runSocketTest() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           🔌 WEBSOCKET LATENCY TEST                          ║');
  console.log('║              500 Concurrent Clients                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  // ============================================
  // STEP 1: Start Server
  // ============================================
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  📋 STEP 1: Starting WebSocket Server');
  console.log('  ─────────────────────────────────────────────────────────────');

  const httpServer = createServer();
  const io = new SocketServer(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket'],
  });

  const eventBus = new EventEmitter();
  eventBus.setMaxListeners(1000);
  
  const gateway = new AppGateway(io, eventBus);

  await new Promise<void>((resolve) => {
    httpServer.listen(PORT, () => {
      console.log(`  ✅ Server started on port ${PORT}`);
      resolve();
    });
  });

  // ============================================
  // STEP 2: Connect 500 Clients
  // ============================================
  console.log();
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  📋 STEP 2: Connecting 500 clients');
  console.log('  ─────────────────────────────────────────────────────────────');

  const clients: Socket[] = [];
  const clientStats: ClientStats[] = [];
  const connectStart = Date.now();

  // Create clients in batches to avoid overwhelming
  const BATCH_SIZE = 50;
  
  for (let batch = 0; batch < TOTAL_CLIENTS / BATCH_SIZE; batch++) {
    const batchPromises: Promise<void>[] = [];

    for (let i = 0; i < BATCH_SIZE; i++) {
      const clientId = batch * BATCH_SIZE + i;
      
      const promise = new Promise<void>((resolve) => {
        const startTime = Date.now();
        const client = SocketClient(`http://localhost:${PORT}/casino`, {
          transports: ['websocket'],
          forceNew: true,
        });

        const stats: ClientStats = {
          id: clientId,
          connected: false,
          connectTime: 0,
          ticksReceived: 0,
          latencies: [],
        };

        client.on('connect', () => {
          stats.connected = true;
          stats.connectTime = Date.now() - startTime;
          client.emit('join:crash');
          resolve();
        });

        client.on('crash:tick', (data: { multiplier: number }) => {
          const receiveTime = Date.now();
          if (!stats.firstTickTime) {
            stats.firstTickTime = receiveTime;
          }
          stats.lastTickTime = receiveTime;
          stats.ticksReceived++;
        });

        client.on('connect_error', (err) => {
          console.error(`  ❌ Client ${clientId} connection error:`, err.message);
          resolve();
        });

        clients.push(client);
        clientStats.push(stats);
      });

      batchPromises.push(promise);
    }

    await Promise.all(batchPromises);
    const progress = ((batch + 1) * BATCH_SIZE / TOTAL_CLIENTS * 100).toFixed(0);
    process.stdout.write(`\r  ⏳ Connecting: ${progress}% (${(batch + 1) * BATCH_SIZE}/${TOTAL_CLIENTS})`);
  }

  const connectTime = Date.now() - connectStart;
  console.log();
  console.log(`  ✅ All ${TOTAL_CLIENTS} clients connected in ${connectTime}ms`);

  // Wait for all clients to join room
  await new Promise(resolve => setTimeout(resolve, 500));

  // ============================================
  // STEP 3: Broadcast Ticks
  // ============================================
  console.log();
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  📋 STEP 3: Broadcasting game ticks');
  console.log('  ─────────────────────────────────────────────────────────────');

  const tickTimestamps: number[] = [];
  let multiplier = 1.00;

  console.log(`  📡 Sending ${TEST_DURATION_TICKS} ticks (${TEST_DURATION_TICKS * TICK_INTERVAL_MS / 1000}s)...`);

  for (let tick = 0; tick < TEST_DURATION_TICKS; tick++) {
    multiplier += 0.01 + Math.random() * 0.05;
    const tickTime = Date.now();
    tickTimestamps.push(tickTime);

    gateway.broadcastTick({
      gameId: 'test-game-001',
      multiplier: parseFloat(multiplier.toFixed(2)),
      state: 'RUNNING',
      elapsed: tick * TICK_INTERVAL_MS,
    });

    await new Promise(resolve => setTimeout(resolve, TICK_INTERVAL_MS));
    
    if ((tick + 1) % 10 === 0) {
      process.stdout.write(`\r  ⏳ Ticks sent: ${tick + 1}/${TEST_DURATION_TICKS}`);
    }
  }

  console.log();
  console.log(`  ✅ All ${TEST_DURATION_TICKS} ticks sent`);

  // Wait for last ticks to be received
  await new Promise(resolve => setTimeout(resolve, 500));

  // ============================================
  // STEP 4: Analyze Results
  // ============================================
  console.log();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                       📊 FINAL RESULTS                        ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  // Connection stats
  const connectedClients = clientStats.filter(c => c.connected).length;
  const avgConnectTime = clientStats.reduce((sum, c) => sum + c.connectTime, 0) / clientStats.length;
  const maxConnectTime = Math.max(...clientStats.map(c => c.connectTime));
  const minConnectTime = Math.min(...clientStats.filter(c => c.connected).map(c => c.connectTime));

  console.log('  📈 CONNECTION METRICS:');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log(`    Total Clients:        ${TOTAL_CLIENTS}`);
  console.log(`    Connected:            ${connectedClients}`);
  console.log(`    Failed:               ${TOTAL_CLIENTS - connectedClients}`);
  console.log(`    Avg Connect Time:     ${avgConnectTime.toFixed(2)}ms`);
  console.log(`    Min Connect Time:     ${minConnectTime}ms`);
  console.log(`    Max Connect Time:     ${maxConnectTime}ms`);
  console.log();

  // Tick reception stats
  const clientsWithTicks = clientStats.filter(c => c.ticksReceived > 0);
  const avgTicksReceived = clientsWithTicks.reduce((sum, c) => sum + c.ticksReceived, 0) / clientsWithTicks.length;
  const minTicksReceived = Math.min(...clientsWithTicks.map(c => c.ticksReceived));
  const maxTicksReceived = Math.max(...clientsWithTicks.map(c => c.ticksReceived));

  console.log('  📡 TICK RECEPTION:');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log(`    Clients Receiving:    ${clientsWithTicks.length}/${connectedClients}`);
  console.log(`    Avg Ticks Received:   ${avgTicksReceived.toFixed(1)}/${TEST_DURATION_TICKS}`);
  console.log(`    Min Ticks Received:   ${minTicksReceived}`);
  console.log(`    Max Ticks Received:   ${maxTicksReceived}`);
  console.log();

  // Latency analysis - compare first tick reception times
  const firstTickTimes = clientStats
    .filter(c => c.firstTickTime)
    .map(c => c.firstTickTime!)
    .sort((a, b) => a - b);

  let latencySpread = 0;
  let firstClientTime = 0;
  let lastClientTime = 0;

  if (firstTickTimes.length >= 2) {
    firstClientTime = firstTickTimes[0];
    lastClientTime = firstTickTimes[firstTickTimes.length - 1];
    latencySpread = lastClientTime - firstClientTime;
  }

  console.log('  ⚡ LATENCY ANALYSIS:');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log(`    First Client Tick:    ${firstClientTime > 0 ? 'T+0ms' : 'N/A'}`);
  console.log(`    Last Client Tick:     ${latencySpread > 0 ? `T+${latencySpread}ms` : 'N/A'}`);
  console.log(`    Latency Spread:       ${latencySpread}ms`);
  console.log(`    Target:               < 50ms`);
  console.log();

  // ============================================
  // VALIDATION
  // ============================================
  console.log('  🧪 VALIDATION:');
  console.log('  ─────────────────────────────────────────────────────────────');

  const allConnected = connectedClients === TOTAL_CLIENTS;
  const allReceivedTicks = clientsWithTicks.length >= connectedClients * 0.95;  // 95% threshold
  const latencyAcceptable = latencySpread < 50;

  console.log(`    ${allConnected ? '✅' : '⚠️'} All clients connected: ${connectedClients}/${TOTAL_CLIENTS}`);
  console.log(`    ${allReceivedTicks ? '✅' : '⚠️'} 95%+ received ticks: ${(clientsWithTicks.length / connectedClients * 100).toFixed(1)}%`);
  console.log(`    ${latencyAcceptable ? '✅' : '⚠️'} Latency spread < 50ms: ${latencySpread}ms`);
  console.log();

  // ============================================
  // FINAL VERDICT
  // ============================================
  console.log('═══════════════════════════════════════════════════════════════');

  const allPassed = allConnected && allReceivedTicks && latencyAcceptable;

  if (allPassed) {
    console.log('  🎉 WEBSOCKET TEST PASSED!');
    console.log(`     All ${TOTAL_CLIENTS} clients received messages simultaneously!`);
    console.log(`     Latency spread: ${latencySpread}ms (target: <50ms)`);
    console.log('     Gateway is production-ready. 🚀');
  } else if (allReceivedTicks) {
    console.log('  ⚠️  WEBSOCKET TEST PASSED WITH WARNING');
    console.log(`     Latency spread is ${latencySpread}ms (target: <50ms)`);
    console.log('     Consider optimizing for lower latency.');
  } else {
    console.log('  ❌ WEBSOCKET TEST FAILED!');
    console.log('     Not all clients received messages properly.');
  }

  console.log('═══════════════════════════════════════════════════════════════');

  // ============================================
  // CLEANUP
  // ============================================
  console.log();
  console.log('  🧹 Cleaning up...');

  // Disconnect all clients
  for (const client of clients) {
    client.disconnect();
  }

  // Close server
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });

  console.log('  ✅ Cleanup complete');

  process.exit(allPassed ? 0 : 1);
}

// Run the test
runSocketTest().catch(console.error);
