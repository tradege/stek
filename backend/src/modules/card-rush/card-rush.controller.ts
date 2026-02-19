/**
 * ============================================
 * CARD RUSH CONTROLLER
 * ============================================
 * Instant Blackjack Variant - REST API endpoints.
 * Secured with JwtAuthGuard, multi-tenant via siteId.
 */
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Post, Get, Body, Req, UseGuards, Query } from '@nestjs/common';
import { CardRushService, PlayCardRushDto } from './card-rush.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('card-rush')
@ApiTags('Games')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
export class CardRushController {
  constructor(private readonly cardRushService: CardRushService) {}

  @Post('play')
  async play(@Req() req: any, @Body() dto: PlayCardRushDto) {
    const siteId = req.tenant?.siteId || req.user?.siteId || '1';
    return this.cardRushService.play(req.user.id, dto, siteId);
  }

  @Post('verify')
  async verify(@Body() body: { serverSeed: string; clientSeed: string; nonce: number; handSize: number }) {
    return this.cardRushService.verifyRound(body.serverSeed, body.clientSeed, body.nonce, body.handSize);
  }

  @Get('history')
  async history(@Req() req: any, @Query('limit') limit?: string) {
    const siteId = req.tenant?.siteId || req.user?.siteId || '1';
    return this.cardRushService.getHistory(req.user.id, siteId, limit ? parseInt(limit) : 20);
  }

  @Get('odds')
  async getOdds(@Req() req: any) {
    const siteId = req.tenant?.siteId || req.user?.siteId || '1';
    return this.cardRushService.getOddsTable(siteId);
  }
}
