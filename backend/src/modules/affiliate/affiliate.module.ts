import { Module } from "@nestjs/common";
import { AffiliateController } from "./affiliate.controller";
import { AffiliateService } from "./affiliate.service";
import { CommissionProcessorService } from "./commission-processor.service";
import { PrismaModule } from "../../prisma/prisma.module";
@Module({
  imports: [PrismaModule],
  controllers: [AffiliateController],
  providers: [AffiliateService, CommissionProcessorService],
  exports: [AffiliateService, CommissionProcessorService],
})
export class AffiliateModule {}
