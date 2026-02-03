/**
 * Commission Service
 * ===================
 * 
 * Producer service that queues commission jobs for async processing.
 * This service is called by CrashService when a bet is settled.
 * 
 * Key Responsibilities:
 * - Queue commission jobs to BullMQ
 * - Provide helper functions for commission calculations
 * - Manage commission rates and configurations
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { COMMISSION_QUEUE } from './commission.module';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface CommissionJobData {
  betId: string;
  playerId: string;
  playerHierarchyPath: string;  // e.g., "/admin/super/master/agent/player"
  betAmount: number;
  payoutAmount: number;
  currency: string;
  gameType: 'CRASH' | 'PLINKO' | 'MINES' | 'DICE';
  timestamp: Date;
}

export interface CommissionRate {
  userId: string;
  role: 'ADMIN' | 'SUPER_MASTER' | 'MASTER' | 'AGENT';
  turnoverRate: number;    // % of bet amount (0-100)
  ggrRate: number;         // % of house profit (0-100)
}

export interface CommissionPayout {
  recipientId: string;
  recipientRole: string;
  turnoverCommission: number;
  ggrCommission: number;
  totalCommission: number;
  sourcePlayerId: string;
  sourceBetId: string;
}

// ============================================
// COMMISSION SERVICE
// ============================================

@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);

  constructor(
    @InjectQueue(COMMISSION_QUEUE) private commissionQueue: Queue,
  ) {}

  /**
   * Queue a commission job for async processing
   * Called by CrashService when a bet is settled
   */
  async queueCommissionJob(data: CommissionJobData): Promise<string> {
    const job = await this.commissionQueue.add('process-commission', data, {
      priority: 1,  // High priority
      delay: 0,     // Process immediately
    });

    this.logger.log(`📤 Queued commission job ${job.id} for bet ${data.betId}`);
    return job.id!;
  }

  /**
   * Queue multiple commission jobs in bulk
   * Used for batch processing
   */
  async queueBulkCommissionJobs(jobs: CommissionJobData[]): Promise<string[]> {
    const bulkJobs = jobs.map(data => ({
      name: 'process-commission',
      data,
      opts: { priority: 1 },
    }));

    const results = await this.commissionQueue.addBulk(bulkJobs);
    const jobIds = results.map(job => job.id!);

    this.logger.log(`📤 Queued ${jobIds.length} commission jobs in bulk`);
    return jobIds;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.commissionQueue.getWaitingCount(),
      this.commissionQueue.getActiveCount(),
      this.commissionQueue.getCompletedCount(),
      this.commissionQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  /**
   * Parse hierarchy path to get ancestor IDs
   * Path format: "/admin_id/super_id/master_id/agent_id/player_id"
   * Returns: ["admin_id", "super_id", "master_id", "agent_id"] (excludes player)
   */
  parseHierarchyPath(path: string): string[] {
    if (!path || path === '/') return [];
    
    const parts = path.split('/').filter(Boolean);
    // Remove the last element (the player themselves)
    return parts.slice(0, -1);
  }

  /**
   * Calculate commission splits for all ancestors
   * This is the core calculation logic
   */
  calculateCommissionSplits(
    ancestorRates: CommissionRate[],
    betAmount: number,
    payoutAmount: number,
  ): CommissionPayout[] {
    const houseProfit = betAmount - payoutAmount;  // Negative if player won
    const payouts: CommissionPayout[] = [];

    for (const ancestor of ancestorRates) {
      // Turnover Commission: Always calculated on bet amount
      const turnoverCommission = (betAmount * ancestor.turnoverRate) / 100;

      // GGR Commission: Only if house made profit (player lost)
      let ggrCommission = 0;
      if (houseProfit > 0) {
        ggrCommission = (houseProfit * ancestor.ggrRate) / 100;
      }

      const totalCommission = turnoverCommission + ggrCommission;

      // Only add if there's something to pay
      if (totalCommission > 0) {
        payouts.push({
          recipientId: ancestor.userId,
          recipientRole: ancestor.role,
          turnoverCommission: Math.round(turnoverCommission * 100) / 100,
          ggrCommission: Math.round(ggrCommission * 100) / 100,
          totalCommission: Math.round(totalCommission * 100) / 100,
          sourcePlayerId: '',  // Will be filled by processor
          sourceBetId: '',     // Will be filled by processor
        });
      }
    }

    return payouts;
  }
}
