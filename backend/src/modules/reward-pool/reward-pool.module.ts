import { Module } from '@nestjs/common';
import { RewardPoolService } from './reward-pool.service';
import { RewardPoolController } from './reward-pool.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RewardPoolController],
  providers: [RewardPoolService],
  exports: [RewardPoolService],
})
export class RewardPoolModule {}
