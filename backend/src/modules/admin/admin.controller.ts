import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Get, Post, Put, Delete, Body, Req, Query, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { AdminService } from './admin.service';

const SUPER_ADMIN_EMAIL = 'marketedgepros@gmail.com';

// Helper: enforce siteId for non-super-admins (WL admins can only see their own brand)
function getSecureSiteId(req: any, querySiteId?: string): string | undefined {
  const isSuperAdmin = req.user?.email === SUPER_ADMIN_EMAIL;
  if (isSuperAdmin && querySiteId) {
    return querySiteId;
  }
  // Non-super-admins MUST use their own siteId - cannot override
  return req.user?.siteId || req.tenant?.siteId;
}

// Helper: verify that a target user belongs to the admin's site (tenant boundary enforcement)
async function verifyUserBelongsToSite(prisma: any, userId: string, req: any): Promise<void> {
  const isSuperAdmin = req.user?.email === SUPER_ADMIN_EMAIL;
  if (isSuperAdmin) return; // Super admin can access any user

  const adminSiteId = req.user?.siteId || req.tenant?.siteId;
  if (!adminSiteId) return; // No site restriction

  const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { siteId: true } });
  if (!targetUser) return; // Let the service handle not-found
  if (targetUser.siteId !== adminSiteId) {
    throw new ForbiddenException('You can only manage users belonging to your site');
  }
}

import { AdminFinanceService } from './admin-finance.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('admin')
@ApiTags('Admin Dashboard')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminFinanceService: AdminFinanceService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  // ============ DASHBOARD STATS (Frontend: /admin/dashboard/stats) ============

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Dashboard stats for frontend admin panel' })
  async getDashboardStats(@Req() req: any) {
    const siteId = getSecureSiteId(req);
    return this.adminService.getStats(siteId);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Brand dashboard with GGR/NGR per brand' })
  async getDashboard(@Req() req: any, @Query('siteId') querySiteId?: string) {
    const siteId = getSecureSiteId(req, querySiteId || 'ALL');
    return this.adminService.getBrandDashboard(siteId);
  }

  @Get('dashboard/all-brands')
  @ApiOperation({ summary: 'All brands overview dashboard (super admin only)' })
  async getAllBrandsDashboard(@Req() req: any) {
    const isSuperAdmin = req.user?.email === SUPER_ADMIN_EMAIL;
    if (!isSuperAdmin) {
      throw new ForbiddenException('Only super admin can view all brands');
    }
    return this.adminService.getAllBrandsDashboard();
  }

  // ============ FINANCE STATS (Frontend: /admin/finance/stats) ============

  @Get('finance/stats')
  @ApiOperation({ summary: 'Finance stats for frontend admin panel' })
  async getFinanceStats(@Req() req: any) {
    const siteId = getSecureSiteId(req);
    return this.adminService.getFinanceStats(siteId);
  }

  @Get('stats/financial')
  @ApiOperation({ summary: 'Get financial stats for CFO dashboard' })
  async getFinancialStats(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const isSuperAdmin = req.user?.email === SUPER_ADMIN_EMAIL;
    if (!isSuperAdmin) {
      throw new ForbiddenException('Only super admin can view global financial stats');
    }
    return this.adminFinanceService.getFinancialStats(startDate, endDate);
  }

  // ============ AUDIT LOGS ============

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get admin audit logs' })
  async getAuditLogs(@Req() req: any, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    // WL admins only see their own audit logs
    const siteId = getSecureSiteId(req);
    return this.auditService.getLogs(limit ? parseInt(limit) : 100, offset ? parseInt(offset) : 0, siteId);
  }

  // ============ GAME CONFIG (Frontend: /admin/game/config) ============

  @Get('game/config')
  @ApiOperation({ summary: 'Get game configuration (house edge, bots)' })
  async getGameConfig(@Req() req: any) {
    const siteId = getSecureSiteId(req);
    return this.adminService.getGameConfig(siteId);
  }

  @Post('game/config')
  @ApiOperation({ summary: 'Update game configuration' })
  async updateGameConfig(@Req() req: any, @Body() body: any) {
    const siteId = getSecureSiteId(req);
    return this.adminService.updateGameConfig(siteId, body);
  }

  // ============ TRANSACTIONS ============

  @Post('transactions/approve')
  @ApiOperation({ summary: 'Approve a pending transaction' })
  async approveTransaction(@Req() req: any, @Body() body: { transactionId: string }) {
    // Verify the transaction belongs to the admin's site
    const isSuperAdmin = req.user?.email === SUPER_ADMIN_EMAIL;
    if (!isSuperAdmin) {
      const tx = await this.prisma.transaction.findUnique({
        where: { id: body.transactionId },
        select: { siteId: true },
      });
      const adminSiteId = req.user?.siteId || req.tenant?.siteId;
      if (tx && adminSiteId && tx.siteId !== adminSiteId) {
        throw new ForbiddenException('You can only approve transactions for your site');
      }
    }
    return this.adminService.approveTransaction(body.transactionId, req.user.id);
  }

  @Post('deposit/simulate')
  @ApiOperation({ summary: 'Simulate a deposit - SUPER ADMIN ONLY' })
  async simulateDeposit(@Req() req: any, @Body() body: { userId?: string; userEmail?: string; amount: number; currency: string }) {
    // SECURITY: Only Super Admin (Root) can simulate deposits
    const isSuperAdmin = req.user?.email === SUPER_ADMIN_EMAIL;
    if (!isSuperAdmin) {
      throw new ForbiddenException('Only Root admin can deposit credits. Contact your platform administrator.');
    }
    // Verify the target user belongs to the admin's site
    if (body.userId) {
      await verifyUserBelongsToSite(this.prisma, body.userId, req);
    }
    return this.adminService.simulateDeposit(body.userId, body.amount, body.currency || 'USDT', body.userEmail);
  }

  // ============ HOUSE EDGE MANAGEMENT ============

  @Get('house-edge/:siteId')
  async getHouseEdge(@Param('siteId') paramSiteId: string, @Req() req: any) {
    const siteId = getSecureSiteId(req, paramSiteId);
    return this.adminService.getHouseEdge(siteId);
  }

  @Put('house-edge/:siteId')
  async updateHouseEdge(@Param('siteId') paramSiteId: string, @Req() req: any, @Body() body: any) {
    const siteId = getSecureSiteId(req, paramSiteId);
    return this.adminService.updateHouseEdge(siteId, body);
  }

  // ============ RISK MANAGEMENT ============

  @Get('risk-limits/:siteId')
  async getRiskLimits(@Param('siteId') paramSiteId: string, @Req() req: any) {
    const siteId = getSecureSiteId(req, paramSiteId);
    return this.adminService.getRiskLimits(siteId);
  }

  @Put('risk-limits/:siteId')
  async setRiskLimits(@Param('siteId') paramSiteId: string, @Req() req: any, @Body() body: any) {
    const siteId = getSecureSiteId(req, paramSiteId);
    return this.adminService.setRiskLimits(siteId, body);
  }

  // ============ EXISTING ENDPOINTS ============

  @Get('stats')
  async getStats(@Req() req: any, @Query('siteId') querySiteId?: string) {
    const siteId = getSecureSiteId(req, querySiteId);
    return this.adminService.getStats(siteId);
  }

  @Get('real-stats')
  async getRealStats(@Req() req: any, @Query('siteId') querySiteId?: string) {
    const siteId = getSecureSiteId(req, querySiteId);
    return this.adminService.getRealStats(siteId);
  }

  @Get('users')
  async getUsers(@Req() req: any, @Query('siteId') querySiteId?: string, @Query('limit') limit?: string) {
    const siteId = getSecureSiteId(req, querySiteId);
    return this.adminService.getAllUsers(siteId, limit ? parseInt(limit) : 100);
  }

  @Get('users/pending')
  async getPendingUsers(@Req() req: any, @Query('siteId') querySiteId?: string) {
    const siteId = getSecureSiteId(req, querySiteId);
    return this.adminService.getPendingUsers(siteId);
  }

  @Post('users/:id/approve')
  async approveUser(@Param('id') id: string, @Req() req: any) {
    await verifyUserBelongsToSite(this.prisma, id, req);
    return this.adminService.approveUser(id, req.user.id);
  }

  @Post('users/:id/ban')
  async banUser(@Param('id') id: string, @Req() req: any) {
    await verifyUserBelongsToSite(this.prisma, id, req);
    return this.adminService.banUser(id, req.user.id);
  }

  @Post('users/:id/unban')
  async unbanUser(@Param('id') id: string, @Req() req: any) {
    await verifyUserBelongsToSite(this.prisma, id, req);
    return this.adminService.unbanUser(id, req.user.id);
  }

  @Post('users/:id/verify')
  async sendVerification(@Param('id') id: string, @Req() req: any) {
    await verifyUserBelongsToSite(this.prisma, id, req);
    return this.adminService.sendVerificationEmail(id, req.user.id);
  }

  @Get('transactions')
  async getTransactions(@Req() req: any, @Query('siteId') querySiteId?: string, @Query('limit') limit?: string) {
    const siteId = getSecureSiteId(req, querySiteId);
    return this.adminService.getTransactions(siteId, limit ? parseInt(limit) : 100);
  }

  @Get('bot-stats')
  async getBotStats(@Req() req: any, @Query('siteId') querySiteId?: string) {
    const siteId = getSecureSiteId(req, querySiteId);
    return this.adminService.getBotStats(siteId);
  }

  // ============ USER DETAIL & BALANCE MANAGEMENT ============

  @Get('users/:id/detail')
  @ApiOperation({ summary: 'Get full user details including IP, bets, transactions' })
  async getUserDetail(@Param('id') id: string, @Req() req: any) {
    await verifyUserBelongsToSite(this.prisma, id, req);
    return this.adminService.getUserDetail(id);
  }

  @Get('users/:id/bets')
  @ApiOperation({ summary: 'Get user bet history' })
  async getUserBets(@Param('id') id: string, @Req() req: any, @Query('limit') limit?: string) {
    await verifyUserBelongsToSite(this.prisma, id, req);
    return this.adminService.getUserBets(id, limit ? parseInt(limit) : 20);
  }

  @Get("users/:id/rewards")
  @ApiOperation({ summary: "Get user reward history" })
  async getUserRewards(@Param("id") id: string, @Req() req: any) {
    await verifyUserBelongsToSite(this.prisma, id, req);
    return this.adminService.getUserRewards(id);
  }

  @Get("users/:id/bonus-stats")
  @ApiOperation({ summary: "Get user bonus stats" })
  async getUserBonusStats(@Param("id") id: string, @Req() req: any) {
    await verifyUserBelongsToSite(this.prisma, id, req);
    return this.adminService.getUserBonusStats(id);
  }

  @Get("reward-pool/status")
  @ApiOperation({ summary: "Get reward pool status" })
  async getRewardPoolStatus(@Req() req: any) {
    const siteId = getSecureSiteId(req);
    return this.adminService.getRewardPoolStatus(siteId);
  }

  @Post("reward-pool/distribute-weekly")
  @ApiOperation({ summary: "Trigger weekly reward distribution" })
  async distributeWeekly(@Req() req: any) {
    const siteId = getSecureSiteId(req);
    return this.adminService.distributeWeekly(siteId);
  }

  @Post("reward-pool/distribute-monthly")
  @ApiOperation({ summary: "Trigger monthly reward distribution" })
  async distributeMonthly(@Req() req: any) {
    const siteId = getSecureSiteId(req);
    return this.adminService.distributeMonthly(siteId);
  }

  @Post('users/:id/adjust-balance')
  @ApiOperation({ summary: 'Adjust user balance - SUPER ADMIN ONLY' })
  async adjustUserBalance(@Param('id') id: string, @Req() req: any, @Body() body: { amount: number; reason: string }) {
    // SECURITY: Only Super Admin (Root) can adjust balances
    const isSuperAdmin = req.user?.email === SUPER_ADMIN_EMAIL;
    if (!isSuperAdmin) {
      throw new ForbiddenException('Only Root admin can adjust user balances. Contact your platform administrator.');
    }
    // CRITICAL: Verify the target user belongs to the admin's site
    await verifyUserBelongsToSite(this.prisma, id, req);
    return this.adminService.adjustUserBalance(id, body.amount, body.reason, req.user.id);
  }


  @Delete('users/:id')
  @ApiOperation({ summary: 'Permanently delete a user - ROOT ONLY' })
  async deleteUser(@Param('id') id: string, @Req() req: any) {
    // SECURITY: Only Root (Super Admin) can delete users. Brands can only ban.
    const isSuperAdmin = req.user?.email === SUPER_ADMIN_EMAIL;
    if (!isSuperAdmin) {
      throw new ForbiddenException('Only Root admin can delete users. Use Ban instead.');
    }
    await verifyUserBelongsToSite(this.prisma, id, req);
    return this.adminService.deleteUser(id, req.user.id);
  }

  // ============ WITHDRAWAL MANAGEMENT ============

  @Get('withdrawals')
  @ApiOperation({ summary: 'Get all withdrawal requests' })
  async getWithdrawals(@Req() req: any, @Query('siteId') querySiteId?: string, @Query('status') status?: string, @Query('limit') limit?: string) {
    const siteId = getSecureSiteId(req, querySiteId);
    return this.adminService.getWithdrawals(siteId, status, limit ? parseInt(limit) : 100);
  }

  @Post('withdrawals/:id/approve')
  @ApiOperation({ summary: 'Approve a withdrawal request' })
  async approveWithdrawal(@Param('id') id: string, @Req() req: any) {
    // Verify the withdrawal belongs to the admin's site
    const isSuperAdmin = req.user?.email === SUPER_ADMIN_EMAIL;
    if (!isSuperAdmin) {
      const withdrawal = await this.prisma.transaction.findUnique({
        where: { id },
        select: { siteId: true },
      });
      const adminSiteId = req.user?.siteId || req.tenant?.siteId;
      if (withdrawal && adminSiteId && withdrawal.siteId !== adminSiteId) {
        throw new ForbiddenException('You can only approve withdrawals for your site');
      }
    }
    return this.adminService.approveWithdrawal(id, req.user.id);
  }

  @Post('withdrawals/:id/reject')
  @ApiOperation({ summary: 'Reject a withdrawal and refund balance' })
  async rejectWithdrawal(@Param('id') id: string, @Req() req: any, @Body() body: { reason?: string }) {
    // Verify the withdrawal belongs to the admin's site
    const isSuperAdmin = req.user?.email === SUPER_ADMIN_EMAIL;
    if (!isSuperAdmin) {
      const withdrawal = await this.prisma.transaction.findUnique({
        where: { id },
        select: { siteId: true },
      });
      const adminSiteId = req.user?.siteId || req.tenant?.siteId;
      if (withdrawal && adminSiteId && withdrawal.siteId !== adminSiteId) {
        throw new ForbiddenException('You can only reject withdrawals for your site');
      }
    }
    return this.adminService.rejectWithdrawal(id, req.user.id, body.reason);
  }

  // ============ AFFILIATE SETTINGS ============

  @Get('affiliate/config')
  @ApiOperation({ summary: 'Get affiliate commission configuration' })
  async getAffiliateConfig(@Req() req: any, @Query('siteId') querySiteId?: string) {
    const siteId = getSecureSiteId(req, querySiteId);
    return this.adminService.getAffiliateConfig(siteId);
  }

  @Put('affiliate/config')
  @ApiOperation({ summary: 'Update affiliate commission configuration' })
  async updateAffiliateConfig(@Req() req: any, @Body() body: any, @Query('siteId') querySiteId?: string) {
    const siteId = getSecureSiteId(req, querySiteId);
    return this.adminService.updateAffiliateConfig(siteId, body);
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
    const siteId = getSecureSiteId(req, querySiteId);
    return this.adminService.getGameHistory(siteId, {
      gameType,
      minBet: minBet ? parseFloat(minBet) : undefined,
      minWin: minWin ? parseFloat(minWin) : undefined,
      limit: limit ? parseInt(limit) : 100,
    });
  }
}
