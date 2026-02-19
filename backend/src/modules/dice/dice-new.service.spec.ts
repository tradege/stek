import { DiceService } from './dice.service';
import * as crypto from 'crypto';
import { RewardPoolService } from '../reward-pool/reward-pool.service';
import { CommissionProcessorService } from '../affiliate/commission-processor.service';

// Mock VipService
const mockVipService = {
  processRakeback: jest.fn().mockResolvedValue(undefined),
  checkLevelUp: jest.fn().mockResolvedValue({ leveledUp: false, newLevel: 0, tierName: 'Bronze' }),
};

// Mock PrismaService
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  wallet: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  bet: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  serverSeed: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  siteConfiguration: {
    findUnique: jest.fn(),
  },
  gameConfig: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

// Mock game-tenant helper
jest.mock('../../common/helpers/game-tenant.helper', () => ({
  getGameConfig: jest.fn().mockResolvedValue({
    siteId: 'default-site-001',
    houseEdge: 0.04,
    maxBetAmount: 10000,
    maxPayoutPerBet: 100000,
    maxPayoutPerDay: 500000,
  }),
  checkRiskLimits: jest.fn().mockResolvedValue(true),
  recordPayout: jest.fn().mockResolvedValue(undefined),
}));


const mockRewardPoolService = {
  contributeToPool: jest.fn().mockResolvedValue(undefined),
} as any;

const mockCommissionProcessor = {
  processCommission: jest.fn().mockResolvedValue(undefined),
} as any;

describe('DiceService', () => {
  let service: DiceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DiceService(mockPrisma as any, mockVipService as any, mockRewardPoolService, mockCommissionProcessor);
  });

  describe('calculateWinChance', () => {
    it('should calculate win chance for UNDER condition', () => {
      const chance = service.calculateWinChance(50, 'UNDER');
      expect(chance).toBe(50);
    });

    it('should calculate win chance for OVER condition', () => {
      const chance = service.calculateWinChance(50, 'OVER');
      expect(chance).toBe(50);
    });

    it('should handle low target UNDER', () => {
      const chance = service.calculateWinChance(10, 'UNDER');
      expect(chance).toBe(10);
    });

    it('should handle high target OVER', () => {
      const chance = service.calculateWinChance(90, 'OVER');
      expect(chance).toBe(10);
    });

    it('should handle edge case targets', () => {
      expect(service.calculateWinChance(0.01, 'UNDER')).toBeCloseTo(0.01, 2);
      expect(service.calculateWinChance(99.98, 'OVER')).toBeCloseTo(0.02, 2);
    });
  });

  describe('calculateMultiplier', () => {
    it('should calculate correct multiplier with house edge', () => {
      // 50% win chance, 4% house edge
      // Multiplier = (100 - 4) / 50 = 1.92
      const multiplier = service.calculateMultiplier(50, 0.04);
      expect(multiplier).toBeCloseTo(1.92, 2);
    });

    it('should return higher multiplier for lower win chance', () => {
      const lowChance = service.calculateMultiplier(10, 0.04);
      const highChance = service.calculateMultiplier(90, 0.04);
      expect(lowChance).toBeGreaterThan(highChance);
    });

    it('should return multiplier > 1 for reasonable win chances', () => {
      const multiplier = service.calculateMultiplier(50, 0.04);
      expect(multiplier).toBeGreaterThan(1);
    });

    it('should account for house edge (multiplier < fair odds)', () => {
      // Fair odds for 50% = 2.0, with 4% edge should be < 2.0
      const multiplier = service.calculateMultiplier(50, 0.04);
      expect(multiplier).toBeLessThan(2.0);
    });
  });

  describe('generateRoll', () => {
    it('should generate deterministic roll from seeds', () => {
      const roll1 = service.generateRoll('server-seed-1', 'client-seed-1', 1);
      const roll2 = service.generateRoll('server-seed-1', 'client-seed-1', 1);
      expect(roll1).toBe(roll2);
    });

    it('should generate different rolls for different nonces', () => {
      const roll1 = service.generateRoll('server-seed', 'client-seed', 1);
      const roll2 = service.generateRoll('server-seed', 'client-seed', 2);
      // Very unlikely to be the same
      expect(roll1 === roll2).toBe(false);
    });

    it('should generate roll between 0 and 99.99', () => {
      for (let i = 0; i < 100; i++) {
        const roll = service.generateRoll(`seed-${i}`, 'client', i);
        expect(roll).toBeGreaterThanOrEqual(0);
        expect(roll).toBeLessThan(100);
      }
    });

    it('should be provably fair (reproducible with same inputs)', () => {
      const serverSeed = 'test-server-seed-abc123';
      const clientSeed = 'test-client-seed-xyz789';
      const nonce = 42;

      // Manually compute expected roll
      const hash = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex');
      const value = parseInt(hash.substring(0, 8), 16);
      const expectedRoll = parseFloat(((value % 10000) / 100).toFixed(2));

      const actualRoll = service.generateRoll(serverSeed, clientSeed, nonce);
      expect(actualRoll).toBe(expectedRoll);
    });
  });

  describe('isWinningRoll', () => {
    it('should return true when roll is under target (UNDER condition)', () => {
      expect(service.isWinningRoll(30, 50, 'UNDER')).toBe(true);
    });

    it('should return false when roll is over target (UNDER condition)', () => {
      expect(service.isWinningRoll(60, 50, 'UNDER')).toBe(false);
    });

    it('should return true when roll is over target (OVER condition)', () => {
      expect(service.isWinningRoll(60, 50, 'OVER')).toBe(true);
    });

    it('should return false when roll is under target (OVER condition)', () => {
      expect(service.isWinningRoll(30, 50, 'OVER')).toBe(false);
    });

    it('should return false when roll equals target (UNDER)', () => {
      expect(service.isWinningRoll(50, 50, 'UNDER')).toBe(false);
    });

    it('should return false when roll equals target (OVER)', () => {
      expect(service.isWinningRoll(50, 50, 'OVER')).toBe(false);
    });

    it('should handle edge case: roll = 0', () => {
      expect(service.isWinningRoll(0, 50, 'UNDER')).toBe(true);
      expect(service.isWinningRoll(0, 50, 'OVER')).toBe(false);
    });
  });

  describe('provably fair verification', () => {
    it('should verify a roll matches the expected output', () => {
      const serverSeed = 'my-secret-server-seed';
      const clientSeed = 'user-provided-client-seed';
      const nonce = 1;

      const roll = service.generateRoll(serverSeed, clientSeed, nonce);

      // Verify: same inputs should produce same roll
      const verifiedRoll = service.generateRoll(serverSeed, clientSeed, nonce);
      expect(roll).toBe(verifiedRoll);
    });

    it('should produce different results with different server seeds', () => {
      const clientSeed = 'same-client-seed';
      const nonce = 1;

      const roll1 = service.generateRoll('server-seed-A', clientSeed, nonce);
      const roll2 = service.generateRoll('server-seed-B', clientSeed, nonce);

      expect(roll1).not.toBe(roll2);
    });
  });
});
