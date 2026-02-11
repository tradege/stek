import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantPublicController, TenantAdminController } from './tenant.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TenantPublicController, TenantAdminController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
