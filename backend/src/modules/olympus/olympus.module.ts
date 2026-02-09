import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { OlympusService } from './olympus.service';
import { OlympusController } from './olympus.controller';

@Module({
  imports: [PrismaModule],
  controllers: [OlympusController],
  providers: [OlympusService],
  exports: [OlympusService],
})
export class OlympusModule {}
