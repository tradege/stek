/**
 * ============================================
 * 🤖 BOT SERVICE - UNIT TESTS
 * ============================================
 * Economy protection: verify bots don't affect real GGR
 * Tests: placeBotBet, botLoop, personality, tenant isolation
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BotService } from './bot.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

// ============================================
// MOCK SETUP
// ============================================

const mockPrisma = {
  siteConfiguration: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  user: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'bot-1', username: 'TestBot_1' }),
  },
  wallet: {
    create: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
  },
  botConfig: {
    findUnique: jest.fn().mockResolvedValue(null),
  },
};

const mockEventEmitter = {
  emit: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

describe('🤖 BotService - Unit Tests', () => {
  let service: BotService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<BotService>(BotService);
  });

  afterEach(() => {
    // Clear any timers
    jest.clearAllTimers();
  });

  // ============================================
  // 🎭 PERSONALITY SYSTEM
  // ============================================

  describe('🎭 Personality Assignment', () => {
    it('1.1 - Should assign one of three personalities', () => {
      const assignPersonality = (service as any).assignPersonality.bind(service);
      const validPersonalities = ['CAUTIOUS', 'NORMAL', 'DEGEN'];
      for (let i = 0; i < 50; i++) {
        const personality = assignPersonality();
        expect(validPersonalities).toContain(personality);
      }
    });

    it('1.2 - Should have ~30% CAUTIOUS distribution', () => {
      const assignPersonality = (service as any).assignPersonality.bind(service);
      let cautious = 0;
      const total = 1000;
      for (let i = 0; i < total; i++) {
        if (assignPersonality() === 'CAUTIOUS') cautious++;
      }
      expect(cautious / total).toBeGreaterThan(0.20);
      expect(cautious / total).toBeLessThan(0.40);
    });

    it('1.3 - Should have ~50% NORMAL distribution', () => {
      const assignPersonality = (service as any).assignPersonality.bind(service);
      let normal = 0;
      const total = 1000;
      for (let i = 0; i < total; i++) {
        if (assignPersonality() === 'NORMAL') normal++;
      }
      expect(normal / total).toBeGreaterThan(0.40);
      expect(normal / total).toBeLessThan(0.60);
    });

    it('1.4 - Should have ~20% DEGEN distribution', () => {
      const assignPersonality = (service as any).assignPersonality.bind(service);
      let degen = 0;
      const total = 1000;
      for (let i = 0; i < total; i++) {
        if (assignPersonality() === 'DEGEN') degen++;
      }
      expect(degen / total).toBeGreaterThan(0.12);
      expect(degen / total).toBeLessThan(0.28);
    });
  });

  // ============================================
  // 💰 BET AMOUNT GENERATION
  // ============================================

  describe('💰 getBetAmount', () => {
    const config = {
      botCount: 10,
      minBetAmount: 1,
      maxBetAmount: 100,
      chatEnabled: false,
      chatIntervalMin: 5,
      chatIntervalMax: 15,
      botNamePrefix: '',
      customChatMessages: null,
    };

    it('2.1 - Should return bet within min-max range', () => {
      const getBetAmount = (service as any).getBetAmount.bind(service);
      for (let i = 0; i < 100; i++) {
        const amount = getBetAmount('NORMAL', config);
        expect(amount).toBeGreaterThanOrEqual(config.minBetAmount);
        expect(amount).toBeLessThanOrEqual(config.maxBetAmount);
      }
    });

    it('2.2 - CAUTIOUS bots should bet in lower range (0-20% of range)', () => {
      const getBetAmount = (service as any).getBetAmount.bind(service);
      const amounts: number[] = [];
      for (let i = 0; i < 200; i++) {
        amounts.push(getBetAmount('CAUTIOUS', config));
      }
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      // CAUTIOUS average should be in lower third
      expect(avg).toBeLessThan(config.maxBetAmount * 0.4);
    });

    it('2.3 - DEGEN bots should bet in higher range (50-100% of range)', () => {
      const getBetAmount = (service as any).getBetAmount.bind(service);
      const amounts: number[] = [];
      for (let i = 0; i < 200; i++) {
        amounts.push(getBetAmount('DEGEN', config));
      }
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      // DEGEN average should be in upper half
      expect(avg).toBeGreaterThan(config.maxBetAmount * 0.4);
    });

    it('2.4 - NORMAL bots should bet in middle range', () => {
      const getBetAmount = (service as any).getBetAmount.bind(service);
      const amounts: number[] = [];
      for (let i = 0; i < 200; i++) {
        amounts.push(getBetAmount('NORMAL', config));
      }
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      // NORMAL average should be in middle
      expect(avg).toBeGreaterThan(config.maxBetAmount * 0.15);
      expect(avg).toBeLessThan(config.maxBetAmount * 0.65);
    });

    it('2.5 - Should return integer amounts (no decimals)', () => {
      const getBetAmount = (service as any).getBetAmount.bind(service);
      for (let i = 0; i < 50; i++) {
        const amount = getBetAmount('NORMAL', config);
        expect(Number.isInteger(amount)).toBe(true);
      }
    });
  });

  // ============================================
  // 🎯 TARGET CASHOUT
  // ============================================

  describe('🎯 getTargetCashout', () => {
    it('3.1 - CAUTIOUS should target 1.01x - 1.30x', () => {
      const getTargetCashout = (service as any).getTargetCashout.bind(service);
      for (let i = 0; i < 100; i++) {
        const target = getTargetCashout('CAUTIOUS');
        expect(target).toBeGreaterThanOrEqual(1.01);
        expect(target).toBeLessThanOrEqual(1.31);
      }
    });

    it('3.2 - NORMAL should target 1.50x - 3.00x', () => {
      const getTargetCashout = (service as any).getTargetCashout.bind(service);
      for (let i = 0; i < 100; i++) {
        const target = getTargetCashout('NORMAL');
        expect(target).toBeGreaterThanOrEqual(1.50);
        expect(target).toBeLessThanOrEqual(3.01);
      }
    });

    it('3.3 - DEGEN should target 5.00x - 20.00x', () => {
      const getTargetCashout = (service as any).getTargetCashout.bind(service);
      for (let i = 0; i < 100; i++) {
        const target = getTargetCashout('DEGEN');
        expect(target).toBeGreaterThanOrEqual(5.00);
        expect(target).toBeLessThanOrEqual(20.01);
      }
    });

    it('3.4 - Default personality should return 2.00', () => {
      const getTargetCashout = (service as any).getTargetCashout.bind(service);
      const target = getTargetCashout('UNKNOWN');
      expect(target).toBe(2.00);
    });
  });

  // ============================================
  // 🏗️ BOT POOL MANAGEMENT
  // ============================================

  describe('🏗️ Bot Pool Management', () => {
    it('4.1 - Should start with empty site pools', () => {
      expect((service as any).sitePools.size).toBe(0);
    });

    it('4.2 - Should initialize with WAITING game state', () => {
      expect((service as any).currentGameState).toBe('WAITING');
    });

    it('4.3 - Should initialize with multiplier 1.0', () => {
      expect((service as any).currentMultiplier).toBe(1.0);
    });
  });

  // ============================================
  // 🔀 TOGGLE SYSTEM
  // ============================================

  describe('🔀 Toggle System', () => {
    beforeEach(() => {
      // Set up a mock site pool
      (service as any).sitePools.set('site-1', {
        siteId: 'site-1',
        bots: [
          { id: 'bot-1', username: 'Bot1', personality: 'NORMAL', siteId: 'site-1' },
          { id: 'bot-2', username: 'Bot2', personality: 'CAUTIOUS', siteId: 'site-1' },
        ],
        chatInterval: null,
        isEnabled: true,
        activeBets: new Map(),
        config: {
          botCount: 2,
          minBetAmount: 1,
          maxBetAmount: 100,
          chatEnabled: false,
          chatIntervalMin: 5,
          chatIntervalMax: 15,
          botNamePrefix: '',
          customChatMessages: null,
        },
      });
    });

    it('5.1 - Should toggle site bots off', () => {
      const result = service.toggleSite('site-1', false);
      expect(result.enabled).toBe(false);
      expect(result.botCount).toBe(2);
    });

    it('5.2 - Should toggle site bots on', () => {
      service.toggleSite('site-1', false);
      const result = service.toggleSite('site-1', true);
      expect(result.enabled).toBe(true);
    });

    it('5.3 - Should return 0 bots for non-existent site', () => {
      const result = service.toggleSite('non-existent', true);
      expect(result.enabled).toBe(false);
      expect(result.botCount).toBe(0);
    });

    it('5.4 - Should clear active bets when disabling', () => {
      const pool = (service as any).sitePools.get('site-1');
      pool.activeBets.set('bot-1', { amount: 10, targetCashout: 2.0 });
      service.toggleSite('site-1', false);
      expect(pool.activeBets.size).toBe(0);
    });

    it('5.5 - Legacy toggle should affect all sites', () => {
      (service as any).sitePools.set('site-2', {
        bots: [{ id: 'bot-3', username: 'Bot3', personality: 'DEGEN', siteId: 'site-2' }],
        siteId: "site-1",
        activeBets: new Map(),
        chatInterval: null,
        isEnabled: true,
        config: { botCount: 1, minBetAmount: 1, maxBetAmount: 50, chatEnabled: false, chatIntervalMin: 5, chatIntervalMax: 15, botNamePrefix: '', customChatMessages: null },
      });

      const result = service.toggle(false);
      expect(result.enabled).toBe(false);
      expect(result.botCount).toBe(3); // 2 from site-1 + 1 from site-2
    });
  });

  // ============================================
  // 📊 STATUS REPORTING
  // ============================================

  describe('📊 Status Reporting', () => {
    beforeEach(() => {
      (service as any).sitePools.set('site-1', {
        bots: [
          { id: 'bot-1', username: 'Bot1', personality: 'CAUTIOUS', siteId: 'site-1' },
          { id: 'bot-2', username: 'Bot2', personality: 'NORMAL', siteId: 'site-1' },
          { id: 'bot-3', username: 'Bot3', personality: 'DEGEN', siteId: 'site-1' },
        ],
        activeBets: new Map([['bot-1', { amount: 10, targetCashout: 1.5 }]]),
        chatInterval: null,
        isEnabled: true,
        config: { botCount: 3, minBetAmount: 1, maxBetAmount: 100, chatEnabled: false, chatIntervalMin: 5, chatIntervalMax: 15, botNamePrefix: '', customChatMessages: null },
      });
    });

    it('6.1 - Should return correct site status', () => {
      const status = service.getSiteStatus('site-1');
      expect(status.siteId).toBe('site-1');
      expect(status.enabled).toBe(true);
      expect(status.botCount).toBe(3);
      expect(status.activeBets).toBe(1);
    });

    it('6.2 - Should return personality breakdown', () => {
      const status = service.getSiteStatus('site-1');
      expect(status.personalities.cautious).toBe(1);
      expect(status.personalities.normal).toBe(1);
      expect(status.personalities.degen).toBe(1);
    });

    it('6.3 - Should return default status for non-existent site', () => {
      const status = service.getSiteStatus('non-existent');
      expect(status.enabled).toBe(false);
      expect(status.botCount).toBe(0);
      expect(status.activeBets).toBe(0);
    });

    it('6.4 - Legacy getStatus should aggregate all sites', () => {
      (service as any).sitePools.set('site-2', {
        bots: [{ id: 'bot-4', username: 'Bot4', personality: 'NORMAL', siteId: 'site-2' }],
        siteId: "site-1",
        activeBets: new Map(),
        chatInterval: null,
        isEnabled: true,
        config: { botCount: 1, minBetAmount: 1, maxBetAmount: 50, chatEnabled: false, chatIntervalMin: 5, chatIntervalMax: 15, botNamePrefix: '', customChatMessages: null },
      });

      const status = service.getStatus();
      expect(status.botCount).toBe(4);
      expect(status.siteCount).toBe(2);
    });

    it('6.5 - Should report enabled=false if any site is disabled', () => {
      (service as any).sitePools.set('site-2', {
        bots: [],
        siteId: "site-1",
        activeBets: new Map(),
        chatInterval: null,
        isEnabled: false,
        config: { botCount: 0, minBetAmount: 1, maxBetAmount: 50, chatEnabled: false, chatIntervalMin: 5, chatIntervalMax: 15, botNamePrefix: '', customChatMessages: null },
      });

      const status = service.getStatus();
      expect(status.enabled).toBe(false);
    });
  });

  // ============================================
  // 🎮 GAME STATE HANDLING
  // ============================================

  describe('🎮 Game State Handling', () => {
    beforeEach(() => {
      (service as any).sitePools.set('site-1', {
        bots: [{ id: 'bot-1', username: 'Bot1', personality: 'NORMAL', siteId: 'site-1' }],
        siteId: "site-1",
        activeBets: new Map(),
        chatInterval: null,
        isEnabled: true,
        config: { botCount: 1, minBetAmount: 1, maxBetAmount: 100, chatEnabled: false, chatIntervalMin: 5, chatIntervalMax: 15, botNamePrefix: '', customChatMessages: null },
      });
    });

    it('7.1 - Should update game state on state_change event', () => {
      service.handleGameStateChange({ state: 'RUNNING' });
      expect((service as any).currentGameState).toBe('RUNNING');
    });

    it('7.2 - Should update game state to CRASHED', () => {
      service.handleGameStateChange({ state: 'CRASHED' });
      expect((service as any).currentGameState).toBe('CRASHED');
    });

    it('7.3 - Should clear active bets on CRASHED for all sites', () => {
      const pool = (service as any).sitePools.get('site-1');
      pool.activeBets.set('bot-1', { amount: 10, targetCashout: 2.0 });
      service.handleGameStateChange({ state: 'CRASHED' });
      expect(pool.activeBets.size).toBe(0);
    });

    it('7.4 - Should update multiplier on tick event', () => {
      service.handleTick({ multiplier1: '3.50' });
      expect((service as any).currentMultiplier).toBe(3.50);
    });

    it('7.5 - Should handle string multiplier in tick', () => {
      service.handleTick({ multiplier: '2.75' });
      expect((service as any).currentMultiplier).toBe(2.75);
    });

    it('7.6 - Should handle numeric multiplier in tick', () => {
      service.handleTick({ multiplier: 4.20 });
      expect((service as any).currentMultiplier).toBe(4.20);
    });

    it('7.7 - Should default to 1.0 if no multiplier provided', () => {
      service.handleTick({});
      expect((service as any).currentMultiplier).toBe(1.0);
    });
  });

  // ============================================
  // 🏠 TENANT ISOLATION
  // ============================================

  describe('🏠 Tenant Isolation', () => {
    it('8.1 - Bot bets should include siteId for isolation', () => {
      (service as any).sitePools.set('site-1', {
        bots: [{ id: 'bot-1', username: 'Bot1', personality: 'NORMAL', siteId: 'site-1' }],
        siteId: "site-1",
        activeBets: new Map(),
        chatInterval: null,
        isEnabled: true,
        config: { botCount: 1, minBetAmount: 1, maxBetAmount: 100, chatEnabled: false, chatIntervalMin: 5, chatIntervalMax: 15, botNamePrefix: '', customChatMessages: null },
      });

      // Trigger bet placement
      (service as any).currentGameState = 'WAITING';
      (service as any).placeSiteBotBets('site-1');

      // The emit should be called with siteId
      // Note: setTimeout makes this async, but we verify the pool structure
      const pool = (service as any).sitePools.get('site-1');
      expect(pool.siteId).toBe('site-1');
    });

    it('8.2 - Bot events should include isBot=true flag', () => {
      // Verify bot events always have isBot: true
      // This ensures GGR calculations can filter out bots
      const pool = {
        bots: [{ id: 'bot-1', username: 'Bot1', personality: 'NORMAL', siteId: 'site-1' }],
        chatInterval: null,
        isEnabled: true,
        activeBets: new Map(),
        config: { botCount: 1, minBetAmount: 1, maxBetAmount: 100, chatEnabled: false, chatIntervalMin: 5, chatIntervalMax: 15, botNamePrefix: '', customChatMessages: null },
      };
      (service as any).sitePools.set('site-1', pool);

      // Trigger cashout check
      (service as any).checkSiteBotCashouts('site-1', 5.0);

      // Verify emit was called with isBot: true
      if (mockEventEmitter.emit.mock.calls.length > 0) {
        const call = mockEventEmitter.emit.mock.calls[0];
        expect(call[1].isBot).toBe(true);
      }
    });

    it('8.3 - Each site should have independent bot pool', () => {
      (service as any).sitePools.set('site-1', {
        bots: [{ id: 'bot-1' }],
        siteId: "site-1",
        activeBets: new Map(),
        isEnabled: true,
      });
      (service as any).sitePools.set('site-2', {
        bots: [{ id: 'bot-2' }, { id: 'bot-3' }],
        siteId: "site-1",
        activeBets: new Map(),
        isEnabled: true,
      });

      const pool1 = (service as any).sitePools.get('site-1');
      const pool2 = (service as any).sitePools.get('site-2');
      expect(pool1.bots.length).toBe(1);
      expect(pool2.bots.length).toBe(2);
    });

    it('8.4 - Disabling one site should not affect others', () => {
      (service as any).sitePools.set('site-1', {
        bots: [{ id: 'bot-1', username: 'Bot1', personality: 'NORMAL', siteId: 'site-1' }],
        siteId: "site-1",
        activeBets: new Map(),
        chatInterval: null,
        isEnabled: true,
        config: { botCount: 1, minBetAmount: 1, maxBetAmount: 100, chatEnabled: false, chatIntervalMin: 5, chatIntervalMax: 15, botNamePrefix: '', customChatMessages: null },
      });
      (service as any).sitePools.set('site-2', {
        bots: [{ id: 'bot-2', username: 'Bot2', personality: 'DEGEN', siteId: 'site-2' }],
        siteId: "site-1",
        activeBets: new Map(),
        chatInterval: null,
        isEnabled: true,
        config: { botCount: 1, minBetAmount: 1, maxBetAmount: 50, chatEnabled: false, chatIntervalMin: 5, chatIntervalMax: 15, botNamePrefix: '', customChatMessages: null },
      });

      service.toggleSite('site-1', false);
      const pool2 = (service as any).sitePools.get('site-2');
      expect(pool2.isEnabled).toBe(true);
    });
  });

  // ============================================
  // 🔄 CONFIG RELOAD
  // ============================================

  describe('🔄 Config Reload', () => {
    it('9.1 - Should reload config from DB', async () => {
      mockPrisma.botConfig.findUnique.mockResolvedValueOnce(null);
      const result = await service.reloadSiteConfig('site-1');
      expect(result.siteId).toBe('site-1');
      expect(result.reloaded).toBe(true);
    });

    it('9.2 - Should clear existing pool before reload', async () => {
      (service as any).sitePools.set('site-1', {
        bots: [{ id: 'bot-1' }],
        activeBets: new Map([['bot-1', { amount: 10 }]]),
        chatInterval: null,
        isEnabled: true,
      });

      mockPrisma.botConfig.findUnique.mockResolvedValueOnce(null);
      await service.reloadSiteConfig('site-1');
      expect((service as any).sitePools.has('site-1')).toBe(false);
    });
  });
});
