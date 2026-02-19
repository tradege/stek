import { VaultModule } from '../vault/vault.module';
import { Module } from '@nestjs/common';
import { VipModule } from '../vip/vip.module';
import { RewardPoolModule } from "../reward-pool/reward-pool.module";
import { AffiliateModule } from "../affiliate/affiliate.module";
import { PrismaModule } from '../../prisma/prisma.module';
import { MinesService } from './mines.service';
import { MinesController } from './mines.controller';

@Module({
  imports: [
    VaultModule,PrismaModule, VipModule, RewardPoolModule, AffiliateModule],
  controllers: [MinesController],
  providers: [MinesService],
  exports: [MinesService],
})
export class MinesModule {}
