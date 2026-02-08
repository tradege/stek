import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminFinanceService } from './admin-finance.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CrashModule } from '../crash/crash.module';

@Module({
  imports: [PrismaModule, CrashModule], // Import CrashModule for GameConfigService
  controllers: [AdminController],
  providers: [AdminService, AdminFinanceService],
  exports: [AdminService, AdminFinanceService],
})
export class AdminModule {}
