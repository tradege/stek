import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { RewardPoolService } from './reward-pool.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const SUPER_ADMIN_EMAIL = 'marketedgepros@gmail.com';

/**
 * Get the effective siteId for the current request.
 * - Super admin can see all sites (defaults to '1' if no siteId on user)
 * - WL admins can only see their own site
 */
function getEffectiveSiteId(req: any): string {
  const isSuperAdmin = req.user?.email === SUPER_ADMIN_EMAIL;
  // WL admins always use their own siteId
  if (!isSuperAdmin && req.user?.siteId) {
    return req.user.siteId;
  }
  // Super admin defaults to root site '1'
  return req.user?.siteId || '1';
}

@Controller('rewards')
export class RewardPoolController {
  constructor(private readonly rewardPoolService: RewardPoolService) {}

  /**
   * GET /rewards/pool-status — Get current reward pool status
   */
  @Get('pool-status')
  @UseGuards(JwtAuthGuard)
  async getPoolStatus(@Req() req: any) {
    const siteId = getEffectiveSiteId(req);
    return this.rewardPoolService.getPoolStatus(siteId);
  }

  /**
   * GET /rewards/settings — Admin: get reward pool settings
   */
  @Get('settings')
  @UseGuards(JwtAuthGuard)
  async getSettings(@Req() req: any) {
    if (req.user?.role !== 'ADMIN') {
      return { error: 'Unauthorized' };
    }
    const siteId = getEffectiveSiteId(req);
    return this.rewardPoolService.getSettings(siteId);
  }

  /**
   * POST /rewards/settings — Admin: update reward pool settings
   */
  @Post('settings')
  @UseGuards(JwtAuthGuard)
  async updateSettings(@Req() req: any, @Body() body: any) {
    if (req.user?.role !== 'ADMIN') {
      return { error: 'Unauthorized' };
    }
    const siteId = getEffectiveSiteId(req);
    return this.rewardPoolService.updateSettings(body, siteId);
  }

  /**
   * GET /rewards/distribution-history — Admin: get distribution history
   */
  @Get('distribution-history')
  @UseGuards(JwtAuthGuard)
  async getDistributionHistory(@Req() req: any) {
    if (req.user?.role !== 'ADMIN') {
      return { error: 'Unauthorized' };
    }
    const siteId = getEffectiveSiteId(req);
    return this.rewardPoolService.getDistributionHistory(siteId);
  }

  /**
   * GET /rewards/top-players — Admin: get current top players
   */
  @Get('top-players')
  @UseGuards(JwtAuthGuard)
  async getTopPlayers(@Req() req: any) {
    if (req.user?.role !== 'ADMIN') {
      return { error: 'Unauthorized' };
    }
    const siteId = getEffectiveSiteId(req);
    return this.rewardPoolService.getTopPlayers(siteId);
  }

  /**
   * GET /rewards/my-history — Get current user's reward history
   */
  @Get('my-history')
  @UseGuards(JwtAuthGuard)
  async getMyRewardHistory(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.rewardPoolService.getUserRewardHistory(userId);
  }

  /**
   * GET /rewards/my-stats — Get current user's bonus stats
   */
  @Get('my-stats')
  @UseGuards(JwtAuthGuard)
  async getMyBonusStats(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.rewardPoolService.getUserBonusStats(userId);
  }

  /**
   * POST /rewards/distribute-weekly — Admin: trigger weekly distribution
   */
  @Post('distribute-weekly')
  @UseGuards(JwtAuthGuard)
  async distributeWeekly(@Req() req: any) {
    if (req.user?.role !== 'ADMIN') {
      return { error: 'Unauthorized' };
    }
    const siteId = getEffectiveSiteId(req);
    return this.rewardPoolService.distributeWeeklyBonus(siteId);
  }

  /**
   * POST /rewards/distribute-monthly — Admin: trigger monthly distribution
   */
  @Post('distribute-monthly')
  @UseGuards(JwtAuthGuard)
  async distributeMonthly(@Req() req: any) {
    if (req.user?.role !== 'ADMIN') {
      return { error: 'Unauthorized' };
    }
    const siteId = getEffectiveSiteId(req);
    return this.rewardPoolService.distributeMonthlyBonus(siteId);
  }
}
