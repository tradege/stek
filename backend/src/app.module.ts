import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { CashierModule } from './modules/wallet/cashier.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
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
    
    // TODO: Add more modules
    // WalletModule,
    // CrashModule,
    // CommissionModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
