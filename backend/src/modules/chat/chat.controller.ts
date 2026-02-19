import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { RainService } from "./rain.service";
import { TipService } from "./tip.service";
import { TriviaService } from "./trivia.service";
import { socketEventBus } from "../../gateway/socket.integration";

@Controller("admin/chat")
@ApiTags("Chat Admin")
@ApiBearerAuth("JWT")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN", "SUPER_MASTER")
export class ChatAdminController {
  constructor(
    private readonly rainService: RainService,
    private readonly tipService: TipService,
    private readonly triviaService: TriviaService,
  ) {}

  @Post("rain")
  @ApiOperation({ summary: "Start a chat rain event (admin only)" })
  async startRain(
    @Req() req: any,
    @Body() body: { amount: number; numberOfPeople: number },
  ) {
    const result = await this.rainService.startRain(
      body.amount,
      body.numberOfPeople,
      req.user.id,
    );
    // Emit via WebSocket
    socketEventBus.emit("chat:rain", result);
    return result;
  }

  @Post("trivia")
  @ApiOperation({ summary: "Start a trivia round (admin only)" })
  async startTrivia(
    @Body() body: { question: string; answer: string; prize: number },
  ) {
    const result = this.triviaService.startTrivia(body.question, body.answer, body.prize);
    // Emit via WebSocket
    socketEventBus.emit("chat:trivia", result);
    return result;
  }

  @Post("trivia/cancel")
  @ApiOperation({ summary: "Cancel active trivia round (admin only)" })
  async cancelTrivia() {
    const cancelled = this.triviaService.cancelTrivia();
    return { cancelled };
  }

  @Get("trivia/active")
  @ApiOperation({ summary: "Get active trivia round" })
  async getActiveTrivia() {
    return this.triviaService.getActiveRound();
  }
}

@Controller("api/chat")
@ApiTags("Chat")
export class ChatPublicController {
  constructor(private readonly tipService: TipService) {}

  @Post("tip")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Send a tip to another user" })
  async sendTip(
    @Req() req: any,
    @Body() body: { toUsername: string; amount: number; message?: string },
  ) {
    const toUserId = await this.tipService.resolveUsername(body.toUsername);
    if (!toUserId) {
      return { error: "User not found" };
    }
    const result = await this.tipService.sendTip(req.user.id, toUserId, body.amount, body.message);
    // Emit via WebSocket
    socketEventBus.emit("chat:tip", result);
    return result;
  }
}
