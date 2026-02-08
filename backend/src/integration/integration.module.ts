import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../modules/auth/auth.module';

@Module({
  imports: [AuthModule], // Import AuthModule to get JwtService
  controllers: [IntegrationController],
  providers: [IntegrationService, PrismaService],
  exports: [IntegrationService],
})
export class IntegrationModule {}
