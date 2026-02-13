import { ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { Roles } from '../auth/roles.decorator';
import { SuperAdminService } from './super-admin.service';

/**
 * SUPER ADMIN CONTROLLER
 * White-Label Management Console
 * Only accessible by ADMIN role (highest level = Super Admin)
 */
@Controller('api/super-admin')
@ApiTags('Super Admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Roles('ADMIN')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  // ============================================
  // DASHBOARD
  // ============================================

  /**
   * Get Super Admin dashboard stats (all brands overview)
   */
  @Get('dashboard')
  async getDashboardStats() {
    return this.superAdminService.getDashboardStats();
  }

  // ============================================
  // TENANT CRUD
  // ============================================

  /**
   * Get all tenants with stats
   */
  @Get('tenants')
  async getAllTenants() {
    return this.superAdminService.getAllTenants();
  }

  /**
   * Get single tenant details
   */
  @Get('tenants/:id')
  async getTenantById(@Param('id') id: string) {
    return this.superAdminService.getTenantById(id);
  }

  /**
   * Create a new tenant (brand)
   */
  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  async createTenant(@Body() body: {
    brandName: string;
    domain: string;
    ownerEmail: string;
    ownerPassword?: string;
    ownerUsername?: string;
    ggrFee: number;
    allowedGames: string[];
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    cardColor?: string;
    dangerColor?: string;
    logoUrl?: string;
    locale?: string;
    jurisdiction?: string;
    licenseType?: string;
  }) {
    if (!body.brandName || !body.domain || !body.ownerEmail) {
      throw new BadRequestException('brandName, domain, and ownerEmail are required');
    }
    if (body.ggrFee === undefined || body.ggrFee < 0 || body.ggrFee > 100) {
      throw new BadRequestException('ggrFee must be between 0 and 100');
    }
    return this.superAdminService.createTenant(body);
  }

  /**
   * Update tenant configuration
   */
  @Put('tenants/:id')
  async updateTenant(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.superAdminService.updateTenant(id, body);
  }

  /**
   * Toggle tenant active/inactive
   */
  @Post('tenants/:id/toggle-status')
  async toggleTenantStatus(@Param('id') id: string) {
    return this.superAdminService.toggleTenantStatus(id);
  }

  /**
   * Delete a tenant permanently
   */
  @Delete('tenants/:id')
  @HttpCode(HttpStatus.OK)
  async deleteTenant(@Param('id') id: string) {
    return this.superAdminService.deleteTenant(id);
  }


  // ============================================
  // TENANT ADMIN MANAGEMENT
  // ============================================

  /**
   * Get admin info for a tenant
   */
  @Get('tenants/:id/admin')
  async getTenantAdmin(@Param('id') id: string) {
    return this.superAdminService.getTenantAdmin(id);
  }

  /**
   * Create admin for a tenant that doesn't have one
   */
  @Post('tenants/:id/admin')
  async createTenantAdmin(
    @Param('id') id: string,
    @Body() body: { email: string; password: string; username: string },
  ) {
    return this.superAdminService.createTenantAdmin(id, body.email, body.password, body.username);
  }

  /**
   * Reset admin password for a tenant
   */
  @Post('tenants/:id/admin/reset-password')
  async resetAdminPassword(
    @Param('id') id: string,
    @Body() body: { password: string },
  ) {
    return this.superAdminService.resetAdminPassword(id, body.password);
  }

  /**
   * Add credits to tenant admin wallet
   */
  @Post('tenants/:id/admin/credits')
  async addCreditsToAdmin(
    @Param('id') id: string,
    @Body() body: { amount: number; note?: string },
  ) {
    return this.superAdminService.addCreditsToAdmin(id, body.amount, body.note);
  }

  // ============================================
  // BANKROLL MANAGEMENT
  // ============================================

  /**
   * Get bankroll overview for all tenants
   */
  @Get('bankroll')
  async getBankrollOverview() {
    return this.superAdminService.getBankrollOverview();
  }

  /**
   * Get bankroll details for a specific tenant
   */
  @Get('bankroll/:tenantId')
  async getTenantBankroll(@Param('tenantId') tenantId: string) {
    return this.superAdminService.getTenantBankroll(tenantId);
  }

  /**
   * Transfer funds to a tenant's house wallet
   */
  @Post('bankroll/:tenantId/transfer')
  async transferFunds(
    @Param('tenantId') tenantId: string,
    @Body() body: { amount: number; note?: string },
  ) {
    if (!body.amount || body.amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    return this.superAdminService.transferFunds(tenantId, body.amount, body.note);
  }

  /**
   * Get transfer history for a tenant
   */
  @Get('bankroll/:tenantId/history')
  async getTransferHistory(
    @Param('tenantId') tenantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.superAdminService.getTransferHistory(tenantId, parseInt(limit || '50'));
  }

  // ============================================
  // MASTER REPORTS
  // ============================================

  /**
   * Get master report for all brands
   */
  @Get('reports')
  async getMasterReport(
    @Query('period') period?: string, // 'today', 'week', 'month', 'all'
  ) {
    return this.superAdminService.getMasterReport(period || 'all');
  }

  /**
   * Get detailed report for a specific brand
   */
  @Get('reports/:tenantId')
  async getTenantReport(
    @Param('tenantId') tenantId: string,
    @Query('period') period?: string,
  ) {
    return this.superAdminService.getTenantReport(tenantId, period || 'all');
  }

  // ============================================
  // BRAND SETTINGS (for tenant admins)
  // ============================================
  /**
   * Get brand settings for the current admin's site
   */
  @Get('brand-settings')
  async getBrandSettings(@Req() req: any) {
    const user = req.user;
    if (!user.siteId) {
      throw new BadRequestException('No site associated with this admin');
    }
    return this.superAdminService.getTenantBrandSettings(user.siteId, user.id);
  }

  /**
   * Update brand colors for the current admin's site
   */
  @Put('brand-settings')
  async updateBrandSettings(@Req() req: any, @Body() body: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    cardColor?: string;
    dangerColor?: string;
    logoUrl?: string;
    faviconUrl?: string;
    heroImageUrl?: string;
    backgroundImageUrl?: string;
  }) {
    const user = req.user;
    if (!user.siteId) {
      throw new BadRequestException('No site associated with this admin');
    }
    return this.superAdminService.updateTenantColors(user.siteId, user.id, body);
  }

}
