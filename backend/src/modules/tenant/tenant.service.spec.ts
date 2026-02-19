/**
 * ============================================
 * TENANT SERVICE - Comprehensive Test Suite
 * ============================================
 * Coverage:
 *  1. createSite       - duplicate check, siteConfiguration.create, botConfig.create
 *  2. updateSite       - findUnique + update, NotFoundException
 *  3. getAllSites       - findMany with _count
 *  4. getSiteById      - findUnique with _count, NotFoundException
 *  5. getSiteByDomain  - findFirst with domain, fallback to first active
 *  6. deactivateSite   - calls updateSite with active: false
 *  7. scopeToTenant    - helper function tests
 *  8. Edge Cases
 */

import { TenantService } from './tenant.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

const mockSite = {
  id: 'site-test-abc123',
  brandName: 'TestBrand',
  domain: 'test.example.com',
  logoUrl: '/logo.png',
  faviconUrl: '/favicon.ico',
  primaryColor: '#00F0FF',
  secondaryColor: '#131B2C',
  accentColor: '#00D46E',
  dangerColor: '#FF385C',
  backgroundColor: '#0A0E17',
  cardColor: '#131B2C',
  heroImageUrl: null,
  backgroundImageUrl: null,
  loginBgUrl: null,
  gameAssets: {},
  houseEdgeConfig: { crash: 0.04, dice: 0.02, mines: 0.03, plinko: 0.03, olympus: 0.04 },
  locale: 'en',
  jurisdiction: null,
  licenseType: null,
  adminUserId: null,
  active: true,
  createdAt: new Date('2025-01-01'),
  _count: { users: 10, bets: 500, transactions: 200 },
};

function createMockPrisma() {
  return {
    siteConfiguration: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue({ ...mockSite }),
      findMany: jest.fn().mockResolvedValue([{ ...mockSite }]),
      create: jest.fn().mockResolvedValue({ ...mockSite }),
      update: jest.fn().mockResolvedValue({ ...mockSite }),
    },
    botConfig: {
      create: jest.fn().mockResolvedValue({ id: 'bot-1', siteId: mockSite.id, enabled: true }),
    },
  };
}

describe('TenantService', () => {
  let service: TenantService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new TenantService(mockPrisma as any);
    jest.clearAllMocks();
  });

  describe('1. createSite', () => {
    it('should create a new site with default values', async () => {
      const result = await service.createSite({ brandName: 'NewBrand', domain: 'new.example.com' });
      expect(mockPrisma.siteConfiguration.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ domain: 'new.example.com' }, { brandName: 'NewBrand' }] },
      });
      expect(mockPrisma.siteConfiguration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ brandName: 'NewBrand', domain: 'new.example.com', active: true }),
        }),
      );
      expect(mockPrisma.botConfig.create).toHaveBeenCalled();
    });

    it('should create site with custom colors', async () => {
      await service.createSite({ brandName: 'Custom', domain: 'c.com', primaryColor: '#FF0000', secondaryColor: '#00FF00', accentColor: '#0000FF' });
      expect(mockPrisma.siteConfiguration.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ primaryColor: '#FF0000', secondaryColor: '#00FF00', accentColor: '#0000FF' }) }),
      );
    });

    it('should throw ConflictException for duplicate domain', async () => {
      mockPrisma.siteConfiguration.findFirst.mockResolvedValue(mockSite);
      await expect(service.createSite({ brandName: 'Dup', domain: 'test.example.com' })).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException for duplicate brand name', async () => {
      mockPrisma.siteConfiguration.findFirst.mockResolvedValue(mockSite);
      await expect(service.createSite({ brandName: 'TestBrand', domain: 'unique.com' })).rejects.toThrow(ConflictException);
    });

    it('should create default bot config for new site', async () => {
      await service.createSite({ brandName: 'BotTest', domain: 'bot.test.com' });
      expect(mockPrisma.botConfig.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ enabled: true, botCount: 50, chatEnabled: true }) }),
      );
    });

    it('should create default house edge config', async () => {
      await service.createSite({ brandName: 'EdgeTest', domain: 'edge.test.com' });
      expect(mockPrisma.siteConfiguration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            houseEdgeConfig: { crash: 0.04, dice: 0.02, mines: 0.03, plinko: 0.03, olympus: 0.04 },
          }),
        }),
      );
    });
  });

  describe('2. updateSite', () => {
    it('should update site configuration', async () => {
      mockPrisma.siteConfiguration.update.mockResolvedValue({ ...mockSite, brandName: 'Updated' });
      await service.updateSite('site-test-abc123', { brandName: 'Updated' });
      expect(mockPrisma.siteConfiguration.findUnique).toHaveBeenCalledWith({ where: { id: 'site-test-abc123' } });
      expect(mockPrisma.siteConfiguration.update).toHaveBeenCalledWith({ where: { id: 'site-test-abc123' }, data: { brandName: 'Updated' } });
    });

    it('should throw NotFoundException for non-existent site', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValue(null);
      await expect(service.updateSite('bad-id', { brandName: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('should update active status', async () => {
      await service.updateSite('site-test-abc123', { active: false });
      expect(mockPrisma.siteConfiguration.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { active: false } }),
      );
    });
  });

  describe('3. getAllSites', () => {
    it('should return all sites with counts', async () => {
      const result = await service.getAllSites();
      expect(mockPrisma.siteConfiguration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { users: true, bets: true, transactions: true } } },
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no sites exist', async () => {
      mockPrisma.siteConfiguration.findMany.mockResolvedValue([]);
      const result = await service.getAllSites();
      expect(result).toHaveLength(0);
    });
  });

  describe('4. getSiteById', () => {
    it('should return site with counts', async () => {
      const result = await service.getSiteById('site-test-abc123');
      expect(result).toHaveProperty('brandName', 'TestBrand');
    });

    it('should throw NotFoundException for non-existent site', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValue(null);
      await expect(service.getSiteById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('5. getSiteByDomain', () => {
    it('should find site by domain', async () => {
      mockPrisma.siteConfiguration.findFirst.mockResolvedValue({ id: 'site-1', brandName: 'Test', domain: 'test.com' });
      const result = await service.getSiteByDomain('test.com');
      expect(result).toHaveProperty('brandName', 'Test');
    });

    it('should fallback to first active site when domain not found', async () => {
      mockPrisma.siteConfiguration.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'fallback', brandName: 'Fallback' });
      const result = await service.getSiteByDomain('unknown.com');
      expect(result).toHaveProperty('brandName', 'Fallback');
      expect(mockPrisma.siteConfiguration.findFirst).toHaveBeenCalledTimes(2);
    });

    it('should return null when no active sites exist', async () => {
      mockPrisma.siteConfiguration.findFirst.mockResolvedValue(null);
      const result = await service.getSiteByDomain('nothing.com');
      expect(result).toBeNull();
    });

    it('should lowercase the domain for lookup', async () => {
      await service.getSiteByDomain('TEST.EXAMPLE.COM');
      expect(mockPrisma.siteConfiguration.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ domain: 'test.example.com' }) }),
      );
    });
  });

  describe('6. deactivateSite', () => {
    it('should set active to false', async () => {
      await service.deactivateSite('site-test-abc123');
      expect(mockPrisma.siteConfiguration.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { active: false } }),
      );
    });
  });

  describe('7. scopeToTenant', () => {
    it('should add siteId to where clause', () => {
      const result = service.scopeToTenant('site-1', { userId: 'u1' });
      expect(result).toEqual({ userId: 'u1', siteId: 'site-1' });
    });

    it('should return original where when siteId is null', () => {
      const result = service.scopeToTenant(null, { userId: 'u1' });
      expect(result).toEqual({ userId: 'u1' });
    });

    it('should handle empty additional where', () => {
      const result = service.scopeToTenant('site-1');
      expect(result).toEqual({ siteId: 'site-1' });
    });
  });

  describe('8. Edge Cases', () => {
    it('should handle concurrent site creation', async () => {
      const [r1, r2] = await Promise.all([
        service.createSite({ brandName: 'A', domain: 'a.com' }),
        service.createSite({ brandName: 'B', domain: 'b.com' }),
      ]);
      expect(r1).toBeDefined();
      expect(r2).toBeDefined();
    });

    it('should handle update with empty data', async () => {
      await service.updateSite('site-test-abc123', {});
      expect(mockPrisma.siteConfiguration.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: {} }),
      );
    });
  });
});
