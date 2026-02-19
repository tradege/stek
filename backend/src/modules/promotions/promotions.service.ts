import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  private siteFilter(siteId?: string) {
    if (!siteId) return {};
    return { siteId };
  }

  async getActivePromotions(siteId?: string) {
    const sf = this.siteFilter(siteId);
    const promotions = await this.prisma.promotion.findMany({
      where: {
        active: true,
        ...sf,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    return promotions.map(promo => ({
      id: promo.id,
      title: promo.title,
      description: promo.description,
      type: promo.type,
      bonusPercent: promo.bonusPercent,
      maxBonus: Number(promo.maxBonus),
      wagerReq: promo.wagerReq,
      minDeposit: Number(promo.minDeposit),
      currency: promo.currency,
      imageUrl: promo.imageUrl,
      startsAt: promo.startsAt,
      expiresAt: promo.expiresAt,
    }));
  }
  async getAllPromotions(siteId?: string) {
    const sf = this.siteFilter(siteId);
    const promotions = await this.prisma.promotion.findMany({
      where: { ...sf },
      orderBy: { createdAt: 'desc' },
    });
    return promotions.map(promo => ({
      id: promo.id,
      title: promo.title,
      description: promo.description,
      type: promo.type,
      bonusPercent: promo.bonusPercent,
      maxBonus: Number(promo.maxBonus),
      wagerReq: promo.wagerReq,
      minDeposit: Number(promo.minDeposit),
      currency: promo.currency,
      imageUrl: promo.imageUrl,
      active: promo.active,
      startsAt: promo.startsAt,
      expiresAt: promo.expiresAt,
    }));
  }
}
