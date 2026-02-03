import { Module } from '@nestjs/common';
import { CashierService } from './cashier.service';
import { CashierController, AdminCashierController } from './cashier.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CashierController, AdminCashierController],
  providers: [CashierService],
  exports: [CashierService],
})
export class CashierModule {}
