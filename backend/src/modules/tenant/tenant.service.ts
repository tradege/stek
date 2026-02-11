/**
 * ============================================
 * TENANT SERVICE - Brand/Site Management
 * ============================================
 * Handles CRUD operations for SiteConfiguration.
 * Provides helper methods for tenant-scoped queries.
 */

import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateSiteDto {
  brandName: string;
  domain: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  dangerColor?: string;
  backgroundColor?: string;
  cardColor?: string;
  heroImageUrl?: string;
  backgroundImageUrl?: string;
  loginBgUrl?: string;
  gameAssets?: any;
  houseEdgeConfig?: any;
  locale?: string;
  jurisdiction?: string;
  licenseType?: string;
  adminUserId?: string;
}

export interface UpdateSiteDto extends Partial<CreateSiteDto> {
  active?: boolean;
}

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new site/brand configuration
   */
  async createSite(data: CreateSiteDto) {
    // Check for duplicate domain
    const existing = await this.prisma.siteConfiguration.findFirst({
      where: {
        OR: [
          { domain: data.domain },
          { brandName: data.brandName },
        ],
      },
    });

    if (existing) {
      throw new ConflictException(
        `A site with domain "${data.domain}" or brand name "${data.brandName}" already exists.`
      );
    }

    const site = await this.prisma.siteConfiguration.create({
      data: {
        brandName: data.brandName,
        domain: data.domain,
        logoUrl: data.logoUrl,
        faviconUrl: data.faviconUrl,
        primaryColor: data.primaryColor || '#00F0FF',
        secondaryColor: data.secondaryColor || '#131B2C',
        accentColor: data.accentColor || '#00D46E',
        dangerColor: data.dangerColor || '#FF385C',
        backgroundColor: data.backgroundColor || '#0A0E17',
        cardColor: data.cardColor || '#131B2C',
        heroImageUrl: data.heroImageUrl,
        backgroundImageUrl: data.backgroundImageUrl,
        loginBgUrl: data.loginBgUrl,
        gameAssets: data.gameAssets || {},
        houseEdgeConfig: data.houseEdgeConfig || {
          crash: 0.04,
          dice: 0.02,
          mines: 0.03,
          plinko: 0.03,
          olympus: 0.04,
        },
        locale: data.locale || 'en',
        jurisdiction: data.jurisdiction,
        licenseType: data.licenseType,
        adminUserId: data.adminUserId,
        active: true,
      },
    });

    // Create default bot config for the new site
    await this.prisma.botConfig.create({
      data: {
        siteId: site.id,
        enabled: true,
        botCount: 50,
        minBetAmount: 5,
        maxBetAmount: 1000,
        chatEnabled: true,
        chatIntervalMin: 5,
        chatIntervalMax: 15,
      },
    });

    this.logger.log(`🏢 Created new site: ${data.brandName} (${data.domain})`);
    return site;
  }

  /**
   * Update an existing site configuration
   */
  async updateSite(siteId: string, data: UpdateSiteDto) {
    const existing = await this.prisma.siteConfiguration.findUnique({
      where: { id: siteId },
    });

    if (!existing) {
      throw new NotFoundException(`Site with ID "${siteId}" not found.`);
    }

    const updated = await this.prisma.siteConfiguration.update({
      where: { id: siteId },
      data,
    });

    this.logger.log(`🏢 Updated site: ${updated.brandName}`);
    return updated;
  }

  /**
   * Get all site configurations
   */
  async getAllSites() {
    return this.prisma.siteConfiguration.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            users: true,
            bets: true,
            transactions: true,
          },
        },
      },
    });
  }

  /**
   * Get a single site configuration by ID
   */
  async getSiteById(siteId: string) {
    const site = await this.prisma.siteConfiguration.findUnique({
      where: { id: siteId },
      include: {
        bots: true,
        _count: {
          select: {
            users: true,
            bets: true,
            transactions: true,
          },
        },
      },
    });

    if (!site) {
      throw new NotFoundException(`Site with ID "${siteId}" not found.`);
    }

    return site;
  }

  /**
   * Get site configuration by domain (used by frontend)
   */
  async getSiteByDomain(domain: string) {
    const site = await this.prisma.siteConfiguration.findFirst({
      where: {
        domain: domain.toLowerCase(),
        active: true,
      },
      select: {
        id: true,
        brandName: true,
        domain: true,
        logoUrl: true,
        faviconUrl: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        dangerColor: true,
        backgroundColor: true,
        cardColor: true,
        heroImageUrl: true,
        backgroundImageUrl: true,
        loginBgUrl: true,
        gameAssets: true,
        locale: true,
      },
    });

    return site;
  }

  /**
   * Delete a site configuration (soft - sets active to false)
   */
  async deactivateSite(siteId: string) {
    return this.updateSite(siteId, { active: false });
  }

  /**
   * Build a Prisma where clause scoped to a specific tenant
   * Helper for all services to use
   */
  scopeToTenant(siteId: string | null, additionalWhere: any = {}) {
    if (!siteId) {
      return additionalWhere;
    }
    return {
      ...additionalWhere,
      siteId,
    };
  }
}
