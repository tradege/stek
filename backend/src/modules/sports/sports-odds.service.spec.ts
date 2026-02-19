
// @ts-nocheck
import { Test, TestingModule } from '@nestjs/testing';
import { SportsOddsService } from './sports-odds.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('SportsOddsService', () => {
  let service: SportsOddsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    sportEvent: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    sportMarket: {
      upsert: jest.fn(),
    },
    sportBet: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    siteConfiguration: {
      findFirst: jest.fn(),
    },
    riskLimit: {
      findFirst: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
    wallet: {
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrismaService)),
    $queryRaw: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-api-key'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SportsOddsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<SportsOddsService>(SportsOddsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  // ============================================
  // 1. SERVICE INITIALIZATION
  // ============================================
  it('1.1 should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // 2. FETCH ODDS
  // ============================================
  describe('fetchAllLeagueOdds', () => {
    it('2.1 should fetch odds for all supported leagues', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Map(),
        })
      ) as jest.Mock;

      const result = await service.fetchAllLeagueOdds();
      expect(result.fetched).toBe(0);
      expect(result.errors).toBe(0);
      expect(fetch).toHaveBeenCalledTimes(4);
    });

    it('2.2 should handle API errors gracefully', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        })
      ) as jest.Mock;

      const result = await service.fetchAllLeagueOdds();
      expect(result.fetched).toBe(0);
      expect(result.errors).toBe(4);
    });

    it('2.3 should not fetch odds if monthly limit is reached', async () => {
      service.apiCallsThisMonth = 500;
      const result = await service.fetchAllLeagueOdds();
      expect(result.fetched).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('2.4 should handle fetch with no events returned', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Map(),
        })
      ) as jest.Mock;
      const count = await service.fetchLeagueOdds('soccer_epl', 'Premier League');
      expect(count).toBe(0);
    });

    it('2.5 should handle fetch with event upsert error', async () => {
      mockPrismaService.sportEvent.upsert.mockRejectedValue(new Error('DB error'));
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{
            id: '1',
            home_team: 'A',
            away_team: 'B',
            commence_time: new Date().toISOString(),
          }]),
          headers: new Map(),
        })
      ) as jest.Mock;
      const count = await service.fetchLeagueOdds('soccer_epl', 'Premier League');
      expect(count).toBe(0);
    });
  });

  // ============================================
  // 3. PLACE BET - SUCCESSFUL FLOW
  // ============================================
  describe('placeBet', () => {
    const mockEvent = {
      id: 'test-event-id',
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      status: 'UPCOMING',
      commenceTime: new Date(Date.now() + 3600000),
      markets: [
        { outcomes: { home: 2.0, away: 3.0, draw: 3.5 } },
      ],
    };

    it('3.1 should place a bet successfully', async () => {
      mockPrismaService.sportEvent.findUnique.mockResolvedValue(mockEvent);
      mockPrismaService.$queryRaw.mockResolvedValue([{ id: 'wallet-1', balance: 100 }]);
      mockPrismaService.sportBet.create.mockResolvedValue({ id: 'bet-1' });

      const result = await service.placeBet('user-1', 'test-event-id', 'home', 10, 'USD');
      expect(result.bet).toBeDefined();
      expect(result.newBalance).toBe(90);
      expect(mockPrismaService.sportBet.create).toHaveBeenCalled();
    });

    it('3.2 should throw an error for insufficient balance', async () => {
      mockPrismaService.sportEvent.findUnique.mockResolvedValue(mockEvent);
      mockPrismaService.$queryRaw.mockResolvedValue([{ id: 'wallet-1', balance: 5 }]);

      await expect(service.placeBet('user-1', 'test-event-id', 'home', 10, 'USD'))
        .rejects.toThrow('Insufficient balance');
    });

    it('3.3 should throw an error for past events', async () => {
      const pastEvent = { ...mockEvent, commenceTime: new Date(Date.now() - 3600000) };
      mockPrismaService.sportEvent.findUnique.mockResolvedValue(pastEvent);

      await expect(service.placeBet('user-1', 'test-event-id', 'home', 10, 'USD'))
        .rejects.toThrow('Event has already started');
    });

    it('3.4 should throw error if event not found', async () => {
      mockPrismaService.sportEvent.findUnique.mockResolvedValue(null);
      await expect(service.placeBet('user-1', 'non-existent', 'home', 10, 'USD'))
        .rejects.toThrow('Event not found');
    });

    it('3.5 should throw error if event is not UPCOMING', async () => {
      mockPrismaService.sportEvent.findUnique.mockResolvedValue({ ...mockEvent, status: 'ENDED' });
      await expect(service.placeBet('user-1', 'test-event-id', 'home', 10, 'USD'))
        .rejects.toThrow('Event is no longer open for betting');
    });

    it('3.6 should throw error if no odds available', async () => {
      mockPrismaService.sportEvent.findUnique.mockResolvedValue({ ...mockEvent, markets: [] });
      await expect(service.placeBet('user-1', 'test-event-id', 'home', 10, 'USD'))
        .rejects.toThrow('No odds available for this event');
    });

    it('3.7 should throw error for invalid selection', async () => {
      mockPrismaService.sportEvent.findUnique.mockResolvedValue(mockEvent);
      await expect(service.placeBet('user-1', 'test-event-id', 'invalid', 10, 'USD'))
        .rejects.toThrow('Invalid selection');
    });

    it('3.8 should throw error for min bet violation', async () => {
      mockPrismaService.sportEvent.findUnique.mockResolvedValue(mockEvent);
      await expect(service.placeBet('user-1', 'test-event-id', 'home', 0.5, 'USD'))
        .rejects.toThrow('Minimum bet is 1');
    });

    it('3.9 should throw error for max bet violation', async () => {
      mockPrismaService.sportEvent.findUnique.mockResolvedValue(mockEvent);
      await expect(service.placeBet('user-1', 'test-event-id', 'home', 10001, 'USD'))
        .rejects.toThrow('Maximum bet is 10,000');
    });

    it('3.10 should throw error if wallet not found', async () => {
      mockPrismaService.sportEvent.findUnique.mockResolvedValue(mockEvent);
      mockPrismaService.$queryRaw.mockResolvedValue([]);
      await expect(service.placeBet('user-1', 'test-event-id', 'home', 10, 'USD'))
        .rejects.toThrow('Wallet not found');
    });
  });

  // ============================================
  // 4. USER BETS
  // ============================================
  describe('getUserBets', () => {
    it('4.1 should retrieve user bets', async () => {
      mockPrismaService.sportBet.findMany.mockResolvedValue([]);
      const bets = await service.getUserBets('test-user-id');
      expect(bets).toEqual([]);
      expect(mockPrismaService.sportBet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'test-user-id' },
        }),
      );
    });
  });

  // ============================================
  // 5. UPCOMING EVENTS
  // ============================================
  describe('getUpcomingEvents', () => {
    it('5.1 should retrieve upcoming events grouped by league', async () => {
      mockPrismaService.sportEvent.findMany.mockResolvedValue([]);
      const events = await service.getUpcomingEvents();
      expect(events).toHaveProperty('leagues');
      expect(events).toHaveProperty('totalEvents');
    });
  });

  // ============================================
  // 6. STATS
  // ============================================
  describe('getStats', () => {
    it('6.1 should retrieve sports betting stats', async () => {
      mockPrismaService.sportBet.count.mockResolvedValue(0);
      mockPrismaService.sportBet.aggregate.mockResolvedValue({ _sum: { stake: 0, potentialWin: 0 } });
      mockPrismaService.sportEvent.count.mockResolvedValue(0);

      const stats = await service.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalBets).toBe(0);
    });
  });

  // ============================================
  // 7. FORCE SETTLE
  // ============================================
  describe('forceSettle', () => {
    it('7.1 should force settle an event with no pending bets', async () => {
      mockPrismaService.sportEvent.findUnique.mockResolvedValue({ id: 'event1' });
      mockPrismaService.sportBet.findMany.mockResolvedValue([]);
      const result = await service.forceSettle('event1', 2, 1);
      expect(result.settledBets).toBe(0);
      expect(mockPrismaService.sportEvent.update).toHaveBeenCalledWith({
        where: { id: 'event1' },
        data: {
          homeScore: 2,
          awayScore: 1,
          completed: true,
          status: 'ENDED',
        },
      });
    });

    it('7.2 should settle winning bets on forceSettle', async () => {
      mockPrismaService.sportEvent.findUnique.mockResolvedValue({ id: 'event1' });
      const bets = [{ id: 'bet1', userId: 'user1', selection: 'home', potentialWin: 20, stake: 10, currency: 'USD', siteId: 'site-1' }];
      mockPrismaService.sportBet.findMany.mockResolvedValue(bets);
      mockPrismaService.wallet.findFirst.mockResolvedValue({ id: 'wallet1', balance: 100 });

      const result = await service.forceSettle('event1', 2, 1);
      expect(result.settledBets).toBe(1);
      expect(mockPrismaService.sportBet.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'WON' }) }),
      );
    });

    it('7.3 should settle losing bets on forceSettle', async () => {
      mockPrismaService.sportEvent.findUnique.mockResolvedValue({ id: 'event1' });
      const bets = [{ id: 'bet1', userId: 'user1', selection: 'home', potentialWin: 20, stake: 10, currency: 'USD', siteId: 'site-1' }];
      mockPrismaService.sportBet.findMany.mockResolvedValue(bets);

      const result = await service.forceSettle('event1', 1, 2);
      expect(result.settledBets).toBe(1);
      expect(mockPrismaService.sportBet.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'LOST' }) }),
      );
    });

    it('7.4 should settle draw bets on forceSettle', async () => {
      mockPrismaService.sportEvent.findUnique.mockResolvedValue({ id: 'event1' });
      const bets = [{ id: 'bet1', userId: 'user1', selection: 'draw', potentialWin: 35, stake: 10, currency: 'USD', siteId: 'site-1' }];
      mockPrismaService.sportBet.findMany.mockResolvedValue(bets);
      mockPrismaService.wallet.findFirst.mockResolvedValue({ id: 'wallet1', balance: 100 });

      const result = await service.forceSettle('event1', 1, 1);
      expect(result.settledBets).toBe(1);
      expect(mockPrismaService.sportBet.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'WON' }) }),
      );
    });

    it('7.5 should handle settlement with wallet not found for winner', async () => {
      mockPrismaService.sportEvent.findUnique.mockResolvedValue({ id: 'event1' });
      const bets = [{ id: 'bet1', userId: 'user1', selection: 'home', potentialWin: 20, stake: 10, currency: 'USD', siteId: 'site-1' }];
      mockPrismaService.sportBet.findMany.mockResolvedValue(bets);
      mockPrismaService.wallet.findFirst.mockResolvedValue(null);

      const result = await service.forceSettle('event1', 2, 1);
      expect(result.settledBets).toBe(1);
      expect(mockPrismaService.wallet.update).not.toHaveBeenCalled();
    });

    it('7.6 should throw if event not found on forceSettle', async () => {
      mockPrismaService.sportEvent.findUnique.mockResolvedValue(null);
      await expect(service.forceSettle('non-existent', 2, 1)).rejects.toThrow('Event not found');
    });
  });

  // ============================================
  // 8. SERVICE STATUS & ADMIN
  // ============================================
  describe('admin operations', () => {
    it('8.1 should get service status', () => {
      const status = service.getStatus();
      expect(status).toHaveProperty('apiKeyConfigured', true);
      expect(status).toHaveProperty('apiCallsThisMonth');
    });

    it('8.2 should trigger fetch manually', async () => {
      const spy = jest.spyOn(service, 'fetchAllLeagueOdds').mockResolvedValue({ fetched: 4, errors: 0 });
      const result = await service.triggerFetch();
      expect(result.fetched).toBe(4);
      spy.mockRestore();
    });

    it('8.3 should trigger settlement manually', async () => {
      const spy = jest.spyOn(service, 'fetchScoresAndSettle').mockResolvedValue({ settled: 10, errors: 0 });
      const result = await service.triggerSettlement();
      expect(result.settled).toBe(10);
      spy.mockRestore();
    });

    it('8.4 should get all bets with filters', async () => {
      mockPrismaService.sportBet.findMany.mockResolvedValue([]);
      mockPrismaService.sportBet.count.mockResolvedValue(0);
      const result = await service.getAllBets({ status: 'PENDING' });
      expect(result.bets).toEqual([]);
      expect(result.total).toBe(0);
      expect(mockPrismaService.sportBet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'PENDING' } }),
      );
    });
  });
});
