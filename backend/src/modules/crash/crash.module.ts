import { VaultModule } from '../vault/vault.module';
/**
 * ============================================
 * CRASH MODULE
 * ============================================
 * Main module for the Crash game.
 * Now imports AffiliateModule and VipModule for post-bet processing.
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CrashService } from './crash.service';
import { CrashGateway } from './crash.gateway';
import { GameConfigService } from './game-config.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { VipModule } from '../vip/vip.module';

import { RewardPoolModule } from "../reward-pool/reward-pool.module";
@Module({
  imports: [
    VaultModule,
    PrismaModule,
    AffiliateModule,
    VipModule,
    RewardPoolModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [CrashService, CrashGateway, GameConfigService],
  exports: [CrashService, GameConfigService],
})
export class CrashModule {}
