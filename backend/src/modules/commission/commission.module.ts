/**
 * Commission Module
 * ==================
 * 
 * This module handles the MLM (Multi-Level Marketing) commission system.
 * It uses BullMQ for asynchronous job processing to avoid blocking the game loop.
 * 
 * Architecture:
 * - Producer: CrashService pushes jobs to 'commissions_queue' when bets are settled
 * - Consumer: CommissionProcessor processes jobs and distributes commissions
 * 
 * Key Features:
 * - Hierarchy Traversal using hierarchyPath field
 * - Hybrid Commission Model (Turnover + GGR)
 * - Atomic Wallet Updates
 * - Full Audit Trail
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommissionService } from './commission.service';
import { CommissionProcessor } from './commission.processor';

// Queue name constant
export const COMMISSION_QUEUE = 'commissions_queue';

@Module({
  imports: [
    BullModule.registerQueue({
      name: COMMISSION_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 1000,  // Keep last 1000 completed jobs
        removeOnFail: 5000,      // Keep last 5000 failed jobs for debugging
      },
    }),
  ],
  providers: [CommissionService, CommissionProcessor],
  exports: [CommissionService],
})
export class CommissionModule {}
