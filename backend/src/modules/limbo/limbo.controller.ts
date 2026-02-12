/**
 * ============================================
 * LIMBO CONTROLLER
 * ============================================
 * Target Multiplier Game - REST API endpoints.
 * Secured with JwtAuthGuard, multi-tenant via siteId.
 */
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Post, Get, Body, Req, UseGuards, Query } from '@nestjs/common';
import { LimboService } from './limbo.service';
import { PlayLimboDto } from './limbo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('limbo')
@ApiTags('Games')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
export class LimboController {
  constructor(private readonly limboService: LimboService) {}

  @Post('play')
  async play(@Req() req: any, @Body() dto: PlayLimboDto) {
    const siteId = req.tenant?.siteId || req.user?.siteId || 'default-site-001';
    return this.limboService.play(req.user.id, dto, siteId);
  }

  @Post('verify')
  async verify(@Body() body: { serverSeed: string; clientSeed: string; nonce: number }) {
    return this.limboService.verifyResult(body.serverSeed, body.clientSeed, body.nonce);
  }

  @Get('history')
  async history(@Req() req: any, @Query('limit') limit?: string) {
    const siteId = req.tenant?.siteId || req.user?.siteId || 'default-site-001';
    return this.limboService.getHistory(req.user.id, siteId, limit ? parseInt(limit) : 20);
  }
}
