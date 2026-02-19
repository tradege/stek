import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';

/**
 * PUBLIC platform stats endpoint — NO authentication required.
 * Returns only safe-to-share metrics for the homepage.
 * Does NOT expose admin-level data (deposits, withdrawals, GGR, etc.)
 */
@Controller('api/v1/platform')
@ApiTags('Public Platform Stats')
export class PublicStatsController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Public platform stats for homepage (no auth)' })
  async getPublicStats(@Query('siteId') siteId?: string) {
    return this.adminService.getPublicStats(siteId);
  }
}
