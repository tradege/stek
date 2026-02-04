'use strict';

import {
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AffiliateService } from './affiliate.service';

@Controller('affiliates')
@UseGuards(JwtAuthGuard)
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  /**
   * GET /affiliates/stats
   * Returns user's affiliate statistics including rank, progress, commission, and network
   */
  @Get('stats')
  async getStats(@Request() req) {
    try {
      const userId = req.user.id;
      return await this.affiliateService.getAffiliateStats(userId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch affiliate stats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /affiliates/network
   * Returns detailed network breakdown by tier
   */
  @Get('network')
  async getNetwork(@Request() req) {
    try {
      const userId = req.user.id;
      return await this.affiliateService.getNetworkDetails(userId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch network details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /affiliates/history
   * Returns commission history over time
   */
  @Get('history')
  async getHistory(@Request() req) {
    try {
      const userId = req.user.id;
      return await this.affiliateService.getCommissionHistory(userId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch commission history',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /affiliates/claim
   * Claims available commission to main wallet
   */
  @Post('claim')
  async claimCommission(@Request() req) {
    try {
      const userId = req.user.id;
      return await this.affiliateService.claimCommission(userId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to claim commission',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /affiliates/leaderboard
   * Returns top affiliates leaderboard
   */
  @Get('leaderboard')
  async getLeaderboard() {
    try {
      return await this.affiliateService.getLeaderboard();
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch leaderboard',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
