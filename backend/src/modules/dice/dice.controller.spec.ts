/**
 * ============================================
 * DICE CONTROLLER - Unit Tests
 * ============================================
 * Tests: Route handling, Auth guards, DTO validation, Response format
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DiceController } from './dice.controller';
import { DiceService } from './dice.service';
import { BadRequestException } from '@nestjs/common';

describe('DiceController', () => {
  let controller: DiceController;
  let service: DiceService;

  const mockPlayResult = {
    result: 42.5,
    target: 50,
    condition: 'UNDER',
    isWin: true,
    multiplier: 1.92,
    payout: 9.6,
    profit: 4.6,
    betAmount: 5,
    currency: 'USDT',
    serverSeedHash: 'abc123def456',
    clientSeed: 'client-seed-hex',
    nonce: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiceController],
      providers: [
        {
          provide: DiceService,
          useValue: {
            play: jest.fn().mockResolvedValue(mockPlayResult),
            getHistory: jest.fn().mockResolvedValue([]),
            verifyRoll: jest.fn().mockReturnValue({ result: 42.5, serverSeedHash: 'hash' }),
            getMultiplier: jest.fn().mockReturnValue(1.92),
          },
        },
      ],
    }).compile();

    controller = module.get<DiceController>(DiceController);
    service = module.get<DiceService>(DiceService);
  });

  // ==================== PLAY ====================
  describe('play', () => {
    it('should call service.play with correct userId and dto', async () => {
      const req = { user: { sub: 'user-123' } };
      const dto = { betAmount: 5, target: 50, condition: 'UNDER' };

      await controller.play(req, dto as any);

      expect(service.play).toHaveBeenCalledWith('user-123', dto);
    });

    it('should use req.user.id as fallback for userId', async () => {
      const req = { user: { id: 'user-456' } };
      const dto = { betAmount: 5, target: 50, condition: 'UNDER' };

      await controller.play(req, dto as any);

      expect(service.play).toHaveBeenCalledWith('user-456', dto);
    });

    it('should throw BadRequestException when user not authenticated', async () => {
      const req = { user: {} };
      const dto = { betAmount: 5, target: 50, condition: 'UNDER' };

      await expect(controller.play(req, dto as any)).rejects.toThrow(BadRequestException);
    });

    it('should return play result with all required fields', async () => {
      const req = { user: { sub: 'user-123' } };
      const dto = { betAmount: 5, target: 50, condition: 'UNDER' };

      const result = await controller.play(req, dto as any);

      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('target');
      expect(result).toHaveProperty('condition');
      expect(result).toHaveProperty('isWin');
      expect(result).toHaveProperty('multiplier');
      expect(result).toHaveProperty('payout');
      expect(result).toHaveProperty('profit');
      expect(result).toHaveProperty('betAmount');
    });

    it('should propagate service errors', async () => {
      (service.play as jest.Mock).mockRejectedValue(new BadRequestException('Insufficient balance'));
      const req = { user: { sub: 'user-123' } };
      const dto = { betAmount: 5, target: 50, condition: 'UNDER' };

      await expect(controller.play(req, dto as any)).rejects.toThrow('Insufficient balance');
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

    it('should parse limit from query string', async () => {
      const req = { user: { sub: 'user-123' } };

      await controller.getHistory(req, '50');

      expect(service.getHistory).toHaveBeenCalledWith('user-123', 50);
    });
  });

  // ==================== VERIFY ====================
  describe('verifyRoll', () => {
    it('should call service.verifyRoll with correct params', () => {
      const body = {
        serverSeed: 'seed123',
        clientSeed: 'client456',
        nonce: 5,
      };

      controller.verifyRoll(body);

      expect(service.verifyRoll).toHaveBeenCalledWith('seed123', 'client456', 5);
    });

    it('should return verification result', () => {
      const body = {
        serverSeed: 'seed123',
        clientSeed: 'client456',
        nonce: 5,
      };

      const result = controller.verifyRoll(body);

      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('serverSeedHash');
    });

    it('should not require authentication', () => {
      const body = { serverSeed: 's', clientSeed: 'c', nonce: 0 };
      expect(() => controller.verifyRoll(body)).not.toThrow();
    });
  });
});
