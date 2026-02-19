import { Module } from '@nestjs/common';
import { CashierService } from './cashier.service';
import { CashierController, WebhookController } from './cashier.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CashierController, WebhookController],
  providers: [CashierService],
  exports: [CashierService],
})
export class CashierModule {}
