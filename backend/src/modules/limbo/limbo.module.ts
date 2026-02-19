import { VaultModule } from '../vault/vault.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { RewardPoolModule } from '../reward-pool/reward-pool.module';
import { VipModule } from '../vip/vip.module';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LimboService } from './limbo.service';
import { LimboController } from './limbo.controller';

@Module({
  imports: [
    VaultModule,PrismaModule, VipModule, RewardPoolModule, AffiliateModule],
  controllers: [LimboController],
  providers: [LimboService],
  exports: [LimboService],
})
export class LimboModule {}
