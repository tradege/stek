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
  Put,
} from '@nestjs/common';
import { SportsOddsService } from './sports-odds.service';
import { BetValidatorService } from './bet-validator.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('admin/sports')
@UseGuards(JwtAuthGuard)
export class SportsAdminController {
  constructor(
    private readonly sportsService: SportsOddsService,
    private readonly betValidator: BetValidatorService,
  ) {}

  /**
   * GET /admin/sports/stats
   */
  @Get('stats')
  async getStats(@Req() req: any) {
    const siteId = req.user.siteId;
    return this.sportsService.getStats(siteId);
  }

  /**
   * GET /admin/sports/bets
   */
  @Get('bets')
  async getAllBets(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const siteId = req.user.siteId;
    return this.sportsService.getAllBets({
      status,
      siteId,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  /**
   * GET /admin/sports/events
   */
  @Get('events')
  async getEvents(@Query('status') status?: string) {
    return this.sportsService.getUpcomingEvents(status);
  }

  /**
   * POST /admin/sports/force-settle
   */
  @Post('force-settle')
  async forceSettle(
    @Body() body: {
      eventId: string;
      homeScore: number;
      awayScore: number;
    },
  ) {
    if (!body.eventId || body.homeScore === undefined || body.awayScore === undefined) {
      throw new BadRequestException('eventId, homeScore, and awayScore are required');
    }
    try {
      return await this.sportsService.forceSettle(body.eventId, body.homeScore, body.awayScore);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * POST /admin/sports/trigger-fetch
   */
  @Post('trigger-fetch')
  async triggerFetch() {
    return this.sportsService.triggerFetch();
  }

  /**
   * POST /admin/sports/trigger-settlement
   */
  @Post('trigger-settlement')
  async triggerSettlement() {
    return this.sportsService.triggerSettlement();
  }

  /**
   * GET /admin/sports/config
   * Get full sports betting configuration including AI Risk Layer
   */
  @Get('config')
  async getConfig() {
    return {
      betting: {
        minBet: parseFloat(process.env.SPORTS_MIN_BET || '1'),
        maxBet: parseFloat(process.env.SPORTS_MAX_BET || '10000'),
      },
      riskLayer: {
        maxPayoutPerTicket: parseFloat(process.env.SPORTS_MAX_PAYOUT_TICKET || '25000'),
        maxPayoutPerDay: parseFloat(process.env.SPORTS_MAX_PAYOUT_DAY || '100000'),
        rateLimitPerMin: parseInt(process.env.SPORTS_RATE_LIMIT_PER_MIN || '5'),
        rateLimitPerHour: parseInt(process.env.SPORTS_RATE_LIMIT_PER_HOUR || '50'),
        liveBufferSeconds: parseInt(process.env.SPORTS_LIVE_BUFFER_SECONDS || '7'),
        oddsChangeThreshold: parseFloat(process.env.SPORTS_ODDS_CHANGE_THRESHOLD || '0.10') * 100 + '%',
        aiValidationEnabled: process.env.SPORTS_AI_VALIDATION !== 'false',
        discordWebhookConfigured: !!process.env.DISCORD_WEBHOOK_URL,
      },
    };
  }

  /**
   * PUT /admin/sports/config
   * Update sports betting and risk layer configuration
   */
  @Put('config')
  async updateConfig(@Body() body: {
    minBet?: number;
    maxBet?: number;
    maxPayoutPerTicket?: number;
    maxPayoutPerDay?: number;
    rateLimitPerMin?: number;
    rateLimitPerHour?: number;
    liveBufferSeconds?: number;
    oddsChangeThreshold?: number;
    aiValidationEnabled?: boolean;
    discordWebhookUrl?: string;
  }) {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.resolve(process.cwd(), '..', '.env');
    let envContent = '';
    try { envContent = fs.readFileSync(envPath, 'utf8'); } catch (e) { envContent = ''; }

    const updateEnv = (key: string, value: string) => {
      process.env[key] = value;
      if (envContent.includes(key + '=')) {
        envContent = envContent.replace(new RegExp(key + '=.*'), key + '=' + value);
      } else {
        envContent += '\n' + key + '=' + value;
      }
    };

    if (body.minBet !== undefined) updateEnv('SPORTS_MIN_BET', String(body.minBet));
    if (body.maxBet !== undefined) updateEnv('SPORTS_MAX_BET', String(body.maxBet));
    if (body.maxPayoutPerTicket !== undefined) updateEnv('SPORTS_MAX_PAYOUT_TICKET', String(body.maxPayoutPerTicket));
    if (body.maxPayoutPerDay !== undefined) updateEnv('SPORTS_MAX_PAYOUT_DAY', String(body.maxPayoutPerDay));
    if (body.rateLimitPerMin !== undefined) updateEnv('SPORTS_RATE_LIMIT_PER_MIN', String(body.rateLimitPerMin));
    if (body.rateLimitPerHour !== undefined) updateEnv('SPORTS_RATE_LIMIT_PER_HOUR', String(body.rateLimitPerHour));
    if (body.liveBufferSeconds !== undefined) updateEnv('SPORTS_LIVE_BUFFER_SECONDS', String(body.liveBufferSeconds));
    if (body.oddsChangeThreshold !== undefined) updateEnv('SPORTS_ODDS_CHANGE_THRESHOLD', String(body.oddsChangeThreshold));
    if (body.aiValidationEnabled !== undefined) updateEnv('SPORTS_AI_VALIDATION', String(body.aiValidationEnabled));
    if (body.discordWebhookUrl !== undefined) updateEnv('DISCORD_WEBHOOK_URL', body.discordWebhookUrl);

    try { fs.writeFileSync(envPath, envContent); } catch (e) {}

    return { success: true, message: 'Configuration updated' };
  }

  /**
   * GET /admin/sports/validator/stats
   * Get AI validator statistics and health
   */
  @Get('validator/stats')
  async getValidatorStats() {
    return this.betValidator.getValidationStats();
  }

  /**
   * GET /admin/sports/validator/alerts
   * Get recent validation alerts
   */
  @Get('validator/alerts')
  async getValidatorAlerts(@Query('limit') limit?: string) {
    return this.betValidator.getRecentAlerts(limit ? parseInt(limit) : 50);
  }

  /**
   * POST /admin/sports/validator/resolve-alert
   * Mark an alert as resolved
   */
  @Post('validator/resolve-alert')
  async resolveAlert(@Body() body: { alertId: string }) {
    if (!body.alertId) {
      throw new BadRequestException('alertId is required');
    }
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.$executeRaw`UPDATE "BetAlert" SET resolved = true WHERE id = ${body.alertId}`;
      await prisma.$disconnect();
      return { success: true };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
