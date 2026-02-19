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
import { OlympusService, SpinDto, FreeSpinDto } from './olympus.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('games/olympus')
export class OlympusController {
  constructor(private readonly olympusService: OlympusService) {}

  /**
   * Spin the reels
   * POST /games/olympus/spin
   */
  @Post('spin')
  @UseGuards(JwtAuthGuard)
  async spin(@Request() req: any, @Body() dto: SpinDto) {
    const userId = req.user.sub || req.user.id;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.olympusService.spin(userId, dto);
  }

  /**
   * Execute a free spin
   * POST /games/olympus/free-spin
   */
  @Post('free-spin')
  @UseGuards(JwtAuthGuard)
  async freeSpin(@Request() req: any, @Body() dto: FreeSpinDto) {
    const userId = req.user.sub || req.user.id;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.olympusService.freeSpin(userId, dto);
  }

  /**
   * Get current game state (active free spins, etc.)
   * GET /games/olympus/state
   */
  @Get('state')
  @UseGuards(JwtAuthGuard)
  getState(@Request() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.olympusService.getState(userId);
  }

  /**
   * Get paytable for display
   * GET /games/olympus/paytable
   */
  @Get('paytable')
  getPaytable() {
    return this.olympusService.getPaytable();
  }

  /**
   * Verify a past spin result
   * POST /games/olympus/verify
   */
  @Post('verify')
  verify(
    @Body() body: { serverSeed: string; clientSeed: string; nonce: number },
  ) {
    return this.olympusService.verify(body.serverSeed, body.clientSeed, body.nonce);
  }

  /**
   * Get bet history
   * GET /games/olympus/history
   */
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(@Request() req: any, @Query('limit') limit?: string) {
    const userId = req.user.sub || req.user.id;
    const limitNum = limit ? parseInt(limit) : 20;
    return this.olympusService.getHistory(userId, Math.min(limitNum, 100));
  }
}
