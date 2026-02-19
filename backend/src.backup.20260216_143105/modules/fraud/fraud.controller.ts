import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Get, Put, Param, Query, Body, Req, UseGuards } from '@nestjs/common';
import { FraudService } from './fraud.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('admin/fraud')
@ApiTags('Fraud Detection')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FraudController {
  constructor(private readonly fraudService: FraudService) {}

  @Get('scan')
  async runScan() {
    return this.fraudService.scanAllBrands();
  }

  @Get('scan/:siteId')
  async scanBrand(@Param('siteId') siteId: string) {
    const alerts = await this.fraudService.scanBrand(siteId);
    return { siteId, newAlerts: alerts };
  }

  @Get('alerts')
  async getAlerts(
    @Req() req: any,
    @Query('siteId') siteId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const site = siteId || req.tenant?.siteId || req.user?.siteId || 'ALL';
    return this.fraudService.getAlerts(site, status, limit ? parseInt(limit) : 50);
  }

  @Put('alerts/:id')
  async updateAlert(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Req() req: any,
  ) {
    return this.fraudService.updateAlertStatus(id, body.status, req.user.id);
  }

  @Get('summary')
  async getSummary(@Req() req: any, @Query('siteId') siteId?: string) {
    const site = siteId || req.tenant?.siteId || req.user?.siteId;
    return this.fraudService.getFraudSummary(site);
  }
}
