import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PenaltyService } from './penalty.service';
import { PenaltyController } from './penalty.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PenaltyController],
  providers: [PenaltyService],
  exports: [PenaltyService],
})
export class PenaltyModule {}
