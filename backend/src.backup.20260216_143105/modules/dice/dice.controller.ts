import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Post, Get, Body, Req, UseGuards, Query } from '@nestjs/common';
import { DiceService, PlayDiceDto } from './dice.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('dice')
@ApiTags('Games')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
export class DiceController {
  constructor(private readonly diceService: DiceService) {}

  @Post('play')
  async play(@Req() req: any, @Body() dto: PlayDiceDto) {
    const siteId = req.tenant?.siteId || req.user?.siteId || 'default-site-001';
    return this.diceService.play(req.user.id, dto, siteId);
  }

  @Post('verify')
  async verify(@Body() body: { serverSeed: string; clientSeed: string; nonce: number }) {
    return this.diceService.verifyRoll(body.serverSeed, body.clientSeed, body.nonce);
  }

  @Get('history')
  async history(@Req() req: any, @Query('limit') limit?: string) {
    const siteId = req.tenant?.siteId || req.user?.siteId || 'default-site-001';
    return this.diceService.getHistory(req.user.id, siteId, limit ? parseInt(limit) : 20);
  }
}
