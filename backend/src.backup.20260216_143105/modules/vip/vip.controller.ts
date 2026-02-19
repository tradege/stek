import { Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import { VipService } from './vip.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('vip')
export class VipController {
  constructor(private readonly vipService: VipService) {}

  /**
   * GET /vip/status — Get current user's VIP status
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getVipStatus(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.vipService.getVipStatus(userId);
  }

  /**
   * POST /vip/claim-rakeback — Claim accumulated rakeback to wallet
   */
  @Post('claim-rakeback')
  @UseGuards(JwtAuthGuard)
  async claimRakeback(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const siteId = req.headers['x-site-id'] || req.user?.siteId;
    return this.vipService.claimRakeback(userId, siteId);
  }
}
