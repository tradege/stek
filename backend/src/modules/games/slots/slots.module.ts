import { VaultModule } from '../../vault/vault.module';
import { AffiliateModule } from '../../affiliate/affiliate.module';
import { RewardPoolModule } from '../../reward-pool/reward-pool.module';
import { VipModule } from '../../vip/vip.module';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { SlotsService } from './slots.service';
import { SlotsController } from './slots.controller';

@Module({
  imports: [
    VaultModule,PrismaModule, VipModule, RewardPoolModule, AffiliateModule],
  controllers: [SlotsController],
  providers: [SlotsService],
  exports: [SlotsService],
})
export class SlotsModule {}
