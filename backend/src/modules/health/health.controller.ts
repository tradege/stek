import { Controller, Get, UseGuards } from '@nestjs/common';
import { HealthService } from './health.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('System')
@Controller('system')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Public health check (DB, Memory, Platform)' })
  async health() {
    return this.healthService.getHealth();
  }

  @Get('health/detailed')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Detailed health with per-brand stats (Admin only)' })
  async detailedHealth() {
    return this.healthService.getDetailedHealth();
  }
}
