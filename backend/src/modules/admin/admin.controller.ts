import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Get, Post, Put, Body, Req, Query, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('admin')
@ApiTags('Admin Dashboard')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ============ DASHBOARD STATS (Frontend: /admin/dashboard/stats) ============

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Dashboard stats for frontend admin panel' })
  async getDashboardStats(@Req() req: any) {
    const siteId = req.tenant?.siteId || req.user?.siteId;
    return this.adminService.getStats(siteId);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Brand dashboard with GGR/NGR per brand' })
  async getDashboard(@Req() req: any, @Query('siteId') querySiteId?: string) {
    const siteId = querySiteId || req.tenant?.siteId || req.user?.siteId || 'ALL';
    return this.adminService.getBrandDashboard(siteId);
  }

  @Get('dashboard/all-brands')
  @ApiOperation({ summary: 'All brands overview dashboard' })
  async getAllBrandsDashboard() {
    return this.adminService.getAllBrandsDashboard();
  }

  // ============ FINANCE STATS (Frontend: /admin/finance/stats) ============

  @Get('finance/stats')
  @ApiOperation({ summary: 'Finance stats for frontend admin panel' })
  async getFinanceStats(@Req() req: any) {
    const siteId = req.tenant?.siteId || req.user?.siteId;
    return this.adminService.getFinanceStats(siteId);
  }

  // ============ GAME CONFIG (Frontend: /admin/game/config) ============

  @Get('game/config')
  @ApiOperation({ summary: 'Get game configuration (house edge, bots)' })
  async getGameConfig(@Req() req: any) {
    const siteId = req.tenant?.siteId || req.user?.siteId;
    return this.adminService.getGameConfig(siteId);
  }

  @Post('game/config')
  @ApiOperation({ summary: 'Update game configuration' })
  async updateGameConfig(@Req() req: any, @Body() body: any) {
    const siteId = req.tenant?.siteId || req.user?.siteId;
    return this.adminService.updateGameConfig(siteId, body);
  }

  // ============ TRANSACTIONS (Frontend: /admin/transactions/approve, /admin/deposit/simulate) ============

  @Post('transactions/approve')
  @ApiOperation({ summary: 'Approve a pending transaction' })
  async approveTransaction(@Req() req: any, @Body() body: { transactionId: string }) {
    return this.adminService.approveTransaction(body.transactionId, req.user.id);
  }

  @Post('deposit/simulate')
  @ApiOperation({ summary: 'Simulate a deposit for testing' })
  async simulateDeposit(@Req() req: any, @Body() body: { userId: string; amount: number; currency: string }) {
    return this.adminService.simulateDeposit(body.userId, body.amount, body.currency || 'USDT');
  }

  // ============ HOUSE EDGE MANAGEMENT ============

  @Get('house-edge/:siteId')
  async getHouseEdge(@Param('siteId') siteId: string) {
    return this.adminService.getHouseEdge(siteId);
  }

  @Put('house-edge/:siteId')
  async updateHouseEdge(@Param('siteId') siteId: string, @Body() body: any) {
    return this.adminService.updateHouseEdge(siteId, body);
  }

  // ============ RISK MANAGEMENT ============

  @Get('risk-limits/:siteId')
  async getRiskLimits(@Param('siteId') siteId: string) {
    return this.adminService.getRiskLimits(siteId);
  }

  @Put('risk-limits/:siteId')
  async setRiskLimits(@Param('siteId') siteId: string, @Body() body: any) {
    return this.adminService.setRiskLimits(siteId, body);
  }

  // ============ EXISTING ENDPOINTS ============

  @Get('stats')
  async getStats(@Req() req: any, @Query('siteId') querySiteId?: string) {
    const siteId = querySiteId || req.tenant?.siteId || req.user?.siteId;
    return this.adminService.getStats(siteId);
  }

  @Get('real-stats')
  async getRealStats(@Req() req: any, @Query('siteId') querySiteId?: string) {
    const siteId = querySiteId || req.tenant?.siteId || req.user?.siteId;
    return this.adminService.getRealStats(siteId);
  }

  @Get('users')
  async getUsers(@Req() req: any, @Query('siteId') querySiteId?: string, @Query('limit') limit?: string) {
    const siteId = querySiteId || req.tenant?.siteId || req.user?.siteId;
    return this.adminService.getAllUsers(siteId, limit ? parseInt(limit) : 100);
  }

  @Get('users/pending')
  async getPendingUsers(@Req() req: any, @Query('siteId') querySiteId?: string) {
    const siteId = querySiteId || req.tenant?.siteId || req.user?.siteId;
    return this.adminService.getPendingUsers(siteId);
  }

  @Post('users/:id/approve')
  async approveUser(@Param('id') id: string, @Req() req: any) {
    return this.adminService.approveUser(id, req.user.id);
  }

  @Post('users/:id/ban')
  async banUser(@Param('id') id: string, @Req() req: any) {
    return this.adminService.banUser(id, req.user.id);
  }

  @Post('users/:id/unban')
  async unbanUser(@Param('id') id: string, @Req() req: any) {
    return this.adminService.unbanUser(id, req.user.id);
  }

  @Post('users/:id/verify')
  async sendVerification(@Param('id') id: string, @Req() req: any) {
    return this.adminService.sendVerificationEmail(id, req.user.id);
  }

  @Get('transactions')
  async getTransactions(@Req() req: any, @Query('siteId') querySiteId?: string, @Query('limit') limit?: string) {
    const siteId = querySiteId || req.tenant?.siteId || req.user?.siteId;
    return this.adminService.getTransactions(siteId, limit ? parseInt(limit) : 100);
  }

  @Get('bot-stats')
  async getBotStats(@Req() req: any, @Query('siteId') querySiteId?: string) {
    const siteId = querySiteId || req.tenant?.siteId || req.user?.siteId;
    return this.adminService.getBotStats(siteId);
  }

  // ============ USER DETAIL & BALANCE MANAGEMENT ============

  @Get('users/:id/detail')
  @ApiOperation({ summary: 'Get full user details including IP, bets, transactions' })
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Get('users/:id/bets')
  @ApiOperation({ summary: 'Get user bet history' })
  async getUserBets(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.adminService.getUserBets(id, limit ? parseInt(limit) : 20);
  }

  @Post('users/:id/adjust-balance')
  @ApiOperation({ summary: 'Credit or debit user balance (admin adjustment)' })
  async adjustUserBalance(@Param('id') id: string, @Req() req: any, @Body() body: { amount: number; reason: string }) {
    return this.adminService.adjustUserBalance(id, body.amount, body.reason, req.user.id);
  }

  // ============ WITHDRAWAL MANAGEMENT ============

  @Get('withdrawals')
  @ApiOperation({ summary: 'Get all withdrawal requests' })
  async getWithdrawals(@Req() req: any, @Query('siteId') querySiteId?: string, @Query('status') status?: string, @Query('limit') limit?: string) {
    const siteId = querySiteId || req.tenant?.siteId || req.user?.siteId;
    return this.adminService.getWithdrawals(siteId, status, limit ? parseInt(limit) : 100);
  }

  @Post('withdrawals/:id/approve')
  @ApiOperation({ summary: 'Approve a withdrawal request' })
  async approveWithdrawal(@Param('id') id: string, @Req() req: any) {
    return this.adminService.approveWithdrawal(id, req.user.id);
  }

  @Post('withdrawals/:id/reject')
  @ApiOperation({ summary: 'Reject a withdrawal and refund balance' })
  async rejectWithdrawal(@Param('id') id: string, @Req() req: any, @Body() body: { reason?: string }) {
    return this.adminService.rejectWithdrawal(id, req.user.id, body.reason);
  }

  // ============ GLOBAL GAME HISTORY ============

  @Get('game-history')
  @ApiOperation({ summary: 'Get global game history with filters' })
  async getGameHistory(
    @Req() req: any,
    @Query('siteId') querySiteId?: string,
    @Query('gameType') gameType?: string,
    @Query('minBet') minBet?: string,
    @Query('minWin') minWin?: string,
    @Query('limit') limit?: string,
  ) {
    const siteId = querySiteId || req.tenant?.siteId || req.user?.siteId;
    return this.adminService.getGameHistory(siteId, {
      gameType,
      minBet: minBet ? parseFloat(minBet) : undefined,
      minWin: minWin ? parseFloat(minWin) : undefined,
      limit: limit ? parseInt(limit) : 100,
    });
  }
}
