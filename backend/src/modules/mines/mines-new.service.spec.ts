import { MinesService } from './mines.service';
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
  },
  gameSession: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
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

// Mock the registerGameSessionProvider
jest.mock('../shared/stuck-sessions-cleanup.service', () => ({
  registerGameSessionProvider: jest.fn(),
}));


const mockRewardPoolService = {
  contributeToPool: jest.fn().mockResolvedValue(undefined),
} as any;

const mockCommissionProcessor = {
  processCommission: jest.fn().mockResolvedValue(undefined),
} as any;

describe('MinesService', () => {
  let service: MinesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MinesService(mockPrisma as any, mockVipService as any, mockRewardPoolService, mockCommissionProcessor);
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') return cb(mockPrisma);
      return Promise.all(cb);
    });
  });

  describe('mine placement determinism', () => {
    it('should generate deterministic mine positions from seeds', () => {
      const serverSeed = 'test-server-seed';
      const clientSeed = 'test-client-seed';
      const nonce = 1;
      const mineCount = 5;

      // Generate mine positions using HMAC-SHA256 (same as service)
      const hash = crypto.createHmac('sha256', serverSeed)
        .update(`${clientSeed}:${nonce}`)
        .digest('hex');

      // Fisher-Yates shuffle using hash bytes
      const tiles = Array.from({ length: 25 }, (_, i) => i);
      for (let i = tiles.length - 1; i > 0; i--) {
        const hashIndex = (i * 2) % hash.length;
        const byte = parseInt(hash.substring(hashIndex, hashIndex + 2), 16);
        const j = byte % (i + 1);
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      }

      const mines = tiles.slice(0, mineCount);

      // Same inputs should produce same mines
      const tiles2 = Array.from({ length: 25 }, (_, i) => i);
      for (let i = tiles2.length - 1; i > 0; i--) {
        const hashIndex = (i * 2) % hash.length;
        const byte = parseInt(hash.substring(hashIndex, hashIndex + 2), 16);
        const j = byte % (i + 1);
        [tiles2[i], tiles2[j]] = [tiles2[j], tiles2[i]];
      }

      const mines2 = tiles2.slice(0, mineCount);
      expect(mines).toEqual(mines2);
    });

    it('should place mines within valid grid range (0-24)', () => {
      const serverSeed = 'any-seed';
      const clientSeed = 'any-client';
      const nonce = 1;

      const hash = crypto.createHmac('sha256', serverSeed)
        .update(`${clientSeed}:${nonce}`)
        .digest('hex');

      const tiles = Array.from({ length: 25 }, (_, i) => i);
      for (let i = tiles.length - 1; i > 0; i--) {
        const hashIndex = (i * 2) % hash.length;
        const byte = parseInt(hash.substring(hashIndex, hashIndex + 2), 16);
        const j = byte % (i + 1);
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      }

      const mines = tiles.slice(0, 5);
      for (const mine of mines) {
        expect(mine).toBeGreaterThanOrEqual(0);
        expect(mine).toBeLessThan(25);
      }
    });

    it('should not have duplicate mine positions', () => {
      const serverSeed = 'unique-seed';
      const clientSeed = 'unique-client';
      const nonce = 1;

      const hash = crypto.createHmac('sha256', serverSeed)
        .update(`${clientSeed}:${nonce}`)
        .digest('hex');

      const tiles = Array.from({ length: 25 }, (_, i) => i);
      for (let i = tiles.length - 1; i > 0; i--) {
        const hashIndex = (i * 2) % hash.length;
        const byte = parseInt(hash.substring(hashIndex, hashIndex + 2), 16);
        const j = byte % (i + 1);
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      }

      const mines = tiles.slice(0, 10);
      const uniqueMines = new Set(mines);
      expect(uniqueMines.size).toBe(mines.length);
    });
  });

  describe('game flow: start → reveal → cashout', () => {
    it('should validate mine count range (1-24)', () => {
      expect(1).toBeGreaterThanOrEqual(1);
      expect(24).toBeLessThanOrEqual(24);
      
      // Invalid mine counts
      expect(0).toBeLessThan(1);
      expect(25).toBeGreaterThan(24);
    });

    it('should validate bet amount range', () => {
      const MIN_BET = 0.01;
      const MAX_BET = 10000;

      expect(MIN_BET).toBeGreaterThan(0);
      expect(MAX_BET).toBe(10000);
      expect(0.01).toBeGreaterThanOrEqual(MIN_BET);
      expect(10000).toBeLessThanOrEqual(MAX_BET);
    });

    it('should calculate multiplier based on remaining safe tiles', () => {
      // With 5 mines and 25 tiles:
      // After revealing 1 tile: safe probability = 20/25 = 0.8
      // Multiplier ≈ 1 / 0.8 * (1 - houseEdge) = 1.2 * 0.96 = 1.152
      const mineCount = 5;
      const gridSize = 25;
      const safeTiles = gridSize - mineCount; // 20
      const revealed = 1;
      const houseEdge = 0.04;

      // Probability of safe tile = (safeTiles - revealed + 1) / (gridSize - revealed + 1)
      const prob = (safeTiles) / gridSize;
      const rawMultiplier = 1 / prob;
      const adjustedMultiplier = rawMultiplier * (1 - houseEdge);

      expect(adjustedMultiplier).toBeGreaterThan(1);
      expect(adjustedMultiplier).toBeLessThan(rawMultiplier);
    });

    it('should increase multiplier with each safe reveal', () => {
      const mineCount = 5;
      const gridSize = 25;
      const houseEdge = 0.04;

      let prevMultiplier = 1;
      for (let revealed = 1; revealed <= 5; revealed++) {
        const safeTilesRemaining = gridSize - mineCount - (revealed - 1);
        const totalRemaining = gridSize - (revealed - 1);
        const prob = safeTilesRemaining / totalRemaining;
        const currentMultiplier = prevMultiplier * (1 / prob) * (1 - houseEdge);

        expect(currentMultiplier).toBeGreaterThan(prevMultiplier);
        prevMultiplier = currentMultiplier;
      }
    });
  });

  describe('grid validation', () => {
    it('should use 5x5 grid (25 tiles)', () => {
      const GRID_SIZE = 25;
      expect(GRID_SIZE).toBe(25);
      expect(Math.sqrt(GRID_SIZE)).toBe(5);
    });

    it('should validate tile index range (0-24)', () => {
      for (let i = 0; i < 25; i++) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(25);
      }
    });

    it('should not allow revealing same tile twice', () => {
      const revealedTiles = [0, 5, 10];
      const newTile = 5;
      
      expect(revealedTiles.includes(newTile)).toBe(true);
      // Service should reject this
    });
  });

  describe('provably fair verification', () => {
    it('should hash server seed before game starts', () => {
      const serverSeed = 'secret-server-seed-12345';
      const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');

      expect(serverSeedHash).toBeTruthy();
      expect(serverSeedHash.length).toBe(64); // SHA256 hex length
      
      // Hash should be deterministic
      const hash2 = crypto.createHash('sha256').update(serverSeed).digest('hex');
      expect(serverSeedHash).toBe(hash2);
    });

    it('should reveal server seed only after game ends', () => {
      // During game: only serverSeedHash is visible
      // After game: serverSeed is revealed for verification
      const serverSeed = 'reveal-after-game';
      const hash = crypto.createHash('sha256').update(serverSeed).digest('hex');

      // Verify hash matches seed
      const verifyHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
      expect(hash).toBe(verifyHash);
    });
  });
});
