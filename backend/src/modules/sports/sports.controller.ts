import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SportsOddsService } from './sports-odds.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/sports')
export class SportsController {
  constructor(private readonly sportsService: SportsOddsService) {}

  /**
   * GET /api/v1/sports/events
   * Get upcoming events grouped by league
   */
  @Get('events')
  async getEvents(@Query('sport') sportKey?: string) {
    return this.sportsService.getUpcomingEvents(sportKey);
  }

  /**
   * GET /api/v1/sports/events/:id
   * Get a single event with odds and recent bets
   */
  @Get('events/:id')
  async getEvent(@Param('id') id: string) {
    const event = await this.sportsService.getEventById(id);
    if (!event) {
      throw new BadRequestException('Event not found');
    }
    return event;
  }

  /**
   * POST /api/v1/sports/bet
   * Place a sports bet (authenticated)
   */
  @Post('bet')
  @UseGuards(JwtAuthGuard)
  async placeBet(
    @Req() req: any,
    @Body() body: {
      eventId: string;
      selection: string;
      stake: number;
      currency?: string;
    },
  ) {
    const userId = req.user.sub || req.user.id;
    const siteId = req.user.siteId;
    const currency = body.currency || 'USDT';

    if (!body.eventId || !body.selection || !body.stake) {
      throw new BadRequestException('eventId, selection, and stake are required');
    }

    if (body.stake <= 0) {
      throw new BadRequestException('Stake must be positive');
    }

    try {
      const result = await this.sportsService.placeBet(
        userId,
        body.eventId,
        body.selection,
        body.stake,
        currency,
        siteId,
      );
      return {
        success: true,
        bet: result.bet,
        newBalance: result.newBalance,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * GET /api/v1/sports/my-bets
   * Get current user's sport bets
   */
  @Get('my-bets')
  @UseGuards(JwtAuthGuard)
  async getMyBets(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.sub || req.user.id;
    return this.sportsService.getUserBets(
      userId,
      status,
      limit ? parseInt(limit) : 50,
    );
  }

  /**
   * GET /api/v1/sports/status
   * Get service status
   */
  @Get('status')
  async getStatus() {
    return this.sportsService.getStatus();
  }

  /**
   * GET /api/v1/sports/leagues
   * Get supported leagues
   */
  @Get('leagues')
  async getLeagues() {
    return {
      leagues: [
        { key: 'soccer_epl', title: 'Premier League', icon: '⚽', sport: 'Football' },
        { key: 'soccer_uefa_champs_league', title: 'Champions League', icon: '⚽', sport: 'Football' },
        { key: 'basketball_nba', title: 'NBA', icon: '🏀', sport: 'Basketball' },
        { key: 'basketball_euroleague', title: 'Euroleague', icon: '🏀', sport: 'Basketball' },
      ],
    };
  }
}
