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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('admin/sports')
@UseGuards(JwtAuthGuard)
export class SportsAdminController {
  constructor(private readonly sportsService: SportsOddsService) {}

  /**
   * GET /api/admin/sports/stats
   * Get sports betting statistics
   */
  @Get('stats')
  async getStats(@Req() req: any) {
    const siteId = req.user.siteId;
    return this.sportsService.getStats(siteId);
  }

  /**
   * GET /api/admin/sports/bets
   * Get all sports bets with filters
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
   * GET /api/admin/sports/events
   * Get all events (admin view with bet counts)
   */
  @Get('events')
  async getEvents(@Query('status') status?: string) {
    return this.sportsService.getUpcomingEvents(status);
  }

  /**
   * POST /api/admin/sports/force-settle
   * Force settle an event with manual scores
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
      return await this.sportsService.forceSettle(
        body.eventId,
        body.homeScore,
        body.awayScore,
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * POST /api/admin/sports/trigger-fetch
   * Manually trigger odds fetch
   */
  @Post('trigger-fetch')
  async triggerFetch() {
    return this.sportsService.triggerFetch();
  }

  /**
   * POST /api/admin/sports/trigger-settlement
   * Manually trigger bet settlement
   */
  @Post('trigger-settlement')
  async triggerSettlement() {
    return this.sportsService.triggerSettlement();
  }

  /**
   * GET /admin/sports/config
   * Get sports betting configuration
   */
  @Get("config")
  @UseGuards(JwtAuthGuard)
  async getConfig() {
    return {
      minBet: parseFloat(process.env.SPORTS_MIN_BET || "1"),
      maxBet: parseFloat(process.env.SPORTS_MAX_BET || "10000"),
    };
  }

  /**
   * PUT /admin/sports/config
   * Update sports betting configuration
   */
  @Put("config")
  @UseGuards(JwtAuthGuard)
  async updateConfig(@Body() body: { minBet?: number; maxBet?: number }) {
    const fs = require("fs");
    const path = require("path");
    const envPath = path.resolve(process.cwd(), "..", ".env");
    let envContent = "";
    try { envContent = fs.readFileSync(envPath, "utf8"); } catch(e) { envContent = ""; }
    
    if (body.minBet !== undefined) {
      process.env.SPORTS_MIN_BET = String(body.minBet);
      if (envContent.includes("SPORTS_MIN_BET=")) {
        envContent = envContent.replace(/SPORTS_MIN_BET=.*/g, "SPORTS_MIN_BET=" + body.minBet);
      } else {
        envContent += "\nSPORTS_MIN_BET=" + body.minBet;
      }
    }
    if (body.maxBet !== undefined) {
      process.env.SPORTS_MAX_BET = String(body.maxBet);
      if (envContent.includes("SPORTS_MAX_BET=")) {
        envContent = envContent.replace(/SPORTS_MAX_BET=.*/g, "SPORTS_MAX_BET=" + body.maxBet);
      } else {
        envContent += "\nSPORTS_MAX_BET=" + body.maxBet;
      }
    }
    try { fs.writeFileSync(envPath, envContent); } catch(e) {}
    
    return {
      success: true,
      minBet: parseFloat(process.env.SPORTS_MIN_BET || "1"),
      maxBet: parseFloat(process.env.SPORTS_MAX_BET || "10000"),
    };
  }
}
