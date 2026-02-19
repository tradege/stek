/**
 * ============================================
 * ONBOARDING SERVICE - Comprehensive Test Suite
 * ============================================
 * Coverage:
 *  1. createBrand      - domain duplicate check, $transaction(siteConfig+riskLimit+botConfig), frontendConfig
 *  2. listBrands       - siteConfiguration.findMany + user.count + botConfig.findUnique per brand
 *  3. deactivateBrand  - siteConfiguration.update + botConfig.update
 *  4. cloneBrand       - findUnique source + createBrand with source config
 *  5. Edge Cases       - duplicate domain, missing source, concurrent
 */

import { OnboardingService } from './onboarding.service';
import { BadRequestException } from '@nestjs/common';

const mockSite = {
  id: 'site-testbrand-abc12345',
  brandName: 'TestBrand',
  domain: 'test.example.com',
  logoUrl: '/assets/brands/site-testbrand-abc12345/logo.png',
  faviconUrl: '/assets/brands/site-testbrand-abc12345/favicon.ico',
  primaryColor: '#6366f1',
  secondaryColor: '#1e1b4b',
  accentColor: '#f59e0b',
  backgroundColor: '#0f0a1e',
  houseEdgeConfig: { dice: 0.02, crash: 0.04, mines: 0.03, plinko: 0.03, olympus: 0.04 },
  active: true,
};

const mockRiskLimit = {
  id: 'rl-1',
  siteId: mockSite.id,
  maxPayoutPerDay: 50000,
  maxPayoutPerBet: 10000,
  maxBetAmount: 5000,
};

const mockBotConfig = {
  id: 'bc-1',
  siteId: mockSite.id,
  enabled: true,
  botCount: 50,
  minBetAmount: 5,
  maxBetAmount: 1000,
  chatEnabled: true,
  chatIntervalMin: 5,
  chatIntervalMax: 15,
  botNamePrefix: 'TES_',
};

function createMockPrisma() {
  // The tx object passed to $transaction callback
  const mockTx = {
    siteConfiguration: {
      create: jest.fn().mockResolvedValue({ ...mockSite }),
    },
    riskLimit: {
      create: jest.fn().mockResolvedValue({ ...mockRiskLimit }),
    },
    botConfig: {
      create: jest.fn().mockResolvedValue({ ...mockBotConfig }),
    },
  };

  return {
    siteConfiguration: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([{ ...mockSite }]),
      update: jest.fn().mockResolvedValue({ ...mockSite, active: false }),
    },
    user: {
      count: jest.fn().mockResolvedValue(25),
    },
    botConfig: {
      findUnique: jest.fn().mockResolvedValue({ ...mockBotConfig }),
      update: jest.fn().mockResolvedValue({ ...mockBotConfig, enabled: false }),
    },
    $transaction: jest.fn(async (cb: any) => cb(mockTx)),
    _tx: mockTx, // expose for assertions
  };
}

describe('OnboardingService', () => {
  let service: OnboardingService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new OnboardingService(mockPrisma as any);
    jest.clearAllMocks();
  });

  // ════════════════════════════════════════════
  // 1. createBrand
  // ════════════════════════════════════════════
  describe('1. createBrand', () => {
    it('should create brand with all required resources in a transaction', async () => {
      const result = await service.createBrand({ brandName: 'NewBrand', domain: 'new.example.com' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('NewBrand');
      expect(result.siteId).toMatch(/^site-newbrand-/);
      expect(result.frontendConfig).toBeDefined();
      expect(result.nextSteps).toBeInstanceOf(Array);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma._tx.siteConfiguration.create).toHaveBeenCalled();
      expect(mockPrisma._tx.riskLimit.create).toHaveBeenCalled();
      expect(mockPrisma._tx.botConfig.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException for duplicate domain', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValue(mockSite);
      await expect(service.createBrand({ brandName: 'New', domain: 'test.example.com' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should use default house edge when not provided', async () => {
      await service.createBrand({ brandName: 'DefEdge', domain: 'defedge.com' });
      expect(mockPrisma._tx.siteConfiguration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            houseEdgeConfig: { dice: 0.02, crash: 0.04, mines: 0.03, plinko: 0.03, olympus: 0.04 },
          }),
        }),
      );
    });

    it('should use custom house edge when provided', async () => {
      const customEdge = { dice: 0.05, crash: 0.06, mines: 0.04, plinko: 0.04, olympus: 0.05 };
      await service.createBrand({ brandName: 'CustEdge', domain: 'custedge.com', houseEdgeConfig: customEdge });
      expect(mockPrisma._tx.siteConfiguration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ houseEdgeConfig: customEdge }),
        }),
      );
    });

    it('should use default risk limits when not provided', async () => {
      await service.createBrand({ brandName: 'DefRisk', domain: 'defrisk.com' });
      expect(mockPrisma._tx.riskLimit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            maxPayoutPerDay: 50000,
            maxPayoutPerBet: 10000,
            maxBetAmount: 5000,
          }),
        }),
      );
    });

    it('should use custom risk limits when provided', async () => {
      await service.createBrand({
        brandName: 'CustRisk', domain: 'custrisk.com',
        maxPayoutPerDay: 100000, maxPayoutPerBet: 20000, maxBetAmount: 10000,
      });
      expect(mockPrisma._tx.riskLimit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            maxPayoutPerDay: 100000,
            maxPayoutPerBet: 20000,
            maxBetAmount: 10000,
          }),
        }),
      );
    });

    it('should generate correct frontend config', async () => {
      const result = await service.createBrand({ brandName: 'FE', domain: 'fe.example.com' });
      expect(result.frontendConfig.domain).toBe('fe.example.com');
      expect(result.frontendConfig.apiUrl).toBe('https://fe.example.com/api');
      expect(result.frontendConfig.wsUrl).toBe('wss://fe.example.com/ws');
      expect(result.frontendConfig.theme).toBeDefined();
      expect(result.frontendConfig.riskLimits).toBeDefined();
      expect(result.frontendConfig.nginx).toBeDefined();
    });

    it('should generate bot name prefix from brand name', async () => {
      await service.createBrand({ brandName: 'LuckyStar', domain: 'lucky.com' });
      expect(mockPrisma._tx.botConfig.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ botNamePrefix: 'LUC_' }),
        }),
      );
    });

    it('should use custom bot name prefix when provided', async () => {
      await service.createBrand({ brandName: 'Custom', domain: 'custom.com', botNamePrefix: 'CUST_' });
      expect(mockPrisma._tx.botConfig.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ botNamePrefix: 'CUST_' }),
        }),
      );
    });
  });

  // ════════════════════════════════════════════
  // 2. listBrands
  // ════════════════════════════════════════════
  describe('2. listBrands', () => {
    it('should return all brands with user count and bot status', async () => {
      const result = await service.listBrands();
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('siteId', mockSite.id);
      expect(result[0]).toHaveProperty('brandName', 'TestBrand');
      expect(result[0]).toHaveProperty('users', 25);
      expect(result[0]).toHaveProperty('botsEnabled', true);
      expect(result[0]).toHaveProperty('houseEdge');
      expect(mockPrisma.user.count).toHaveBeenCalledWith({ where: { siteId: mockSite.id } });
      expect(mockPrisma.botConfig.findUnique).toHaveBeenCalledWith({ where: { siteId: mockSite.id } });
    });

    it('should handle empty brand list', async () => {
      mockPrisma.siteConfiguration.findMany.mockResolvedValue([]);
      const result = await service.listBrands();
      expect(result).toHaveLength(0);
    });

    it('should handle brand without bot config', async () => {
      mockPrisma.botConfig.findUnique.mockResolvedValue(null);
      const result = await service.listBrands();
      expect(result[0].botsEnabled).toBe(false);
    });
  });

  // ════════════════════════════════════════════
  // 3. deactivateBrand
  // ════════════════════════════════════════════
  describe('3. deactivateBrand', () => {
    it('should deactivate site and disable bots', async () => {
      const result = await service.deactivateBrand('site-test-abc123');
      expect(result.success).toBe(true);
      expect(mockPrisma.siteConfiguration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'site-test-abc123' },
          data: { active: false },
        }),
      );
      expect(mockPrisma.botConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { siteId: 'site-test-abc123' },
          data: { enabled: false },
        }),
      );
    });

    it('should not throw if botConfig update fails', async () => {
      mockPrisma.botConfig.update.mockRejectedValue(new Error('Not found'));
      const result = await service.deactivateBrand('site-test-abc123');
      expect(result.success).toBe(true);
    });
  });

  // ════════════════════════════════════════════
  // 4. cloneBrand
  // ════════════════════════════════════════════
  describe('4. cloneBrand', () => {
    it('should clone brand with source configuration', async () => {
      // cloneBrand calls findUnique for source first, then createBrand calls findUnique for domain dup check
      mockPrisma.siteConfiguration.findUnique
        .mockResolvedValueOnce({ ...mockSite })  // source brand lookup
        .mockResolvedValueOnce(null);             // domain duplicate check in createBrand
      const result = await service.cloneBrand(mockSite.id, 'ClonedBrand', 'cloned.example.com');
      expect(result.success).toBe(true);
      expect(result.message).toContain('ClonedBrand');
    });

    it('should throw BadRequestException when source not found', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValue(null);
      await expect(service.cloneBrand('bad-id', 'Clone', 'clone.com'))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ════════════════════════════════════════════
  // 5. Edge Cases
  // ════════════════════════════════════════════
  describe('5. Edge Cases', () => {
    it('should generate unique siteId with crypto', async () => {
      const result = await service.createBrand({ brandName: 'UniqueTest', domain: 'unique.test.com' });
      expect(result.siteId).toMatch(/^site-uniquetest-[a-f0-9]{8}$/);
    });

    it('should handle special characters in brand name for siteId', async () => {
      const result = await service.createBrand({ brandName: 'Lucky Star!', domain: 'lucky-star.com' });
      expect(result.siteId).toMatch(/^site-lucky-star--[a-f0-9]{8}$/);
    });

    it('should include next steps in createBrand response', async () => {
      const result = await service.createBrand({ brandName: 'Steps', domain: 'steps.com' });
      expect(result.nextSteps.length).toBeGreaterThanOrEqual(3);
      expect(result.nextSteps[0]).toContain('DNS');
    });
  });
});
