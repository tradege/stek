import { Module } from '@nestjs/common';
import { SportsOddsService } from './sports-odds.service';
import { SportsController } from './sports.controller';
import { SportsAdminController } from './sports-admin.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SportsController, SportsAdminController],
  providers: [SportsOddsService],
  exports: [SportsOddsService],
})
export class SportsModule {}
