import { VaultModule } from '../vault/vault.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { RewardPoolModule } from '../reward-pool/reward-pool.module';
import { VipModule } from '../vip/vip.module';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CardRushService } from './card-rush.service';
import { CardRushController } from './card-rush.controller';

@Module({
  imports: [
    VaultModule,PrismaModule, VipModule, RewardPoolModule, AffiliateModule],
  controllers: [CardRushController],
  providers: [CardRushService],
  exports: [CardRushService],
})
export class CardRushModule {}
