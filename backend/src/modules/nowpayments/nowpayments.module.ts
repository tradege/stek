import { Module } from '@nestjs/common';
import { NowPaymentsService } from './nowpayments.service';

@Module({
  providers: [NowPaymentsService],
  exports: [NowPaymentsService],
})
export class NowPaymentsModule {}
