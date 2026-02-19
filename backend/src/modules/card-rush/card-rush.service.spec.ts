import { CardRushService, PlayCardRushDto, Card } from './card-rush.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as gameTenantHelper from '../../common/helpers/game-tenant.helper';

jest.mock('../../common/helpers/game-tenant.helper', () => ({
  getGameConfig: jest.fn(),
  checkRiskLimits: jest.fn(),
  recordPayout: jest.fn(),
}));

describe('CardRushService', () => {
  let service: CardRushService;
  let mockPrisma: any;
  let dateNowSpy: jest.SpyInstance;
  let currentTime: number;

  beforeEach(() => {
    currentTime = 1000000;
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      currentTime += 2000;
      return currentTime;
    });

    mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet-1', balance: 10000 }]),
      serverSeed: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'seed-id', seed: 'server-seed',
          seedHash: crypto.createHash('sha256').update('server-seed').digest('hex'),
          nonce: 0,
        }),
        create: jest.fn().mockResolvedValue({
          id: 'seed-id', seed: 'new-server-seed',
          seedHash: crypto.createHash('sha256').update('new-server-seed').digest('hex'),
          nonce: 0,
        }),
        update: jest.fn(),
      },
      wallet: { update: jest.fn() },
      bet: { create: jest.fn(), findMany: jest.fn() },
      transaction: { create: jest.fn() },
      siteConfiguration: {
        findFirst: jest.fn().mockResolvedValue({ gameConfig: { 'card-rush': { houseEdge: 0.04, maxBetAmount: 10000 } } }),
      },
    };
    service = new CardRushService(mockPrisma as unknown as PrismaService);

    (gameTenantHelper.getGameConfig as jest.Mock).mockResolvedValue({
      houseEdge: 0.04, maxBetAmount: 10000, minBetAmount: 0.01,
    });
    (gameTenantHelper.checkRiskLimits as jest.Mock).mockResolvedValue({ allowed: true });
    (gameTenantHelper.recordPayout as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    dateNowSpy.mockRestore();
  });

  // ============================================
  // 1. HAND SUM CALCULATION
  // ============================================
  describe('calculateHandSum', () => {
    it('1.1 should calculate sum of number cards', () => {
      const cards: Card[] = [
        { rank: '5', suit: '♠', value: 5 },
        { rank: '8', suit: '♥', value: 8 },
      ];
      expect(service.calculateHandSum(cards)).toBe(13);
    });

    it('1.2 should count face cards as 10', () => {
      const cards: Card[] = [
        { rank: 'K', suit: '♠', value: 10 },
        { rank: 'Q', suit: '♥', value: 10 },
      ];
      expect(service.calculateHandSum(cards)).toBe(20);
    });

    it('1.3 should count Ace as 11 when not busting', () => {
      const cards: Card[] = [
        { rank: 'A', suit: '♠', value: 11 },
        { rank: '8', suit: '♥', value: 8 },
      ];
      expect(service.calculateHandSum(cards)).toBe(19);
    });

    it('1.4 should adjust Ace from 11 to 1 when busting', () => {
      const cards: Card[] = [
        { rank: 'A', suit: '♠', value: 11 },
        { rank: '8', suit: '♥', value: 8 },
        { rank: '7', suit: '♦', value: 7 },
      ];
      // 11 + 8 + 7 = 26 -> adjust Ace to 1 -> 1 + 8 + 7 = 16
      expect(service.calculateHandSum(cards)).toBe(16);
    });

    it('1.5 should handle multiple Aces', () => {
      const cards: Card[] = [
        { rank: 'A', suit: '♠', value: 11 },
        { rank: 'A', suit: '♥', value: 11 },
        { rank: '9', suit: '♦', value: 9 },
      ];
      // 11 + 11 + 9 = 31 -> adjust first Ace -> 1 + 11 + 9 = 21
      expect(service.calculateHandSum(cards)).toBe(21);
    });

    it('1.6 should handle blackjack (A + 10)', () => {
      const cards: Card[] = [
        { rank: 'A', suit: '♠', value: 11 },
        { rank: '10', suit: '♥', value: 10 },
      ];
      expect(service.calculateHandSum(cards)).toBe(21);
    });
  });

  // ============================================
  // 2. MULTIPLIER CALCULATION
  // ============================================
  describe('calculateMultiplier', () => {
    it('2.1 should calculate multiplier for hand size 2', () => {
      const mult = service.calculateMultiplier(2, 0.04, false);
      // (1 / 0.42) * 0.96 = 2.2857
      expect(mult).toBeGreaterThan(2);
      expect(mult).toBeLessThan(3);
    });

    it('2.2 should calculate multiplier for hand size 5', () => {
      const mult = service.calculateMultiplier(5, 0.04, false);
      // Corrected: (0.96 - 0.007) / 0.036 = 26.47
      expect(mult).toBeGreaterThan(20);
      expect(mult).toBeLessThan(35);
    });

    it('2.3 should apply blackjack bonus', () => {
      const normal = service.calculateMultiplier(2, 0.04, false);
      const blackjack = service.calculateMultiplier(2, 0.04, true);
      expect(blackjack).toBeGreaterThan(normal);
    });

    it('2.4 should return 0 for invalid hand size', () => {
      expect(service.calculateMultiplier(6, 0.04, false)).toBe(0);
    });

    it('2.5 should decrease with higher house edge', () => {
      const low = service.calculateMultiplier(2, 0.02, false);
      const high = service.calculateMultiplier(2, 0.10, false);
      expect(low).toBeGreaterThan(high);
    });
  });

  // ============================================
  // 3. PLAY - SUCCESSFUL FLOW
  // ============================================
  describe('play - successful flow', () => {
    it('3.1 should return all required fields', async () => {
      const result = await service.play('user-p1', { betAmount: 10, handSize: 2 }, 'site-1');
      expect(result).toHaveProperty('playerCards');
      expect(result).toHaveProperty('dealerCards');
      expect(result).toHaveProperty('playerSum');
      expect(result).toHaveProperty('dealerSum');
      expect(result).toHaveProperty('isWin');
      expect(result).toHaveProperty('isPush');
      expect(result).toHaveProperty('isBust');
      expect(result).toHaveProperty('isDealerBust');
      expect(result).toHaveProperty('isBlackjack');
      expect(result).toHaveProperty('multiplier');
      expect(result).toHaveProperty('payout');
      expect(result).toHaveProperty('profit');
      expect(result).toHaveProperty('serverSeedHash');
      expect(result).toHaveProperty('clientSeed');
      expect(result).toHaveProperty('nonce');
    });

    it('3.2 should deal correct number of player cards', async () => {
      const result2 = await service.play('user-p2', { betAmount: 10, handSize: 2 }, 'site-1');
      expect(result2.playerCards.length).toBe(2);

      const result5 = await service.play('user-p3', { betAmount: 10, handSize: 5 }, 'site-1');
      expect(result5.playerCards.length).toBe(5);
    });

    it('3.3 should create bet and transaction records', async () => {
      await service.play('user-p4', { betAmount: 10, handSize: 2 }, 'site-1');
      expect(mockPrisma.bet.create).toHaveBeenCalled();
      expect(mockPrisma.transaction.create).toHaveBeenCalled();
    });

    it('3.4 should update wallet balance', async () => {
      await service.play('user-p5', { betAmount: 10, handSize: 2 }, 'site-1');
      expect(mockPrisma.wallet.update).toHaveBeenCalled();
    });

    it('3.5 should use atomic transaction', async () => {
      await service.play('user-p6', { betAmount: 10, handSize: 2 }, 'site-1');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ============================================
  // 4. PLAY - INPUT VALIDATION
  // ============================================
  describe('play - input validation', () => {
    it('4.1 should throw for invalid hand size', async () => {
      await expect(service.play('user-iv1', { betAmount: 10, handSize: 6 as any }, 'site-1'))
        .rejects.toThrow('Hand size must be 2, 3, 4, or 5');
    });

    it('4.2 should throw for bet amount below minimum', async () => {
      await expect(service.play('user-iv2', { betAmount: 0.001, handSize: 2 }, 'site-1'))
        .rejects.toThrow('Bet must be between');
    });

    it('4.3 should throw for bet amount above maximum', async () => {
      await expect(service.play('user-iv3', { betAmount: 20000, handSize: 2 }, 'site-1'))
        .rejects.toThrow('Bet must be between');
    });

    it('4.4 should throw for insufficient balance', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'wallet-1', balance: 5 }]);
      await expect(service.play('user-iv4', { betAmount: 10, handSize: 2 }, 'site-1'))
        .rejects.toThrow('Insufficient balance');
    });

    it('4.5 should throw when wallet not found', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      await expect(service.play('user-iv5', { betAmount: 10, handSize: 2 }, 'site-1'))
        .rejects.toThrow('No USDT wallet found');
    });

    it('4.6 should throw when payout exceeds risk limits', async () => {
      (gameTenantHelper.checkRiskLimits as jest.Mock).mockResolvedValue({ allowed: false, reason: 'Payout exceeds risk limits' });
      // Force a win by mocking calculateHandSum
      jest.spyOn(service, 'calculateHandSum').mockReturnValueOnce(21).mockReturnValueOnce(17);
      await expect(service.play('user-iv6', { betAmount: 10, handSize: 2 }, 'site-1'))
        .rejects.toThrow('Payout exceeds risk limits');
    });
  });

  // ============================================
  // 5. RATE LIMITING
  // ============================================
  describe('play - rate limiting', () => {
    it('5.1 should throw for rapid consecutive bets', async () => {
      dateNowSpy.mockRestore();
      dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(5000000);
      await service.play('user-rl1', { betAmount: 10, handSize: 2 }, 'site-1');
      await expect(service.play('user-rl1', { betAmount: 10, handSize: 2 }, 'site-1'))
        .rejects.toThrow('Please wait before placing another bet');
    });

    it('5.2 should allow bets from different users', async () => {
      dateNowSpy.mockRestore();
      dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(6000000);
      await service.play('user-rl2a', { betAmount: 10, handSize: 2 }, 'site-1');
      await expect(service.play('user-rl2b', { betAmount: 10, handSize: 2 }, 'site-1'))
        .resolves.toBeDefined();
    });
  });

  // ============================================
  // 6. GAME LOGIC
  // ============================================
  describe('play - game logic', () => {
    it('6.1 should not deal dealer cards when player busts', async () => {
      jest.spyOn(service, 'calculateHandSum').mockReturnValueOnce(25);
      const result = await service.play('user-gl1', { betAmount: 10, handSize: 4 }, 'site-1');
      expect(result.isBust).toBe(true);
      expect(result.dealerCards.length).toBe(0);
      expect(result.isWin).toBe(false);
    });

    it('6.2 should return push when player and dealer have same sum', async () => {
      jest.spyOn(service as any, 'generateCards').mockReturnValue([{ rank: '9', value: 9, suit: 'hearts' }, { rank: '9', value: 9, suit: 'spades' }]);
      jest.spyOn(service as any, 'dealerDraw').mockReturnValue([{ rank: '10', value: 10, suit: 'clubs' }, { rank: '8', value: 8, suit: 'diamonds' }]);
      const result = await service.play('user-gl2', { betAmount: 10, handSize: 2 }, 'site-1');
      expect(result.isPush).toBe(true);
      expect(result.multiplier).toBe(1);
    });

    it('6.3 should detect blackjack (21 with 2 cards)', async () => {
      jest.spyOn(service as any, 'generateCards').mockReturnValue([{ rank: 'A', value: 11, suit: 'hearts' }, { rank: '10', value: 10, suit: 'spades' }]);
      jest.spyOn(service as any, 'dealerDraw').mockReturnValue([{ rank: '10', value: 10, suit: 'clubs' }, { rank: '7', value: 7, suit: 'diamonds' }]);
      const result = await service.play('user-gl3', { betAmount: 10, handSize: 2 }, 'site-1');
      expect(result.isBlackjack).toBe(true);
      expect(result.isWin).toBe(true);
    });

    it('6.4 should not detect blackjack with 3+ cards summing to 21', async () => {
      jest.spyOn(service as any, 'generateCards').mockReturnValue([{ rank: '7', value: 7, suit: 'hearts' }, { rank: '7', value: 7, suit: 'spades' }, { rank: '7', value: 7, suit: 'clubs' }]);
      jest.spyOn(service as any, 'dealerDraw').mockReturnValue([{ rank: '10', value: 10, suit: 'clubs' }, { rank: '7', value: 7, suit: 'diamonds' }]);
      const result = await service.play('user-gl4', { betAmount: 10, handSize: 3 }, 'site-1');
      expect(result.isBlackjack).toBe(false);
    });

    it('6.5 should record payout on win', async () => {
      jest.spyOn(service as any, 'generateCards').mockReturnValue([{ rank: '10', value: 10, suit: 'hearts' }, { rank: '10', value: 10, suit: 'spades' }]);
      jest.spyOn(service as any, 'dealerDraw').mockReturnValue([{ rank: '10', value: 10, suit: 'clubs' }, { rank: '7', value: 7, suit: 'diamonds' }]);
      await service.play('user-gl5', { betAmount: 10, handSize: 2 }, 'site-1');
      expect(gameTenantHelper.recordPayout).toHaveBeenCalled();
    });

    it('6.6 should not record payout on loss', async () => {
      jest.spyOn(service as any, 'generateCards').mockReturnValue([{ rank: '8', value: 8, suit: 'hearts' }, { rank: '7', value: 7, suit: 'spades' }]);
      jest.spyOn(service as any, 'dealerDraw').mockReturnValue([{ rank: '10', value: 10, suit: 'clubs' }, { rank: '10', value: 10, suit: 'diamonds' }]);
      await service.play('user-gl6', { betAmount: 10, handSize: 2 }, 'site-1');
      expect(gameTenantHelper.recordPayout).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // 7. HISTORY & VERIFICATION
  // ============================================
  describe('getHistory', () => {
    it('7.1 should return bet history', async () => {
      const bets = [{ id: 'bet-1' }];
      mockPrisma.bet.findMany.mockResolvedValue(bets);
      const result = await service.getHistory('user-1', 'site-1');
      expect(result).toEqual(bets);
    });

    it('7.2 should use default limit of 20', async () => {
      await service.getHistory('user-1', 'site-1');
      expect(mockPrisma.bet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('7.3 should cap limit at 100', async () => {
      await service.getHistory('user-1', 'site-1', 200);
      expect(mockPrisma.bet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe('verifyRound', () => {
    it('7.4 should return verification data', async () => {
      const result = await service.verifyRound('server-seed', 'client-seed', 1, 2);
      expect(result).toHaveProperty('playerCards');
      expect(result).toHaveProperty('dealerCards');
      expect(result).toHaveProperty('playerSum');
      expect(result).toHaveProperty('seedHash');
    });

    it('7.5 should be deterministic', async () => {
      const r1 = await service.verifyRound('server-seed', 'client-seed', 1, 2);
      const r2 = await service.verifyRound('server-seed', 'client-seed', 1, 2);
      expect(r1.playerSum).toBe(r2.playerSum);
    });
  });

  describe('getOddsTable', () => {
    it('7.6 should return odds for all hand sizes', async () => {
      const odds = await service.getOddsTable('site-1');
      expect(odds.length).toBe(4);
      expect(odds.map(o => o.handSize)).toEqual([2, 3, 4, 5]);
    });

    it('7.7 should include multiplier and blackjack multiplier', async () => {
      const odds = await service.getOddsTable('site-1');
      for (const entry of odds) {
        expect(entry).toHaveProperty('multiplier');
        expect(entry).toHaveProperty('blackjackMultiplier');
        expect(entry.multiplier).toBeGreaterThan(0);
      }
    });
  });
});
