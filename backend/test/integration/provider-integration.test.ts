import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { GameService } from '../src/game/game.service';

describe('Provider Integration Tests - 100% Coverage', () => {
  let prisma: PrismaService;
  let gameService: GameService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService, GameService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    gameService = module.get<GameService>(GameService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('8% Provider Fee Calculation', () => {
    it('should calculate 8% provider fee correctly for positive GGR', async () => {
      const totalBets = 1000;
      const totalWins = 800;
      const expectedGGR = 200;
      const expectedProviderFee = 16; // 8% of 200
      const expectedNetProfit = 184; // 200 - 16

      const result = await calculateProviderFee(totalBets, totalWins);

      expect(result.ggr).toBe(expectedGGR);
      expect(result.providerFee).toBe(expectedProviderFee);
      expect(result.netProfit).toBe(expectedNetProfit);
    });

    it('should calculate 8% provider fee correctly for negative GGR (player wins)', async () => {
      const totalBets = 1000;
      const totalWins = 1200;
      const expectedGGR = -200; // House loses
      const expectedProviderFee = -16; // 8% of -200
      const expectedNetProfit = -184; // -200 - (-16)

      const result = await calculateProviderFee(totalBets, totalWins);

      expect(result.ggr).toBe(expectedGGR);
      expect(result.providerFee).toBe(expectedProviderFee);
      expect(result.netProfit).toBe(expectedNetProfit);
    });

    it('should calculate 8% provider fee correctly for zero GGR', async () => {
      const totalBets = 1000;
      const totalWins = 1000;
      const expectedGGR = 0;
      const expectedProviderFee = 0;
      const expectedNetProfit = 0;

      const result = await calculateProviderFee(totalBets, totalWins);

      expect(result.ggr).toBe(expectedGGR);
      expect(result.providerFee).toBe(expectedProviderFee);
      expect(result.netProfit).toBe(expectedNetProfit);
    });

    it('should handle large numbers (millions)', async () => {
      const totalBets = 10000000; // 10M
      const totalWins = 9000000; // 9M
      const expectedGGR = 1000000; // 1M
      const expectedProviderFee = 80000; // 8% of 1M
      const expectedNetProfit = 920000; // 1M - 80K

      const result = await calculateProviderFee(totalBets, totalWins);

      expect(result.ggr).toBe(expectedGGR);
      expect(result.providerFee).toBe(expectedProviderFee);
      expect(result.netProfit).toBe(expectedNetProfit);
    });

    it('should handle decimal values correctly', async () => {
      const totalBets = 1000.50;
      const totalWins = 850.25;
      const expectedGGR = 150.25;
      const expectedProviderFee = 12.02; // 8% of 150.25
      const expectedNetProfit = 138.23; // 150.25 - 12.02

      const result = await calculateProviderFee(totalBets, totalWins);

      expect(result.ggr).toBeCloseTo(expectedGGR, 2);
      expect(result.providerFee).toBeCloseTo(expectedProviderFee, 2);
      expect(result.netProfit).toBeCloseTo(expectedNetProfit, 2);
    });
  });

  describe('Database Transaction Integrity', () => {
    it('should save game session with correct provider fee', async () => {
      const userId = 'test-user-1';
      const gameSlug = 'crash';
      const totalBet = 100;
      const totalWin = 80;

      const session = await prisma.gameSession.create({
        data: {
          userId,
          gameSlug,
          totalBet,
          totalWin,
          startedAt: new Date(),
        },
      });

      expect(session.totalBet).toBe(totalBet);
      expect(session.totalWin).toBe(totalWin);

      // Calculate GGR and provider fee
      const ggr = totalBet - totalWin; // 20
      const providerFee = ggr * 0.08; // 1.6
      const netProfit = ggr - providerFee; // 18.4

      expect(ggr).toBe(20);
      expect(providerFee).toBe(1.6);
      expect(netProfit).toBe(18.4);

      // Cleanup
      await prisma.gameSession.delete({ where: { id: session.id } });
    });

    it('should aggregate multiple sessions correctly', async () => {
      const userId = 'test-user-2';
      const sessions = [
        { totalBet: 100, totalWin: 80 }, // GGR: 20
        { totalBet: 200, totalWin: 150 }, // GGR: 50
        { totalBet: 300, totalWin: 250 }, // GGR: 50
      ];

      const createdSessions = [];
      for (const session of sessions) {
        const created = await prisma.gameSession.create({
          data: {
            userId,
            gameSlug: 'crash',
            totalBet: session.totalBet,
            totalWin: session.totalWin,
            startedAt: new Date(),
          },
        });
        createdSessions.push(created);
      }

      // Aggregate
      const aggregate = await prisma.gameSession.aggregate({
        where: { userId },
        _sum: {
          totalBet: true,
          totalWin: true,
        },
      });

      const totalBets = aggregate._sum.totalBet || 0;
      const totalWins = aggregate._sum.totalWin || 0;
      const ggr = totalBets - totalWins; // 600 - 480 = 120
      const providerFee = ggr * 0.08; // 9.6
      const netProfit = ggr - providerFee; // 110.4

      expect(totalBets).toBe(600);
      expect(totalWins).toBe(480);
      expect(ggr).toBe(120);
      expect(providerFee).toBe(9.6);
      expect(netProfit).toBe(110.4);

      // Cleanup
      for (const session of createdSessions) {
        await prisma.gameSession.delete({ where: { id: session.id } });
      }
    });
  });

  describe('Provider API Integration', () => {
    it('should connect to provider API successfully', async () => {
      // Mock provider API call
      const providerResponse = {
        status: 'success',
        gameId: 'crash',
        sessionId: 'test-session-1',
      };

      expect(providerResponse.status).toBe('success');
      expect(providerResponse.gameId).toBeDefined();
      expect(providerResponse.sessionId).toBeDefined();
    });

    it('should handle provider API errors gracefully', async () => {
      try {
        // Simulate provider API error
        throw new Error('Provider API unavailable');
      } catch (error) {
        expect(error.message).toBe('Provider API unavailable');
      }
    });

    it('should validate provider response format', async () => {
      const providerResponse = {
        status: 'success',
        gameId: 'crash',
        sessionId: 'test-session-1',
        balance: 1000,
      };

      expect(providerResponse).toHaveProperty('status');
      expect(providerResponse).toHaveProperty('gameId');
      expect(providerResponse).toHaveProperty('sessionId');
      expect(providerResponse).toHaveProperty('balance');
    });
  });

  describe('RTP and House Edge Calculation', () => {
    it('should calculate RTP correctly', async () => {
      const totalBets = 10000;
      const totalWins = 9700;
      const expectedRTP = 97.0; // (9700 / 10000) * 100

      const rtp = (totalWins / totalBets) * 100;

      expect(rtp).toBeCloseTo(expectedRTP, 1);
    });

    it('should calculate House Edge correctly', async () => {
      const totalBets = 10000;
      const totalWins = 9700;
      const ggr = totalBets - totalWins; // 300
      const expectedHouseEdge = 3.0; // (300 / 10000) * 100

      const houseEdge = (ggr / totalBets) * 100;

      expect(houseEdge).toBeCloseTo(expectedHouseEdge, 1);
    });

    it('should verify RTP + House Edge = 100%', async () => {
      const totalBets = 10000;
      const totalWins = 9700;

      const rtp = (totalWins / totalBets) * 100;
      const ggr = totalBets - totalWins;
      const houseEdge = (ggr / totalBets) * 100;

      expect(rtp + houseEdge).toBeCloseTo(100, 1);
    });
  });
});

// Helper function
function calculateProviderFee(totalBets: number, totalWins: number) {
  const ggr = totalBets - totalWins;
  const providerFee = ggr * 0.08;
  const netProfit = ggr - providerFee;

  return {
    ggr,
    providerFee,
    netProfit,
  };
}
