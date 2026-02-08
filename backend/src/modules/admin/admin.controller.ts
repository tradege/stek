import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
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
  // REAL ANALYTICS
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
  // GAME CONTROL CENTER
  // ==========================================
  @Get('game/config')
  async getGameConfig() {
    const config = this.gameConfigService.getConfig();
    return {
      success: true,
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
    const updates: any = {};
    if (body.houseEdge !== undefined) {
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

  @Post('users/:id/approve')
  async approveUser(@Param('id') userId: string, @Req() req: any) {
    const adminId = req.user?.id || req.user?.sub || 'admin';
    return this.adminService.approveUser(userId, adminId);
  }

  @Post('users/:id/ban')
  async banUser(@Param('id') userId: string, @Req() req: any) {
    const adminId = req.user?.id || req.user?.sub || 'admin';
    return this.adminService.banUser(userId, adminId);
  }

  @Post('users/:id/unban')
  async unbanUser(@Param('id') userId: string, @Req() req: any) {
    const adminId = req.user?.id || req.user?.sub || 'admin';
    return this.adminService.unbanUser(userId, adminId);
  }

  @Post('users/:id/send-verification')
  async sendVerification(@Param('id') userId: string, @Req() req: any) {
    const adminId = req.user?.id || req.user?.sub || 'admin';
    return this.adminService.sendVerificationEmail(userId, adminId);
  }

  @Get('transactions')
  async getTransactions() {
    return this.adminService.getTransactions();
  }
}
