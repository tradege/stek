import { BonusModule } from './bonus/bonus.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { CashierModule } from './modules/wallet/cashier.module';
import { BotModule } from './modules/bot/bot.module';
import { AffiliateModule } from './modules/affiliate/affiliate.module';
import { VipModule } from './modules/vip/vip.module';
import { IntegrationModule } from './integration/integration.module';
import { CrashModule } from './modules/crash/crash.module';
import { AdminModule } from './modules/admin/admin.module';
import { PlinkoModule } from './modules/plinko/plinko.module';
import { DiceModule } from './modules/dice/dice.module';
import { MinesModule } from './modules/mines/mines.module';
import { OlympusModule } from './modules/olympus/olympus.module';
import { PrismaModule } from './prisma/prisma.module';
import { GamesModule } from './modules/games/games.module';
import { UsersModule } from './modules/users/users.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { FraudModule } from './modules/fraud/fraud.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { HealthModule } from './modules/health/health.module';
import { CardRushModule } from './modules/card-rush/card-rush.module';
import { LimboModule } from './modules/limbo/limbo.module';
import { PenaltyModule } from './modules/penalty/penalty.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { SportsModule } from './modules/sports/sports.module';
import { ChatModule } from './modules/chat/chat.module';
import { RaceModule } from './modules/race/race.module';
import { AuditModule } from './modules/audit/audit.module';
import { EmailModule } from './modules/email/email.module';
import { NowPaymentsModule } from './modules/nowpayments/nowpayments.module';
import { SupportModule } from './modules/support/support.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { RewardPoolModule } from './modules/reward-pool/reward-pool.module';
import { SlotsModule } from './modules/games/slots/slots.module';
import { ProvablyFairModule } from './modules/fairness/provably-fair.module';
import { VaultModule } from './modules/vault/vault.module';
import { StuckSessionsCleanupService } from './modules/shared/stuck-sessions-cleanup.service';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';

@Module({
  imports: [
    BonusModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 500,
    }]),
    PrismaModule,
    TenantModule,
    AuthModule,
    AdminModule,
    CashierModule,
    CrashModule,
    PlinkoModule,
    DiceModule,
    MinesModule,
    OlympusModule,
    BotModule,
    AffiliateModule,
    VipModule,
    IntegrationModule,
    GamesModule,
    UsersModule,
    FraudModule,
    OnboardingModule,
    CardRushModule,
    LimboModule,
    PenaltyModule,
    SuperAdminModule,
    SportsModule,
    ChatModule,
    RaceModule,
    AuditModule,
    EmailModule,
    NowPaymentsModule,
    SupportModule,
    PromotionsModule,
    RewardPoolModule,
    SlotsModule,
    HealthModule,
    ProvablyFairModule,
    VaultModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    StuckSessionsCleanupService,
  ],
})
export class AppModule {}
