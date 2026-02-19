import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";

export interface TriviaRound {
  id: string;
  question: string;
  answer: string;
  prize: number;
  startedAt: Date;
  winnerId?: string;
  winnerUsername?: string;
}

@Injectable()
export class TriviaService {
  private readonly logger = new Logger(TriviaService.name);
  private activeRound: TriviaRound | null = null;

  constructor(private readonly prisma: PrismaService) {}

  startTrivia(question: string, answer: string, prize: number): TriviaRound {
    if (this.activeRound && !this.activeRound.winnerId) {
      throw new BadRequestException("A trivia round is already active");
    }

    if (prize <= 0) throw new BadRequestException("Prize must be positive");
    if (!question.trim()) throw new BadRequestException("Question is required");
    if (!answer.trim()) throw new BadRequestException("Answer is required");

    this.activeRound = {
      id: `trivia_${Date.now()}`,
      question: question.trim(),
      answer: answer.trim().toLowerCase(),
      prize,
      startedAt: new Date(),
    };

    return {
      ...this.activeRound,
      answer: "***",
    };
  }

  async checkAnswer(userId: string, username: string, message: string): Promise<TriviaRound | null> {
    if (!this.activeRound || this.activeRound.winnerId) {
      return null;
    }

    if (message.trim().toLowerCase() !== this.activeRound.answer) {
      return null;
    }

    this.activeRound.winnerId = userId;
    this.activeRound.winnerUsername = username;

    try {
      let wallet = await this.prisma.wallet.findFirst({
        where: { userId, currency: "USDT" },
      });

      if (!wallet) {
        wallet = await this.prisma.wallet.create({
          data: { userId, currency: "USDT", balance: 0, lockedBalance: 0 },
        });
      }

      const prizeAmount = new Decimal(this.activeRound.prize);
      const balanceBefore = wallet.balance;
      const balanceAfter = new Decimal(balanceBefore).plus(prizeAmount);

      await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      await this.prisma.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: "TRIVIA" as any,
          status: "CONFIRMED",
          amount: prizeAmount,
          balanceBefore,
          balanceAfter,
          metadata: {
            triviaId: this.activeRound.id,
            question: this.activeRound.question,
          },
        },
      });
    } catch (err) {
      this.logger.error(`Failed to credit trivia prize: ${err.message}`);
    }

    return { ...this.activeRound, answer: "***" };
  }

  getActiveRound(): Omit<TriviaRound, "answer"> | null {
    if (!this.activeRound || this.activeRound.winnerId) return null;
    const { answer, ...rest } = this.activeRound;
    return rest;
  }

  cancelTrivia(): boolean {
    if (!this.activeRound || this.activeRound.winnerId) return false;
    this.activeRound = null;
    return true;
  }
}
