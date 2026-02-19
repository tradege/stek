import { Module } from '@nestjs/common';
import { PlinkoController } from './plinko.controller';
import { PlinkoService } from './plinko.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PlinkoController],
  providers: [PlinkoService],
  exports: [PlinkoService],
})
export class PlinkoModule {}
