import { Injectable, OnModuleInit } from "@nestjs/common";
import { RainService } from "./rain.service";
import { TriviaService } from "./trivia.service";
import { TipService } from "./tip.service";
import { socketEventBus } from "../../gateway/socket.integration";

@Injectable()
export class ChatBridgeService implements OnModuleInit {
  constructor(
    private readonly rainService: RainService,
    private readonly triviaService: TriviaService,
    private readonly tipService: TipService,
  ) {}

  onModuleInit() {
    // Listen for new chat messages from Socket Gateway to check for trivia
    socketEventBus.on("chat:new_message", async (data: { userId: string; username: string; message: string }) => {
      // 1. Check Trivia
      const triviaResult = await this.triviaService.checkAnswer(data.userId, data.username, data.message);
      if (triviaResult) {
        socketEventBus.emit("chat:trivia-winner", {
          id: triviaResult.id,
          winnerId: triviaResult.winnerId,
          winnerUsername: triviaResult.winnerUsername,
          prize: triviaResult.prize,
          question: triviaResult.question,
        });
      }

      // 2. Check for /tip command
      if (data.message.startsWith("/tip ")) {
        this.handleTipCommand(data.userId, data.message);
      }
    });
  }

  private async handleTipCommand(fromUserId: string, message: string) {
    // Format: /tip @username amount
    const parts = message.split(" ").filter(p => p.length > 0);
    if (parts.length < 3) return;

    const username = parts[1].replace("@", "");
    const amount = parseFloat(parts[2]);

    if (isNaN(amount) || amount <= 0) return;

    try {
      const toUserId = await this.tipService.resolveUsername(username);
      if (toUserId) {
        const result = await this.tipService.sendTip(fromUserId, toUserId, amount);
        socketEventBus.emit("chat:tip", result);
      }
    } catch (err) {
      // Fail silently for chat commands
    }
  }
}
