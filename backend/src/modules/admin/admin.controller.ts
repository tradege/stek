import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminFinanceService } from './admin-finance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminController {
  constructor(private readonly adminFinanceService: AdminFinanceService) {}

  @Get('finance/stats')
  async getFinanceStats() {
    return this.adminFinanceService.getFinanceStats();
  }

  @Get('dashboard/stats')
  async getDashboardStats() {
    return this.adminFinanceService.getDashboardStats();
  }
}
