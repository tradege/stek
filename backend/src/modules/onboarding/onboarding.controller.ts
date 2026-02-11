import { Controller, Post, Get, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { OnboardingService, CreateBrandDto } from './onboarding.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('Brand Onboarding')
@ApiBearerAuth()
@Controller('admin/brands')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a new brand (Brand Factory)' })
  @ApiBody({ schema: {
    type: 'object',
    properties: {
      brandName: { type: 'string', example: 'LuckyDragon' },
      domain: { type: 'string', example: 'luckydragon.com' },
      primaryColor: { type: 'string', example: '#ff6600' },
      secondaryColor: { type: 'string', example: '#1a1a2e' },
      houseEdgeConfig: { type: 'object', example: { dice: 0.03, crash: 0.04, mines: 0.03, plinko: 0.03, olympus: 0.04 } },
      maxPayoutPerDay: { type: 'number', example: 50000 },
      botCount: { type: 'number', example: 10 },
    },
    required: ['brandName', 'domain'],
  }})
  async createBrand(@Body() dto: CreateBrandDto) {
    return this.onboardingService.createBrand(dto);
  }

  @Get('list')
  @ApiOperation({ summary: 'List all brands with status' })
  async listBrands() {
    return this.onboardingService.listBrands();
  }

  @Delete(':siteId')
  @ApiOperation({ summary: 'Deactivate a brand (soft delete)' })
  async deactivateBrand(@Param('siteId') siteId: string) {
    return this.onboardingService.deactivateBrand(siteId);
  }

  @Post('clone')
  @ApiOperation({ summary: 'Clone an existing brand to create a new one' })
  async cloneBrand(@Body() body: { sourceSiteId: string; brandName: string; domain: string }) {
    return this.onboardingService.cloneBrand(body.sourceSiteId, body.brandName, body.domain);
  }
}
