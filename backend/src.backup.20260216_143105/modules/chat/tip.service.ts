import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

const MIN_TIP_AMOUNT = 0.01;

@Injectable()
export class TipService {
  private readonly logger = new Logger(TipService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Send a tip from one user to another
   */
  async sendTip(fromUserId: string, toUserId: string, amount: number, message?: string) {
    if (amount < MIN_TIP_AMOUNT) {
      throw new BadRequestException(`Minimum tip amount is $${MIN_TIP_AMOUNT}`);
    }

    if (fromUserId === toUserId) {
      throw new BadRequestException('Cannot tip yourself');
    }

    // Verify receiver exists
    const receiver = await this.prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true, username: true, status: true },
    });

    if (!receiver || receiver.status !== 'ACTIVE') {
      throw new NotFoundException('Recipient not found or inactive');
    }

    // Get sender info
    const sender = await this.prisma.user.findUnique({
      where: { id: fromUserId },
      select: { id: true, username: true },
    });

    if (!sender) {
      throw new NotFoundException('Sender not found');
    }

    // Get sender wallet
    const senderWallet = await this.prisma.wallet.findFirst({
      where: { userId: fromUserId, currency: 'USDT' },
    });

    if (!senderWallet || new Decimal(senderWallet.balance).lt(amount)) {
      throw new BadRequestException('Insufficient balance');
    }

    // Get or create receiver wallet
    let receiverWallet = await this.prisma.wallet.findFirst({
      where: { userId: toUserId, currency: 'USDT' },
    });

    if (!receiverWallet) {
      receiverWallet = await this.prisma.wallet.create({
        data: { userId: toUserId, currency: 'USDT', balance: 0, lockedBalance: 0 },
      });
    }

    const tipAmount = new Decimal(amount);
    const senderBalanceBefore = senderWallet.balance;
    const senderBalanceAfter = new Decimal(senderBalanceBefore).minus(tipAmount);
    const receiverBalanceBefore = receiverWallet.balance;
    const receiverBalanceAfter = new Decimal(receiverBalanceBefore).plus(tipAmount);

    // Execute in transaction
    const [tip] = await this.prisma.$transaction([
      // Create Tip record
      this.prisma.tip.create({
        data: {
          senderId: fromUserId,
          receiverId: toUserId,
          currency: 'USDT',
          amount: tipAmount,
          message: message || null,
        },
      }),
      // Debit sender
      this.prisma.wallet.update({
        where: { id: senderWallet.id },
        data: { balance: senderBalanceAfter },
      }),
      // Credit receiver
      this.prisma.wallet.update({
        where: { id: receiverWallet.id },
        data: { balance: receiverBalanceAfter },
      }),
      // Sender transaction
      this.prisma.transaction.create({
        data: {
          userId: fromUserId,
          walletId: senderWallet.id,
          type: 'TIP_SENT',
          status: 'CONFIRMED',
          amount: tipAmount,
          balanceBefore: senderBalanceBefore,
          balanceAfter: senderBalanceAfter,
          metadata: { toUserId, toUsername: receiver.username, message },
        },
      }),
      // Receiver transaction
      this.prisma.transaction.create({
        data: {
          userId: toUserId,
          walletId: receiverWallet.id,
          type: 'TIP_RECEIVED',
          status: 'CONFIRMED',
          amount: tipAmount,
          balanceBefore: receiverBalanceBefore,
          balanceAfter: receiverBalanceAfter,
          metadata: { fromUserId, fromUsername: sender.username, message },
        },
      }),
    ]);

    this.logger.log(`Tip: ${sender.username} -> ${receiver.username}: $${amount}`);

    return {
      tipId: tip.id,
      from: { userId: fromUserId, username: sender.username },
      to: { userId: toUserId, username: receiver.username },
      amount: amount.toString(),
      message: message || null,
    };
  }

  /**
   * Resolve username to userId for /tip @username command
   */
  async resolveUsername(username: string): Promise<string | null> {
    const cleaned = username.replace(/^@/, '');
    const user = await this.prisma.user.findUnique({
      where: { username: cleaned },
      select: { id: true },
    });
    return user?.id || null;
  }
}
