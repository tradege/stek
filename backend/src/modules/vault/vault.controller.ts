import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { VaultService } from './vault.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('vault')
export class VaultController {
  constructor(private readonly vaultService: VaultService) {}

  /**
   * GET /vault/pool - Get current jackpot pool info
   * Public endpoint - shown in header ticker
   */
  @Get('pool')
  async getPoolInfo() {
    return this.vaultService.getPoolInfo();
  }

  /**
   * PUT /vault/settings - Admin: Update pool settings
   */
  @Put('settings')
  @UseGuards(JwtAuthGuard)
  async updateSettings(@Body() data: {
    seedAmount?: number;
    contributionRate?: number;
    dropThreshold?: number;
    isActive?: boolean;
  }) {
    return this.vaultService.updatePoolSettings(data);
  }
}
