import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DiceService } from './dice.service';
import { DiceController } from './dice.controller';

@Module({
  imports: [PrismaModule],
  controllers: [DiceController],
  providers: [DiceService],
  exports: [DiceService],
})
export class DiceModule {}
