import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class RainService {
  private readonly logger = new Logger(RainService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Start a rain event - distributes amount equally among active users
   * Active users = users who wagered > $10 in last 60 minutes AND sent a chat message
   */
  async startRain(amount: number, numberOfPeople: number, creatorId: string) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');
    if (numberOfPeople <= 0) throw new BadRequestException('Number of people must be positive');

    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Find active users: wagered > $10 in last 60 min AND sent a chat message
    const activeWagerers = await this.prisma.bet.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: sixtyMinutesAgo },
        user: { isBot: false, status: 'ACTIVE' },
      },
      _sum: { betAmount: true },
      having: {
        betAmount: { _sum: { gte: 10 } },
      },
    });

    const wagererIds = activeWagerers.map((w) => w.userId);

    if (wagererIds.length === 0) {
      throw new BadRequestException('No active users found (wagered > $10 in last 60 min)');
    }

    // Filter to those who also sent a chat message in last 60 min
    const chatters = await this.prisma.chatMessage.findMany({
      where: {
        userId: { in: wagererIds },
        createdAt: { gte: sixtyMinutesAgo },
      },
      distinct: ['userId'],
      select: { userId: true },
    });

    let eligibleUserIds = chatters.map((c) => c.userId);

    if (eligibleUserIds.length === 0) {
      // Fallback: use wagerers even without chat messages
      this.logger.warn('No users with both wager + chat. Falling back to wagerers only.');
      eligibleUserIds = wagererIds;
    }

    // Randomly select up to numberOfPeople
    const shuffled = eligibleUserIds.sort(() => Math.random() - 0.5);
    const selectedUserIds = shuffled.slice(0, numberOfPeople);
    const amountPerUser = new Decimal(amount).div(selectedUserIds.length);

    // Create Rain record
    const rain = await this.prisma.rain.create({
      data: {
        creatorId,
        currency: 'USDT',
        totalAmount: new Decimal(amount),
        amountPerUser,
        maxParticipants: selectedUserIds.length,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min expiry
      },
    });

    // Credit each selected user
    const results: Array<{ userId: string; username: string; amount: string }> = [];

    for (const userId of selectedUserIds) {
      try {
        // Get or create USDT wallet
        let wallet = await this.prisma.wallet.findFirst({
          where: { userId, currency: 'USDT' },
        });

        if (!wallet) {
          wallet = await this.prisma.wallet.create({
            data: { userId, currency: 'USDT', balance: 0, lockedBalance: 0 },
          });
        }

        const balanceBefore = wallet.balance;
        const balanceAfter = new Decimal(balanceBefore).plus(amountPerUser);

        // Update wallet balance
        await this.prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: balanceAfter },
        });

        // Create transaction record
        await this.prisma.transaction.create({
          data: {
            userId,
            walletId: wallet.id,
            type: 'RAIN_RECEIVED',
            status: 'CONFIRMED',
            amount: amountPerUser,
            balanceBefore,
            balanceAfter,
            metadata: { rainId: rain.id, creatorId },
          },
        });

        // Create rain participant
        await this.prisma.rainParticipant.create({
          data: { rainId: rain.id, userId },
        });

        // Get username for response
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { username: true },
        });

        results.push({
          userId,
          username: user?.username || 'Unknown',
          amount: amountPerUser.toString(),
        });
      } catch (err) {
        this.logger.error(`Failed to credit rain to user ${userId}: ${err.message}`);
      }
    }

    this.logger.log(
      `Rain started: $${amount} split among ${results.length} users ($${amountPerUser} each)`,
    );

    return {
      rainId: rain.id,
      totalAmount: amount,
      amountPerUser: amountPerUser.toString(),
      participants: results,
      participantCount: results.length,
    };
  }
}
