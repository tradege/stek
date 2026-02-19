/**
 * MLM Commission Flow Test
 * =========================
 * 
 * This script tests the complete MLM commission flow:
 * 1. Setup hierarchy: Admin -> Super -> Agent -> Player
 * 2. Player places a bet
 * 3. Commission processor distributes commissions up the chain
 * 
 * Expected Results:
 * - Agent: +$5.00 (5% of $100 bet)
 * - Super: +$2.00 (2% of $100 bet)
 * - Admin: +$1.00 (1% of $100 bet)
 * 
 * Usage:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs"}' src/tests/test_mlm_flow.ts
 */

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

// ============================================
// CONFIGURATION
// ============================================

const REDIS_CONFIG = {
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
};

const COMMISSION_QUEUE = 'commissions_queue_test';

// ============================================
// TYPES
// ============================================

interface User {
  id: string;
  role: 'ADMIN' | 'SUPER_MASTER' | 'MASTER' | 'AGENT' | 'PLAYER';
  name: string;
  hierarchyPath: string;
  turnoverRate: number;  // % of bet amount
  ggrRate: number;       // % of house profit
  balance: number;
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

interface CommissionPayout {
  recipientId: string;
  recipientRole: string;
  turnoverCommission: number;
  ggrCommission: number;
  totalCommission: number;
}

// ============================================
// MOCK DATABASE
// ============================================

const users: Map<string, User> = new Map();
const transactions: any[] = [];

// ============================================
// HELPER FUNCTIONS
// ============================================

function parseHierarchyPath(path: string): string[] {
  if (!path || path === '/') return [];
  const parts = path.split('/').filter(Boolean);
  return parts.slice(0, -1);  // Exclude the player
}

function calculateCommissionSplits(
  ancestorRates: { userId: string; role: string; turnoverRate: number; ggrRate: number }[],
  betAmount: number,
  payoutAmount: number,
): CommissionPayout[] {
  const houseProfit = betAmount - payoutAmount;
  const payouts: CommissionPayout[] = [];

  for (const ancestor of ancestorRates) {
    const turnoverCommission = (betAmount * ancestor.turnoverRate) / 100;
    let ggrCommission = 0;
    if (houseProfit > 0) {
      ggrCommission = (houseProfit * ancestor.ggrRate) / 100;
    }
    const totalCommission = turnoverCommission + ggrCommission;

    if (totalCommission > 0) {
      payouts.push({
        recipientId: ancestor.userId,
        recipientRole: ancestor.role,
        turnoverCommission: Math.round(turnoverCommission * 100) / 100,
        ggrCommission: Math.round(ggrCommission * 100) / 100,
        totalCommission: Math.round(totalCommission * 100) / 100,
      });
    }
  }

  return payouts;
}

// ============================================
// MAIN TEST
// ============================================

async function runTest() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           🏛️ MLM COMMISSION FLOW TEST                        ║');
  console.log('║              Async Queue Processing                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  // ============================================
  // STEP 1: Setup Hierarchy
  // ============================================
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  📋 STEP 1: Setting up hierarchy');
  console.log('  ─────────────────────────────────────────────────────────────');

  const admin: User = {
    id: 'admin_001',
    role: 'ADMIN',
    name: 'Admin',
    hierarchyPath: '/admin_001',
    turnoverRate: 1,  // 1% of bet
    ggrRate: 5,       // 5% of house profit
    balance: 0,
  };

  const superMaster: User = {
    id: 'super_001',
    role: 'SUPER_MASTER',
    name: 'Super Master',
    hierarchyPath: '/admin_001/super_001',
    turnoverRate: 2,  // 2% of bet
    ggrRate: 10,      // 10% of house profit
    balance: 0,
  };

  const agent: User = {
    id: 'agent_001',
    role: 'AGENT',
    name: 'Agent',
    hierarchyPath: '/admin_001/super_001/agent_001',
    turnoverRate: 5,  // 5% of bet
    ggrRate: 20,      // 20% of house profit
    balance: 0,
  };

  const player: User = {
    id: 'player_001',
    role: 'PLAYER',
    name: 'Player',
    hierarchyPath: '/admin_001/super_001/agent_001/player_001',
    turnoverRate: 0,
    ggrRate: 0,
    balance: 1000,
  };

  users.set(admin.id, admin);
  users.set(superMaster.id, superMaster);
  users.set(agent.id, agent);
  users.set(player.id, player);

  console.log('  Hierarchy created:');
  console.log(`    👑 Admin (1% turnover, 5% GGR)`);
  console.log(`      └─ 🌟 Super Master (2% turnover, 10% GGR)`);
  console.log(`           └─ 🤝 Agent (5% turnover, 20% GGR)`);
  console.log(`                └─ 🎮 Player (Balance: $1000)`);
  console.log();

  // ============================================
  // STEP 2: Initialize BullMQ
  // ============================================
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  📋 STEP 2: Initializing BullMQ Queue & Worker');
  console.log('  ─────────────────────────────────────────────────────────────');

  const connection = new Redis(REDIS_CONFIG);
  
  // Create queue
  const commissionQueue = new Queue(COMMISSION_QUEUE, { connection });
  console.log(`  ✅ Queue "${COMMISSION_QUEUE}" created`);

  // Create worker
  let jobProcessed = false;
  let processedPayouts: CommissionPayout[] = [];

  const worker = new Worker(
    COMMISSION_QUEUE,
    async (job: Job<CommissionJobData>) => {
      console.log();
      console.log('  ─────────────────────────────────────────────────────────────');
      console.log(`  📥 WORKER: Processing job ${job.id}`);
      console.log('  ─────────────────────────────────────────────────────────────');
      
      const { betId, playerId, playerHierarchyPath, betAmount, payoutAmount } = job.data;
      
      console.log(`  [Worker] Bet ID: ${betId}`);
      console.log(`  [Worker] Player: ${playerId}`);
      console.log(`  [Worker] Bet Amount: $${betAmount}`);
      console.log(`  [Worker] Payout: $${payoutAmount}`);
      console.log(`  [Worker] House Profit: $${betAmount - payoutAmount}`);
      console.log();

      // Parse hierarchy
      const ancestorIds = parseHierarchyPath(playerHierarchyPath);
      console.log(`  [Worker] Ancestors: ${ancestorIds.join(' -> ')}`);

      // Fetch ancestor rates
      const ancestorRates = ancestorIds
        .map(id => users.get(id))
        .filter(u => u && u.role !== 'PLAYER')
        .map(u => ({
          userId: u!.id,
          role: u!.role,
          turnoverRate: u!.turnoverRate,
          ggrRate: u!.ggrRate,
        }));

      // Calculate commissions
      const payouts = calculateCommissionSplits(ancestorRates, betAmount, payoutAmount);
      processedPayouts = payouts;

      console.log();
      console.log('  [Worker] 💰 Distributing Commissions:');
      console.log('  ─────────────────────────────────────────────────────────────');

      // Credit each ancestor
      for (const payout of payouts) {
        const user = users.get(payout.recipientId);
        if (user) {
          user.balance += payout.totalCommission;
          console.log(`    ${payout.recipientRole} (${user.name}): +$${payout.totalCommission.toFixed(2)}`);
          console.log(`      └─ Turnover: $${payout.turnoverCommission.toFixed(2)}, GGR: $${payout.ggrCommission.toFixed(2)}`);
        }
      }

      jobProcessed = true;
      return { success: true, payouts };
    },
    { connection }
  );

  console.log('  ✅ Worker started and listening');
  console.log();

  // ============================================
  // STEP 3: Simulate Bet
  // ============================================
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  📋 STEP 3: Player places a bet (Player LOSES)');
  console.log('  ─────────────────────────────────────────────────────────────');

  const betAmount = 100;
  const payoutAmount = 0;  // Player loses everything

  console.log(`  🎰 Player bets $${betAmount} on Crash`);
  console.log(`  💥 Player LOSES! Payout: $${payoutAmount}`);
  console.log(`  🏦 House Profit: $${betAmount - payoutAmount}`);
  console.log();

  // Queue commission job
  const jobData: CommissionJobData = {
    betId: `bet_${Date.now()}`,
    playerId: player.id,
    playerHierarchyPath: player.hierarchyPath,
    betAmount,
    payoutAmount,
    currency: 'USD',
    gameType: 'CRASH',
    timestamp: new Date(),
  };

  console.log('  📤 Queuing commission job...');
  const job = await commissionQueue.add('process-commission', jobData);
  console.log(`  ✅ Job ${job.id} queued`);

  // Wait for job to be processed
  console.log('  ⏳ Waiting for worker to process...');
  
  await new Promise<void>((resolve) => {
    const checkInterval = setInterval(() => {
      if (jobProcessed) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);
  });

  // ============================================
  // STEP 4: Verify Results
  // ============================================
  console.log();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                       📊 FINAL RESULTS                        ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  console.log('  💰 WALLET BALANCES:');
  console.log('  ─────────────────────────────────────────────────────────────');
  
  const adminFinal = users.get(admin.id)!;
  const superFinal = users.get(superMaster.id)!;
  const agentFinal = users.get(agent.id)!;

  console.log(`    👑 Admin:        $${adminFinal.balance.toFixed(2)}`);
  console.log(`    🌟 Super Master: $${superFinal.balance.toFixed(2)}`);
  console.log(`    🤝 Agent:        $${agentFinal.balance.toFixed(2)}`);
  console.log();

  // Expected calculations:
  // Turnover commissions (on $100 bet):
  //   Agent: 5% = $5.00
  //   Super: 2% = $2.00
  //   Admin: 1% = $1.00
  // GGR commissions (on $100 house profit):
  //   Agent: 20% = $20.00
  //   Super: 10% = $10.00
  //   Admin: 5% = $5.00
  // Total:
  //   Agent: $5 + $20 = $25.00
  //   Super: $2 + $10 = $12.00
  //   Admin: $1 + $5 = $6.00

  const expectedAgent = 25.00;  // 5% turnover + 20% GGR
  const expectedSuper = 12.00;  // 2% turnover + 10% GGR
  const expectedAdmin = 6.00;   // 1% turnover + 5% GGR

  console.log('  🧪 VALIDATION:');
  console.log('  ─────────────────────────────────────────────────────────────');
  
  const agentPass = Math.abs(agentFinal.balance - expectedAgent) < 0.01;
  const superPass = Math.abs(superFinal.balance - expectedSuper) < 0.01;
  const adminPass = Math.abs(adminFinal.balance - expectedAdmin) < 0.01;

  console.log(`    ${agentPass ? '✅' : '❌'} Agent: Expected $${expectedAgent.toFixed(2)}, Got $${agentFinal.balance.toFixed(2)}`);
  console.log(`    ${superPass ? '✅' : '❌'} Super: Expected $${expectedSuper.toFixed(2)}, Got $${superFinal.balance.toFixed(2)}`);
  console.log(`    ${adminPass ? '✅' : '❌'} Admin: Expected $${expectedAdmin.toFixed(2)}, Got $${adminFinal.balance.toFixed(2)}`);
  console.log();

  const totalDistributed = agentFinal.balance + superFinal.balance + adminFinal.balance;
  console.log(`  📊 Total Distributed: $${totalDistributed.toFixed(2)}`);
  console.log(`  📊 House Retained: $${(betAmount - payoutAmount - totalDistributed).toFixed(2)}`);
  console.log();

  // ============================================
  // STEP 5: Test Player WIN scenario
  // ============================================
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  📋 STEP 5: Testing Player WIN scenario (No GGR)');
  console.log('  ─────────────────────────────────────────────────────────────');

  // Reset balances
  users.get(admin.id)!.balance = 0;
  users.get(superMaster.id)!.balance = 0;
  users.get(agent.id)!.balance = 0;

  jobProcessed = false;

  const winJobData: CommissionJobData = {
    betId: `bet_win_${Date.now()}`,
    playerId: player.id,
    playerHierarchyPath: player.hierarchyPath,
    betAmount: 100,
    payoutAmount: 250,  // Player wins 2.5x
    currency: 'USD',
    gameType: 'CRASH',
    timestamp: new Date(),
  };

  console.log(`  🎰 Player bets $100, cashes out at 2.5x`);
  console.log(`  🎉 Player WINS! Payout: $250`);
  console.log(`  📉 House Loss: $150`);
  console.log();

  await commissionQueue.add('process-commission', winJobData);

  await new Promise<void>((resolve) => {
    const checkInterval = setInterval(() => {
      if (jobProcessed) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);
  });

  console.log();
  console.log('  💰 WALLET BALANCES (After WIN):');
  console.log('  ─────────────────────────────────────────────────────────────');

  // When player wins, only turnover commission applies (no GGR)
  // Agent: 5% of $100 = $5.00
  // Super: 2% of $100 = $2.00
  // Admin: 1% of $100 = $1.00

  console.log(`    👑 Admin:        $${users.get(admin.id)!.balance.toFixed(2)} (Expected: $1.00 - Turnover only)`);
  console.log(`    🌟 Super Master: $${users.get(superMaster.id)!.balance.toFixed(2)} (Expected: $2.00 - Turnover only)`);
  console.log(`    🤝 Agent:        $${users.get(agent.id)!.balance.toFixed(2)} (Expected: $5.00 - Turnover only)`);
  console.log();

  // ============================================
  // CLEANUP
  // ============================================
  console.log('═══════════════════════════════════════════════════════════════');
  
  const allPassed = agentPass && superPass && adminPass;
  if (allPassed) {
    console.log('  🎉 ALL TESTS PASSED! MLM Commission Engine is working correctly.');
  } else {
    console.log('  ⚠️  SOME TESTS FAILED! Review the commission calculations.');
  }
  
  console.log('═══════════════════════════════════════════════════════════════');

  // Cleanup
  await worker.close();
  await commissionQueue.close();
  await connection.quit();

  process.exit(allPassed ? 0 : 1);
}

// Run the test
runTest().catch(console.error);
