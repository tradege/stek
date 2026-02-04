/**
 * ============================================
 * CRASH MODULE
 * ============================================
 * Main module for the Crash game
 */

import { Module } from '@nestjs/common';
import { CrashService } from './crash.service';
import { CrashGateway } from './crash.gateway';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CrashService, CrashGateway],
  exports: [CrashService],
})
export class CrashModule {}
