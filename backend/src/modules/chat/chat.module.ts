import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { RainService } from "./rain.service";
import { TipService } from "./tip.service";
import { TriviaService } from "./trivia.service";
import { ChatBridgeService } from "./chat-bridge.service";
import { ChatAdminController, ChatPublicController } from "./chat.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ChatAdminController, ChatPublicController],
  providers: [RainService, TipService, TriviaService, ChatBridgeService],
  exports: [RainService, TipService, TriviaService],
})
export class ChatModule {}
