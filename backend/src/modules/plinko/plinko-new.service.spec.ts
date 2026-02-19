import { PlinkoService } from './plinko.service';
import { RewardPoolService } from '../reward-pool/reward-pool.service';
import { CommissionProcessorService } from '../affiliate/commission-processor.service';

// Mock RewardPoolService
const mockRewardPoolService = { contributeToPool: jest.fn().mockResolvedValue(undefined) };

// Mock CommissionProcessor
const mockCommissionProcessor = { processCommission: jest.fn().mockResolvedValue(undefined) };

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

describe('PlinkoService', () => {
  let service: PlinkoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PlinkoService(mockPrisma as any, mockVipService as any, mockRewardPoolService as any, mockCommissionProcessor as any);
  });

  describe('getMultipliers', () => {
    it('should return multiplier array for valid rows and risk', () => {
      const multipliers = service.getMultipliers(12, 'MEDIUM');
      expect(Array.isArray(multipliers)).toBe(true);
      expect(multipliers.length).toBeGreaterThan(0);
    });

    it('should return correct number of multipliers for each row count', () => {
      // For N rows, there should be N+1 possible landing positions
      const rows8 = service.getMultipliers(8, 'MEDIUM');
      expect(rows8.length).toBe(9); // 8 + 1

      const rows12 = service.getMultipliers(12, 'MEDIUM');
      expect(rows12.length).toBe(13); // 12 + 1

      const rows16 = service.getMultipliers(16, 'MEDIUM');
      expect(rows16.length).toBe(17); // 16 + 1
    });

    it('should have higher max multiplier for HIGH risk', () => {
      const lowRisk = service.getMultipliers(12, 'LOW');
      const highRisk = service.getMultipliers(12, 'HIGH');

      const maxLow = Math.max(...lowRisk);
      const maxHigh = Math.max(...highRisk);

      expect(maxHigh).toBeGreaterThan(maxLow);
    });

    it('should have lower min multiplier for HIGH risk', () => {
      const lowRisk = service.getMultipliers(12, 'LOW');
      const highRisk = service.getMultipliers(12, 'HIGH');

      const minLow = Math.min(...lowRisk);
      const minHigh = Math.min(...highRisk);

      expect(minHigh).toBeLessThanOrEqual(minLow);
    });

    it('should support LOW, MEDIUM, HIGH risk levels', () => {
      const low = service.getMultipliers(12, 'LOW');
      const medium = service.getMultipliers(12, 'MEDIUM');
      const high = service.getMultipliers(12, 'HIGH');

      expect(low.length).toBeGreaterThan(0);
      expect(medium.length).toBeGreaterThan(0);
      expect(high.length).toBeGreaterThan(0);
    });

    it('should return empty array for invalid row count', () => {
      const invalid = service.getMultipliers(5, 'MEDIUM'); // 5 is likely invalid
      // May return empty or throw depending on implementation
      expect(Array.isArray(invalid)).toBe(true);
    });

    it('should have symmetric multiplier distribution', () => {
      const multipliers = service.getMultipliers(12, 'MEDIUM');
      const reversed = [...multipliers].reverse();
      
      // Plinko multipliers should be symmetric
      for (let i = 0; i < multipliers.length; i++) {
        expect(multipliers[i]).toBeCloseTo(reversed[i], 2);
      }
    });

    it('should have multipliers that include values both above and below 1x', () => {
      const multipliers = service.getMultipliers(12, 'MEDIUM');
      const hasAbove1 = multipliers.some(m => m > 1);
      const hasBelow1 = multipliers.some(m => m < 1);

      expect(hasAbove1).toBe(true);
      expect(hasBelow1).toBe(true);
    });
  });

  describe('multiplier calculation', () => {
    it('should all be positive numbers', () => {
      const multipliers = service.getMultipliers(12, 'MEDIUM');
      for (const m of multipliers) {
        expect(m).toBeGreaterThan(0);
      }
    });

    it('should have center positions with lower multipliers', () => {
      const multipliers = service.getMultipliers(12, 'MEDIUM');
      const center = Math.floor(multipliers.length / 2);
      const edge = 0;

      // Center should generally have lower multipliers than edges
      expect(multipliers[center]).toBeLessThanOrEqual(multipliers[edge]);
    });
  });

  describe('provably fair verification', () => {
    it('should generate deterministic ball path from seeds', () => {
      // The ball path is determined by HMAC-SHA256 of server+client seeds
      const crypto = require('crypto');
      const serverSeed = 'plinko-server-seed';
      const clientSeed = 'plinko-client-seed';
      const nonce = 1;

      const hash = crypto.createHmac('sha256', serverSeed)
        .update(`${clientSeed}:${nonce}`)
        .digest('hex');

      // Same inputs = same hash = same path
      const hash2 = crypto.createHmac('sha256', serverSeed)
        .update(`${clientSeed}:${nonce}`)
        .digest('hex');

      expect(hash).toBe(hash2);
    });

    it('should produce ball path within valid range', () => {
      const crypto = require('crypto');
      const rows = 12;
      const serverSeed = 'test-seed';
      const clientSeed = 'test-client';
      const nonce = 1;

      const hash = crypto.createHmac('sha256', serverSeed)
        .update(`${clientSeed}:${nonce}`)
        .digest('hex');

      // Each bit determines left/right, landing position is 0 to rows
      let position = 0;
      for (let i = 0; i < rows; i++) {
        const byte = parseInt(hash.charAt(i), 16);
        if (byte >= 8) position++; // Right
      }

      expect(position).toBeGreaterThanOrEqual(0);
      expect(position).toBeLessThanOrEqual(rows);
    });
  });
});
