import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LimboService } from './limbo.service';
import { LimboController } from './limbo.controller';

@Module({
  imports: [PrismaModule],
  controllers: [LimboController],
  providers: [LimboService],
  exports: [LimboService],
})
export class LimboModule {}
