import { VaultModule } from '../vault/vault.module';
import { Module } from '@nestjs/common';
import { VipModule } from '../vip/vip.module';
import { RewardPoolModule } from "../reward-pool/reward-pool.module";
import { AffiliateModule } from "../affiliate/affiliate.module";
import { PlinkoController } from './plinko.controller';
import { PlinkoService } from './plinko.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    VaultModule,PrismaModule, VipModule, RewardPoolModule, AffiliateModule],
  controllers: [PlinkoController],
  providers: [PlinkoService],
  exports: [PlinkoService],
})
export class PlinkoModule {}
