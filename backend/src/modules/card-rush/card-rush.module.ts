import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CardRushService } from './card-rush.service';
import { CardRushController } from './card-rush.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CardRushController],
  providers: [CardRushService],
  exports: [CardRushService],
})
export class CardRushModule {}
