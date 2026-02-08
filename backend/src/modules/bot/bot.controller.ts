/**
 * ============================================
 * BOT CONTROLLER - Admin API
 * ============================================
 * Endpoints for controlling the bot system
 */

import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { BotService } from './bot.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// DTO for toggle endpoint
class ToggleBotsDto {
  @IsBoolean()
  enable: boolean;
}

@Controller('admin/bots')
export class BotController {
  constructor(private readonly botService: BotService) {}

  /**
   * Toggle bot system on/off
   * POST /admin/bots/toggle
   */
  @Post('toggle')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard) // Uncomment when auth is fully integrated
  toggle(@Body() dto: ToggleBotsDto) {
    return this.botService.toggle(dto.enable);
  }

  /**
   * Get bot system status
   * GET /admin/bots/status
   */
  @Get('status')
  // @UseGuards(JwtAuthGuard)
  getStatus() {
    return this.botService.getStatus();
  }

  /**
   * Manually trigger bot bets (for testing)
   * POST /admin/bots/trigger-bets
   */
  @Post('trigger-bets')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard)
  async triggerBets() {
    return this.botService.triggerBets();
  }

  /**
   * Manually trigger chat message (for testing)
   * POST /admin/bots/trigger-chat
   */
  @Post('trigger-chat')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard)
  triggerChat() {
    return this.botService.triggerChat();
  }
}
