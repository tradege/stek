// @ts-nocheck
/**
 * ============================================
 * FRAUD DETECTION SERVICE - Per Brand
 * ============================================
 * Flags users with suspicious patterns:
 * - High win rate (>80% over 50+ bets)
 * - Rapid betting patterns
 * - Large withdrawal requests
 * - Unusual deposit-to-withdrawal ratios
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Scan all brands for suspicious activity
   * Runs every 15 minutes automatically
   */
  async scanAllBrands() {
    const sites = await this.prisma.siteConfiguration.findMany({
      where: { active: true },
      select: { id: true, brandName: true },
    });

    let totalAlerts = 0;
    for (const site of sites) {
      const alerts = await this.scanBrand(site.id);
      totalAlerts += alerts;
    }

    this.logger.log(`🔍 Fraud scan complete: ${totalAlerts} new alerts across ${sites.length} brands`);
    return { scanned: sites.length, newAlerts: totalAlerts };
  }

  /**
   * Scan a specific brand for fraud
   */
  async scanBrand(siteId: string): Promise<number> {
    let alertCount = 0;

    // 1. HIGH WIN RATE CHECK
    alertCount += await this.checkHighWinRate(siteId);

    // 2. RAPID BETTING CHECK
    alertCount += await this.checkRapidBetting(siteId);

    // 3. LARGE WITHDRAWAL CHECK
    alertCount += await this.checkLargeWithdrawals(siteId);

    // 4. DEPOSIT-TO-WITHDRAWAL RATIO
    alertCount += await this.checkDepositWithdrawalRatio(siteId);

    return alertCount;
  }

  /**
   * Check 1: Users with >80% win rate over 50+ bets
   */
  private async checkHighWinRate(siteId: string): Promise<number> {
    const MIN_BETS = 50;
    const WIN_RATE_THRESHOLD = 0.80;

    // Get users with enough bets in this brand
    const userBets = await this.prisma.bet.groupBy({
      by: ['userId'],
      where: { siteId, user: { isBot: false } },
      _count: true,
      having: { userId: { _count: { gte: MIN_BETS } } },
    });

    let alertCount = 0;

    for (const ub of userBets) {
      // Count wins
      const wins = await this.prisma.bet.count({
        where: { userId: ub.userId, siteId, isWin: true },
      });

      const winRate = wins / ub._count;

      if (winRate >= WIN_RATE_THRESHOLD) {
        // Check if alert already exists (avoid duplicates)
        const existing = await this.prisma.fraudAlert.findFirst({
          where: {
            userId: ub.userId,
            siteId,
            type: 'HIGH_WIN_RATE',
            status: { in: ['OPEN', 'REVIEWED'] },
          },
        });

        if (!existing) {
          await this.prisma.fraudAlert.create({
            data: {
              siteId,
              userId: ub.userId,
              type: 'HIGH_WIN_RATE',
              severity: winRate >= 0.90 ? 'CRITICAL' : 'HIGH',
              details: JSON.stringify({
                winRate: (winRate * 100).toFixed(1) + '%',
                totalBets: ub._count,
                wins,
                losses: ub._count - wins,
              }),
            },
          });
          alertCount++;
          this.logger.warn(`🚨 [${siteId}] HIGH_WIN_RATE alert: User ${ub.userId} - ${(winRate * 100).toFixed(1)}% over ${ub._count} bets`);
        }
      }
    }

    return alertCount;
  }

  /**
   * Check 2: Rapid betting (>100 bets in 1 hour)
   */
  private async checkRapidBetting(siteId: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const RAPID_THRESHOLD = 100;

    const rapidUsers = await this.prisma.bet.groupBy({
      by: ['userId'],
      where: { siteId, createdAt: { gte: oneHourAgo }, user: { isBot: false } },
      _count: true,
      having: { userId: { _count: { gte: RAPID_THRESHOLD } } },
    });

    let alertCount = 0;

    for (const ru of rapidUsers) {
      const existing = await this.prisma.fraudAlert.findFirst({
        where: {
          userId: ru.userId,
          siteId,
          type: 'RAPID_BETTING',
          createdAt: { gte: oneHourAgo },
        },
      });

      if (!existing) {
        await this.prisma.fraudAlert.create({
          data: {
            siteId,
            userId: ru.userId,
            type: 'RAPID_BETTING',
            severity: 'MEDIUM',
            details: JSON.stringify({ betsInLastHour: ru._count }),
          },
        });
        alertCount++;
      }
    }

    return alertCount;
  }

  /**
   * Check 3: Large withdrawal requests (>$5000)
   */
  private async checkLargeWithdrawals(siteId: string): Promise<number> {
    const LARGE_THRESHOLD = 5000;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const largeWithdrawals = await this.prisma.transaction.findMany({
      where: {
        siteId,
        type: 'WITHDRAWAL',
        amount: { gte: LARGE_THRESHOLD },
        createdAt: { gte: oneDayAgo },
        user: { isBot: false },
      },
      select: { userId: true, amount: true, id: true },
    });

    let alertCount = 0;

    for (const lw of largeWithdrawals) {
      const existing = await this.prisma.fraudAlert.findFirst({
        where: {
          userId: lw.userId,
          siteId,
          type: 'LARGE_WITHDRAWAL',
          details: JSON.stringify({ path: ['transactionId'], equals: lw.id }),
        },
      });

      if (!existing) {
        await this.prisma.fraudAlert.create({
          data: {
            siteId,
            userId: lw.userId,
            type: 'LARGE_WITHDRAWAL',
            severity: Number(lw.amount) >= 10000 ? 'HIGH' : 'MEDIUM',
            details: JSON.stringify({ amount: Number(lw.amount), transactionId: lw.id }),
          },
        });
        alertCount++;
      }
    }

    return alertCount;
  }

  /**
   * Check 4: Suspicious deposit-to-withdrawal ratio
   * Users who withdraw much more than they deposit
   */
  private async checkDepositWithdrawalRatio(siteId: string): Promise<number> {
    const RATIO_THRESHOLD = 3; // Withdrawals > 3x deposits

    // Get all real users for this brand
    const users = await this.prisma.user.findMany({
      where: { siteId, isBot: false },
      select: { id: true },
    });

    let alertCount = 0;

    for (const user of users) {
      const [deposits, withdrawals] = await Promise.all([
        this.prisma.transaction.aggregate({
          where: { userId: user.id, siteId, type: 'DEPOSIT', status: 'CONFIRMED' },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: { userId: user.id, siteId, type: 'WITHDRAWAL', status: 'CONFIRMED' },
          _sum: { amount: true },
        }),
      ]);

      const totalDeposits = Number(deposits._sum.amount || 0);
      const totalWithdrawals = Number(withdrawals._sum.amount || 0);

      if (totalDeposits > 0 && totalWithdrawals / totalDeposits > RATIO_THRESHOLD) {
        const existing = await this.prisma.fraudAlert.findFirst({
          where: {
            userId: user.id,
            siteId,
            type: 'SUSPICIOUS_RATIO',
            status: { in: ['OPEN', 'REVIEWED'] },
          },
        });

        if (!existing) {
          await this.prisma.fraudAlert.create({
            data: {
              siteId,
              userId: user.id,
              type: 'SUSPICIOUS_RATIO',
              severity: 'HIGH',
              details: JSON.stringify({
                totalDeposits,
                totalWithdrawals,
                ratio: (totalWithdrawals / totalDeposits).toFixed(2),
              }),
            },
          });
          alertCount++;
        }
      }
    }

    return alertCount;
  }

  // ============================================
  // ADMIN API METHODS
  // ============================================

  /**
   * Get all fraud alerts for a brand
   */
  async getAlerts(siteId: string, status?: string, limit = 50) {
    const where: any = {};
    if (siteId && siteId !== 'ALL') where.siteId = siteId;
    if (status) where.status = status;

    const alerts = await this.prisma.fraudAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, username: true, email: true, siteId: true } },
        // site relation removed - not in schema
      },
    });

    const stats = await this.prisma.fraudAlert.groupBy({
      by: ['severity'],
      where: siteId && siteId !== 'ALL' ? { siteId } : {},
      _count: true,
    });

    return {
      alerts,
      stats: {
        total: alerts.length,
        bySeverity: Object.fromEntries(stats.map(s => [s.severity, s._count])),
      },
    };
  }

  /**
   * Update alert status (review, dismiss, confirm)
   */
  async updateAlertStatus(alertId: string, status: string, resolvedBy: string) {
    return this.prisma.fraudAlert.update({
      where: { id: alertId },
      data: {
        status,
        resolvedBy: resolvedBy,
        resolvedAt: new Date(), resolved: status === 'RESOLVED',
      },
    });
  }

  /**
   * Get fraud summary per brand
   */
  async getFraudSummary(siteId?: string) {
    const where = siteId && siteId !== 'ALL' ? { siteId } : {};

    const [total, open, byType, bySeverity] = await Promise.all([
      this.prisma.fraudAlert.count({ where }),
      this.prisma.fraudAlert.count({ where: { ...where, status: 'OPEN' } }),
      this.prisma.fraudAlert.groupBy({ by: ['type'], where, _count: true }),
      this.prisma.fraudAlert.groupBy({ by: ['severity'], where, _count: true }),
    ]);

    return {
      total,
      open,
      byType: Object.fromEntries(byType.map(t => [t.alertType, t._count])),
      bySeverity: Object.fromEntries(bySeverity.map(s => [s.severity, s._count])),
    };
  }
}
