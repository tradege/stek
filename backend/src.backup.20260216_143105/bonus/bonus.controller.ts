import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { BonusService } from './bonus.service';

/**
 * Stub Bonus Controller
 * Provides endpoints for the frontend bonus UI to call
 * without getting 500 errors.
 */
@Controller('bonus')
export class BonusController {
  constructor(private readonly bonusService: BonusService) {}

  @Post('claim-deposit')
  async claimDepositBonus(@Body() body: { depositAmount: number }, @Req() req: any) {
    const userId = req.user?.id || 'anonymous';
    return this.bonusService.claimDepositBonus(userId, body.depositAmount);
  }

  @Post('claim-weekly')
  async claimWeeklyReload(@Body() body: { depositAmount: number }, @Req() req: any) {
    const userId = req.user?.id || 'anonymous';
    return this.bonusService.claimWeeklyReload(userId, body.depositAmount);
  }

  @Post('claim-cashback')
  async claimCashback(@Req() req: any) {
    const userId = req.user?.id || 'anonymous';
    return this.bonusService.claimCashback(userId);
  }

  @Get('status')
  async getBonusStatus(@Req() req: any) {
    const userId = req.user?.id || 'anonymous';
    return this.bonusService.getBonusStatus(userId);
  }
}
