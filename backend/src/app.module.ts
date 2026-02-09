import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
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

@Module({
  imports: [
    // Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // Event Emitter for internal events
    EventEmitterModule.forRoot(),
    
    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 500, // 100 requests per minute
    }]),
    
    // Database
    PrismaModule,
    
    // Auth module
    AuthModule,
    
    // Admin module (User management, Stats)
    AdminModule,
    
    // Cashier module (Deposit/Withdraw)
    CashierModule,
    
    // Crash Game module
    CrashModule,
    PlinkoModule,
    DiceModule,
    MinesModule,
    OlympusModule,
    
    // Bot module (Ghost Protocol - Traffic Bots)
    BotModule,
    AffiliateModule,
    
    // External Game Provider Integration
    IntegrationModule,
    
    // Games Catalog API
    GamesModule,
    UsersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
