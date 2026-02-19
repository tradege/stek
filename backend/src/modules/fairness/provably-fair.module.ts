import { Global, Module } from '@nestjs/common';
import { ProvablyFairService } from './provably-fair.service';
import { FairnessController } from './fairness.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [FairnessController],
  providers: [ProvablyFairService],
  exports: [ProvablyFairService],
})
export class ProvablyFairModule {}
