import { VaultModule } from '../vault/vault.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { RewardPoolModule } from '../reward-pool/reward-pool.module';
import { VipModule } from '../vip/vip.module';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { OlympusService } from './olympus.service';
import { OlympusController } from './olympus.controller';

@Module({
  imports: [
    VaultModule,PrismaModule, VipModule, RewardPoolModule, AffiliateModule],
  controllers: [OlympusController],
  providers: [OlympusService],
  exports: [OlympusService],
})
export class OlympusModule {}
