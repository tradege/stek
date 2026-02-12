import * as bcrypt from "bcrypt";
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';


@Injectable()
export class SuperAdminService {
  private readonly SALT_ROUNDS = 10;

  constructor(private readonly prisma: PrismaService) {}


  async deleteTenant(id: string) {
    const tenant = await this.prisma.siteConfiguration.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    await this.prisma.siteConfiguration.delete({ where: { id } });
    return { message: 'Tenant deleted successfully', id };
  }

  // ============================================
  // DASHBOARD
  // ============================================

  async getDashboardStats() {
    const [
      totalBrands,
      activeBrands,
      totalPlayers,
      totalBets,
      totalWagered,
      totalPayout,
    ] = await Promise.all([
      this.prisma.siteConfiguration.count(),
      this.prisma.siteConfiguration.count({ where: { active: true } }),
      this.prisma.user.count({ where: { role: 'USER' } }),
      this.prisma.bet.count(),
      this.prisma.bet.aggregate({ _sum: { betAmount: true } }),
      this.prisma.bet.aggregate({ _sum: { payout: true } }),
    ]);

    const wagered = Number(totalWagered._sum.betAmount || 0);
    const payout = Number(totalPayout._sum.payout || 0);
    const ggr = wagered - payout;

    return {
      totalBrands,
      activeBrands,
      inactiveBrands: totalBrands - activeBrands,
      totalPlayers,
      totalBets: totalBets,
      totalWagered: wagered,
      totalPayout: payout,
      totalGGR: ggr,
    };
  }

  // ============================================
  // TENANT CRUD
  // ============================================

  async getAllTenants() {
    const tenants = await this.prisma.siteConfiguration.findMany({
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

    // Enrich with financial data
    const enriched = await Promise.all(
      tenants.map(async (tenant) => {
        const betsAgg = await this.prisma.bet.aggregate({
          where: { siteId: tenant.id },
          _sum: { betAmount: true, payout: true, profit: true },
        });

        const wagered = Number(betsAgg._sum.betAmount || 0);
        const payout = Number(betsAgg._sum.payout || 0);
        const ggr = wagered - payout;
        const ggrFee = tenant.houseEdgeConfig
          ? (typeof tenant.houseEdgeConfig === 'object' && (tenant.houseEdgeConfig as any).ggrFee)
            ? Number((tenant.houseEdgeConfig as any).ggrFee)
            : 12
          : 12;
        const commission = ggr * (ggrFee / 100);

        return {
          ...tenant,
          stats: {
            totalPlayers: tenant._count.users,
            totalBets: tenant._count.bets,
            totalTransactions: tenant._count.transactions,
            totalWagered: wagered,
            totalPayout: payout,
            ggr,
            ggrFee,
            commission,
          },
        };
      }),
    );

    return enriched;
  }

  async getTenantById(id: string) {
    const tenant = await this.prisma.siteConfiguration.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            bets: true,
            transactions: true,
          },
        },
        bots: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} not found`);
    }

    // Get financial stats
    const betsAgg = await this.prisma.bet.aggregate({
      where: { siteId: id },
      _sum: { betAmount: true, payout: true },
    });

    // Get recent bets
    const recentBets = await this.prisma.bet.findMany({
      where: { siteId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { username: true } } },
    });

    // Get owner user if exists
    let owner = null;
    if (tenant.adminUserId) {
      owner = await this.prisma.user.findUnique({
        where: { id: tenant.adminUserId },
        select: { id: true, username: true, email: true, role: true },
      });
    }

    const wagered = Number(betsAgg._sum.betAmount || 0);
    const payout = Number(betsAgg._sum.payout || 0);

    return {
      ...tenant,
      owner,
      stats: {
        totalPlayers: tenant._count.users,
        totalBets: tenant._count.bets,
        totalWagered: wagered,
        totalPayout: payout,
        ggr: wagered - payout,
      },
      recentBets,
    };
  }

  async createTenant(data: {
    brandName: string;
    domain: string;
    ownerEmail: string;
    ownerPassword?: string;
    ownerUsername?: string;
    ggrFee: number;
    allowedGames: string[];
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    cardColor?: string;
    dangerColor?: string;
    logoUrl?: string;
    locale?: string;
    jurisdiction?: string;
    licenseType?: string;
  }) {
    const existing = await this.prisma.siteConfiguration.findFirst({
      where: { OR: [{ brandName: data.brandName }, { domain: data.domain.toLowerCase() }] },
    });
    if (existing) {
      throw new BadRequestException(
        existing.brandName === data.brandName ? 'Brand name already exists' : 'Domain already registered',
      );
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: data.ownerEmail.toLowerCase() },
    });
    if (existingUser) {
      throw new BadRequestException('Owner email already registered. Use a unique email for each brand admin.');
    }

    const adminPassword = data.ownerPassword || this.generateSecurePassword();
    const adminUsername = data.ownerUsername || data.brandName.toLowerCase().replace(/[^a-z0-9]/g, '') + '_admin';

    const result = await this.prisma.$transaction(async (tx) => {
      const site = await tx.siteConfiguration.create({
        data: {
          brandName: data.brandName,
          domain: data.domain.toLowerCase(),
          primaryColor: data.primaryColor || '#00F0FF',
          secondaryColor: data.secondaryColor || '#131B2C',
          accentColor: data.accentColor || '#00D46E',
          backgroundColor: data.backgroundColor || '#0A0E17',
          cardColor: data.cardColor || '#131B2C',
          dangerColor: data.dangerColor || '#FF385C',
          logoUrl: data.logoUrl,
          locale: data.locale || 'en',
          jurisdiction: data.jurisdiction,
          licenseType: data.licenseType,
          houseEdgeConfig: {
            ggrFee: data.ggrFee,
            allowedGames: data.allowedGames,
            crash: 0.04, dice: 0.04, mines: 0.04, plinko: 0.04,
            limbo: 0.04, penalty: 0.04, olympus: 0.04, cardRush: 0.04,
          },
          gameAssets: {},
        },
      });

      const passwordHash = await bcrypt.hash(adminPassword, this.SALT_ROUNDS);
      const adminUser = await tx.user.create({
        data: {
          username: adminUsername.toLowerCase(),
          email: data.ownerEmail.toLowerCase(),
          passwordHash,
          role: 'ADMIN',
          status: 'ACTIVE',
          displayName: data.brandName + ' Admin',
          siteId: site.id,
          hierarchyPath: '/',
          hierarchyLevel: 1,
        },
      });

      await tx.wallet.create({
        data: {
          userId: adminUser.id,
          currency: 'USDT',
          balance: 0,
          lockedBalance: 0,
          siteId: site.id,
        },
      });

      await tx.siteConfiguration.update({
        where: { id: site.id },
        data: { adminUserId: adminUser.id },
      });

      return { site, adminUser: { id: adminUser.id, username: adminUser.username, email: adminUser.email, role: adminUser.role } };
    });

    return {
      success: true,
      tenant: result.site,
      adminCredentials: {
        email: data.ownerEmail.toLowerCase(),
        username: result.adminUser.username,
        password: adminPassword,
        role: 'ADMIN',
        loginUrl: 'https://' + data.domain.toLowerCase(),
      },
    };
  }

  async updateTenant(id: string, data: any) {
    const existing = await this.prisma.siteConfiguration.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Tenant ${id} not found`);

    // Build update data - only include fields that are provided
    const updateData: any = {};
    const directFields = [
      'brandName', 'domain', 'logoUrl', 'faviconUrl',
      'primaryColor', 'secondaryColor', 'accentColor', 'dangerColor',
      'backgroundColor', 'cardColor', 'heroImageUrl', 'backgroundImageUrl',
      'loginBgUrl', 'locale', 'jurisdiction', 'licenseType', 'adminUserId',
    ];

    for (const field of directFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    // Handle houseEdgeConfig updates (merge)
    if (data.ggrFee !== undefined || data.allowedGames !== undefined) {
      const currentConfig = (existing.houseEdgeConfig as any) || {};
      updateData.houseEdgeConfig = {
        ...currentConfig,
        ...(data.ggrFee !== undefined ? { ggrFee: data.ggrFee } : {}),
        ...(data.allowedGames !== undefined ? { allowedGames: data.allowedGames } : {}),
      };
    }

    if (data.active !== undefined) {
      updateData.active = data.active;
    }

    const updated = await this.prisma.siteConfiguration.update({
      where: { id },
      data: updateData,
    });

    return { success: true, tenant: updated };
  }

  async toggleTenantStatus(id: string) {
    const tenant = await this.prisma.siteConfiguration.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);

    const updated = await this.prisma.siteConfiguration.update({
      where: { id },
      data: { active: !tenant.active },
    });

    return { success: true, active: updated.active };
  }

  // ============================================
  // BANKROLL MANAGEMENT
  // ============================================

  async getBankrollOverview() {
    const tenants = await this.prisma.siteConfiguration.findMany({
      where: { active: true },
      select: {
        id: true,
        brandName: true,
        domain: true,
        active: true,
        houseEdgeConfig: true,
      },
    });

    const overview = await Promise.all(
      tenants.map(async (tenant) => {
        // Calculate house wallet balance from bets (wagered - payout = house profit)
        const betsAgg = await this.prisma.bet.aggregate({
          where: { siteId: tenant.id },
          _sum: { betAmount: true, payout: true },
        });

        // Get total deposits and withdrawals for this tenant
        const depositsAgg = await this.prisma.transaction.aggregate({
          where: { siteId: tenant.id, type: 'DEPOSIT', status: 'CONFIRMED' },
          _sum: { amount: true },
        });

        const withdrawalsAgg = await this.prisma.transaction.aggregate({
          where: { siteId: tenant.id, type: 'WITHDRAWAL', status: 'CONFIRMED' },
          _sum: { amount: true },
        });

        const wagered = Number(betsAgg._sum.betAmount || 0);
        const payout = Number(betsAgg._sum.payout || 0);
        const deposits = Number(depositsAgg._sum.amount || 0);
        const withdrawals = Number(withdrawalsAgg._sum.amount || 0);
        const houseProfit = wagered - payout;
        const houseBalance = deposits - withdrawals + houseProfit;

        return {
          tenantId: tenant.id,
          brandName: tenant.brandName,
          domain: tenant.domain,
          houseBalance,
          houseProfit,
          totalDeposits: deposits,
          totalWithdrawals: withdrawals,
          totalWagered: wagered,
          totalPayout: payout,
          status: houseBalance > 0 ? 'HEALTHY' : houseBalance > -1000 ? 'WARNING' : 'CRITICAL',
        };
      }),
    );

    return overview;
  }

  async getTenantBankroll(tenantId: string) {
    const tenant = await this.prisma.siteConfiguration.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    // Get detailed financial breakdown
    const [betsAgg, depositsAgg, withdrawalsAgg, recentTransactions] = await Promise.all([
      this.prisma.bet.aggregate({
        where: { siteId: tenantId },
        _sum: { betAmount: true, payout: true },
      }),
      this.prisma.transaction.aggregate({
        where: { siteId: tenantId, type: 'DEPOSIT', status: 'CONFIRMED' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { siteId: tenantId, type: 'WITHDRAWAL', status: 'CONFIRMED' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.findMany({
        where: { siteId: tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { username: true } } },
      }),
    ]);

    const wagered = Number(betsAgg._sum.betAmount || 0);
    const payout = Number(betsAgg._sum.payout || 0);
    const deposits = Number(depositsAgg._sum.amount || 0);
    const withdrawals = Number(withdrawalsAgg._sum.amount || 0);

    return {
      tenantId,
      brandName: tenant.brandName,
      houseBalance: deposits - withdrawals + (wagered - payout),
      houseProfit: wagered - payout,
      totalDeposits: deposits,
      totalWithdrawals: withdrawals,
      totalWagered: wagered,
      totalPayout: payout,
      recentTransactions,
    };
  }

  async transferFunds(tenantId: string, amount: number, note?: string) {
    const tenant = await this.prisma.siteConfiguration.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    // Store transfer in the tenant's houseEdgeConfig as a transfer log
    const currentConfig = (tenant.houseEdgeConfig as any) || {};
    const transfers = currentConfig.houseTransfers || [];
    const transfer = {
      id: `transfer_${Date.now()}`,
      amount,
      note: note || `House wallet funding: $${amount}`,
      source: 'SUPER_ADMIN',
      timestamp: new Date().toISOString(),
    };
    transfers.push(transfer);

    await this.prisma.siteConfiguration.update({
      where: { id: tenantId },
      data: {
        houseEdgeConfig: {
          ...currentConfig,
          houseTransfers: transfers,
          houseWalletBalance: (currentConfig.houseWalletBalance || 0) + amount,
        },
      },
    });

    return {
      success: true,
      transfer: {
        ...transfer,
        tenantId,
        brandName: tenant.brandName,
      },
    };
  }

  async getTransferHistory(tenantId: string, limit: number = 50) {
    const tenant = await this.prisma.siteConfiguration.findUnique({
      where: { id: tenantId },
    });

    const config = (tenant.houseEdgeConfig as any) || {};
    const transfers = (config.houseTransfers || []).slice(-limit).reverse();

    return transfers;
  }

  // ============================================
  // MASTER REPORTS
  // ============================================

  async getMasterReport(period: string = 'all') {
    const dateFilter = this.getDateFilter(period);

    const tenants = await this.prisma.siteConfiguration.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    const report = await Promise.all(
      tenants.map(async (tenant) => {
        const betsAgg = await this.prisma.bet.aggregate({
          where: {
            siteId: tenant.id,
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          },
          _sum: { betAmount: true, payout: true },
          _count: true,
        });

        const wagered = Number(betsAgg._sum.betAmount || 0);
        const payout = Number(betsAgg._sum.payout || 0);
        const ggr = wagered - payout;
        const config = (tenant.houseEdgeConfig as any) || {};
        const ggrFee = config.ggrFee || 12;
        const commission = ggr * (ggrFee / 100);

        return {
          tenantId: tenant.id,
          brandName: tenant.brandName,
          domain: tenant.domain,
          active: tenant.active,
          totalPlayers: tenant._count.users,
          totalBets: betsAgg._count,
          totalWagered: wagered,
          totalPayout: payout,
          ggr,
          ggrFee,
          commission,
          houseBalance: config.houseWalletBalance || 0,
          allowedGames: config.allowedGames || [],
        };
      }),
    );

    // Calculate totals
    const totals = report.reduce(
      (acc, r) => ({
        totalPlayers: acc.totalPlayers + r.totalPlayers,
        totalBets: acc.totalBets + r.totalBets,
        totalWagered: acc.totalWagered + r.totalWagered,
        totalPayout: acc.totalPayout + r.totalPayout,
        totalGGR: acc.totalGGR + r.ggr,
        totalCommission: acc.totalCommission + r.commission,
      }),
      { totalPlayers: 0, totalBets: 0, totalWagered: 0, totalPayout: 0, totalGGR: 0, totalCommission: 0 },
    );

    return { period, brands: report, totals };
  }

  async getTenantReport(tenantId: string, period: string = 'all') {
    const tenant = await this.prisma.siteConfiguration.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    const dateFilter = this.getDateFilter(period);
    const whereClause = {
      siteId: tenantId,
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    };

    // Get per-game breakdown
    const gameTypes = ['CRASH', 'PLINKO', 'DICE', 'MINES', 'LIMBO', 'PENALTY', 'OLYMPUS', 'CARD_RUSH'];
    const gameBreakdown = await Promise.all(
      gameTypes.map(async (gameType) => {
        const agg = await this.prisma.bet.aggregate({
          where: { ...whereClause, gameType: gameType as any },
          _sum: { betAmount: true, payout: true },
          _count: true,
        });
        const wagered = Number(agg._sum.betAmount || 0);
        const payout = Number(agg._sum.payout || 0);
        return {
          gameType,
          bets: agg._count,
          wagered,
          payout,
          ggr: wagered - payout,
          rtp: wagered > 0 ? (payout / wagered) * 100 : 0,
        };
      }),
    );

    // Get daily trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyBets = await this.prisma.bet.groupBy({
      by: ['createdAt'],
      where: {
        siteId: tenantId,
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { betAmount: true, payout: true },
      _count: true,
    });

    return {
      tenant: {
        id: tenant.id,
        brandName: tenant.brandName,
        domain: tenant.domain,
        active: tenant.active,
      },
      period,
      gameBreakdown: gameBreakdown.filter((g) => g.bets > 0),
      dailyTrend: dailyBets,
    };
  }

  // ============================================
  // ============================================
  // TENANT COLOR MANAGEMENT
  // ============================================
  async updateTenantColors(siteId: string, userId: string, colors: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    cardColor?: string;
    dangerColor?: string;
    logoUrl?: string;
    faviconUrl?: string;
    heroImageUrl?: string;
    backgroundImageUrl?: string;
  }) {
    const site = await this.prisma.siteConfiguration.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');
    if (site.adminUserId !== userId) {
      throw new BadRequestException('You are not the admin of this brand');
    }
    const colorFields = ['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'cardColor', 'dangerColor'];
    for (const field of colorFields) {
      if (colors[field] && !/^#[0-9A-Fa-f]{6}$/.test(colors[field])) {
        throw new BadRequestException('Invalid color format for ' + field + '. Use hex #RRGGBB');
      }
    }
    const updateData: any = {};
    for (const [key, value] of Object.entries(colors)) {
      if (value !== undefined && value !== null) updateData[key] = value;
    }
    const updated = await this.prisma.siteConfiguration.update({ where: { id: siteId }, data: updateData });
    return {
      success: true,
      message: 'Brand colors updated successfully',
      colors: {
        primaryColor: updated.primaryColor, secondaryColor: updated.secondaryColor,
        accentColor: updated.accentColor, backgroundColor: updated.backgroundColor,
        cardColor: updated.cardColor, dangerColor: updated.dangerColor,
        logoUrl: updated.logoUrl, faviconUrl: updated.faviconUrl,
        heroImageUrl: updated.heroImageUrl, backgroundImageUrl: updated.backgroundImageUrl,
      },
    };
  }

  async getTenantBrandSettings(siteId: string, userId: string) {
    const site = await this.prisma.siteConfiguration.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');
    if (site.adminUserId !== userId) {
      throw new BadRequestException('You are not the admin of this brand');
    }
    return {
      brandName: site.brandName, domain: site.domain,
      primaryColor: site.primaryColor, secondaryColor: site.secondaryColor,
      accentColor: site.accentColor, backgroundColor: site.backgroundColor,
      cardColor: site.cardColor, dangerColor: site.dangerColor,
      logoUrl: site.logoUrl, faviconUrl: site.faviconUrl,
      heroImageUrl: site.heroImageUrl, backgroundImageUrl: site.backgroundImageUrl,
      locale: site.locale, jurisdiction: site.jurisdiction,
    };
  }

  private generateSecurePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const specials = '!@#$%';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    password += specials.charAt(Math.floor(Math.random() * specials.length));
    password += Math.floor(Math.random() * 10);
    return password;
  }


  // HELPERS
  // ============================================

  private getDateFilter(period: string) {
    const now = new Date();
    switch (period) {
      case 'today':
        return { gte: new Date(now.setHours(0, 0, 0, 0)) };
      case 'week':
        return { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      case 'month':
        return { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
      case 'all':
      default:
        return null;
    }
  }
}
