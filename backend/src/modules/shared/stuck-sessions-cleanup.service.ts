import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * StuckSessionsCleanupService
 * 
 * Runs every hour to find and auto-close stuck game sessions.
 * 
 * Problem: In games like Mines, a player can start a game (money deducted),
 * then close the browser. The game stays "active" in memory forever,
 * and the money is stuck - not in the wallet, not settled.
 * 
 * Solution: This cron job detects games that have been active for too long
 * and refunds the bet amount to the player's wallet.
 * 
 * Note: Mines uses an in-memory Map (not DB), so we can't query the DB for stuck sessions.
 * Instead, we inject MinesService and access the activeGames map directly.
 * We also expose a cleanup method that MinesService can call.
 */

// We need to modify MinesService to export the activeGames map
// For now, we create a shared registry that MinesService will register with

export interface StuckGameInfo {
  gameId: string;
  userId: string;
  betAmount: number;
  currency: string;
  createdAt: number;
  gameName: string;
}

// Shared registry for active game sessions across all game modules
const gameSessionRegistries: Map<string, () => StuckGameInfo[]> = new Map();

/**
 * Register a game module's active sessions provider.
 * Call this from each game service (Mines, etc.) during initialization.
 */
export function registerGameSessionProvider(
  gameName: string,
  provider: () => StuckGameInfo[],
) {
  gameSessionRegistries.set(gameName, provider);
}

@Injectable()
export class StuckSessionsCleanupService {
  private readonly logger = new Logger(StuckSessionsCleanupService.name);

  // 24 hours in milliseconds
  private readonly MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

  constructor(private prisma: PrismaService) {}

  /**
   * Runs every hour to clean up stuck game sessions.
   * Refunds the bet amount to the player's wallet.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleStuckSessions() {
    this.logger.log('Running stuck sessions cleanup...');

    const now = Date.now();
    let totalCleaned = 0;
    let totalRefunded = 0;

    for (const [gameName, getActiveSessions] of gameSessionRegistries) {
      try {
        const sessions = getActiveSessions();
        const stuckSessions = sessions.filter(
          (s) => now - s.createdAt > this.MAX_SESSION_AGE_MS,
        );

        if (stuckSessions.length === 0) continue;

        this.logger.warn(
          `Found ${stuckSessions.length} stuck ${gameName} sessions to clean up`,
        );

        for (const session of stuckSessions) {
          try {
            await this.refundStuckSession(session);
            totalCleaned++;
            totalRefunded += session.betAmount;
            this.logger.log(
              `Auto-refunded stuck ${gameName} session for user ${session.userId}: $${session.betAmount}`,
            );
          } catch (error) {
            this.logger.error(
              `Failed to refund stuck session ${session.gameId}: ${error.message}`,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to process ${gameName} stuck sessions: ${error.message}`,
        );
      }
    }

    if (totalCleaned > 0) {
      this.logger.warn(
        `Stuck sessions cleanup complete: ${totalCleaned} sessions cleaned, $${totalRefunded.toFixed(2)} refunded`,
      );
    } else {
      this.logger.debug('No stuck sessions found');
    }
  }

  /**
   * Refund a stuck session's bet amount to the player's wallet.
   */
  private async refundStuckSession(session: StuckGameInfo): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Find the user's wallet
      const wallet = await tx.wallet.findFirst({
        where: {
          userId: session.userId,
          currency: session.currency as any,
        },
      });

      if (!wallet) {
        this.logger.warn(
          `No wallet found for user ${session.userId} (currency: ${session.currency}). Skipping refund.`,
        );
        return;
      }

      // Refund the bet amount
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: session.betAmount },
        },
      });

      // Log the refund as a transaction (optional but good for audit trail)
      this.logger.log(
        `Refunded $${session.betAmount} to user ${session.userId} wallet ${wallet.id} (stuck ${session.gameName} session ${session.gameId})`,
      );
    });
  }
}
