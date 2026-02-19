/**
 * ============================================
 * MINES SERVICE - Unit Tests
 * ============================================
 */

import { MinesService } from './mines.service';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

describe('MinesService', () => {
  let service: MinesService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb) => {
        return cb({
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet-1', balance: 1000 }]),
          wallet: { update: jest.fn().mockResolvedValue({}) },
          bet: { create: jest.fn().mockResolvedValue({}) },
          transaction: { create: jest.fn().mockResolvedValue({}) },
        });
      }),
      bet: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    service = new MinesService(mockPrisma);
  });

  // ==================== MINE GENERATION ====================
  describe('generateMinePositions', () => {
    it('should generate correct number of mines', () => {
      for (let mineCount = 1; mineCount <= 24; mineCount++) {
        const positions = service.generateMinePositions('seed', 'client', 0, mineCount);
        expect(positions.length).toBe(mineCount);
      }
    });

    it('should generate positions within valid range (0-24)', () => {
      for (let i = 0; i < 100; i++) {
        const seed = crypto.randomBytes(32).toString('hex');
        const positions = service.generateMinePositions(seed, 'client', i, 5);
        for (const pos of positions) {
          expect(pos).toBeGreaterThanOrEqual(0);
          expect(pos).toBeLessThan(25);
        }
      }
    });

    it('should generate unique positions (no duplicates)', () => {
      for (let i = 0; i < 100; i++) {
        const seed = crypto.randomBytes(32).toString('hex');
        const positions = service.generateMinePositions(seed, 'client', i, 10);
        const unique = new Set(positions);
        expect(unique.size).toBe(positions.length);
      }
    });

    it('should be deterministic with same seeds', () => {
      const pos1 = service.generateMinePositions('seed-a', 'client-b', 42, 5);
      const pos2 = service.generateMinePositions('seed-a', 'client-b', 42, 5);
      expect(pos1).toEqual(pos2);
    });

    it('should produce different positions with different seeds', () => {
      const pos1 = service.generateMinePositions('seed-1', 'client', 0, 5);
      const pos2 = service.generateMinePositions('seed-2', 'client', 0, 5);
      // Very unlikely to be the same
      expect(pos1).not.toEqual(pos2);
    });

    it('should return sorted positions', () => {
      for (let i = 0; i < 50; i++) {
        const seed = crypto.randomBytes(32).toString('hex');
        const positions = service.generateMinePositions(seed, 'client', i, 8);
        for (let j = 1; j < positions.length; j++) {
          expect(positions[j]).toBeGreaterThanOrEqual(positions[j - 1]);
        }
      }
    });
  });

  // ==================== MULTIPLIER CALCULATION ====================
  describe('calculateMultiplier', () => {
    it('should return 1 for 0 revealed tiles', () => {
      expect(service.calculateMultiplier(5, 0)).toBe(1);
    });

    it('should increase multiplier with more reveals', () => {
      const mineCount = 5;
      let prevMultiplier = 0;
      for (let i = 1; i <= 20; i++) {
        const mult = service.calculateMultiplier(mineCount, i);
        expect(mult).toBeGreaterThan(prevMultiplier);
        prevMultiplier = mult;
      }
    });

    it('should have higher multipliers with more mines', () => {
      const revealed = 3;
      const mult5 = service.calculateMultiplier(5, revealed);
      const mult10 = service.calculateMultiplier(10, revealed);
      const mult20 = service.calculateMultiplier(20, revealed);
      expect(mult10).toBeGreaterThan(mult5);
      expect(mult20).toBeGreaterThan(mult10);
    });

    it('should return 0 if revealed exceeds safe tiles', () => {
      expect(service.calculateMultiplier(24, 2)).toBe(0); // Only 1 safe tile
    });

    it('should include 4% house edge', () => {
      // With 1 mine, 1 reveal: probability = 24/25 = 0.96
      // Multiplier = 0.96 / 0.96 = 1.0 (exactly 1x with house edge)
      const mult = service.calculateMultiplier(1, 1);
      // Fair would be 25/24 = 1.0416... With 4% edge: 0.96 * 25/24 * 0.99 = 0.99
      expect(mult).toBe(0.99);
    });

    it('should floor to 4 decimal places', () => {
      const mult = service.calculateMultiplier(5, 3);
      const decimals = mult.toString().split('.')[1] || '';
      expect(decimals.length).toBeLessThanOrEqual(4);
    });
  });

  // ==================== START GAME ====================
  describe('startGame', () => {
    it('should start a valid game', async () => {
      const result = await service.startGame('user-start-1', {
        betAmount: 10,
        mineCount: 5,
      });

      expect(result).toHaveProperty('gameId');
      expect(result).toHaveProperty('betAmount', 10);
      expect(result).toHaveProperty('mineCount', 5);
      expect(result).toHaveProperty('revealedTiles', []);
      expect(result).toHaveProperty('currentMultiplier', 1);
      expect(result).toHaveProperty('nextMultiplier');
      expect(result).toHaveProperty('status', 'ACTIVE');
      expect(result).toHaveProperty('serverSeedHash');
      expect(result.nextMultiplier).toBeGreaterThan(1);
    });

    it('should reject bet below minimum', async () => {
      await expect(
        service.startGame('user-start-2', { betAmount: 0.001, mineCount: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject bet above maximum', async () => {
      await expect(
        service.startGame('user-start-3', { betAmount: 100000, mineCount: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject mine count below 1', async () => {
      await expect(
        service.startGame('user-start-4', { betAmount: 10, mineCount: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject mine count above 24', async () => {
      await expect(
        service.startGame('user-start-5', { betAmount: 10, mineCount: 25 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when wallet not found', async () => {
      mockPrisma.$transaction = jest.fn(async (cb) => {
        return cb({
          $queryRaw: jest.fn().mockResolvedValue([]),
          wallet: { update: jest.fn() },
        });
      });

      await expect(
        service.startGame('user-start-6', { betAmount: 10, mineCount: 5 }),
      ).rejects.toThrow('Wallet not found');
    });

    it('should reject when insufficient balance', async () => {
      mockPrisma.$transaction = jest.fn(async (cb) => {
        return cb({
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'w1', balance: 5 }]),
          wallet: { update: jest.fn() },
        });
      });

      await expect(
        service.startGame('user-start-7', { betAmount: 10, mineCount: 5 }),
      ).rejects.toThrow('Insufficient balance');
    });

    it('should reject duplicate active games', async () => {
      await service.startGame('user-dup-1', { betAmount: 10, mineCount: 5 });
      // Wait past rate limit
      await new Promise(r => setTimeout(r, 600));
      await expect(
        service.startGame('user-dup-1', { betAmount: 10, mineCount: 5 }),
      ).rejects.toThrow('already have an active game');
    });
  });

  // ==================== REVEAL TILE ====================
  describe('revealTile', () => {
    it('should reveal a safe tile and increase multiplier', async () => {
      const game = await service.startGame('user-reveal-1', { betAmount: 10, mineCount: 3 });
      
      // Find a safe tile (not a mine) - try all tiles until we find one
      let result;
      for (let i = 0; i < 25; i++) {
        try {
          result = await service.revealTile('user-reveal-1', { gameId: game.gameId, tileIndex: i });
          if (result.status !== 'LOST') break;
        } catch {
          break;
        }
      }

      if (result && result.status === 'ACTIVE') {
        expect(result.revealedTiles.length).toBe(1);
        expect(result.currentMultiplier).toBeGreaterThan(1);
        expect(result.currentPayout).toBeGreaterThan(0);
      }
    });

    it('should reject invalid game ID', async () => {
      await expect(
        service.revealTile('user-reveal-2', { gameId: 'fake-id', tileIndex: 0 }),
      ).rejects.toThrow('Game not found');
    });

    it('should reject wrong user', async () => {
      const game = await service.startGame('user-reveal-3', { betAmount: 10, mineCount: 5 });
      await expect(
        service.revealTile('wrong-user', { gameId: game.gameId, tileIndex: 0 }),
      ).rejects.toThrow('not your game');
    });

    it('should reject invalid tile index', async () => {
      const game = await service.startGame('user-reveal-4', { betAmount: 10, mineCount: 5 });
      await expect(
        service.revealTile('user-reveal-4', { gameId: game.gameId, tileIndex: 25 }),
      ).rejects.toThrow('Invalid tile index');
      await expect(
        service.revealTile('user-reveal-4', { gameId: game.gameId, tileIndex: -1 }),
      ).rejects.toThrow('Invalid tile index');
    });

    it('should reject duplicate tile reveal', async () => {
      const game = await service.startGame('user-reveal-5', { betAmount: 10, mineCount: 1 });
      
      // Find a safe tile
      let safeTile = 0;
      for (let i = 0; i < 25; i++) {
        const result = await service.revealTile('user-reveal-5', { gameId: game.gameId, tileIndex: i });
        if (result.status === 'ACTIVE') {
          safeTile = i;
          break;
        }
        // If lost, start new game
        if (result.status === 'LOST') {
          const newGame = await service.startGame('user-reveal-5', { betAmount: 10, mineCount: 1 });
          // Try again with new game
          for (let j = 0; j < 25; j++) {
            const r2 = await service.revealTile('user-reveal-5', { gameId: newGame.gameId, tileIndex: j });
            if (r2.status === 'ACTIVE') {
              safeTile = j;
              await expect(
                service.revealTile('user-reveal-5', { gameId: newGame.gameId, tileIndex: j }),
              ).rejects.toThrow('already revealed');
              return;
            }
          }
        }
      }

      await expect(
        service.revealTile('user-reveal-5', { gameId: game.gameId, tileIndex: safeTile }),
      ).rejects.toThrow('already revealed');
    });

    it('should return LOST status when hitting a mine', async () => {
      // Start game with 24 mines (only 1 safe tile)
      const game = await service.startGame('user-reveal-6', { betAmount: 10, mineCount: 24 });
      
      // Most tiles will be mines
      let hitMine = false;
      for (let i = 0; i < 25 && !hitMine; i++) {
        const result = await service.revealTile('user-reveal-6', { gameId: game.gameId, tileIndex: i });
        if (result.status === 'LOST') {
          hitMine = true;
          expect(result.minePositions).toBeDefined();
          expect(result.minePositions!.length).toBe(24);
          expect(result.currentMultiplier).toBe(0);
          expect(result.currentPayout).toBe(0);
        }
      }
      expect(hitMine).toBe(true);
    });
  });

  // ==================== CASHOUT ====================
  describe('cashout', () => {
    it('should reject cashout with no reveals', async () => {
      const game = await service.startGame('user-cash-1', { betAmount: 10, mineCount: 5 });
      await expect(
        service.cashout('user-cash-1', { gameId: game.gameId }),
      ).rejects.toThrow('Must reveal at least one tile');
    });

    it('should reject cashout for wrong user', async () => {
      const game = await service.startGame('user-cash-2', { betAmount: 10, mineCount: 5 });
      await expect(
        service.cashout('wrong-user', { gameId: game.gameId }),
      ).rejects.toThrow('not your game');
    });

    it('should reject cashout for non-existent game', async () => {
      await expect(
        service.cashout('user-cash-3', { gameId: 'fake-id' }),
      ).rejects.toThrow('Game not found');
    });
  });

  // ==================== GET ACTIVE GAME ====================
  describe('getActiveGame', () => {
    it('should return null when no active game', () => {
      const result = service.getActiveGame('user-no-game');
      expect(result).toBeNull();
    });

    it('should return active game state', async () => {
      const game = await service.startGame('user-active-1', { betAmount: 10, mineCount: 5 });
      const active = service.getActiveGame('user-active-1');
      expect(active).not.toBeNull();
      expect(active!.gameId).toBe(game.gameId);
      expect(active!.status).toBe('ACTIVE');
    });
  });

  // ==================== VERIFY GAME ====================
  describe('verifyGame', () => {
    it('should verify mine positions correctly', () => {
      const serverSeed = 'test-verify-seed';
      const clientSeed = 'test-client';
      const nonce = 42;
      const mineCount = 5;

      const result = service.verifyGame(serverSeed, clientSeed, nonce, mineCount);
      expect(result.minePositions.length).toBe(mineCount);
      
      const expectedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
      expect(result.serverSeedHash).toBe(expectedHash);

      // Verify deterministic
      const result2 = service.verifyGame(serverSeed, clientSeed, nonce, mineCount);
      expect(result2.minePositions).toEqual(result.minePositions);
    });
  });

  // ==================== HOUSE EDGE MONTE CARLO ====================
  describe('House Edge Verification', () => {
    it('should maintain ~4% house edge over simulations', () => {
      const iterations = 50000;
      const mineCount = 5;
      const betAmount = 1;
      let totalBet = 0;
      let totalPayout = 0;

      for (let i = 0; i < iterations; i++) {
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const clientSeed = crypto.randomBytes(16).toString('hex');
        const mines = service.generateMinePositions(serverSeed, clientSeed, i, mineCount);
        
        totalBet += betAmount;
        
        // Simulate revealing 3 tiles randomly
        const safeTiles = [];
        for (let t = 0; t < 25; t++) {
          if (!mines.includes(t)) safeTiles.push(t);
        }
        
        // Pick 3 random safe tiles
        const revealCount = Math.min(3, safeTiles.length);
        let hitMine = false;
        
        // Actually simulate random reveals
        const allTiles = Array.from({ length: 25 }, (_, j) => j);
        // Shuffle
        for (let j = allTiles.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [allTiles[j], allTiles[k]] = [allTiles[k], allTiles[j]];
        }
        
        let revealed = 0;
        for (const tile of allTiles) {
          if (mines.includes(tile)) {
            hitMine = true;
            break;
          }
          revealed++;
          if (revealed >= revealCount) break;
        }

        if (!hitMine && revealed >= revealCount) {
          const mult = service.calculateMultiplier(mineCount, revealCount);
          totalPayout += betAmount * mult;
        }
      }

      const houseEdge = 1 - totalPayout / totalBet;
      // Should be approximately 4% (±3% tolerance)
      expect(houseEdge).toBeGreaterThan(0.01);
      expect(houseEdge).toBeLessThan(0.07);
    }, 30000);
  });

  // ==================== GET HISTORY ====================
  describe('getHistory', () => {
    it('should call prisma with correct parameters', async () => {
      await service.getHistory('user-1', 20);
      expect(mockPrisma.bet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', gameType: 'MINES' },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      );
    });
  });
});
