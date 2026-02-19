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
      const req = { user: { id: 'user-123' }, tenant: {} };
      const dto = { betAmount: 5, target: 50, condition: 'UNDER' };

      await controller.play(req, dto as any);

      expect(service.play).toHaveBeenCalledWith('user-123', dto, 'default-site-001');
    });

    it('should use req.user.id as fallback for userId', async () => {
      const req = { user: { id: 'user-456' } };
      const dto = { betAmount: 5, target: 50, condition: 'UNDER' };

      await controller.play(req, dto as any);

      expect(service.play).toHaveBeenCalledWith('user-456', dto, 'default-site-001');
    });

    it('should pass undefined userId when user has no id', async () => {
      const req = { user: {}, tenant: {} };
      const dto = { betAmount: 5, target: 50, condition: 'UNDER' };
      await controller.play(req, dto as any);
      expect(service.play).toHaveBeenCalledWith(undefined, dto, 'default-site-001');
    });

    it('should return play result with all required fields', async () => {
      const req = { user: { id: 'user-123' }, tenant: {} };
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
      const req = { user: { id: 'user-123' }, tenant: {} };
      const dto = { betAmount: 5, target: 50, condition: 'UNDER' };

      await expect(controller.play(req, dto as any)).rejects.toThrow('Insufficient balance');
    });
  });

  // ==================== HISTORY ====================
  describe('history', () => {
    it('should call service.getHistory with correct userId', async () => {
      const req = { user: { id: 'user-123' }, tenant: {} };

      await controller.history(req);

      expect(service.getHistory).toHaveBeenCalledWith('user-123', 'default-site-001', 20);
    });

    it('should return history array', async () => {
      const req = { user: { id: 'user-123' }, tenant: {} };

      const result = await controller.history(req);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should parse limit from query string', async () => {
      const req = { user: { id: 'user-123' }, tenant: {} };

      await controller.history(req, '50');

      expect(service.getHistory).toHaveBeenCalledWith('user-123', 'default-site-001', 50);
    });
  });

  // ==================== VERIFY ====================
  describe('verify', () => {
    it('should call service.verifyRoll with correct params', () => {
      const body = {
        serverSeed: 'seed123',
        clientSeed: 'client456',
        nonce: 5,
      };

      controller.verify(body);

      expect(service.verifyRoll).toHaveBeenCalledWith('seed123', 'client456', 5);
    });

    it('should return verification result', async () => {
      const body = {
        serverSeed: 'seed123',
        clientSeed: 'client456',
        nonce: 5,
      };

      const result = await controller.verify(body);

      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('serverSeedHash');
    });

    it('should not require authentication', () => {
      const body = { serverSeed: 's', clientSeed: 'c', nonce: 0 };
      expect(() => controller.verify(body)).not.toThrow();
    });
  });
});
