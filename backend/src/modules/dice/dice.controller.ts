import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { DiceService, PlayDiceDto } from './dice.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('dice')
export class DiceController {
  constructor(private readonly diceService: DiceService) {}

  /**
   * Play a dice round
   * POST /dice/play
   */
  @Post('play')
  @UseGuards(JwtAuthGuard)
  async play(@Request() req: any, @Body() dto: PlayDiceDto) {
    const userId = req.user.sub || req.user.id;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.diceService.play(userId, dto);
  }

  /**
   * Get multiplier for given parameters (no auth needed)
   * GET /dice/multiplier?target=50&condition=UNDER
   */
  @Get('multiplier')
  getMultiplier(
    @Query('target') target: string,
    @Query('condition') condition: string,
  ) {
    const targetNum = parseFloat(target);
    if (isNaN(targetNum) || targetNum < 0.01 || targetNum > 99.98) {
      throw new BadRequestException('Invalid target');
    }
    if (condition !== 'OVER' && condition !== 'UNDER') {
      throw new BadRequestException('Condition must be OVER or UNDER');
    }

    const winChance = this.diceService.calculateWinChance(targetNum, condition as 'OVER' | 'UNDER');
    const multiplier = this.diceService.calculateMultiplier(winChance);

    return { target: targetNum, condition, winChance, multiplier };
  }

  /**
   * Verify a past roll
   * POST /dice/verify
   */
  @Post('verify')
  verifyRoll(
    @Body() body: { serverSeed: string; clientSeed: string; nonce: number },
  ) {
    return this.diceService.verifyRoll(body.serverSeed, body.clientSeed, body.nonce);
  }

  /**
   * Get bet history
   * GET /dice/history
   */
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(@Request() req: any, @Query('limit') limit?: string) {
    const userId = req.user.sub || req.user.id;
    const limitNum = limit ? parseInt(limit) : 20;
    return this.diceService.getHistory(userId, Math.min(limitNum, 100));
  }
}
