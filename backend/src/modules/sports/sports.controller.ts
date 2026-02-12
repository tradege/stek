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
import { BetValidatorService } from './bet-validator.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('api/v1/sports')
export class SportsController {
  constructor(
    private readonly sportsService: SportsOddsService,
    private readonly betValidator: BetValidatorService,
    private readonly prisma: PrismaService,
  ) {}

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
   * Place a sports bet with AI Risk Layer validation
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

    // ═══════════════════════════════════════════
    // STEP 1: Fetch event and market data for validation
    // ═══════════════════════════════════════════
    const event = await this.prisma.sportEvent.findUnique({
      where: { id: body.eventId },
      include: {
        markets: {
          where: { marketType: 'h2h' },
          orderBy: { lastUpdated: 'desc' },
          take: 1,
        },
      },
    });

    if (!event) {
      throw new BadRequestException('Event not found');
    }

    const market = event.markets[0];
    if (!market) {
      throw new BadRequestException('No odds available for this event');
    }

    const outcomes = market.outcomes as Record<string, number>;
    const odds = outcomes[body.selection];
    if (!odds) {
      throw new BadRequestException(`Invalid selection "${body.selection}"`);
    }

    const potentialWin = body.stake * odds;

    // ═══════════════════════════════════════════
    // STEP 2: Run AI Risk Layer validation (7 checks)
    // ═══════════════════════════════════════════
    const validation = await this.betValidator.validateBet(
      userId,
      body.eventId,
      body.selection,
      body.stake,
      odds,
      potentialWin,
      event,
      market,
    );

    if (!validation.approved) {
      throw new BadRequestException({
        message: validation.reason,
        riskLevel: validation.riskLevel,
        checks: validation.checks,
        requiresManualReview: validation.requiresManualReview || false,
      });
    }

    // ═══════════════════════════════════════════
    // STEP 3: Handle 7-second live buffer for in-play bets
    // ═══════════════════════════════════════════
    if (validation.pendingValidation) {
      const bufferSeconds = parseInt(process.env.SPORTS_LIVE_BUFFER_SECONDS || '7');
      await new Promise(resolve => setTimeout(resolve, bufferSeconds * 1000));

      const liveValidation = await this.betValidator.validateLiveBuffer(
        body.eventId,
        body.selection,
        odds,
        userId,
        body.stake,
      );

      if (!liveValidation.approved) {
        throw new BadRequestException({
          message: liveValidation.reason || 'Odds changed during validation',
          riskLevel: liveValidation.riskLevel,
          checks: [...validation.checks, ...liveValidation.checks],
        });
      }
    }

    // ═══════════════════════════════════════════
    // STEP 4: Place the bet (all checks passed)
    // ═══════════════════════════════════════════
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
        validation: {
          riskLevel: validation.riskLevel,
          checksRun: validation.checks.length,
          allPassed: true,
        },
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

  /**
   * GET /api/v1/sports/config
   * Get sports betting configuration
   */
  @Get('config')
  async getConfig() {
    const minBet = parseFloat(process.env.SPORTS_MIN_BET || '1');
    const maxBet = parseFloat(process.env.SPORTS_MAX_BET || '10000');
    const maxPayoutTicket = parseFloat(process.env.SPORTS_MAX_PAYOUT_TICKET || '25000');
    return {
      minBet,
      maxBet,
      maxPayoutPerTicket: maxPayoutTicket,
      currencies: ['USDT'],
      oddsFormats: ['decimal', 'american', 'fractional'],
    };
  }

  /**
   * GET /api/v1/sports/validator/stats
   * Get AI validator stats (public summary)
   */
  @Get('validator/stats')
  async getValidatorStats() {
    return this.betValidator.getValidationStats();
  }
}
