/**
 * Commission Processor (Worker)
 * ==============================
 * 
 * BullMQ Worker that processes commission jobs asynchronously.
 * This runs in the background and doesn't block the game loop.
 * 
 * Key Features:
 * - Hierarchy Traversal using hierarchyPath
 * - Single DB query for all ancestor rates
 * - Atomic wallet updates
 * - Full audit trail
 */

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { COMMISSION_QUEUE } from './commission.module';
import { CommissionJobData, CommissionRate, CommissionPayout, CommissionService } from './commission.service';

// ============================================
// MOCK DATABASE (For Testing)
// Replace with actual Prisma/TypeORM in production
// ============================================

interface MockUser {
  id: string;
  role: 'ADMIN' | 'SUPER_MASTER' | 'MASTER' | 'AGENT' | 'PLAYER';
  hierarchyPath: string;
  turnoverRate: number;
  ggrRate: number;
  balance: number;
}

// In-memory mock database
export const mockUsers: Map<string, MockUser> = new Map();
export const mockTransactions: any[] = [];

// ============================================
// COMMISSION PROCESSOR
// ============================================

@Processor(COMMISSION_QUEUE)
export class CommissionProcessor extends WorkerHost {
  private readonly logger = new Logger(CommissionProcessor.name);

  constructor(private readonly commissionService: CommissionService) {
    super();
  }

  /**
   * Main job processor
   * Called by BullMQ when a job is picked up from the queue
   */
  async process(job: Job<CommissionJobData>): Promise<any> {
    const startTime = Date.now();
    const { betId, playerId, playerHierarchyPath, betAmount, payoutAmount, currency, gameType } = job.data;

    this.logger.log(`📥 Processing commission job ${job.id} for bet ${betId}`);
    this.logger.log(`   Player: ${playerId}, Bet: $${betAmount}, Payout: $${payoutAmount}`);

    try {
      // Step 1: Parse hierarchy path to get ancestor IDs
      const ancestorIds = this.commissionService.parseHierarchyPath(playerHierarchyPath);
      
      if (ancestorIds.length === 0) {
        this.logger.log(`   No ancestors found for player ${playerId}`);
        return { success: true, payouts: [] };
      }

      this.logger.log(`   Ancestors: ${ancestorIds.join(' -> ')}`);

      // Step 2: Fetch all ancestor commission rates in ONE query
      const ancestorRates = await this.fetchAncestorRates(ancestorIds);
      
      if (ancestorRates.length === 0) {
        this.logger.log(`   No commission rates configured for ancestors`);
        return { success: true, payouts: [] };
      }

      // Step 3: Calculate commission splits
      const payouts = this.commissionService.calculateCommissionSplits(
        ancestorRates,
        betAmount,
        payoutAmount,
      );

      // Fill in source info
      payouts.forEach(payout => {
        payout.sourcePlayerId = playerId;
        payout.sourceBetId = betId;
      });

      // Step 4: Execute atomic wallet updates
      for (const payout of payouts) {
        await this.creditCommission(payout, currency);
      }

      const duration = Date.now() - startTime;
      this.logger.log(`✅ Commission job ${job.id} completed in ${duration}ms`);
      this.logger.log(`   Distributed ${payouts.length} payouts totaling $${payouts.reduce((sum, p) => sum + p.totalCommission, 0).toFixed(2)}`);

      return {
        success: true,
        duration,
        payouts,
      };

    } catch (error) {
      this.logger.error(`❌ Commission job ${job.id} failed: ${error}`);
      throw error;  // BullMQ will retry based on job options
    }
  }

  /**
   * Fetch commission rates for all ancestors in ONE database query
   * Uses WHERE id IN (...) for efficiency
   */
  private async fetchAncestorRates(ancestorIds: string[]): Promise<CommissionRate[]> {
    // In production, this would be:
    // const users = await prisma.user.findMany({
    //   where: { id: { in: ancestorIds } },
    //   select: { id: true, role: true, turnoverRate: true, ggrRate: true }
    // });

    // Mock implementation
    const rates: CommissionRate[] = [];
    
    for (const id of ancestorIds) {
      const user = mockUsers.get(id);
      if (user && user.role !== 'PLAYER') {
        rates.push({
          userId: user.id,
          role: user.role as any,
          turnoverRate: user.turnoverRate,
          ggrRate: user.ggrRate,
        });
      }
    }

    return rates;
  }

  /**
   * Credit commission to a recipient's wallet
   * Uses atomic transaction for safety
   */
  private async creditCommission(payout: CommissionPayout, currency: string): Promise<void> {
    // In production, this would use WalletService:
    // await this.walletService.processTransaction(
    //   payout.recipientId,
    //   payout.totalCommission,
    //   'COMMISSION_REWARD',
    //   { betId: payout.sourceBetId, sourceUserId: payout.sourcePlayerId }
    // );

    // Mock implementation
    const user = mockUsers.get(payout.recipientId);
    if (user) {
      user.balance += payout.totalCommission;
      
      // Record transaction for audit
      mockTransactions.push({
        id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: payout.recipientId,
        type: 'COMMISSION_REWARD',
        amount: payout.totalCommission,
        currency,
        metadata: {
          betId: payout.sourceBetId,
          sourceUserId: payout.sourcePlayerId,
          turnoverCommission: payout.turnoverCommission,
          ggrCommission: payout.ggrCommission,
        },
        createdAt: new Date(),
      });

      this.logger.log(`   💰 ${payout.recipientRole} (${payout.recipientId}): +$${payout.totalCommission.toFixed(2)}`);
      this.logger.log(`      Turnover: $${payout.turnoverCommission.toFixed(2)}, GGR: $${payout.ggrCommission.toFixed(2)}`);
    }
  }

  // ============================================
  // WORKER EVENTS
  // ============================================

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Job ${job.id} is now active`);
  }
}
