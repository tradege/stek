import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [IntegrationController],
  providers: [IntegrationService, PrismaService],
  exports: [IntegrationService],
})
export class IntegrationModule {}
