/**
 * ============================================
 * SLOTS CONTROLLER
 * ============================================
 * Routes: /games/slots/*
 */
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
import { SlotsService, SlotSpinDto, SlotFreeSpinDto } from './slots.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('games/slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  /**
   * Spin the reels
   * POST /games/slots/spin
   */
  @Post('spin')
  @UseGuards(JwtAuthGuard)
  async spin(@Request() req: any, @Body() dto: SlotSpinDto) {
    const userId = req.user.sub || req.user.id;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.slotsService.spin(userId, dto);
  }

  /**
   * Execute a free spin
   * POST /games/slots/free-spin
   */
  @Post('free-spin')
  @UseGuards(JwtAuthGuard)
  async freeSpin(@Request() req: any, @Body() dto: SlotFreeSpinDto) {
    const userId = req.user.sub || req.user.id;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.slotsService.freeSpin(userId, dto);
  }

  /**
   * Starburst respin (for wild expansion)
   * POST /games/slots/starburst-respin
   */
  @Post('starburst-respin')
  @UseGuards(JwtAuthGuard)
  async starburstRespin(
    @Request() req: any,
    @Body() body: { stickyWilds: number[]; respinCount: number },
  ) {
    const userId = req.user.sub || req.user.id;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.slotsService.starburstRespin(userId, body);
  }

  /**
   * Get current game state (active free spins, quantum charges, etc.)
   * GET /games/slots/state
   */
  @Get('state')
  @UseGuards(JwtAuthGuard)
  getState(@Request() req: any, @Query('gameMode') gameMode?: string) {
    const userId = req.user.sub || req.user.id;
    return this.slotsService.getState(userId, gameMode as any);
  }

  /**
   * Get paytable for a specific game mode
   * GET /games/slots/paytable?gameMode=BONANZA
   */
  @Get('paytable')
  getPaytable(@Query('gameMode') gameMode: string) {
    if (!gameMode) {
      throw new BadRequestException('gameMode query parameter is required');
    }
    return this.slotsService.getPaytable(gameMode as any);
  }

  /**
   * Verify a past spin result
   * POST /games/slots/verify
   */
  @Post('verify')
  verify(
    @Body() body: { serverSeed: string; clientSeed: string; nonce: number; gameMode: string },
  ) {
    return this.slotsService.verify(body as any);
  }

  /**
   * Get bet history for slots
   * GET /games/slots/history
   */
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(@Request() req: any, @Query('limit') limit?: string) {
    const userId = req.user.sub || req.user.id;
    const limitNum = limit ? parseInt(limit) : 20;
    return this.slotsService.getHistory(userId, Math.min(limitNum, 100));
  }
}
