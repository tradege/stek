import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MinesService } from './mines.service';
import { MinesController } from './mines.controller';

@Module({
  imports: [PrismaModule],
  controllers: [MinesController],
  providers: [MinesService],
  exports: [MinesService],
})
export class MinesModule {}
