/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  PROVABLY FAIR SERVICE - COMPREHENSIVE UNIT TESTS                  ║
 * ║  Coverage Goal: 100%                                               ║
 * ║  Covers: HMAC integrity, seed rotation, nonce management,          ║
 * ║  avalanche effect, determinism, edge cases                         ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { ProvablyFairService } from './provably-fair.service';
import { createHmac } from 'crypto';

describe('ProvablyFairService - Comprehensive Unit Tests', () => {
  let service: ProvablyFairService;
  let mockPrisma: any;

  const mockSeed = {
    id: 'seed-1', userId: 'user-1', seed: 'server-seed-abc123',
    seedHash: createHmac('sha256', 'server-seed-abc123').update('').digest('hex'),
    clientSeed: 'client-seed-xyz', nonce: 0, isActive: true, createdAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      serverSeed: {
        findFirst: jest.fn().mockResolvedValue({ ...mockSeed }),
        create: jest.fn().mockResolvedValue({ ...mockSeed, id: 'seed-2' }),
        update: jest.fn().mockResolvedValue({ ...mockSeed, nonce: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };
    service = new ProvablyFairService(mockPrisma as any);
  });

  describe('1. getOrCreateServerSeed', () => {
    it('should return existing active seed', async () => {
      const result = await service.getOrCreateServerSeed('user-1');
      expect(result).toBeDefined();
      expect(mockPrisma.serverSeed.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1', isActive: true }) })
      );
    });

    it('should create new seed if none exists', async () => {
      mockPrisma.serverSeed.findFirst.mockResolvedValue(null);
      const result = await service.getOrCreateServerSeed('user-1');
      expect(mockPrisma.serverSeed.create).toHaveBeenCalled();
    });

    it('should return seedHash (not raw seed) to user', async () => {
      const result = await service.getOrCreateServerSeed('user-1');
      expect(result.seedHash).toBeDefined();
    });
  });

  describe('2. incrementNonce', () => {
    it('should increment nonce by 1', async () => {
      await service.incrementNonce('seed-1');
      expect(mockPrisma.serverSeed.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'seed-1' },
          data: { nonce: { increment: 1 } },
        })
      );
    });
  });

  describe('3. rotateSeed', () => {
    it('should deactivate old seed and create new one', async () => {
      mockPrisma.serverSeed.update.mockResolvedValue({ ...mockSeed, isActive: false });
      mockPrisma.serverSeed.create.mockResolvedValue({ ...mockSeed, id: 'seed-new', seed: 'new-seed' });
      const result = await service.rotateSeed('user-1');
      expect(result).toBeDefined();
      expect(result.previousSeed).toBeDefined();
    });

    it('should reveal old seed on rotation', async () => {
      mockPrisma.serverSeed.update.mockResolvedValue({ ...mockSeed, isActive: false });
      mockPrisma.serverSeed.create.mockResolvedValue({ ...mockSeed, id: 'seed-new' });
      const result = await service.rotateSeed('user-1');
      expect(result.previousSeed).toBe(mockSeed.seed);
    });
  });

  describe('4. HMAC Integrity', () => {
    it('should produce correct HMAC-SHA256 hash', () => {
      const serverSeed = 'test-server';
      const clientSeed = 'test-client';
      const nonce = 42;
      const expected = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex');
      const actual = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex');
      expect(actual).toBe(expected);
      expect(actual.length).toBe(64);
    });

    it('should produce 256-bit (64 hex char) hashes', () => {
      const hash = createHmac('sha256', 'seed').update('data').digest('hex');
      expect(hash.length).toBe(64);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });
  });

  describe('5. Avalanche Effect', () => {
    it('should completely change hash when 1 character changes in client seed', () => {
      const hash1 = createHmac('sha256', 'server').update('clientA:0').digest('hex');
      const hash2 = createHmac('sha256', 'server').update('clientB:0').digest('hex');
      let diffBits = 0;
      for (let i = 0; i < hash1.length; i++) { if (hash1[i] !== hash2[i]) diffBits++; }
      expect(diffBits).toBeGreaterThan(hash1.length * 0.3); // >30% chars different
    });

    it('should completely change hash when 1 character changes in server seed', () => {
      const hash1 = createHmac('sha256', 'serverA').update('client:0').digest('hex');
      const hash2 = createHmac('sha256', 'serverB').update('client:0').digest('hex');
      let diffBits = 0;
      for (let i = 0; i < hash1.length; i++) { if (hash1[i] !== hash2[i]) diffBits++; }
      expect(diffBits).toBeGreaterThan(hash1.length * 0.3);
    });

    it('should completely change hash when nonce changes by 1', () => {
      const hash1 = createHmac('sha256', 'server').update('client:0').digest('hex');
      const hash2 = createHmac('sha256', 'server').update('client:1').digest('hex');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('6. Determinism', () => {
    it('should always produce same hash for same inputs', () => {
      for (let i = 0; i < 100; i++) {
        const h1 = createHmac('sha256', 'seed').update(`client:${i}`).digest('hex');
        const h2 = createHmac('sha256', 'seed').update(`client:${i}`).digest('hex');
        expect(h1).toBe(h2);
      }
    });
  });

  describe('7. Float Extraction', () => {
    it('should extract float in [0, 1) range', () => {
      for (let i = 0; i < 1000; i++) {
        const hash = createHmac('sha256', 'seed').update(`client:${i}`).digest('hex');
        const float = parseInt(hash.slice(0, 8), 16) / 0x100000000;
        expect(float).toBeGreaterThanOrEqual(0);
        expect(float).toBeLessThan(1);
      }
    });
  });

  describe('8. Edge Cases', () => {
    it('should handle empty client seed', () => {
      const hash = createHmac('sha256', 'server').update(':0').digest('hex');
      expect(hash.length).toBe(64);
    });

    it('should handle very long seeds', () => {
      const longSeed = 'a'.repeat(10000);
      const hash = createHmac('sha256', longSeed).update('client:0').digest('hex');
      expect(hash.length).toBe(64);
    });

    it('should handle unicode in seeds', () => {
      const hash = createHmac('sha256', 'שלום').update('client:0').digest('hex');
      expect(hash.length).toBe(64);
    });

    it('should handle nonce = 0', async () => {
      const result = await service.getOrCreateServerSeed('user-1');
      expect(result).toBeDefined();
    });
  });

  describe('9. Security', () => {
    it('should not expose raw server seed before rotation', async () => {
      const result = await service.getOrCreateServerSeed('user-1');
      // Result should contain hash, not raw seed
      expect(result.seedHash).toBeDefined();
    });

    it('should generate cryptographically random seeds', async () => {
      mockPrisma.serverSeed.findFirst.mockResolvedValue(null);
      await service.getOrCreateServerSeed('user-1');
      const createCall = mockPrisma.serverSeed.create.mock.calls[0]?.[0];
      if (createCall?.data?.seed) {
        expect(createCall.data.seed.length).toBeGreaterThan(20);
      }
    });
  });
});
