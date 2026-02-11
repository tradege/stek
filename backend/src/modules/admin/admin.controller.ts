import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
/**
 * ============================================
 * ADMIN CONTROLLER - Brand Master API
 * ============================================
 */
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

  // ============ BRAND DASHBOARD ============

  @Get('dashboard')
  async getDashboard(@Req() req: any, @Query('siteId') querySiteId?: string) {
    const siteId = querySiteId || req.tenant?.siteId || req.user?.siteId || 'ALL';
    return this.adminService.getBrandDashboard(siteId);
  }

  @Get('dashboard/all-brands')
  async getAllBrandsDashboard() {
    return this.adminService.getAllBrandsDashboard();
  }

  // ============ HOUSE EDGE MANAGEMENT ============

  @Get('house-edge/:siteId')
  async getHouseEdge(@Param('siteId') siteId: string) {
    return this.adminService.getHouseEdge(siteId);
  }

  @Put('house-edge/:siteId')
  async updateHouseEdge(@Param('siteId') siteId: string, @Body() body: { houseEdgeConfig: Record<string, number> }) {
    return this.adminService.updateHouseEdge(siteId, body.houseEdgeConfig);
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

  // ============ EXISTING ENDPOINTS (now tenant-aware) ============

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
}
