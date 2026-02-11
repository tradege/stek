import { ApiTags } from '@nestjs/swagger';
/**
 * TENANT CONTROLLER - Brand Management API
 * Public endpoint for frontend branding + Admin CRUD
 */
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
} from '@nestjs/common';
import { TenantService, CreateSiteDto, UpdateSiteDto } from './tenant.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

/**
 * PUBLIC tenant endpoint - no auth required
 * Used by frontend to load branding config
 */
@Controller('api/v1/tenants')
@ApiTags('Tenant')
export class TenantPublicController {
  constructor(private readonly tenantService: TenantService) {}

  /**
   * Get brand config by domain (PUBLIC - no auth)
   * GET /api/v1/tenants/by-domain?domain=example.com
   */
  @Get('by-domain')
  async getSiteByDomain(@Query('domain') domain: string) {
    return this.tenantService.getSiteByDomain(domain);
  }
}

/**
 * ADMIN tenant management - requires auth
 */
@Controller('api/v1/tenants')
@ApiTags('Tenant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantAdminController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSite(@Body() body: CreateSiteDto) {
    return this.tenantService.createSite(body);
  }

  @Get()
  async getAllSites() {
    return this.tenantService.getAllSites();
  }

  @Get(':id')
  async getSiteById(@Param('id') id: string) {
    return this.tenantService.getSiteById(id);
  }

  @Put(':id')
  async updateSite(@Param('id') id: string, @Body() body: UpdateSiteDto) {
    return this.tenantService.updateSite(id, body);
  }

  @Delete(':id')
  async deactivateSite(@Param('id') id: string) {
    return this.tenantService.deactivateSite(id);
  }
}
