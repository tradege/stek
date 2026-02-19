/**
 * ============================================
 * PENALTY SHOOTOUT CONTROLLER
 * ============================================
 * Visual Accumulator Game - REST API endpoints.
 * Secured with JwtAuthGuard, multi-tenant via siteId.
 * Flow: POST /start -> POST /kick (repeat) -> POST /cashout
 */
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Post, Get, Body, Req, UseGuards, Query } from '@nestjs/common';
import { PenaltyService, StartPenaltyDto, KickDto, CashoutPenaltyDto } from './penalty.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('penalty')
@ApiTags('Games')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
export class PenaltyController {
  constructor(private readonly penaltyService: PenaltyService) {}

  @Post('start')
  async start(@Req() req: any, @Body() dto: StartPenaltyDto) {
    const siteId = req.tenant?.siteId || req.user?.siteId || '1';
    return this.penaltyService.start(req.user.id, dto, siteId);
  }

  @Post('kick')
  async kick(@Req() req: any, @Body() dto: KickDto) {
    return this.penaltyService.kick(req.user.id, dto);
  }

  @Post('cashout')
  async cashout(@Req() req: any, @Body() dto: CashoutPenaltyDto) {
    return this.penaltyService.cashout(req.user.id, dto);
  }

  @Post('verify')
  async verify(@Body() body: { serverSeed: string; clientSeed: string; nonce: number; round: number }) {
    return this.penaltyService.verifyKick(body.serverSeed, body.clientSeed, body.nonce, body.round);
  }

  @Get('history')
  async history(@Req() req: any, @Query('limit') limit?: string) {
    const siteId = req.tenant?.siteId || req.user?.siteId || '1';
    return this.penaltyService.getHistory(req.user.id, siteId, limit ? parseInt(limit) : 20);
  }

  @Get('multipliers')
  async getMultipliers(@Req() req: any) {
    const siteId = req.tenant?.siteId || req.user?.siteId || '1';
    return this.penaltyService.getMultiplierTable(siteId);
  }
}
