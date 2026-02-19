import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";

const DAILY_PRIZES: Record<number, number> = { 1: 500, 2: 250, 3: 125, 4: 75, 5: 50, 6: 40, 7: 30, 8: 20, 9: 15, 10: 10 };
const WEEKLY_PRIZES: Record<number, number> = { 1: 2000, 2: 1000, 3: 500, 4: 300, 5: 200, 6: 150, 7: 100, 8: 75, 9: 50, 10: 25 };
const MONTHLY_PRIZES: Record<number, number> = { 1: 5000, 2: 2500, 3: 1500, 4: 1000, 5: 750, 6: 500, 7: 350, 8: 200, 9: 150, 10: 100 };

export interface LeaderboardEntry { rank: number; userId: string; username: string; wagered: string; prize: number; }

@Injectable()
export class RaceService {
  private readonly logger = new Logger(RaceService.name);
  constructor(private readonly prisma: PrismaService) {}

  private async getLeaderboard(since: Date, prizes: Record<number, number>, limit = 10): Promise<LeaderboardEntry[]> {
    const topWagerers = await this.prisma.bet.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since }, user: { isBot: false, status: "ACTIVE" } },
      _sum: { betAmount: true },
      orderBy: { _sum: { betAmount: "desc" } },
      take: limit,
    });
    const entries: LeaderboardEntry[] = [];
    for (let i = 0; i < topWagerers.length; i++) {
      const entry = topWagerers[i];
      const user = await this.prisma.user.findUnique({ where: { id: entry.userId }, select: { username: true } });
      const rank = i + 1;
      entries.push({
        rank,
        userId: entry.userId,
        username: user?.username || "Unknown",
        wagered: (entry._sum.betAmount || new Decimal(0)).toString(),
        prize: prizes[rank] || 0,
      });
    }
    return entries;
  }

  private async payoutPrizes(entries: LeaderboardEntry[], raceType: string): Promise<number> {
    let totalPaid = 0;
    for (const entry of entries) {
      if (entry.prize <= 0) continue;
      try {
        let wallet = await this.prisma.wallet.findFirst({ where: { userId: entry.userId, currency: "USDT" } });
        if (!wallet) wallet = await this.prisma.wallet.create({ data: { userId: entry.userId, currency: "USDT", balance: 0, lockedBalance: 0 } });
        const prizeAmount = new Decimal(entry.prize);
        const balanceBefore = wallet.balance;
        const balanceAfter = new Decimal(balanceBefore).plus(prizeAmount);
        await this.prisma.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter } });
        await this.prisma.transaction.create({
          data: {
            userId: entry.userId,
            walletId: wallet.id,
            type: "RACE_PRIZE" as any,
            status: "CONFIRMED",
            amount: prizeAmount,
            balanceBefore,
            balanceAfter,
            metadata: { raceType, rank: entry.rank, wagered: entry.wagered },
          },
        });
        totalPaid += entry.prize;
      } catch (err) { this.logger.error(`Failed to pay ${raceType} prize: ${err.message}`); }
    }
    return totalPaid;
  }

  @Cron("0 0 * * *") async handleDailyRaceReset() {
    const entries = await this.getDailyLeaderboard();
    await this.payoutPrizes(entries, "DAILY");
  }

  @Cron("0 0 * * 1") async handleWeeklyRaceReset() {
    const entries = await this.getWeeklyLeaderboard();
    await this.payoutPrizes(entries, "WEEKLY");
  }

  @Cron("0 0 1 * *") async handleMonthlyRaceReset() {
    const entries = await this.getMonthlyLeaderboard();
    await this.payoutPrizes(entries, "MONTHLY");
  }

  async getDailyLeaderboard() { return this.getLeaderboard(new Date(Date.now() - 24 * 60 * 60 * 1000), DAILY_PRIZES); }
  async getWeeklyLeaderboard() { return this.getLeaderboard(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), WEEKLY_PRIZES); }
  async getMonthlyLeaderboard() { return this.getLeaderboard(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), MONTHLY_PRIZES); }
  getPrizeConfig() { return { daily: DAILY_PRIZES, weekly: WEEKLY_PRIZES, monthly: MONTHLY_PRIZES }; }
}
