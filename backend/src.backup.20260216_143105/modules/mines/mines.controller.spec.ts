/**
 * ============================================
 * MINES CONTROLLER - Unit Tests
 * ============================================
 * Tests: Route handling, Auth guards, DTO validation, Response format
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MinesController } from './mines.controller';
import { MinesService } from './mines.service';
import { BadRequestException } from '@nestjs/common';

describe('MinesController', () => {
  let controller: MinesController;
  let service: MinesService;

  const mockStartResult = {
    gameId: 'game-123',
    mineCount: 5,
    betAmount: 1,
    currency: 'USDT',
    serverSeedHash: 'abc123',
    clientSeed: 'def456',
    nonce: 0,
  };

  const mockRevealResult = {
    position: 3,
    isMine: false,
    multiplier: 1.2,
    payout: 1.2,
    revealedPositions: [3],
    gameOver: false,
  };

  const mockCashoutResult = {
    totalPayout: 5.5,
    profit: 4.5,
    multiplier: 5.5,
    revealedPositions: [1, 3, 7],
    minePositions: [0, 5, 10, 15, 20],
    serverSeed: 'revealed-seed',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MinesController],
      providers: [
        {
          provide: MinesService,
          useValue: {
            startGame: jest.fn().mockResolvedValue(mockStartResult),
            revealTile: jest.fn().mockResolvedValue(mockRevealResult),
            cashout: jest.fn().mockResolvedValue(mockCashoutResult),
            getActiveGame: jest.fn().mockResolvedValue(null),
            getHistory: jest.fn().mockResolvedValue([]),
            verifyGame: jest.fn().mockReturnValue({ minePositions: [0, 5], serverSeedHash: 'hash' }),
          },
        },
      ],
    }).compile();

    controller = module.get<MinesController>(MinesController);
    service = module.get<MinesService>(MinesService);
  });

  // ==================== START GAME ====================
  describe('startGame', () => {
    it('should call service.startGame with correct userId and dto', async () => {
      const req = { user: { sub: 'user-123' } };
      const dto = { betAmount: 1, mineCount: 5 };

      await controller.startGame(req, dto as any);

      expect(service.startGame).toHaveBeenCalledWith('user-123', dto);
    });

    it('should use req.user.id as fallback for userId', async () => {
      const req = { user: { id: 'user-456' } };
      const dto = { betAmount: 1, mineCount: 5 };

      await controller.startGame(req, dto as any);

      expect(service.startGame).toHaveBeenCalledWith('user-456', dto);
    });

    it('should throw BadRequestException when user not authenticated', async () => {
      const req = { user: {} };
      const dto = { betAmount: 1, mineCount: 5 };

      await expect(controller.startGame(req, dto as any)).rejects.toThrow(BadRequestException);
    });

    it('should return game start result', async () => {
      const req = { user: { sub: 'user-123' } };
      const dto = { betAmount: 1, mineCount: 5 };

      const result = await controller.startGame(req, dto);

      expect(result).toHaveProperty('gameId');
      expect(result).toHaveProperty('mineCount');
      expect(result).toHaveProperty('betAmount');
      expect(result).toHaveProperty('serverSeedHash');
    });

    it('should propagate service errors', async () => {
      (service.startGame as jest.Mock).mockRejectedValue(
        new BadRequestException('Insufficient balance'),
      );
      const req = { user: { sub: 'user-123' } };
      const dto = { betAmount: 1, mineCount: 5 };

      await expect(controller.startGame(req, dto as any)).rejects.toThrow('Insufficient balance');
    });
  });

  // ==================== REVEAL ====================
  describe('reveal', () => {
    it('should call service.reveal with correct userId and dto', async () => {
      const req = { user: { sub: 'user-123' } };
      const dto = { gameId: 'game-123', position: 3 };

      await controller.revealTile(req, dto as any);

      expect(service.revealTile).toHaveBeenCalledWith('user-123', dto);
    });

    it('should throw BadRequestException when user not authenticated', async () => {
      const req = { user: {} };
      const dto = { gameId: 'game-123', position: 3 };

      await expect(controller.revealTile(req, dto as any)).rejects.toThrow(BadRequestException);
    });

    it('should return reveal result', async () => {
      const req = { user: { sub: 'user-123' } };
      const dto = { gameId: 'game-123', position: 3 };

      const result = await controller.revealTile(req, dto as any);

      expect(result).toHaveProperty('position');
      expect(result).toHaveProperty('isMine');
      expect(result).toHaveProperty('multiplier');
    });
  });

  // ==================== CASHOUT ====================
  describe('cashout', () => {
    it('should call service.cashout with correct userId and dto', async () => {
      const req = { user: { sub: 'user-123' } };
      const dto = { gameId: 'game-123' };

      await controller.cashout(req, dto as any);

      expect(service.cashout).toHaveBeenCalledWith('user-123', dto);
    });

    it('should throw BadRequestException when user not authenticated', async () => {
      const req = { user: {} };
      const dto = { gameId: 'game-123' };

      await expect(controller.cashout(req, dto as any)).rejects.toThrow(BadRequestException);
    });

    it('should return cashout result with payout and mine positions', async () => {
      const req = { user: { sub: 'user-123' } };
      const dto = { gameId: 'game-123' };

      const result = await controller.cashout(req, dto);

      expect(result).toHaveProperty('totalPayout');
      expect(result).toHaveProperty('profit');
      expect(result).toHaveProperty('minePositions');
      expect(result).toHaveProperty('serverSeed');
    });
  });

  // ==================== ACTIVE GAME ====================
  describe('getActiveGame', () => {
    it('should call service.getActiveGame with correct userId', async () => {
      const req = { user: { sub: 'user-123' } };

      await controller.getActiveGame(req);

      expect(service.getActiveGame).toHaveBeenCalledWith('user-123');
    });

    it('should return null when no active game', async () => {
      const req = { user: { sub: 'user-123' } };

      const result = await controller.getActiveGame(req);

      expect(result).toBeNull();
    });
  });

  // ==================== HISTORY ====================
  describe('getHistory', () => {
    it('should call service.getHistory with correct userId', async () => {
      const req = { user: { sub: 'user-123' } };

      await controller.getHistory(req);

      expect(service.getHistory).toHaveBeenCalledWith('user-123', expect.any(Number));
    });

    it('should return history array', async () => {
      const req = { user: { sub: 'user-123' } };

      const result = await controller.getHistory(req);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ==================== VERIFY ====================
  describe('verifyGame', () => {
    it('should call service.verifyGame with correct params', () => {
      const body = {
        serverSeed: 'seed123',
        clientSeed: 'client456',
        nonce: 5,
        mineCount: 3,
      };

      controller.verifyGame(body);

      expect(service.verifyGame).toHaveBeenCalledWith('seed123', 'client456', 5, 3);
    });

    it('should return verification result', () => {
      const body = {
        serverSeed: 'seed123',
        clientSeed: 'client456',
        nonce: 5,
        mineCount: 3,
      };

      const result = controller.verifyGame(body);

      expect(result).toHaveProperty('minePositions');
      expect(result).toHaveProperty('serverSeedHash');
    });

    it('should not require authentication', () => {
      const body = { serverSeed: 's', clientSeed: 'c', nonce: 0, mineCount: 5 };
      expect(() => controller.verifyGame(body)).not.toThrow();
    });
  });
});
