import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Post, Get, Body, Req, UseGuards, Query } from '@nestjs/common';
import { PlinkoService } from './plinko.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('games/plinko')
@ApiTags('Games')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
export class PlinkoController {
  constructor(private readonly plinkoService: PlinkoService) {}

  @Post('play')
  async play(@Req() req: any, @Body() dto: any) {
    const siteId = req.tenant?.siteId || req.user?.siteId || 'default-site-001';
    return this.plinkoService.play(req.user.id, dto, siteId);
  }

  @Get('multipliers')
  getMultipliers(@Query('rows') rows: string, @Query('risk') risk: string) {
    return this.plinkoService.getMultipliers(parseInt(rows) || 12, (risk || 'MEDIUM') as any);
  }
}
