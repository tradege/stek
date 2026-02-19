import { VaultModule } from '../vault/vault.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { RewardPoolModule } from '../reward-pool/reward-pool.module';
import { VipModule } from '../vip/vip.module';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PenaltyService } from './penalty.service';
import { PenaltyController } from './penalty.controller';

@Module({
  imports: [
    VaultModule,PrismaModule, VipModule, RewardPoolModule, AffiliateModule],
  controllers: [PenaltyController],
  providers: [PenaltyService],
  exports: [PenaltyService],
})
export class PenaltyModule {}
