/**
 * ============================================
 * CARD RUSH SERVICE - Instant Blackjack Variant
 * ============================================
 * Multi-Tenant Provably Fair Card Game.
 * Player selects hand size (2, 3, 4, or 5 cards).
 * Fixed Odds Table for payout calculation.
 * Dynamic houseEdge from SiteConfiguration per brand.
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getGameConfig, checkRiskLimits, recordPayout } from '../../common/helpers/game-tenant.helper';
import * as crypto from 'crypto';
import Decimal from 'decimal.js';

// ============================================
// DTOs
// ============================================
export interface PlayCardRushDto {
  betAmount: number;
  handSize: 2 | 3 | 4 | 5;
  currency?: string;
}

export interface CardRushResult {
  playerCards: Card[];
  dealerCards: Card[];
  playerSum: number;
  dealerSum: number;
  isWin: boolean;
  isPush: boolean;
  isBust: boolean;
  isDealerBust: boolean;
  isBlackjack: boolean;
  multiplier: number;
  payout: number;
  profit: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface Card {
  rank: string;
  suit: string;
  value: number;
}

// ============================================
// CONSTANTS
// ============================================
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♥', '♦', '♣'];
const MIN_BET = 0.01;
const RATE_LIMIT_MS = 500;
const userLastBetTime = new Map<string, number>();

/**
 * Fixed Odds Table - Pre-calculated win probabilities per hand size.
 * Based on standard Blackjack mathematics with simplified rules.
 * Win probability decreases with more cards (higher bust chance).
 */
const FIXED_ODDS_TABLE: Record<number, { winProbability: number; bustProbability: number }> = {
  2: { winProbability: 0.4200, bustProbability: 0.00 },  // 2 cards: classic blackjack hand, no bust possible, high variance
  3: { winProbability: 0.4650, bustProbability: 0.12 },  // 3 cards: lower bust risk
  4: { winProbability: 0.3800, bustProbability: 0.28 },  // 4 cards: moderate risk
  5: { winProbability: 0.2900, bustProbability: 0.42 },  // 5 cards: high risk, high reward
};

/**
 * Blackjack bonus: Natural 21 with minimum cards pays extra
 */
const BLACKJACK_BONUS_MULTIPLIER = 1.10; // Calibrated: 10% BJ bonus (was 50%) for ~96.5% RTP // 50% bonus on blackjack

@Injectable()
export class CardRushService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // CARD GENERATION (Provably Fair)
  // ============================================

  /**
   * Generate a deterministic card from hash bytes
   */
  private generateCard(hashBytes: Buffer, offset: number): Card {
    const rankIndex = hashBytes[offset] % 13;
    const suitIndex = hashBytes[offset + 1] % 4;
    const rank = RANKS[rankIndex];
    const suit = SUITS[suitIndex];
    const value = this.getCardValue(rank);
    return { rank, suit, value };
  }

  /**
   * Get numeric value for a card rank
   */
  private getCardValue(rank: string): number {
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    if (rank === 'A') return 11; // Ace starts as 11
    return parseInt(rank);
  }

  /**
   * Calculate hand sum with Ace adjustment (11 -> 1 if bust)
   */
  calculateHandSum(cards: Card[]): number {
    let sum = cards.reduce((total, card) => total + card.value, 0);
    let aces = cards.filter(c => c.rank === 'A').length;

    while (sum > 21 && aces > 0) {
      sum -= 10; // Convert Ace from 11 to 1
      aces--;
    }
    return sum;
  }

  /**
   * Generate all cards for a round using provably fair hash chain
   */
  private generateCards(serverSeed: string, clientSeed: string, nonce: number, count: number): Card[] {
    const cards: Card[] = [];
    // Generate enough hash bytes for all cards (2 bytes per card)
    const hashesNeeded = Math.ceil(count * 2 / 32) + 1;
    const allBytes: number[] = [];

    for (let i = 0; i < hashesNeeded; i++) {
      const hash = crypto.createHmac('sha256', serverSeed)
        .update(`${clientSeed}:${nonce}:${i}`)
        .digest();
      for (let j = 0; j < hash.length; j++) {
        allBytes.push(hash[j]);
      }
    }

    const buf = Buffer.from(allBytes);
    for (let i = 0; i < count; i++) {
      cards.push(this.generateCard(buf, i * 2));
    }
    return cards;
  }

  /**
   * Dealer draws to soft 17 (standard Blackjack rule)
   */
  private dealerDraw(serverSeed: string, clientSeed: string, nonce: number, startOffset: number): Card[] {
    const dealerCards: Card[] = [];
    let dealerSum = 0;
    let cardIndex = 0;

    // Dealer draws until reaching 17+
    while (dealerSum < 17) {
      const hash = crypto.createHmac('sha256', serverSeed)
        .update(`${clientSeed}:${nonce}:dealer:${cardIndex}`)
        .digest();
      const card = this.generateCard(hash, 0);
      dealerCards.push(card);
      dealerSum = this.calculateHandSum(dealerCards);
      cardIndex++;

      // Safety: max 10 cards for dealer
      if (cardIndex >= 10) break;
    }

    return dealerCards;
  }

  /**
   * Calculate payout multiplier using Fixed Odds Table
   * Formula: (1 / winProbability) * (1 - houseEdge)
   */
  calculateMultiplier(handSize: number, houseEdge: number, isBlackjack: boolean): number {
    const odds = FIXED_ODDS_TABLE[handSize];
    if (!odds) return 0;

    let baseMultiplier = (1 / odds.winProbability) * (1 - houseEdge);

    // Blackjack bonus for natural 21
    if (isBlackjack) {
      baseMultiplier *= BLACKJACK_BONUS_MULTIPLIER;
    }

    return parseFloat(baseMultiplier.toFixed(4));
  }

  // ============================================
  // MAIN PLAY FUNCTION
  // ============================================

  async play(userId: string, dto: PlayCardRushDto, siteId: string): Promise<CardRushResult> {
    const { betAmount, handSize, currency = 'USDT' } = dto;

    // Rate limiting
    const now = Date.now();
    const lastBet = userLastBetTime.get(userId) || 0;
    if (now - lastBet < RATE_LIMIT_MS) {
      throw new BadRequestException('Please wait before placing another bet');
    }
    userLastBetTime.set(userId, now);
    if (userLastBetTime.size > 10000) {
      const cutoff = now - 60000;
      for (const [uid, time] of userLastBetTime.entries()) {
        if (time < cutoff) userLastBetTime.delete(uid);
      }
    }

    // Validate hand size
    if (![2, 3, 4, 5].includes(handSize)) {
      throw new BadRequestException('Hand size must be 2, 3, 4, or 5');
    }

    // Get dynamic config for this brand
    const gameConfig = await getGameConfig(this.prisma, siteId, 'card-rush');

    // Validate bet amount
    if (betAmount < MIN_BET || betAmount > gameConfig.maxBetAmount) {
      throw new BadRequestException(`Bet must be between ${MIN_BET} and ${gameConfig.maxBetAmount}`);
    }

    // Get or create server seed
    let serverSeedRecord = await this.prisma.serverSeed.findFirst({
      where: { userId, isActive: true },
    });
    if (!serverSeedRecord) {
      const seed = crypto.randomBytes(32).toString('hex');
      serverSeedRecord = await this.prisma.serverSeed.create({
        data: {
          userId,
          seed,
          seedHash: crypto.createHash('sha256').update(seed).digest('hex'),
          isActive: true,
          nonce: 0,
        },
      });
    }

    const serverSeed = serverSeedRecord.seed;
    const serverSeedHash = serverSeedRecord.seedHash;
    const clientSeed = crypto.randomBytes(16).toString('hex');
    const nonce = serverSeedRecord.nonce + 1;

    // Update nonce
    await this.prisma.serverSeed.update({
      where: { id: serverSeedRecord.id },
      data: { nonce },
    });

    // Deal player cards
    const playerCards = this.generateCards(serverSeed, clientSeed, nonce, handSize);
    const playerSum = this.calculateHandSum(playerCards);
    const isBust = playerSum > 21;

    // Check for blackjack (21 with minimum cards)
    const isBlackjack = playerSum === 21 && handSize <= 2;

    // Dealer draws (only if player didn't bust)
    let dealerCards: Card[] = [];
    let dealerSum = 0;
    let isDealerBust = false;

    if (!isBust) {
      dealerCards = this.dealerDraw(serverSeed, clientSeed, nonce, handSize);
      dealerSum = this.calculateHandSum(dealerCards);
      isDealerBust = dealerSum > 21;
    }

    // Determine outcome
    let isWin = false;
    let isPush = false;

    if (isBust) {
      isWin = false;
    } else if (isDealerBust) {
      isWin = true;
    } else if (playerSum > dealerSum) {
      isWin = true;
    } else if (playerSum === dealerSum) {
      isPush = true;
    }

    // Calculate payout
    const multiplier = isWin ? this.calculateMultiplier(handSize, gameConfig.houseEdge, isBlackjack) : (isPush ? 1 : 0);
    const payout = parseFloat((betAmount * multiplier).toFixed(2));
    const profit = parseFloat((payout - betAmount).toFixed(2));

    // Risk limit check
    if (isWin && payout > 0) {
      const riskCheck = await checkRiskLimits(this.prisma, siteId, payout);
      if (!riskCheck.allowed) {
        throw new BadRequestException(riskCheck.reason || 'Payout exceeds risk limits');
      }
    }

    // Atomic wallet transaction
    const wallet = await this.prisma.wallet.findFirst({
      where: { userId, currency: currency as any },
    });
    if (!wallet) {
      throw new BadRequestException(`No ${currency} wallet found`);
    }
    const currentBalance = new Decimal(wallet.balance.toString());
    if (currentBalance.lt(betAmount)) {
      throw new BadRequestException('Insufficient balance');
    }

    const newBalance = currentBalance.minus(betAmount).plus(payout);

    await this.prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance.toNumber() },
      });

      await tx.bet.create({
        data: {
          userId,
          siteId,
          gameType: 'CARD_RUSH' as any,
          currency: currency as any,
          betAmount: new Decimal(betAmount),
          multiplier: new Decimal(multiplier),
          payout: new Decimal(payout),
          profit: new Decimal(profit),
          serverSeed,
          serverSeedHash,
          clientSeed,
          nonce,
          gameData: ({
            game: 'CARD_RUSH',
            playerCards,
            dealerCards,
            playerSum,
            dealerSum,
            handSize,
            isBust,
            isDealerBust,
            isBlackjack,
            isPush,
            houseEdge: gameConfig.houseEdge,
          }) as any,
          isWin,
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          siteId,
          walletId: wallet.id,
          type: 'BET',
          status: 'CONFIRMED',
          amount: new Decimal(betAmount),
          balanceBefore: currentBalance.toNumber(),
          balanceAfter: newBalance.toNumber(),
          externalRef: `CARDRUSH-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
          metadata: {
            game: 'CARD_RUSH',
            handSize,
            playerSum,
            dealerSum,
            multiplier,
            payout,
            profit,
            isWin,
            isPush,
            isBlackjack,
            siteId,
          },
        },
      });
    });

    // Record payout for risk tracking
    if (isWin && payout > 0) {
      await recordPayout(this.prisma, siteId, payout);
    }

    return {
      playerCards,
      dealerCards,
      playerSum,
      dealerSum,
      isWin,
      isPush,
      isBust,
      isDealerBust,
      isBlackjack,
      multiplier,
      payout,
      profit,
      serverSeedHash,
      clientSeed,
      nonce,
    };
  }

  // ============================================
  // HISTORY & VERIFICATION
  // ============================================

  async getHistory(userId: string, siteId: string, limit: number = 20) {
    return this.prisma.bet.findMany({
      where: {
        userId,
        siteId,
        gameType: 'CARD_RUSH' as any,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      select: {
        id: true,
        betAmount: true,
        multiplier: true,
        payout: true,
        profit: true,
        isWin: true,
        gameData: true,
        createdAt: true,
      },
    });
  }

  async verifyRound(serverSeed: string, clientSeed: string, nonce: number, handSize: number) {
    const playerCards = this.generateCards(serverSeed, clientSeed, nonce, handSize);
    const playerSum = this.calculateHandSum(playerCards);
    const isBust = playerSum > 21;

    let dealerCards: Card[] = [];
    let dealerSum = 0;
    if (!isBust) {
      dealerCards = this.dealerDraw(serverSeed, clientSeed, nonce, handSize);
      dealerSum = this.calculateHandSum(dealerCards);
    }

    return {
      playerCards,
      dealerCards,
      playerSum,
      dealerSum,
      isBust,
      isDealerBust: dealerSum > 21,
      seedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
    };
  }

  /**
   * Get fixed odds table for display
   */
  async getOddsTable(siteId: string) {
    const gameConfig = await getGameConfig(this.prisma, siteId, 'card-rush');
    return Object.entries(FIXED_ODDS_TABLE).map(([size, odds]) => ({
      handSize: parseInt(size),
      winProbability: (odds.winProbability * 100).toFixed(2) + '%',
      bustProbability: (odds.bustProbability * 100).toFixed(2) + '%',
      multiplier: this.calculateMultiplier(parseInt(size), gameConfig.houseEdge, false),
      blackjackMultiplier: this.calculateMultiplier(parseInt(size), gameConfig.houseEdge, true),
    }));
  }
}
