import { VaultModule } from '../vault/vault.module';
import { Module } from '@nestjs/common';
import { VipModule } from '../vip/vip.module';
import { RewardPoolModule } from "../reward-pool/reward-pool.module";
import { AffiliateModule } from "../affiliate/affiliate.module";
import { PrismaModule } from '../../prisma/prisma.module';
import { DiceService } from './dice.service';
import { DiceController } from './dice.controller';

@Module({
  imports: [
    VaultModule,PrismaModule, VipModule, RewardPoolModule, AffiliateModule],
  controllers: [DiceController],
  providers: [DiceService],
  exports: [DiceService],
})
export class DiceModule {}
