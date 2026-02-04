import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './modules/auth/auth.module';
import { CashierModule } from './modules/wallet/cashier.module';
import { BotModule } from './modules/bot/bot.module';
import { AffiliateModule } from './modules/affiliate/affiliate.module';
import { CrashModule } from './modules/crash/crash.module';
import { PrismaModule } from './prisma/prisma.module';

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
      limit: 100, // 100 requests per minute
    }]),
    
    // Database
    PrismaModule,
    
    // Auth module
    AuthModule,
    
    // Cashier module (Deposit/Withdraw)
    CashierModule,
    
    // Crash Game module
    CrashModule,
    
    // Bot module (Ghost Protocol - Traffic Bots)
    BotModule,
    AffiliateModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
