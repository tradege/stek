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
import { MinesService, StartGameDto, RevealTileDto, CashoutDto } from './mines.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('mines')
export class MinesController {
  constructor(private readonly minesService: MinesService) {}

  /**
   * Start a new mines game
   * POST /mines/start
   */
  @Post('start')
  @UseGuards(JwtAuthGuard)
  async startGame(@Request() req: any, @Body() dto: StartGameDto) {
    const userId = req.user.sub || req.user.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.minesService.startGame(userId, dto);
  }

  /**
   * Reveal a tile
   * POST /mines/reveal
   */
  @Post('reveal')
  @UseGuards(JwtAuthGuard)
  async revealTile(@Request() req: any, @Body() dto: RevealTileDto) {
    const userId = req.user.sub || req.user.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.minesService.revealTile(userId, dto);
  }

  /**
   * Cash out current winnings
   * POST /mines/cashout
   */
  @Post('cashout')
  @UseGuards(JwtAuthGuard)
  async cashout(@Request() req: any, @Body() dto: CashoutDto) {
    const userId = req.user.sub || req.user.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.minesService.cashout(userId, dto);
  }

  /**
   * Get active game state
   * GET /mines/active
   */
  @Get('active')
  @UseGuards(JwtAuthGuard)
  getActiveGame(@Request() req: any) {
    const userId = req.user.sub || req.user.id;
    const game = this.minesService.getActiveGame(userId);
    return game || { status: 'NONE' };
  }

  /**
   * Get multiplier table
   * GET /mines/multipliers?mineCount=5
   */
  @Get('multipliers')
  getMultipliers(@Query('mineCount') mineCount: string) {
    const mines = parseInt(mineCount) || 5;
    if (mines < 1 || mines > 24) throw new BadRequestException('Mine count must be 1-24');
    
    const safeTiles = 25 - mines;
    const multipliers: { revealed: number; multiplier: number }[] = [];
    
    for (let i = 1; i <= safeTiles; i++) {
      multipliers.push({
        revealed: i,
        multiplier: this.minesService.calculateMultiplier(mines, i),
      });
    }
    
    return { mineCount: mines, multipliers };
  }

  /**
   * Verify a past game
   * POST /mines/verify
   */
  @Post('verify')
  verifyGame(
    @Body() body: { serverSeed: string; clientSeed: string; nonce: number; mineCount: number },
  ) {
    return this.minesService.verifyGame(body.serverSeed, body.clientSeed, body.nonce, body.mineCount);
  }

  /**
   * Get bet history
   * GET /mines/history
   */
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(@Request() req: any, @Query('limit') limit?: string) {
    const userId = req.user.sub || req.user.id;
    const limitNum = limit ? parseInt(limit) : 20;
    return this.minesService.getHistory(userId, Math.min(limitNum, 100));
  }
}
