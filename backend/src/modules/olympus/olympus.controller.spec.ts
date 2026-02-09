/**
 * ============================================
 * OLYMPUS CONTROLLER - Unit Tests
 * ============================================
 * Tests: Route handling, Auth guards, DTO validation, Response format
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OlympusController } from './olympus.controller';
import { OlympusService } from './olympus.service';
import { BadRequestException } from '@nestjs/common';

describe('OlympusController', () => {
  let controller: OlympusController;
  let service: OlympusService;

  const mockSpinResult = {
    initialGrid: [[{ symbol: 'crown' }]],
    tumbles: [],
    totalWin: 5.5,
    totalMultiplier: 5.5,
    multiplierSum: 0,
    scatterCount: 1,
    freeSpinsAwarded: 0,
    freeSpinSessionId: null,
    isWin: true,
    profit: 4.5,
    betAmount: 1,
    anteBet: false,
    serverSeedHash: 'abc123',
    clientSeed: 'def456',
    nonce: 0,
  };

  const mockFreeSpinResult = {
    grid: [[{ symbol: 'crown' }]],
    tumbles: [],
    spinWin: 3.0,
    cumulativeMultiplier: 5,
    spinsRemaining: 10,
    totalSpins: 15,
    totalWin: 20.0,
    isComplete: false,
    scatterCount: 1,
    retrigger: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OlympusController],
      providers: [
        {
          provide: OlympusService,
          useValue: {
            spin: jest.fn().mockResolvedValue(mockSpinResult),
            freeSpin: jest.fn().mockResolvedValue(mockFreeSpinResult),
            getState: jest.fn().mockReturnValue({ hasActiveSession: false }),
            getPaytable: jest.fn().mockReturnValue({ paytable: {}, symbols: [] }),
            verify: jest.fn().mockReturnValue({ grid: [], serverSeedHash: 'hash' }),
            getHistory: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    controller = module.get<OlympusController>(OlympusController);
    service = module.get<OlympusService>(OlympusService);
  });

  // ==================== SPIN ====================
  describe('spin', () => {
    it('should call service.spin with correct userId and dto', async () => {
      const req = { user: { sub: 'user-123' } };
      const dto = { betAmount: 5, anteBet: false };

      await controller.spin(req, dto);

      expect(service.spin).toHaveBeenCalledWith('user-123', dto);
    });

    it('should use req.user.id as fallback for userId', async () => {
      const req = { user: { id: 'user-456' } };
      const dto = { betAmount: 5 };

      await controller.spin(req, dto);

      expect(service.spin).toHaveBeenCalledWith('user-456', dto);
    });

    it('should throw BadRequestException when user not authenticated', async () => {
      const req = { user: {} };
      const dto = { betAmount: 5 };

      await expect(controller.spin(req, dto)).rejects.toThrow(BadRequestException);
    });

    it('should return spin result', async () => {
      const req = { user: { sub: 'user-123' } };
      const dto = { betAmount: 5 };

      const result = await controller.spin(req, dto);

      expect(result).toEqual(mockSpinResult);
    });
  });

  // ==================== FREE SPIN ====================
  describe('freeSpin', () => {
    it('should call service.freeSpin with correct userId and dto', async () => {
      const req = { user: { sub: 'user-123' } };
      const dto = { sessionId: 'session-abc' };

      await controller.freeSpin(req, dto);

      expect(service.freeSpin).toHaveBeenCalledWith('user-123', dto);
    });

    it('should throw BadRequestException when user not authenticated', async () => {
      const req = { user: {} };
      const dto = { sessionId: 'session-abc' };

      await expect(controller.freeSpin(req, dto)).rejects.toThrow(BadRequestException);
    });

    it('should return free spin result', async () => {
      const req = { user: { sub: 'user-123' } };
      const dto = { sessionId: 'session-abc' };

      const result = await controller.freeSpin(req, dto);

      expect(result).toEqual(mockFreeSpinResult);
    });
  });

  // ==================== STATE ====================
  describe('getState', () => {
    it('should call service.getState with correct userId', () => {
      const req = { user: { sub: 'user-123' } };

      controller.getState(req);

      expect(service.getState).toHaveBeenCalledWith('user-123');
    });

    it('should return game state', () => {
      const req = { user: { sub: 'user-123' } };

      const result = controller.getState(req);

      expect(result).toEqual({ hasActiveSession: false });
    });
  });

  // ==================== PAYTABLE ====================
  describe('getPaytable', () => {
    it('should call service.getPaytable', () => {
      controller.getPaytable();

      expect(service.getPaytable).toHaveBeenCalled();
    });

    it('should return paytable data', () => {
      const result = controller.getPaytable();

      expect(result).toHaveProperty('paytable');
      expect(result).toHaveProperty('symbols');
    });

    it('should not require authentication', () => {
      // getPaytable has no @UseGuards decorator
      // This test verifies it can be called without a request object
      expect(() => controller.getPaytable()).not.toThrow();
    });
  });

  // ==================== VERIFY ====================
  describe('verify', () => {
    it('should call service.verify with correct params', () => {
      const body = {
        serverSeed: 'seed123',
        clientSeed: 'client456',
        nonce: 5,
      };

      controller.verify(body);

      expect(service.verify).toHaveBeenCalledWith('seed123', 'client456', 5);
    });

    it('should return verification result', () => {
      const body = {
        serverSeed: 'seed123',
        clientSeed: 'client456',
        nonce: 5,
      };

      const result = controller.verify(body);

      expect(result).toHaveProperty('grid');
      expect(result).toHaveProperty('serverSeedHash');
    });
  });

  // ==================== HISTORY ====================
  describe('getHistory', () => {
    it('should call service.getHistory with correct userId and default limit', async () => {
      const req = { user: { sub: 'user-123' } };

      await controller.getHistory(req);

      expect(service.getHistory).toHaveBeenCalledWith('user-123', 20);
    });

    it('should parse limit from query string', async () => {
      const req = { user: { sub: 'user-123' } };

      await controller.getHistory(req, '50');

      expect(service.getHistory).toHaveBeenCalledWith('user-123', 50);
    });

    it('should cap limit at 100', async () => {
      const req = { user: { sub: 'user-123' } };

      await controller.getHistory(req, '500');

      expect(service.getHistory).toHaveBeenCalledWith('user-123', 100);
    });

    it('should return history array', async () => {
      const req = { user: { sub: 'user-123' } };

      const result = await controller.getHistory(req);

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
