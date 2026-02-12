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
import { StuckSessionsCleanupService } from './modules/shared/stuck-sessions-cleanup.service';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';

@Module({
  imports: [
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
    HealthModule,
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
