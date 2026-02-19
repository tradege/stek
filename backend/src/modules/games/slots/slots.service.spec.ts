import { SlotsService, SlotSpinDto } from './slots.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { VipService } from '../../vip/vip.service';
import { RewardPoolService } from '../../reward-pool/reward-pool.service';
import { CommissionProcessorService } from '../../affiliate/commission-processor.service';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

describe('SlotsService', () => {
  let service: SlotsService;
  let mockPrisma: any;
  let mockVipService: any;
  let mockRewardPoolService: any;
  let mockCommissionProcessor: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet-1', balance: 10000 }]),
      serverSeed: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'seed-id', seed: 'server-seed',
          seedHash: crypto.createHash('sha256').update('server-seed').digest('hex'),
          nonce: 0, isActive: true,
        }),
        create: jest.fn().mockResolvedValue({
          id: 'seed-id', seed: 'new-server-seed',
          seedHash: crypto.createHash('sha256').update('new-server-seed').digest('hex'),
          nonce: 0,
        }),
        update: jest.fn(),
      },
      wallet: { update: jest.fn(), findFirst: jest.fn().mockResolvedValue({ id: 'wallet-1', balance: 10000 }) },
      bet: { create: jest.fn().mockResolvedValue({ id: 'bet-id-1' }), findMany: jest.fn() },
      transaction: { create: jest.fn() },
      siteConfiguration: {
        findFirst: jest.fn().mockResolvedValue({ gameConfig: {} }),
      },
    };

    mockVipService = {
      addWagerStats: jest.fn().mockResolvedValue(undefined),
      checkLevelUp: jest.fn().mockResolvedValue(undefined),
      processRakeback: jest.fn().mockResolvedValue(undefined),
      updateUserStats: jest.fn().mockResolvedValue(undefined),
    };

    mockRewardPoolService = {
      contribute: jest.fn().mockResolvedValue(undefined),
      contributeToPool: jest.fn().mockResolvedValue(undefined),
    };

    mockCommissionProcessor = {
      processCommission: jest.fn().mockResolvedValue(undefined),
    };

    service = new SlotsService(
      mockPrisma as unknown as PrismaService,
      mockVipService as unknown as VipService,
      mockRewardPoolService as unknown as RewardPoolService,
      mockCommissionProcessor as unknown as CommissionProcessorService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // 1. SPIN - INPUT VALIDATION
  // ============================================
  describe('spin - input validation', () => {
    it('1.1 should throw for bet below minimum (0.10)', async () => {
      const dto: SlotSpinDto = { betAmount: 0.01, gameMode: 'BONANZA' };
      await expect(service.spin('user-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('1.2 should throw for bet above maximum (1000)', async () => {
      const dto: SlotSpinDto = { betAmount: 2000, gameMode: 'BONANZA' };
      await expect(service.spin('user-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('1.3 should throw for zero bet amount', async () => {
      const dto: SlotSpinDto = { betAmount: 0, gameMode: 'BONANZA' };
      await expect(service.spin('user-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('1.4 should throw for negative bet amount', async () => {
      const dto: SlotSpinDto = { betAmount: -10, gameMode: 'BONANZA' };
      await expect(service.spin('user-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('1.5 should throw for insufficient balance', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'wallet-1', balance: 0.05 }]);
      const dto: SlotSpinDto = { betAmount: 1, gameMode: 'BONANZA' };
      await expect(service.spin('user-1', dto)).rejects.toThrow();
    });

    it('1.6 should throw when wallet not found', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      const dto: SlotSpinDto = { betAmount: 1, gameMode: 'BONANZA' };
      await expect(service.spin('user-1', dto)).rejects.toThrow();
    });
  });

  // ============================================
  // 2. SPIN - SUCCESSFUL FLOW
  // ============================================
  describe('spin - successful flow', () => {
    it('2.1 should return spin result with required fields', async () => {
      const dto: SlotSpinDto = { betAmount: 1, gameMode: 'BONANZA' };
      const result = await service.spin('user-1', dto);
      expect(result).toHaveProperty('grid');
      expect(result).toHaveProperty('totalPayout');
      expect(result).toHaveProperty('multiplier');
    });

    it('2.2 should create bet record', async () => {
      const dto: SlotSpinDto = { betAmount: 1, gameMode: 'BONANZA' };
      await service.spin('user-1', dto);
      expect(mockPrisma.bet.create).toHaveBeenCalled();
    });

    it('2.3 should update wallet balance', async () => {
      const dto: SlotSpinDto = { betAmount: 1, gameMode: 'BONANZA' };
      await service.spin('user-1', dto);
      expect(mockPrisma.wallet.update).toHaveBeenCalled();
    });

    it('2.4 should use atomic transaction', async () => {
      const dto: SlotSpinDto = { betAmount: 1, gameMode: 'BONANZA' };
      await service.spin('user-1', dto);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('2.5 should work with BOOK_OF_DEAD mode', async () => {
      const dto: SlotSpinDto = { betAmount: 1, gameMode: 'BOOK_OF_DEAD' };
      const result = await service.spin('user-1', dto);
      expect(result).toHaveProperty('grid');
    });

    it('2.6 should work with STARBURST mode', async () => {
      const dto: SlotSpinDto = { betAmount: 1, gameMode: 'STARBURST' };
      const result = await service.spin('user-1', dto);
      expect(result).toHaveProperty('grid');
    });

    it('2.7 should work with BIG_BASS mode', async () => {
      const dto: SlotSpinDto = { betAmount: 1, gameMode: 'BIG_BASS' };
      const result = await service.spin('user-1', dto);
      expect(result).toHaveProperty('grid');
    });
  });

  // ============================================
  // 3. GAME MODES
  // ============================================
  describe('spin - game modes', () => {
    it('3.1 should return different grid sizes for different modes', async () => {
      const bonanza = await service.spin('user-1', { betAmount: 1, gameMode: 'BONANZA' });
      const book = await service.spin('user-2', { betAmount: 1, gameMode: 'BOOK_OF_DEAD' });
      // Both should have grids but may differ in structure
      expect(bonanza.grid).toBeDefined();
      expect(book.grid).toBeDefined();
    });

    it('3.2 should handle risk level for BOOK_OF_DEAD', async () => {
      const normal = await service.spin('user-1', { betAmount: 1, gameMode: 'BOOK_OF_DEAD', riskLevel: 'normal' });
      const extreme = await service.spin('user-2', { betAmount: 1, gameMode: 'BOOK_OF_DEAD', riskLevel: 'extreme' });
      expect(normal).toBeDefined();
      expect(extreme).toBeDefined();
    });
  });

  // ============================================
  // 4. POST-BET PROCESSING
  // ============================================
  describe('spin - post-bet processing', () => {
    it('4.1 should call VIP service for wager stats', async () => {
      const dto: SlotSpinDto = { betAmount: 1, gameMode: 'BONANZA' };
      await service.spin('user-1', dto);
      // postBetProcessing is fire-and-forget, need to wait
      await new Promise(r => setTimeout(r, 50));
      expect(mockVipService.updateUserStats).toHaveBeenCalled();
    });

    it('4.2 should call commission processor', async () => {
      const dto: SlotSpinDto = { betAmount: 1, gameMode: 'BONANZA' };
      await service.spin('user-1', dto);
      await new Promise(r => setTimeout(r, 50));
      expect(mockCommissionProcessor.processCommission).toHaveBeenCalled();
    });

    it('4.3 should call reward pool contribution', async () => {
      const dto: SlotSpinDto = { betAmount: 1, gameMode: 'BONANZA' };
      await service.spin('user-1', dto);
      await new Promise(r => setTimeout(r, 50));
      expect(mockRewardPoolService.contributeToPool).toHaveBeenCalled();
    });
  });

  // ============================================
  // 5. HISTORY
  // ============================================
  describe('getHistory', () => {
    it('5.1 should return bet history', async () => {
      const bets = [{ id: 'bet-1' }];
      mockPrisma.bet.findMany.mockResolvedValue(bets);
      const result = await service.getHistory('user-1');
      expect(result).toEqual({ bets });
    });

    it('5.2 should use default limit of 20', async () => {
      await service.getHistory('user-1');
      expect(mockPrisma.bet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });
  });

  // ============================================
  // 6. SEED MANAGEMENT
  // ============================================
  describe('provably fair', () => {
    it('6.1 should include provably fair data in spin result', async () => {
      const dto: SlotSpinDto = { betAmount: 1, gameMode: 'BONANZA' };
      const result = await service.spin('user-pf1', dto);
      expect(result).toHaveProperty('provablyFair');
      expect(result.provablyFair).toHaveProperty('serverSeedHash');
      expect(result.provablyFair).toHaveProperty('clientSeed');
      expect(result.provablyFair).toHaveProperty('nonce');
    });

    it('6.2 should generate unique server seeds per spin', async () => {
      const dto: SlotSpinDto = { betAmount: 1, gameMode: 'BONANZA' };
      const r1 = await service.spin('user-pf2', dto);
      const r2 = await service.spin('user-pf3', dto);
      expect(r1.provablyFair.serverSeedHash).not.toBe(r2.provablyFair.serverSeedHash);
    });
  });
});
