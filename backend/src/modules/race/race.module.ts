import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { RaceService } from "./race.service";
import { RaceController } from "./race.controller";

@Module({
  imports: [PrismaModule],
  controllers: [RaceController],
  providers: [RaceService],
  exports: [RaceService],
})
export class RaceModule {}
