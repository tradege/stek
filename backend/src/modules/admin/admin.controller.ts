import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminFinanceService } from './admin-finance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { GameConfigService } from '../crash/game-config.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminFinanceService: AdminFinanceService,
    private readonly gameConfigService: GameConfigService,
  ) {}

  // ==========================================
  // EXISTING ENDPOINTS
  // ==========================================

  @Get('finance/stats')
  async getFinanceStats() {
    return this.adminFinanceService.getFinanceStats();
  }

  @Get('dashboard/stats')
  async getDashboardStats() {
    return this.adminFinanceService.getDashboardStats();
  }

  // ==========================================
  // PHASE 32: REAL ANALYTICS (Task 2)
  // ==========================================

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('stats/real')
  async getRealStats() {
    return this.adminService.getRealStats();
  }

  @Get('stats/bots')
  async getBotStats() {
    return this.adminService.getBotStats();
  }

  // ==========================================
  // PHASE 32: GAME CONTROL CENTER (Task 3)
  // Now connected to REAL GameConfigService
  // ==========================================

  @Get('game/config')
  async getGameConfig() {
    const config = this.gameConfigService.getConfig();
    return {
      success: true,
      data: {
        houseEdge: config.houseEdge * 100, // Convert 0.04 -> 4 for display
        instantBust: config.instantBust * 100, // Convert 0.02 -> 2 for display
        botsEnabled: config.botsEnabled,
        maxBotBet: config.maxBotBet,
        minBotBet: config.minBotBet,
        maxBotsPerRound: config.maxBotsPerRound,
      },
    };
  }

  @Post('game/config')
  async updateGameConfig(
    @Body() body: {
      houseEdge?: number;
      instantBust?: number;
      botsEnabled?: boolean;
      maxBotBet?: number;
      minBotBet?: number;
      maxBotsPerRound?: number;
    },
  ) {
    // Convert display values (4%) to decimal (0.04) for GameConfigService
    const updates: any = {};

    if (body.houseEdge !== undefined) {
      // Input is in percentage (1-10), convert to decimal (0.01-0.10)
      updates.houseEdge = body.houseEdge / 100;
    }
    if (body.instantBust !== undefined) {
      updates.instantBust = body.instantBust / 100;
    }
    if (body.botsEnabled !== undefined) {
      updates.botsEnabled = body.botsEnabled;
    }
    if (body.maxBotBet !== undefined) {
      updates.maxBotBet = body.maxBotBet;
    }
    if (body.minBotBet !== undefined) {
      updates.minBotBet = body.minBotBet;
    }
    if (body.maxBotsPerRound !== undefined) {
      updates.maxBotsPerRound = body.maxBotsPerRound;
    }

    const config = this.gameConfigService.updateConfig(updates);

    return {
      success: true,
      message: 'Game configuration updated - changes take effect on next round',
      data: {
        houseEdge: config.houseEdge * 100,
        instantBust: config.instantBust * 100,
        botsEnabled: config.botsEnabled,
        maxBotBet: config.maxBotBet,
        minBotBet: config.minBotBet,
        maxBotsPerRound: config.maxBotsPerRound,
      },
    };
  }

  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  @Get('users')
  async getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Get('users/pending')
  async getPendingUsers() {
    return this.adminService.getPendingUsers();
  }

  @Get('transactions')
  async getTransactions() {
    return this.adminService.getTransactions();
  }
}
