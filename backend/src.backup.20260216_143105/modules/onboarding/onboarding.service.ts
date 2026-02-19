import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

export interface CreateBrandDto {
  brandName: string;
  domain: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  houseEdgeConfig?: Record<string, number>;
  maxPayoutPerDay?: number;
  maxPayoutPerBet?: number;
  maxBetAmount?: number;
  botNamePrefix?: string;
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private prisma: PrismaService) {}

  async createBrand(dto: CreateBrandDto) {
    const existingDomain = await this.prisma.siteConfiguration.findUnique({
      where: { domain: dto.domain },
    });
    if (existingDomain) {
      throw new BadRequestException(`Domain "${dto.domain}" already registered`);
    }

    const siteId = `site-${dto.brandName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;

    const defaultHouseEdge = {
      dice: 0.02, crash: 0.04, mines: 0.03, plinko: 0.03, olympus: 0.04,
    };

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. SiteConfiguration
      const site = await tx.siteConfiguration.create({
        data: {
          id: siteId,
          brandName: dto.brandName,
          domain: dto.domain,
          logoUrl: dto.logoUrl || `/assets/brands/${siteId}/logo.png`,
          faviconUrl: dto.faviconUrl || `/assets/brands/${siteId}/favicon.ico`,
          primaryColor: dto.primaryColor || '#6366f1',
          secondaryColor: dto.secondaryColor || '#1e1b4b',
          accentColor: dto.accentColor || '#f59e0b',
          backgroundColor: '#0f0a1e',
          houseEdgeConfig: dto.houseEdgeConfig || defaultHouseEdge,
          active: true,
        },
      });
      this.logger.log(`SiteConfiguration created: ${siteId}`);

      // 2. RiskLimit
      const riskLimit = await tx.riskLimit.create({
        data: {
          siteId,
          maxPayoutPerDay: dto.maxPayoutPerDay || 50000,
          maxPayoutPerBet: dto.maxPayoutPerBet || 10000,
          maxBetAmount: dto.maxBetAmount || 5000,
        },
      });
      this.logger.log(`RiskLimit created for ${siteId}`);

      // 3. BotConfig (single entry per site)
      const botConfig = await tx.botConfig.create({
        data: {
          siteId,
          enabled: true,
          botCount: 50,
          minBetAmount: 5,
          maxBetAmount: 1000,
          chatEnabled: true,
          chatIntervalMin: 5,
          chatIntervalMax: 15,
          botNamePrefix: dto.botNamePrefix || dto.brandName.substring(0, 3).toUpperCase() + '_',
        },
      });
      this.logger.log(`BotConfig created for ${siteId}`);

      return { site, riskLimit, botConfig };
    });

    const frontendConfig = {
      siteId,
      brandName: dto.brandName,
      domain: dto.domain,
      apiUrl: `https://${dto.domain}/api`,
      wsUrl: `wss://${dto.domain}/ws`,
      theme: {
        primaryColor: dto.primaryColor || '#6366f1',
        secondaryColor: dto.secondaryColor || '#1e1b4b',
        accentColor: dto.accentColor || '#f59e0b',
        logoUrl: result.site.logoUrl,
      },
      houseEdge: dto.houseEdgeConfig || defaultHouseEdge,
      riskLimits: {
        maxPayoutPerDay: dto.maxPayoutPerDay || 50000,
        maxPayoutPerBet: dto.maxPayoutPerBet || 10000,
        maxBetAmount: dto.maxBetAmount || 5000,
      },
      nginx: {
        serverName: dto.domain,
        proxyPass: 'http://localhost:3000',
        sslCertPath: `/etc/letsencrypt/live/${dto.domain}/fullchain.pem`,
        sslKeyPath: `/etc/letsencrypt/live/${dto.domain}/privkey.pem`,
      },
    };

    this.logger.log(`Brand "${dto.brandName}" created! siteId: ${siteId}`);

    return {
      success: true,
      message: `Brand "${dto.brandName}" created successfully`,
      siteId,
      frontendConfig,
      nextSteps: [
        `1. Point DNS for ${dto.domain} to server IP`,
        `2. Run: certbot --nginx -d ${dto.domain}`,
        `3. Add nginx server block for ${dto.domain}`,
        `4. Upload logo to ${result.site.logoUrl}`,
        `5. Restart PM2: pm2 restart stek-backend`,
      ],
    };
  }

  async listBrands() {
    const brands = await this.prisma.siteConfiguration.findMany({
      orderBy: { brandName: 'asc' },
    });
    const result = [];
    for (const b of brands) {
      const userCount = await this.prisma.user.count({ where: { siteId: b.id } });
      const botConfig = await this.prisma.botConfig.findUnique({ where: { siteId: b.id } });
      result.push({
        siteId: b.id,
        brandName: b.brandName,
        domain: b.domain,
        active: b.active,
        primaryColor: b.primaryColor,
        users: userCount,
        botsEnabled: botConfig?.enabled || false,
        houseEdge: b.houseEdgeConfig,
      });
    }
    return result;
  }

  async deactivateBrand(targetSiteId: string) {
    await this.prisma.siteConfiguration.update({
      where: { id: targetSiteId },
      data: { active: false },
    });
    await this.prisma.botConfig.update({
      where: { siteId: targetSiteId },
      data: { enabled: false },
    }).catch(() => {});
    return { success: true, message: `Brand ${targetSiteId} deactivated` };
  }

  async cloneBrand(sourceSiteId: string, newBrandName: string, newDomain: string) {
    const source = await this.prisma.siteConfiguration.findUnique({
      where: { id: sourceSiteId },
    });
    if (!source) throw new BadRequestException('Source brand not found');

    return this.createBrand({
      brandName: newBrandName,
      domain: newDomain,
      primaryColor: source.primaryColor || undefined,
      secondaryColor: source.secondaryColor || undefined,
      accentColor: source.accentColor || undefined,
      houseEdgeConfig: source.houseEdgeConfig as any,
    });
  }
}
