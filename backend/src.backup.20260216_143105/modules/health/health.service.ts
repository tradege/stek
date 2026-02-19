/**
 * ============================================
 * SYSTEM HEALTH SERVICE
 * ============================================
 * Reports status of DB, WebSocket, and platform metrics
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(private prisma: PrismaService) {}

  async getHealth() {
    const checks: Record<string, any> = {};

    // 1. Database check
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: 'UP',
        responseTime: `${Date.now() - start}ms`,
      };
    } catch (e) {
      checks.database = { status: 'DOWN', error: (e as Error).message };
    }

    // 2. Memory usage
    const mem = process.memoryUsage();
    checks.memory = {
      status: 'UP',
      heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
      external: `${Math.round(mem.external / 1024 / 1024)}MB`,
    };

    // 3. Platform metrics
    try {
      const [totalUsers, totalBets, activeSites, openAlerts] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.bet.count(),
        this.prisma.siteConfiguration.count({ where: { active: true } }),
        this.prisma.fraudAlert.count({ where: { status: 'OPEN' } }).catch(() => 0),
      ]);
      checks.platform = {
        status: 'UP',
        totalUsers,
        totalBets,
        activeSites,
        openFraudAlerts: openAlerts,
      };
    } catch (e) {
      checks.platform = { status: 'DEGRADED', error: (e as Error).message };
    }

    // 4. Uptime
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    // Overall status
    const allUp = Object.values(checks).every((c: any) => c.status === 'UP');

    return {
      status: allUp ? 'HEALTHY' : 'DEGRADED',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'production',
      uptime: `${hours}h ${minutes}m ${seconds}s`,
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  async getDetailedHealth() {
    const health = await this.getHealth();

    // Add per-brand stats
    const brands = await this.prisma.siteConfiguration.findMany({
      where: { active: true },
      select: { id: true, brandName: true, domain: true },
    });

    const brandHealth = await Promise.all(brands.map(async (b) => {
      const [users, betsToday] = await Promise.all([
        this.prisma.user.count({ where: { siteId: b.id, isBot: false } }),
        this.prisma.bet.count({
          where: { siteId: b.id, createdAt: { gte: new Date(Date.now() - 86400000) } },
        }),
      ]);
      return { siteId: b.id, brandName: b.brandName, domain: b.domain, users, betsToday };
    }));

    return { ...health, brands: brandHealth };
  }
}
