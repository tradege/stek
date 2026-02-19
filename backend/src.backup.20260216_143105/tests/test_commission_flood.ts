/**
 * Commission Flood Test
 * ======================
 * 
 * Stress-tests the Commission Queue with 10,000 jobs injected instantly.
 * Measures throughput (Jobs Per Second) and verifies no jobs fail.
 * 
 * Expected Results:
 * - All 10,000 jobs processed
 * - 0 failed jobs
 * - > 1,000 JPS (Jobs Per Second)
 * 
 * Usage:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs"}' src/tests/test_commission_flood.ts
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

// ============================================
// CONFIGURATION
// ============================================

const REDIS_CONFIG = {
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
};

const COMMISSION_QUEUE = 'commissions_flood_test';
const TOTAL_JOBS = 10000;
const TOTAL_USERS = 5000;
const TOTAL_AGENTS = 50;
const CONCURRENCY = 100;  // Process 100 jobs in parallel

// ============================================
// TYPES
// ============================================

interface User {
  id: string;
  role: 'ADMIN' | 'SUPER_MASTER' | 'MASTER' | 'AGENT' | 'PLAYER';
  hierarchyPath: string;
  turnoverRate: number;
  ggrRate: number;
}

interface CommissionJobData {
  betId: string;
  playerId: string;
  playerHierarchyPath: string;
  betAmount: number;
  payoutAmount: number;
  currency: string;
  gameType: string;
  timestamp: Date;
}

// ============================================
// MOCK DATA GENERATION
// ============================================

const users: Map<string, User> = new Map();
const processedJobs: Set<string> = new Set();
let totalCommissionsDistributed = 0;

function generateHierarchy(): void {
  // Create Admin
  users.set('admin_001', {
    id: 'admin_001',
    role: 'ADMIN',
    hierarchyPath: '/admin_001',
    turnoverRate: 0.5,
    ggrRate: 2,
  });

  // Create Super Masters
  for (let i = 1; i <= 5; i++) {
    users.set(`super_${i}`, {
      id: `super_${i}`,
      role: 'SUPER_MASTER',
      hierarchyPath: `/admin_001/super_${i}`,
      turnoverRate: 1,
      ggrRate: 5,
    });
  }

  // Create Agents (50 total, distributed among Super Masters)
  for (let i = 1; i <= TOTAL_AGENTS; i++) {
    const superMaster = Math.ceil(i / 10);  // 10 agents per super
    users.set(`agent_${i}`, {
      id: `agent_${i}`,
      role: 'AGENT',
      hierarchyPath: `/admin_001/super_${superMaster}/agent_${i}`,
      turnoverRate: 3,
      ggrRate: 15,
    });
  }

  // Create Players (5000 total, randomly assigned to agents)
  for (let i = 1; i <= TOTAL_USERS; i++) {
    const agent = Math.ceil(Math.random() * TOTAL_AGENTS);
    const superMaster = Math.ceil(agent / 10);
    users.set(`player_${i}`, {
      id: `player_${i}`,
      role: 'PLAYER',
      hierarchyPath: `/admin_001/super_${superMaster}/agent_${agent}/player_${i}`,
      turnoverRate: 0,
      ggrRate: 0,
    });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function parseHierarchyPath(path: string): string[] {
  if (!path || path === '/') return [];
  const parts = path.split('/').filter(Boolean);
  return parts.slice(0, -1);
}

function calculateCommissions(ancestorIds: string[], betAmount: number, payoutAmount: number): number {
  let total = 0;
  const houseProfit = betAmount - payoutAmount;

  for (const id of ancestorIds) {
    const user = users.get(id);
    if (user && user.role !== 'PLAYER') {
      const turnover = (betAmount * user.turnoverRate) / 100;
      const ggr = houseProfit > 0 ? (houseProfit * user.ggrRate) / 100 : 0;
      total += turnover + ggr;
    }
  }

  return total;
}

// ============================================
// MAIN TEST
// ============================================

async function runFloodTest() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           🌊 COMMISSION FLOOD TEST                           ║');
  console.log('║              10,000 Jobs Stress Test                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  // ============================================
  // STEP 1: Generate Hierarchy
  // ============================================
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  📋 STEP 1: Generating chaotic hierarchy');
  console.log('  ─────────────────────────────────────────────────────────────');

  generateHierarchy();

  console.log(`  ✅ Created ${users.size} users:`);
  console.log(`     - 1 Admin`);
  console.log(`     - 5 Super Masters`);
  console.log(`     - ${TOTAL_AGENTS} Agents`);
  console.log(`     - ${TOTAL_USERS} Players (randomly assigned)`);
  console.log();

  // ============================================
  // STEP 2: Initialize BullMQ
  // ============================================
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  📋 STEP 2: Initializing BullMQ with high concurrency');
  console.log('  ─────────────────────────────────────────────────────────────');

  const connection = new Redis(REDIS_CONFIG);
  
  // Clean up any previous test data
  await connection.flushdb();
  
  const commissionQueue = new Queue(COMMISSION_QUEUE, { connection });
  const queueEvents = new QueueEvents(COMMISSION_QUEUE, { connection });
  
  console.log(`  ✅ Queue "${COMMISSION_QUEUE}" created`);
  console.log(`  ✅ Concurrency: ${CONCURRENCY} parallel workers`);
  console.log();

  // Track statistics
  let completedJobs = 0;
  let failedJobs = 0;

  // Create high-concurrency worker
  const worker = new Worker(
    COMMISSION_QUEUE,
    async (job: Job<CommissionJobData>) => {
      const { betId, playerId, playerHierarchyPath, betAmount, payoutAmount } = job.data;

      // Parse hierarchy and calculate commissions
      const ancestorIds = parseHierarchyPath(playerHierarchyPath);
      const commissions = calculateCommissions(ancestorIds, betAmount, payoutAmount);

      // Track processed
      processedJobs.add(betId);
      totalCommissionsDistributed += commissions;

      return { success: true, commissions };
    },
    { 
      connection,
      concurrency: CONCURRENCY,  // Process 100 jobs in parallel
    }
  );

  worker.on('completed', () => {
    completedJobs++;
  });

  worker.on('failed', () => {
    failedJobs++;
  });

  console.log('  ✅ Worker started with concurrency:', CONCURRENCY);
  console.log();

  // ============================================
  // STEP 3: Inject 10,000 Jobs
  // ============================================
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  📋 STEP 3: Injecting 10,000 jobs instantly');
  console.log('  ─────────────────────────────────────────────────────────────');

  const playerIds = Array.from(users.entries())
    .filter(([_, u]) => u.role === 'PLAYER')
    .map(([id, _]) => id);

  const jobs: { name: string; data: CommissionJobData }[] = [];

  for (let i = 0; i < TOTAL_JOBS; i++) {
    const playerId = playerIds[Math.floor(Math.random() * playerIds.length)];
    const player = users.get(playerId)!;
    const betAmount = Math.floor(Math.random() * 100) + 10;  // $10-$110
    const isWin = Math.random() > 0.6;  // 40% win rate
    const payoutAmount = isWin ? betAmount * (1 + Math.random() * 2) : 0;

    jobs.push({
      name: 'process-commission',
      data: {
        betId: `bet_${i}_${Date.now()}`,
        playerId,
        playerHierarchyPath: player.hierarchyPath,
        betAmount,
        payoutAmount,
        currency: 'USD',
        gameType: 'CRASH',
        timestamp: new Date(),
      },
    });
  }

  console.log(`  📤 Prepared ${TOTAL_JOBS} jobs`);
  console.log('  🚀 Injecting all jobs NOW...');

  const injectStart = Date.now();
  
  // Bulk add all jobs at once
  await commissionQueue.addBulk(jobs);
  
  const injectTime = Date.now() - injectStart;
  console.log(`  ✅ All ${TOTAL_JOBS} jobs injected in ${injectTime}ms`);
  console.log(`  📊 Injection Rate: ${Math.round(TOTAL_JOBS / (injectTime / 1000))} jobs/sec`);
  console.log();

  // ============================================
  // STEP 4: Wait for Queue to Drain
  // ============================================
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  📋 STEP 4: Processing jobs (waiting for queue to drain)');
  console.log('  ─────────────────────────────────────────────────────────────');

  const processStart = Date.now();
  let lastProgress = 0;

  // Wait for all jobs to complete
  await new Promise<void>((resolve) => {
    const checkInterval = setInterval(async () => {
      const waiting = await commissionQueue.getWaitingCount();
      const active = await commissionQueue.getActiveCount();
      const total = waiting + active;

      // Progress update every 10%
      const progress = Math.floor((completedJobs / TOTAL_JOBS) * 100);
      if (progress >= lastProgress + 10) {
        const elapsed = (Date.now() - processStart) / 1000;
        const jps = Math.round(completedJobs / elapsed);
        console.log(`  ⏳ Progress: ${progress}% (${completedJobs}/${TOTAL_JOBS}) - ${jps} JPS`);
        lastProgress = progress;
      }

      if (completedJobs + failedJobs >= TOTAL_JOBS) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);
  });

  const processTime = Date.now() - processStart;
  const totalTime = injectTime + processTime;

  // ============================================
  // STEP 5: Results
  // ============================================
  console.log();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                       📊 FINAL RESULTS                        ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  const jps = Math.round(completedJobs / (processTime / 1000));

  console.log('  📈 PERFORMANCE METRICS:');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log(`    Total Jobs:           ${TOTAL_JOBS.toLocaleString()}`);
  console.log(`    Completed Jobs:       ${completedJobs.toLocaleString()}`);
  console.log(`    Failed Jobs:          ${failedJobs}`);
  console.log(`    Injection Time:       ${injectTime}ms`);
  console.log(`    Processing Time:      ${processTime}ms (${(processTime / 1000).toFixed(2)}s)`);
  console.log(`    Total Time:           ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
  console.log();
  console.log(`    ⚡ Jobs Per Second:    ${jps.toLocaleString()} JPS`);
  console.log(`    💰 Total Commissions:  $${totalCommissionsDistributed.toFixed(2)}`);
  console.log();

  console.log('  🧪 VALIDATION:');
  console.log('  ─────────────────────────────────────────────────────────────');

  const allProcessed = completedJobs === TOTAL_JOBS;
  const noFailures = failedJobs === 0;
  const fastEnough = jps >= 1000;

  console.log(`    ${allProcessed ? '✅' : '❌'} All jobs processed: ${completedJobs}/${TOTAL_JOBS}`);
  console.log(`    ${noFailures ? '✅' : '❌'} Zero failures: ${failedJobs} failed`);
  console.log(`    ${fastEnough ? '✅' : '⚠️'} Throughput >= 1000 JPS: ${jps} JPS`);
  console.log();

  // ============================================
  // FINAL VERDICT
  // ============================================
  console.log('═══════════════════════════════════════════════════════════════');

  const allPassed = allProcessed && noFailures && fastEnough;

  if (allPassed) {
    console.log('  🎉 STRESS TEST PASSED!');
    console.log(`     The system can handle ${jps.toLocaleString()} bets per second!`);
    console.log('     Commission queue is production-ready. 🚀');
  } else if (allProcessed && noFailures) {
    console.log('  ⚠️  STRESS TEST PASSED WITH WARNING');
    console.log(`     All jobs processed but throughput is ${jps} JPS (target: 1000+)`);
    console.log('     Consider increasing Redis resources or worker concurrency.');
  } else {
    console.log('  ❌ STRESS TEST FAILED!');
    console.log('     Review the errors above and optimize the worker.');
  }

  console.log('═══════════════════════════════════════════════════════════════');

  // Cleanup
  await worker.close();
  await commissionQueue.close();
  await queueEvents.close();
  await connection.quit();

  process.exit(allPassed ? 0 : 1);
}

// Run the test
runFloodTest().catch(console.error);
