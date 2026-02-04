/**
 * ============================================
 * CRASH MODULE
 * ============================================
 * Main module for the Crash game
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CrashService } from './crash.service';
import { CrashGateway } from './crash.gateway';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [CrashService, CrashGateway],
  exports: [CrashService],
})
export class CrashModule {}
