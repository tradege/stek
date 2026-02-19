import { RewardPoolModule } from '../reward-pool/reward-pool.module';
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PublicStatsController } from './public-stats.controller';
import { AdminService } from './admin.service';
import { AdminFinanceService } from './admin-finance.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CrashModule } from '../crash/crash.module';
import { AuditModule } from '../audit/audit.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AdminActivityInterceptor } from '../../common/interceptors/admin-activity.interceptor';

@Module({
  imports: [PrismaModule, CrashModule, AuditModule, RewardPoolModule],
  controllers: [AdminController, PublicStatsController],
  providers: [
    AdminService,
    AdminFinanceService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AdminActivityInterceptor,
    },
  ],
  exports: [AdminService, AdminFinanceService],
})
export class AdminModule {}
