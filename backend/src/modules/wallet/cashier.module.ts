import { Module } from '@nestjs/common';
import { CashierService } from './cashier.service';
import { CashierController, WebhookController } from './cashier.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NowPaymentsModule } from '../nowpayments/nowpayments.module';

@Module({
  imports: [PrismaModule, NowPaymentsModule],
  controllers: [CashierController, WebhookController],
  providers: [CashierService],
  exports: [CashierService],
})
export class CashierModule {}
